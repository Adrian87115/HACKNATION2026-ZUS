"""ZUSia's verified knowledge: core rules, live engine parameters, ZUS forms and the matching articles of law.

Everything is handed to the model inside <|PROTECTED_INTERNAL_DATA|> in the system instruction of each turn
(never inside the user's message), which is what zusia_persona.txt tells the model to rely on.
"""
import json
import logging
import threading
import time
from pathlib import Path

import requests

from python.config import setting
from python.knowledge.retriever import LegalIndex
from python.knowledge.sources import DATA_DIR
from python.knowledge.vectors import VectorIndex

logger = logging.getLogger(__name__)

CORE_FILE = Path(__file__).resolve().parent / 'core.md'
PARAMS_TTL_SECONDS = 60


class KnowledgeBase:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.core = CORE_FILE.read_text(encoding='utf-8')
        self.index = LegalIndex(data_dir / 'acts.json')
        # OpenAI embeddings of the same fragments; empty (BM25 only) without vectors.npy or an OpenAI key.
        self.vectors = VectorIndex(self.index.chunks, data_dir)
        forms_file = data_dir / 'forms.json'
        self.forms = json.loads(forms_file.read_text(encoding='utf-8')) if forms_file.exists() else []
        self.params_url = setting('ENGINE_PARAMS_URL', f"{setting('BACKEND_API_URL', 'http://127.0.0.1:3000')}/engine/params")
        self.library_url = setting('LIBRARY_URL', f"{setting('BACKEND_API_URL', 'http://127.0.0.1:3000')}/library")
        self._params: tuple[float, dict | None] = (0.0, None)
        self._library: tuple[float, list | None] = (0.0, None)
        self._lock = threading.Lock()
        if not len(self.index):
            logger.warning('No legal texts found in %s – run: .venv/bin/python -m python.knowledge.build', data_dir)

    def engine_params(self) -> dict | None:
        """Benefit engine parameters set in the admin panel (cached for a minute; None when the backend is down)."""
        with self._lock:
            fetched_at, params = self._params
            if time.monotonic() - fetched_at < PARAMS_TTL_SECONDS:
                return params
            try:
                res = requests.get(self.params_url, timeout=2)
                res.raise_for_status()
                params = res.json()
            except (requests.RequestException, ValueError):
                logger.info('Engine parameters unavailable at %s – using the defaults from core.md', self.params_url)
                params = None
            self._params = (time.monotonic(), params)
            return params

    def library(self) -> list | None:
        """Documents managed in the admin panel (forms, acts, guides) with their version history; cached for a minute."""
        with self._lock:
            fetched_at, documents = self._library
            if time.monotonic() - fetched_at < PARAMS_TTL_SECONDS:
                return documents
            try:
                res = requests.get(self.library_url, timeout=2)
                res.raise_for_status()
                documents = res.json().get('documents')
            except (requests.RequestException, ValueError, AttributeError):
                logger.info('Document library unavailable at %s – using the static forms list', self.library_url)
                documents = None
            self._library = (time.monotonic(), documents)
            return documents

    @staticmethod
    def _library_section(documents: list) -> str:
        lines = []
        for d in documents:
            current = d['versions'][0]
            status = 'WYCOFANY' + (f" ({d['withdrawn']['reason']})" if d.get('withdrawn') else '') if d['status'] == 'wycofany' else 'obowiązuje'
            lines.append(f"- [{d['kind']}] {d['fullTitle']} – {status}; aktualna wersja: {current['version']}"
                         f"{' od ' + current['validFrom'] if current.get('validFrom') else ''}; {current['url']}")
            for v in d['versions'][1:]:
                lines.append(f"  - wcześniejsza wersja {v['version']}{' z ' + v['validFrom'] if v.get('validFrom') else ''}"
                             f"{': ' + v['changes'] if v.get('changes') else ''}")
            for a in d.get('amendments', []):
                lines.append(f"  - zmiana: {a['title']} ({a['source']}), w mocy od {a['date']}")
        return ('## Baza dokumentów z historią zmian (zarządzana w panelu administratora – ma pierwszeństwo)\n'
                'Używaj jej, gdy pytanie dotyczy formularzy, wersji przepisów albo tego, jak zmieniały się zasady. '
                'Nie polecaj dokumentów wycofanych – wskaż, co je zastąpiło.\n' + '\n'.join(lines))

    def context(self, question: str) -> str:
        sections = [self.core]

        params = self.engine_params()
        if params:
            sections.append('## Aktualne parametry silnika obliczeń (panel administratora – mają pierwszeństwo)\n'
                            + json.dumps(params, ensure_ascii=False))

        documents = self.library()
        if documents:
            sections.append(self._library_section(documents))
        elif self.forms:
            lines = [f"- {f['code']} – {f['name']}: {f['page']}" for f in self.forms]
            sections.append('## Formularze ZUS (oficjalne wzory na zus.pl)\n' + '\n'.join(lines))

        hits = self.index.search(question, semantic = self.vectors.ranking(question))
        if hits:
            articles = [f"### {h['act']} – art. {h['article']}\nŹródło: {h['source']}\n{h['text']}"
                        if not h['article'].startswith(('§', 'wstęp')) else
                        f"### {h['act']} – {h['article']}\nŹródło: {h['source']}\n{h['text']}" for h in hits]
            sections.append('## Przepisy pasujące do pytania (teksty jednolite z Dziennika Ustaw)\n\n' + '\n\n'.join(articles))

        return '\n\n'.join(sections)
