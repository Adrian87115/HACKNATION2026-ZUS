"""Build the seed of the document library (backend/src/library/library.seed.ts).

Legal acts: the consolidated texts (teksty jednolite) and the amending acts of recent years, from the official
Sejm ELI API (the same data as ISAP) – so the library shows how the rules changed over time.
Forms and guides: the official ZUS forms from KNOWLEDGE_BASE.txt and the official guides used by the app.

Run: .venv/bin/python -m python.knowledge.library_seed
"""
import json
from pathlib import Path

import requests

from python.knowledge.sources import parse_sources

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'backend' / 'src' / 'library' / 'library.seed.ts'
API = 'https://api.sejm.gov.pl/eli/acts'
RETRIEVED = '2026-11-21'
MAX_TEXTS = 6
AMENDMENTS_SINCE = '2022-01-01'
MAX_AMENDMENTS = 10

MANIFEST = Path(__file__).resolve().parent / 'data' / 'documents.json'

# act id → local file from KNOWLEDGE_BASE.txt and section
ACT_FILES = {
    'DU/1999/636': ('prawo/ustawa_zasilkowa_tekst_jednolity_DzU_2026_poz_854.pdf', 'ustawy'),
    'DU/1974/141': ('prawo/kodeks_pracy_tekst_jednolity_DzU_2026_poz_1245.pdf', 'ustawy'),
    'DU/1998/887': ('prawo/ustawa_o_systemie_ubezpieczen_spolecznych_ujednolicona.pdf', 'ustawy'),
    'DU/2016/1860': ('prawo/ustawa_za_zyciem_ujednolicona.pdf', 'ustawy'),
    'DU/2026/1316': ('prawo/rozporzadzenie_dokumenty_do_zasilkow_DzU_2026_poz_1316.pdf', 'rozporzadzenia'),
    'DU/2025/322': ('prawo/rozporzadzenie_wnioski_urlopy_rodzicielskie_DzU_2025_poz_322.pdf', 'rozporzadzenia'),
}

# form code → (section, who fills it in and when)
FORMS = {
    'ZAM': ('wnioski', 'Wniosek o wypłatę zasiłku macierzyńskiego. Składasz go płatnikowi składek albo bezpośrednio w ZUS (np. przy umowie zlecenia lub działalności).'),
    'ZAS-55': ('wnioski', 'Wniosek o zasiłek w wysokości zasiłku macierzyńskiego (m.in. po utracie pracy w ciąży z powodu upadłości lub likwidacji pracodawcy) oraz o zasiłek wyrównawczy.'),
    'ZAS-53': ('wnioski', 'Wniosek o zasiłek chorobowy – gdy zasiłek wypłaca ZUS, a dane z e-ZLA nie wystarczą (np. po ustaniu ubezpieczenia).'),
    'ZPW': ('wnioski', 'Wniosek o wydanie przez ZUS zaświadczenia w sprawie zasiłku, np. o okresach i kwotach wypłaconych świadczeń.'),
    'ZNp-7': ('wnioski', 'Wniosek o świadczenie rehabilitacyjne po wyczerpaniu zasiłku chorobowego (w ciąży – 100% podstawy).'),
    'RWN': ('wnioski', 'Wniosek o zaświadczenie o niezaleganiu w składkach – przydatny przed porodem przy własnej działalności (art. 2a).'),
    'Z-3': ('zaswiadczenia', 'Zaświadczenie wypełnia pracodawca, gdy zasiłek wypłaca ZUS – zawiera wynagrodzenie potrzebne do podstawy zasiłku.'),
    'Z-3a': ('zaswiadczenia', 'Zaświadczenie płatnika dla osób niebędących pracownikami (np. zleceniobiorców) – dane do podstawy zasiłku.'),
    'ZAS-15': ('zaswiadczenia', 'Zaświadczenie płatnika składek o wykorzystanych urlopach macierzyńskim, rodzicielskim i ojcowskim.'),
    'ZAS-24': ('zaswiadczenia', 'Zaświadczenie o okresach wypłaconego lub przysługującego zasiłku macierzyńskiego – np. przy podziale urlopu między rodziców.'),
    'ZAS-12': ('zaswiadczenia', 'Zaświadczenie płatnika składek potrzebne do zasiłku chorobowego lub opiekuńczego za kolejny okres.'),
    'ZAS-40': ('zaswiadczenia', 'Zaświadczenie lekarskie o pobycie matki dziecka w szpitalu – gdy w tym czasie opiekę i zasiłek przejmuje ojciec.'),
    'ZAS-2': ('zaswiadczenia', 'Zaświadczenie lekarskie wystawiane w związku z ciążą (m.in. o przewidywanej dacie porodu).'),
    'ZAS-26': ('oswiadczenia', 'Oświadczenie o przyjęciu dziecka na wychowanie (adopcja, rodzina zastępcza) – do ustalenia prawa do zasiłku macierzyńskiego.'),
    'ZAS-33': ('oswiadczenia', 'Oświadczenie o porzuceniu dziecka przez matkę lub o jej śmierci – gdy zasiłek przejmuje ojciec lub inny członek rodziny.'),
    'ZAS-39': ('oswiadczenia', 'Oświadczenie, że matka dziecka pobiera zasiłek macierzyński w okresie 8 tygodni po porodzie.'),
    'Z-10': ('oswiadczenia', 'Oświadczenie do zasiłku chorobowego lub świadczenia rehabilitacyjnego po ustaniu tytułu ubezpieczenia.'),
}

