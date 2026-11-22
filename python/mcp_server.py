"""MCP server of ZUSia: read-only tools for the signed-in user's PUE/eZUS data, the screen they are on,
benefit parameters and the document library.

Served over Streamable HTTP at /mcp (python/main.py). Each request identifies the user with headers:
  Authorization: Bearer <PUE session token>   – the backend returns data of that one account only,
  X-Zusia-Session: <chat session id>          – which screen snapshot belongs to the conversation.
Without a token the account tools answer that the user is not signed in – there is no way to ask for
somebody else's data. No tool changes anything (the assistant is advisory only).
"""
import logging
import threading
import time
from typing import Any

import httpx

from mcp.server.mcpserver import Context, MCPServer
from mcp.types import ToolAnnotations

from python.config import setting

logger = logging.getLogger(__name__)

BACKEND = setting('BACKEND_API_URL', 'http://127.0.0.1:3000').rstrip('/')
READ_ONLY = ToolAnnotations(readOnlyHint = True, destructiveHint = False, idempotentHint = True, openWorldHint = False)
NOT_SIGNED_IN = {
    'zalogowany': False,
    'komunikat': 'Użytkownik nie jest zalogowany – brak dostępu do danych z konta ZUS. '
                 'Zaproponuj logowanie przez mObywatel (symulacja) w prawym górnym rogu strony.',
}

server = MCPServer(
    name = 'zusia-pue',
    title = 'ZUSia – dane z PUE/eZUS',
    instructions = (
        'Narzędzia tylko do odczytu dla asystentki ZUSia. Zwracają dane wyłącznie zalogowanej osoby (token sesji '
        'mObywatel/PUE w nagłówku Authorization), ekran, na którym jest użytkownik, parametry zasiłków i bazę dokumentów. '
        'Żadne narzędzie niczego nie zmienia na koncie.'
    ),
)


# ---------------------------------------------------------------------------
#  Screen snapshots (in memory only, never stored with the conversation)
# ---------------------------------------------------------------------------

class ScreenStore:
    """Latest screen the user had open when sending a message, per chat session (kept for an hour)."""

    TTL = 3600

    def __init__(self):
        self._items: dict[str, tuple[float, str]] = {}
        self._lock = threading.Lock()

    def put(self, session_id: str, screen: str | None) -> None:
        if not screen:
            return
        with self._lock:
            now = time.monotonic()
            self._items = {k: v for k, v in self._items.items() if now - v[0] < self.TTL}
            self._items[session_id] = (now, screen[:20_000])

    def get(self, session_id: str | None) -> str | None:
        with self._lock:
            item = self._items.get(session_id or '')
            return item[1] if item and time.monotonic() - item[0] < self.TTL else None

    def forget(self, session_id: str) -> None:
        with self._lock:
            self._items.pop(session_id, None)


screens = ScreenStore()


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _header(ctx: Context, name: str) -> str | None:
    headers = ctx.headers or {}
    return headers.get(name) or headers.get(name.lower())


def _token(ctx: Context) -> str | None:
    auth = _header(ctx, 'authorization') or ''
    return auth[7:].strip() or None if auth.startswith('Bearer ') else None


async def _backend(path: str, token: str | None = None, method: str = 'GET', body: Any = None) -> Any:
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    async with httpx.AsyncClient(timeout = 5) as client:
        res = await client.request(method, f'{BACKEND}{path}', headers = headers, json = body)
    if res.status_code == 401:
        raise PermissionError('Sesja użytkownika wygasła – poproś o ponowne zalogowanie.')
    res.raise_for_status()
    return res.json()


async def _account(ctx: Context) -> dict | None:
    token = _token(ctx)
    if not token:
        return None
    return await _backend('/pue/me', token)


def _current_title(account: dict) -> dict | None:
    today = time.strftime('%Y-%m-%d')
    active = [t for t in account['insurance'] if t['from'] <= today and (not t['to'] or t['to'] >= today)]
    return (active or sorted(account['insurance'], key = lambda t: t['from'], reverse = True) or [None])[0]


async def _params() -> dict:
    return await _backend('/engine/params')


# ---------------------------------------------------------------------------
#  Tools – the signed-in user's account
# ---------------------------------------------------------------------------

