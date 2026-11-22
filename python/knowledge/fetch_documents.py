"""Download every document listed in "Materiały dodatkowe/KNOWLEDGE_BASE.txt" (legal acts from the Sejm ELI API,
ZUS forms from zus.pl) into frontend/public/dokumenty/, so the knowledge base serves its own copies.

Writes python/knowledge/data/documents.json with size, page count, SHA-256 and the download date of each file –
library_seed.py attaches it to the documents in the library.

Run: .venv/bin/python -m python.knowledge.fetch_documents
"""
import hashlib
import io
import json
import time
from pathlib import Path

import requests
from pypdf import PdfReader

from python.knowledge.sources import DATA_DIR, parse_sources

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = ROOT / 'frontend' / 'public' / 'dokumenty'
MANIFEST = DATA_DIR / 'documents.json'
HEADERS = {'User-Agent': 'Mozilla/5.0 (ZUSia knowledge base fetcher)'}


def fetch(url: str) -> bytes:
    for attempt in range(3):
        try:
            res = requests.get(url, headers = HEADERS, timeout = 60)
            res.raise_for_status()
            if not res.content.startswith(b'%PDF-'):
                raise ValueError(f'not a PDF ({res.headers.get("content-type")})')
            return res.content
        except (requests.RequestException, ValueError) as exc:
            if attempt == 2:
                raise
            print(f'  retry ({exc})')
            time.sleep(2)
    raise RuntimeError('unreachable')


def pages(data: bytes) -> int | None:
    try:
        return len(PdfReader(io.BytesIO(data)).pages)
    except Exception:
        return None


def main() -> None:
    acts, forms = parse_sources()
    manifest = {}
    for entry in [*acts, *forms]:
        target = PUBLIC_DIR / entry['file']
        target.parent.mkdir(parents = True, exist_ok = True)
        print(entry['file'])
        data = fetch(entry['download'])
        target.write_bytes(data)
        manifest[entry['file']] = {
            'path': f"/dokumenty/{entry['file']}",
            'size': len(data),
            'pages': pages(data),
            'sha256': hashlib.sha256(data).hexdigest(),
            'downloadedAt': time.strftime('%Y-%m-%d'),
            'source': entry['download'],
        }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii = False, indent = 2), encoding = 'utf-8')
    total = sum(m['size'] for m in manifest.values())
    print(f'{len(manifest)} files, {total / 1_048_576:.1f} MB → {PUBLIC_DIR.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