# act id → (library id, short title, description, topics)
ACTS = [
    ('DU/1999/636', 'ustawa-zasilkowa', 'Ustawa zasiłkowa',
     'Zasady przyznawania i wysokość zasiłku chorobowego, macierzyńskiego i świadczenia rehabilitacyjnego.',
     ['ciaza', 'macierzynski', 'rodzicielski', 'skladki']),
    ('DU/1974/141', 'kodeks-pracy', 'Kodeks pracy',
     'Dział VIII – uprawnienia pracowników związane z rodzicielstwem: urlopy, ochrona przed zwolnieniem, wnioski.',
     ['macierzynski', 'rodzicielski', 'adopcja', 'ciaza']),
    ('DU/1998/887', 'ustawa-o-systemie-ubezpieczen', 'Ustawa o systemie ubezpieczeń społecznych',
     'Kto podlega ubezpieczeniu chorobowemu (obowiązkowo lub dobrowolnie) i jak opłaca się składki.',
     ['skladki']),
    ('DU/2016/1860', 'ustawa-za-zyciem', 'Ustawa „Za życiem”',
     'Wsparcie kobiet w ciąży i rodzin dzieci z ciężkim i nieodwracalnym upośledzeniem lub chorobą zagrażającą życiu.',
     ['ciaza', 'rodzicielski']),
    ('DU/2026/1316', 'rozporzadzenie-dokumenty-do-zasilkow', 'Rozporządzenie o dokumentach do zasiłków',
     'Jakie dokumenty i informacje są potrzebne, żeby ZUS lub płatnik przyznał i wypłacił zasiłek.',
     ['macierzynski', 'ciaza', 'skladki']),
    ('DU/2025/322', 'rozporzadzenie-wnioski-urlopy', 'Rozporządzenie o wnioskach urlopowych',
     'Wzory i zakres wniosków o urlopy związane z rodzicielstwem oraz dokumenty dołączane do wniosków.',
     ['macierzynski', 'rodzicielski', 'adopcja']),
]

FORM_TOPICS = {
    'ZAM': ['macierzynski'], 'Z-3': ['macierzynski', 'ciaza'], 'Z-3a': ['macierzynski', 'ciaza'],
    'ZAS-55': ['ciaza'], 'ZAS-26': ['adopcja'], 'ZAS-33': ['rodzicielski'], 'ZAS-39': ['rodzicielski'],
    'ZAS-40': ['macierzynski'], 'ZAS-15': ['macierzynski', 'rodzicielski'], 'ZAS-24': ['macierzynski'],
    'ZPW': ['skladki'], 'ZAS-53': ['ciaza'], 'Z-10': ['ciaza'], 'ZAS-12': ['ciaza'], 'ZAS-2': ['ciaza'],
    'ZNp-7': ['ciaza'], 'RWN': ['skladki'],
}

GUIDES = [
    ('poradnik-zus-macierzynski', 'Zasiłek macierzyński – poradnik ZUS', 'Kto może dostać zasiłek, ile wynosi i jak o niego wystąpić.',
     'https://www.zus.pl/swiadczenia/zasilki/zasilek-macierzynski', ['macierzynski']),
    ('poradnik-gov-urlop-rodzicielski', 'Urlop rodzicielski – gov.pl (Ministerstwo Rodziny, Pracy i Polityki Społecznej)',
     'Wymiar urlopu rodzicielskiego, podział między rodziców i łączenie z pracą.',
     'https://www.gov.pl/web/rodzina/urlop-rodzicielski', ['rodzicielski']),
    ('poradnik-pip-rodzicielstwo', 'Rodzicielstwo – porady prawne PIP', 'Uprawnienia pracowników-rodziców i obowiązki pracodawcy.',
     'https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo', ['macierzynski', 'rodzicielski', 'ciaza']),
    ('poradnik-zus-chorobowy-ciaza', 'Zasiłek chorobowy – poradnik ZUS', 'Zasiłek w czasie niezdolności do pracy, także w ciąży (100% z kodem „B”).',
     'https://www.zus.pl/swiadczenia/zasilki/zasilek-chorobowy', ['ciaza']),
]


def get(path: str) -> dict:
    response = requests.get(f'{API}/{path}', timeout = 30)
    response.raise_for_status()
    return response.json()


def isap(eli_id: str) -> str:
    _, year, pos = eli_id.split('/')
    return f'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU{year}{int(pos):07d}'


def label(eli_id: str) -> str:
    _, year, pos = eli_id.split('/')
    return f'Dz.U. {year} poz. {pos}'