@server.tool(annotations = READ_ONLY)
async def get_user_profile(ctx: Context) -> dict:
    """Podstawowe dane zalogowanego użytkownika z PUE/eZUS: imię, rola (matka/ojciec), miasto, zamaskowany PESEL,
    przewidywana data porodu i data urodzenia dziecka. Użyj na początku rozmowy o sytuacji użytkownika."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    c = account.get('circumstances') or {}
    return {
        'zalogowany': True,
        'imie': account['person']['firstName'],
        'rola': 'matka' if account['role'] == 'mother' else 'ojciec',
        'miasto': account['person']['city'],
        'pesel': account['person']['peselMasked'],
        'przewidywana_data_porodu': c.get('expectedBirthDate') or account['family']['expectedBirthDate'],
        'data_urodzenia_dziecka': account['family']['childBirthDate'],
        'zrodlo': 'PUE/eZUS (symulacja) oraz okoliczności podane przez użytkownika',
    }


@server.tool(annotations = READ_ONLY)
async def get_insurance(ctx: Context) -> dict:
    """Tytuły ubezpieczenia zalogowanego użytkownika (umowa o pracę, zlecenie, działalność), czy podlega
    ubezpieczeniu chorobowemu (obowiązkowo/dobrowolnie/brak) i kto wypłaca zasiłki (płatnik powyżej 20 osób albo ZUS)."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    current = _current_title(account)
    return {
        'aktualny_tytul': current and current['type'],
        'ubezpieczenie_chorobowe': current['sickness'] if current else 'brak tytułu ubezpieczenia',
        'tytuly': [
            {
                'rodzaj': t['type'],
                'platnik': t['payer']['name'],
                'od': t['from'],
                'do': t['to'],
                'ubezpieczenie_chorobowe': t['sickness'],
                'pelny_etat': t.get('fullTime'),
                'zasilki_wyplaca': None if t['type'] == 'dzialalnosc' else ('płatnik (ponad 20 ubezpieczonych)' if t['payer']['over20Insured'] else 'ZUS'),
            }
            for t in account['insurance']
        ],
    }


@server.tool(annotations = READ_ONLY)
async def get_contributions(ctx: Context) -> dict:
    """Przychody i podstawy składki chorobowej z ostatnich 12 miesięcy oraz zadłużenie składkowe zalogowanego
    użytkownika z informacją, czy zaległość blokuje wypłatę zasiłku (art. 2a ustawy zasiłkowej)."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    params = await _params()
    threshold = round(params['MIN_WAGE_2026_GROSS'] * params['DEBT_EXCLUSION_MIN_WAGE_RATIO'], 2)
    current = _current_title(account)
    return {
        'miesiace': [{'miesiac': m['month'], 'przychod_brutto': m['gross'], 'podstawa_skladki_chorobowej': m['sicknessBasis']}
                     for m in account['contributionBases']],
        'zadluzenie': account['debt']['amount'],
        'zadluzenie_na_dzien': account['debt']['asOf'],
        'prog_art_2a': threshold,
        'blokuje_wyplate': bool(current and current['sickness'] == 'dobrowolne' and account['debt']['amount'] > threshold),
    }


@server.tool(annotations = READ_ONLY)
async def calculate_my_benefit_basis(ctx: Context) -> dict:
    """Wylicza podstawę wymiaru zasiłku zalogowanego użytkownika z jego przychodów w ZUS (silnik obliczeń ZUSi,
    parametry z panelu administratora) oraz miesięczne kwoty zasiłku przy stawkach 100%, 81,5%, 80% i 70%.
    Użyj, gdy użytkownik pyta, ile wyniesie jego zasiłek."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    current = _current_title(account)
    if not current or not account['contributionBases']:
        return {'komunikat': 'Brak danych o przychodach – podstawy nie da się wyliczyć.'}
    if current['type'] == 'umowa_o_prace':
        body = {'kind': 'employee', 'fullTime': current.get('fullTime', True),
                'months': [{'grossSalary': m['gross']} for m in account['contributionBases']]}
    else:
        body = {'kind': 'non_employee', 'months': [{'contributionBasis': m['sicknessBasis']} for m in account['contributionBases']]}
    result = await _backend('/engine/basis', method = 'POST', body = body)
    params = await _params()
    monthly = result['monthlyBasis']
    rates = {'100%': 1, '81,5%': params['RATE_COMBINED_21_DAYS'], '80%': params['RATE_SICKNESS_STANDARD'], '70%': params['RATE_PARENTAL_70']}
    return {
        'podstawa_miesieczna': monthly,
        'podstawa_dzienna': result['dailyBasis'],
        'liczba_miesiecy': result['monthsCounted'],
        'zastosowane_zasady': result['appliedRules'],
        'zasilek_miesiecznie': {label: round(monthly * rate, 2) for label, rate in rates.items()},
        'uwaga': 'Kwoty brutto przed zaliczką na podatek; ostateczną kwotę ustala ZUS lub płatnik.',
    }


