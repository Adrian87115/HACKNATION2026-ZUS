"""Build ZUSia's legal knowledge from the sources listed in „Materiały dodatkowe/KNOWLEDGE_BASE.txt”.

Downloads the official texts of the acts (API Sejmu – ELI), extracts the text, splits it into articles
and writes python/knowledge/data/acts.json. The forms from the same file are written to forms.json.
With an OpenAI key (OPENAI_API_KEY / OPEN_AI_KEY) it also embeds the fragments into vectors.npy (see vectors.py).

Run:  .venv/bin/python -m python.knowledge.build
"""
import io
import json
import re
import sys

import requests
from pypdf import PdfReader

from python.knowledge.sources import DATA_DIR, parse_sources
from python.knowledge.vectors import VECTORS_FILE, build_vectors

# Only the parts of the Labour Code that concern parents (Dział VIII) and sick pay (Art. 92) –
# the rest of the code is unrelated and would only add noise to the search.
LABOUR_CODE_SECTIONS = (('DZIAŁ ÓSMY', 'DZIAŁ DZIEWIĄTY'),)
LABOUR_CODE_EXTRA_ARTICLES = {'92'}

PAGE_NOISE = re.compile(r'^(©Kancelaria Sejmu.*|\d{4}-\d{2}-\d{2}|s\. \d+/\d+)\s*$')
ARTICLE_START = re.compile(r'^Art\.\s*(\d+[a-z]?(?:\[\w+\])?)\.\s', re.MULTILINE)
MAX_CHUNK = 5000
PARAGRAPH_START = re.compile(r'\n(?=§ \d+\.)')
SHORT_NAMES = {
    'kodeks_pracy': 'Kodeks pracy',
    'ustawa_zasilkowa': 'ustawa zasiłkowa',
    'ustawa_o_systemie_ubezpieczen_spolecznych': 'ustawa o systemie ubezpieczeń społecznych',
    'ustawa_za_zyciem': 'ustawa „Za życiem”',
    'rozporzadzenie_dokumenty_do_zasilkow': 'rozporządzenie w sprawie dokumentów do zasiłków',
    'rozporzadzenie_wnioski_urlopy_rodzicielskie': 'rozporządzenie w sprawie wniosków o urlopy rodzicielskie',
}


def short_name(file: str) -> str:
    stem = file.rsplit('/', 1)[-1]
    for prefix, name in SHORT_NAMES.items():
        if stem.startswith(prefix):
            return name
    return stem


def download(url: str) -> bytes:
    res = requests.get(url, headers={'User-Agent': 'zusia-knowledge-builder'}, timeout=60)
    res.raise_for_status()
    return res.content


def pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    lines = []
    for page in reader.pages:
        for line in (page.extract_text() or '').splitlines():
            if not PAGE_NOISE.match(line.strip()):
                lines.append(line.rstrip())
    return '\n'.join(lines)


def slice_sections(text: str, sections) -> str:
    parts = []
    for start, end in sections:
        i = text.find(start)
        j = text.find(end, i + 1) if i >= 0 else -1
        if i >= 0:
            parts.append(text[i:j if j > 0 else None])
    return '\n'.join(parts)


def split_articles(text: str) -> list[tuple[str, str]]:
    matches = list(ARTICLE_START.finditer(text))
    articles = []
    for k, m in enumerate(matches):
        end = matches[k + 1].start() if k + 1 < len(matches) else len(text)
        body = re.sub(r'[ \t]+\n', '\n', text[m.start():end]).strip()
        # Superscripts come out as „182[1a]” – write them the way people cite them: „182^1a”.
        number = m.group(1).replace('[', '^').replace(']', '')
        articles.append((number, re.sub(r'\n{2,}', '\n', body)))
    return articles


def split_long(body: str, limit: int = MAX_CHUNK) -> list[str]:
    """Long articles (e.g. definitions) are cut on line breaks, so one search hit stays a readable size."""
    if len(body) <= limit:
        return [body]
    pieces, current = [], ''
    for line in body.splitlines(keepends=True):
        if current and len(current) + len(line) > limit:
            pieces.append(current.strip())
            current = ''
        current += line
    if current.strip():
        pieces.append(current.strip())
    return pieces


def build() -> None:
    acts, forms = parse_sources()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    chunks = []
    for act in acts:
        print(f'↓ {act["title"][:90]}', file=sys.stderr)
        text = pdf_text(download(act['download']))
        name = short_name(act['file'])
        is_labour_code = name == 'Kodeks pracy'
        articles = split_articles(text)
        if is_labour_code:
            wanted = {n for n, _ in split_articles(slice_sections(text, LABOUR_CODE_SECTIONS))}
            articles = [(n, b) for n, b in articles if n in wanted or n in LABOUR_CODE_EXTRA_ARTICLES]
        if not articles:  # regulations without articles numbered at line start – keep whole paragraphs
            parts = [p.strip() for p in PARAGRAPH_START.split(text) if p.strip()]
            articles = [((re.match(r'§ \d+', p) or [f'wstęp {i + 1}'])[0], p) for i, p in enumerate(parts)]
        for number, body in articles:
            pieces = split_long(body)
            for k, piece in enumerate(pieces):
                label = number if len(pieces) == 1 else f'{number} (cz. {k + 1}/{len(pieces)})'
                chunks.append({'act': name, 'article': label, 'source': act['page'], 'text': piece})
        print(f'  {len(articles)} fragmentów', file=sys.stderr)

    (DATA_DIR / 'acts.json').write_text(json.dumps(chunks, ensure_ascii=False, indent=0), encoding='utf-8')
    (DATA_DIR / 'forms.json').write_text(json.dumps(forms, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Zapisano {len(chunks)} fragmentów przepisów i {len(forms)} formularzy w {DATA_DIR}', file=sys.stderr)

    # OpenAI embeddings of the same fragments (semantic search next to BM25); skipped without an OpenAI key.
    if build_vectors(chunks, DATA_DIR):
        print(f'Zapisano embeddingi fragmentów w {DATA_DIR / VECTORS_FILE}', file=sys.stderr)


if __name__ == '__main__':
    build()
