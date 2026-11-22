"""Parse the source index „Materiały dodatkowe/KNOWLEDGE_BASE.txt” (acts and ZUS forms with official links)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES_FILE = ROOT / 'Materiały dodatkowe' / 'KNOWLEDGE_BASE.txt'
DATA_DIR = Path(__file__).resolve().parent / 'data'

FIELD = re.compile(r'^(Plik|Akt|Formularz|Strona aktu|Strona|Pobrano z):\s*(.+)$')


def parse_sources(path: Path = SOURCES_FILE) -> tuple[list[dict], list[dict]]:
    """Return (acts, forms). Each entry keeps the title, the official page and the direct download link."""
    acts, forms, entry = [], [], {}

    def flush():
        if 'file' not in entry:
            return
        if 'act' in entry:
            acts.append({'file': entry['file'], 'title': entry['act'], 'page': entry.get('page'), 'download': entry.get('download')})
        elif 'form' in entry:
            code, _, name = entry['form'].partition(' – ')
            forms.append({'file': entry['file'], 'code': code.strip(), 'name': name.strip() or code.strip(), 'page': entry.get('page'),
                          'download': entry.get('download')})

    for line in path.read_text(encoding='utf-8').splitlines():
        m = FIELD.match(line.strip())
        if not m:
            continue
        key, value = m.groups()
        if key == 'Plik':
            flush()
            entry = {'file': value.strip()}
        elif key == 'Akt':
            entry['act'] = value.strip()
        elif key == 'Formularz':
            entry['form'] = value.strip()
        elif key in ('Strona aktu', 'Strona'):
            entry['page'] = value.strip()
        elif key == 'Pobrano z':
            entry['download'] = value.strip()
    flush()
    return acts, forms