@server.tool(annotations = READ_ONLY)
async def get_sick_leaves(ctx: Context) -> dict:
    """Zwolnienia lekarskie e-ZLA zalogowanego użytkownika, w tym z kodem „B” (ciąża – zasiłek 100%)."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    return {'zwolnienia': [{'numer': z['number'], 'od': z['from'], 'do': z['to'], 'kod_B_ciaza': z['pregnancyCodeB'],
                            'wystawil': z['issuer'], 'status': z['status']} for z in account['eZla']]}


@server.tool(annotations = READ_ONLY)
async def get_benefits(ctx: Context) -> dict:
    """Świadczenia wypłacone lub w toku dla zalogowanego użytkownika (zasiłek chorobowy, macierzyński, wynagrodzenie chorobowe)."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    return {'swiadczenia': [{'rodzaj': b['type'], 'od': b['from'], 'do': b['to'], 'status': b['status'],
                             'kwota': b['amount'], 'wyplaca': 'ZUS' if b['paidBy'] == 'zus' else 'płatnik'} for b in account['benefits']]}


@server.tool(annotations = READ_ONLY)
async def get_applications(ctx: Context) -> dict:
    """Wnioski wysłane z konta zalogowanego użytkownika (urlopy, ZAM, odpis aktu urodzenia): numer, adresat, status,
    okresy urlopów i ostrzeżenia. Użytkownik składa je sam – Ty możesz tylko je omówić."""
    token = _token(ctx)
    if not token:
        return NOT_SIGNED_IN
    applications = await _backend('/pue/me/applications', token)
    return {'wnioski': [{'tytul': a['title'], 'numer': a['number'], 'wyslano': a['submittedAt'], 'adresat': a['recipient']['name'],
                         'status': a['status'], 'pola': a['fields'], 'urlopy': a.get('leaves', []), 'ostrzezenia': a['warnings']}
                        for a in applications]}


@server.tool(annotations = READ_ONLY)
async def get_circumstances(ctx: Context) -> dict:
    """Okoliczności wpisane samodzielnie przez użytkownika (deklaracja, nie dane z ZUS): przewidywana data porodu,
    liczba dzieci z jednego porodu, zmiana sytuacji zawodowej, uwagi – wraz z podpowiedziami prawnymi."""
    account = await _account(ctx)
    if account is None:
        return NOT_SIGNED_IN
    c = account.get('circumstances') or {}
    if not c.get('updatedAt'):
        return {'uzupelnione': False, 'komunikat': 'Użytkownik nie wpisał dodatkowych okoliczności (może to zrobić w „Moim koncie”).'}
    return {'uzupelnione': True, **{k: v for k, v in c.items() if k != 'updatedAt'}}


# ---------------------------------------------------------------------------
#  Tools – where the user is and public data
# ---------------------------------------------------------------------------

@server.tool(annotations = READ_ONLY)
async def get_current_screen(ctx: Context) -> dict:
    """Ekran, który użytkownik ma teraz otwarty w aplikacji: adres i tytuł strony, wartości wpisane w formularzu
    i widoczna treść. Użyj, gdy pytanie dotyczy „tego”, co widzi (formularz wniosku, wynik kalkulatora, dokument)."""
    screen = screens.get(_header(ctx, 'x-zusia-session'))
    if not screen:
        return {'komunikat': 'Brak informacji o ekranie użytkownika.'}
    return {'ekran': screen}


@server.tool(annotations = READ_ONLY)
async def get_benefit_parameters() -> dict:
    """Aktualne parametry zasiłków (stawki, kwoty, wymiary urlopów) ustawione w panelu administratora – mają
    pierwszeństwo przed wartościami z pamięci."""
    return await _params()


@server.tool(annotations = READ_ONLY)
async def search_documents(query: str, kind: str | None = None) -> dict:
    """Szuka w bazie wiedzy ZUSi: formularzy ZUS, przepisów (z historią wersji i aktami zmieniającymi) i poradników.
    `query` – np. „ZAM”, „zasiłek chorobowy”, „Kodeks pracy”; `kind` – opcjonalnie formularz, akt_prawny albo poradnik."""
    data = await _backend('/library')
    q = query.lower().strip()
    hits = [d for d in data['documents']
            if (not kind or d['kind'] == kind) and (not q or q in f"{d.get('code') or ''} {d['fullTitle']} {d['description']}".lower())]
    return {'dokumenty': [{
        'tytul': d['fullTitle'], 'rodzaj': d['kind'], 'status': d['status'], 'wycofany': d.get('withdrawn'),
        'aktualna_wersja': d['versions'][0], 'wczesniejsze_wersje': d['versions'][1:6], 'akty_zmieniajace': d.get('amendments', [])[:6],
        'strona': d['pageUrl'],
    } for d in hits[:8]]}
