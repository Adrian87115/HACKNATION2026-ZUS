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

logger = logging.getLogger(__name__)

CORE_FILE = Path(__file__).resolve().parent / 'core.md'
PARAMS_TTL_SECONDS = 60


class KnowledgeBase:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.core = CORE_FILE.read_text(encoding='utf-8')
        self.index = LegalIndex(data_dir / 'acts.json')
        forms_file = data_dir / 'forms.json'
        self.forms = json.loads(forms_file.read_text(encoding='utf-8')) if forms_file.exists() else []
        self.params_url = setting('ENGINE_PARAMS_URL', f"{setting('BACKEND_API_URL', 'http://127.0.0.1:3000')}/engine/params")
        self._params: tuple[float, dict | None] = (0.0, None)
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

    def context(self, question: str) -> str:
        sections = [self.core]

        params = self.engine_params()
        if params:
            sections.append('## Aktualne parametry silnika obliczeń (panel administratora – mają pierwszeństwo)\n'
                            + json.dumps(params, ensure_ascii=False))

        if self.forms:
            lines = [f"- {f['code']} – {f['name']}: {f['page']}" for f in self.forms]
            sections.append('## Formularze ZUS (oficjalne wzory na zus.pl)\n' + '\n'.join(lines))

        hits = self.index.search(question)
        if hits:
            articles = [f"### {h['act']} – art. {h['article']}\nŹródło: {h['source']}\n{h['text']}"
                        if not h['article'].startswith(('§', 'wstęp')) else
                        f"### {h['act']} – {h['article']}\nŹródło: {h['source']}\n{h['text']}" for h in hits]
            sections.append('## Przepisy pasujące do pytania (teksty jednolite z Dziennika Ustaw)\n\n' + '\n\n'.join(articles))

        return '\n\n'.join(sections)