def local_file(name: str) -> dict | None:
    manifest = json.loads(MANIFEST.read_text(encoding = 'utf-8')) if MANIFEST.exists() else {}
    return manifest.get(name)


def act_entry(eli_id: str, doc_id: str, title: str, description: str, topics: list[str]) -> dict:
    act = get(eli_id)
    refs = act.get('references', {})
    texts = [r['id'] for r in refs.get('Inf. o tekście jednolitym', [])][:MAX_TEXTS]
    versions = []
    for text_id in texts or [eli_id]:
        text = get(text_id)
        versions.append({
            'version': label(text_id),
            'label': 'Tekst jednolity' if texts else 'Tekst ogłoszony',
            'validFrom': text.get('announcementDate') or text.get('promulgation'),
            'url': isap(text_id),
            'changes': '',
            'addedAt': RETRIEVED,
        })
    if not texts:
        versions[0]['validFrom'] = act.get('entryIntoForce') or act.get('announcementDate')

    amendments = sorted(
        (r for r in refs.get('Akty zmieniające', []) if (r.get('date') or '') >= AMENDMENTS_SINCE),
        key = lambda r: r['date'], reverse = True)[:MAX_AMENDMENTS]
    changes = []
    for ref in amendments:
        amending = get(ref['id'])
        changes.append({'date': ref['date'], 'title': amending.get('title', '').strip(), 'source': label(ref['id']), 'url': isap(ref['id'])})

    replaced = [{'source': label(r['id']), 'url': isap(r['id']), 'date': r.get('date')} for r in refs.get('Akty uchylone', [])][:3]

    # newest first; describe what each consolidated text brought: the amendments in force since the previous one
    versions.sort(key = lambda v: v['validFrom'] or '', reverse = True)
    for i, version in enumerate(versions):
        since = versions[i + 1]['validFrom'] if i + 1 < len(versions) else None
        brought = [c for c in changes if since and since <= c['date'] <= (version['validFrom'] or '9999')]
        if brought:
            version['changes'] = 'Uwzględnia zmiany: ' + '; '.join(f"{c['title']} ({c['source']}, w mocy od {c['date']})" for c in brought)
        elif replaced and not texts:
            version['changes'] = 'Zastąpiło: ' + ', '.join(r['source'] for r in replaced)

    file_name, section = ACT_FILES[eli_id]
    versions[0]['file'] = local_file(file_name)
    return {
        'id': doc_id, 'kind': 'akt_prawny', 'code': None, 'title': title, 'fullTitle': act.get('title', '').strip(),
        'description': description, 'topics': topics, 'category': 'prawo', 'section': section,
        'status': 'obowiazujacy', 'pageUrl': isap(eli_id),
        'versions': versions, 'amendments': changes, 'withdrawn': None,
    }


def main() -> None:
    docs = []
    for eli_id, doc_id, title, description, topics in ACTS:
        print('act', eli_id)
        docs.append(act_entry(eli_id, doc_id, title, description, topics))

    _, forms = parse_sources()
    for form in forms:
        docs.append({
            'id': f"formularz-{form['code'].lower()}", 'kind': 'formularz', 'code': form['code'], 'title': form['name'],
            'fullTitle': f"{form['code']} – {form['name']}", 'description': FORMS[form['code']][1],
            'topics': FORM_TOPICS.get(form['code'], []), 'category': 'formularze', 'section': FORMS[form['code']][0],
            'status': 'obowiazujacy', 'pageUrl': form['page'],
            'versions': [{'version': 'wersja z zus.pl', 'label': 'Wzór do druku', 'validFrom': RETRIEVED, 'url': form['download'],
                          'changes': 'Wzór pobrany ze strony ZUS „Wzory formularzy”.', 'addedAt': RETRIEVED,
                          'file': local_file(form['file'])}],
            'amendments': [], 'withdrawn': None,
        })

    for doc_id, title, description, url, topics in GUIDES:
        docs.append({
            'id': doc_id, 'kind': 'poradnik', 'code': None, 'title': title, 'fullTitle': title, 'description': description,
            'topics': topics, 'category': 'poradniki', 'section': 'instytucje', 'status': 'obowiazujacy', 'pageUrl': url,
            'versions': [{'version': '1', 'label': 'Strona oficjalna', 'validFrom': RETRIEVED, 'url': url, 'changes': '', 'addedAt': RETRIEVED}],
            'amendments': [], 'withdrawn': None,
        })

    OUT.parent.mkdir(parents = True, exist_ok = True)
    OUT.write_text(
        '/* Generated by python/knowledge/library_seed.py from the Sejm ELI API and KNOWLEDGE_BASE.txt – do not edit by hand. */\n'
        "import type { LibraryDocument } from './library.types.js';\n\n"
        f'export const LIBRARY_SEED: LibraryDocument[] = {json.dumps(docs, ensure_ascii = False, indent = 2)};\n',
        encoding = 'utf-8')
    print(f'{len(docs)} documents → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
