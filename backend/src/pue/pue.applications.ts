/**
 * Simulated e-applications: leave requests sent to the employer, the ZAM application sent to ZUS via PUE/eZUS
 * and the request for a copy of the child's birth certificate sent to the civil registry office (USC) via gov.pl.
 * Checks follow the Labour Code deadlines (Art. 180, 182^1a, 182^1d, 182^3 KP) and Art. 2a / 30a of the benefits act.
 * Problems that ZUS or the employer would raise later are returned as warnings, so the user learns about them now.
 */
import { createHash, randomInt } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { BenefitParams } from '@zus/engine';
import type { Account, InsuranceTitle } from './pue.data.js';

export type ApplicationKind = 'urlop_macierzynski' | 'urlop_rodzicielski' | 'urlop_ojcowski' | 'zam' | 'odpis_aktu_urodzenia';
export type ZamPeriod = 'macierzynski' | 'rodzicielski' | 'ojcowski';
/** Birth certificate copy: short (skrócony) or full (zupełny). */
export type CertificateCopy = 'skrocony' | 'zupelny';
export type CertificateDelivery = 'elektronicznie' | 'odbior_osobisty';

export type ApplicationInput = {
  kind?: unknown;
  startDate?: unknown;
  weeks?: unknown;
  /** Maternity + parental leave requested together within 21 days of the birth (81.5% rate). */
  combined?: unknown;
  /** ZAM: which leave the benefit is for. */
  period?: unknown;
  bankAccount?: unknown;
  /** Birth certificate request: copy type and how to receive it. */
  copyType?: unknown;
  delivery?: unknown;
  confirmed?: unknown;
};

export type Application = {
  id: string;
  number: string;
  kind: ApplicationKind;
  title: string;
  recipient: { type: 'pracodawca' | 'zus' | 'usc'; name: string };
  channel: string;
  submittedAt: string;
  status: 'doreczony' | 'przyjety';
  fields: { label: string; value: string }[];
  warnings: string[];
  upo: { number: string; digest: string } | null;
};

const TITLES: Record<ApplicationKind, string> = {
  urlop_macierzynski: 'Wniosek o udzielenie urlopu macierzyńskiego',
  urlop_rodzicielski: 'Wniosek o udzielenie urlopu rodzicielskiego',
  urlop_ojcowski: 'Wniosek o udzielenie urlopu ojcowskiego',
  zam: 'ZAM – wniosek o zasiłek macierzyński',
  odpis_aktu_urodzenia: 'Wniosek o wydanie odpisu aktu urodzenia',
};
const COPY_LABEL: Record<CertificateCopy, string> = {
  skrocony: 'odpis skrócony',
  zupelny: 'odpis zupełny',
};
const DELIVERY_LABEL: Record<CertificateDelivery, string> = {
  elektronicznie: 'elektronicznie – do skrzynki na koncie gov.pl',
  odbior_osobisty: 'odbiór osobisty w urzędzie stanu cywilnego',
};
const PERIOD_LABEL: Record<ZamPeriod, string> = {
  macierzynski: 'urlopu macierzyńskiego',
  rodzicielski: 'urlopu rodzicielskiego',
  ojcowski: 'urlopu ojcowskiego',
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (v: unknown, field: string): Date => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new BadRequestException(`Podaj poprawną datę: ${field}.`);
  }
  return new Date(`${v}T00:00:00Z`);
};
const plDate = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const addWeeks = (d: Date, weeks: number) => new Date(d.getTime() + weeks * 7 * DAY - DAY);
const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
};

/** Polish IBAN (26 digits, optional „PL” and spaces) with the mod-97 check. */
export function normalizeBankAccount(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/[\s-]/g, '').toUpperCase().replace(/^PL/, '');
  if (!/^\d{26}$/.test(digits)) return null;
  const rearranged = `${digits.slice(2)}2521${digits.slice(0, 2)}`; // „PL” → 25 21
  let rest = 0;
  for (const ch of rearranged) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1 ? digits.replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6 $7') : null;
}

/** Parental leave one parent can take: the pool minus the other parent's 9 non-transferable weeks. */
export function parentalMaxPerParent(params: BenefitParams): number {
  return params.PARENTAL_WEEKS_SINGLE_CHILD - params.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS;
}

/** Request for a copy of the child's birth certificate, filed with the civil registry office via gov.pl. */
function buildCertificateRequest(
  account: Account,
  input: ApplicationInput,
  birth: Date | null,
  name: string,
  now: Date,
): Application {
  if (!birth) {
    throw new BadRequestException('Odpis aktu urodzenia można zamówić po zarejestrowaniu urodzenia dziecka w urzędzie stanu cywilnego.');
  }
  const copyType = input.copyType as CertificateCopy;
  if (!(copyType in COPY_LABEL)) throw new BadRequestException('Wybierz rodzaj odpisu: skrócony albo zupełny.');
  const delivery = input.delivery as CertificateDelivery;
  if (!(delivery in DELIVERY_LABEL)) throw new BadRequestException('Wybierz, jak chcesz odebrać odpis.');

  const fields: Application['fields'] = [
    { label: 'Wnioskodawca', value: `${name}, PESEL ${account.person.peselMasked}` },
    { label: 'Dokument', value: `${COPY_LABEL[copyType]} aktu urodzenia dziecka` },
    { label: 'Data urodzenia dziecka', value: plDate(birth) },
    { label: 'Sposób odbioru', value: DELIVERY_LABEL[delivery] },
  ];
  const warnings: string[] = [];
  if (copyType === 'zupelny') {
    warnings.push('Do wniosków o zasiłek wystarcza zwykle odpis skrócony – zupełny zawiera pełną historię aktu i bywa potrzebny głównie w sprawach sądowych lub za granicą.');
  }
  warnings.push('ZUS może sam pobrać dane o urodzeniu dziecka z rejestru stanu cywilnego – odpis przyda się, jeśli płatnik składek albo ZUS o niego poprosi.');

  const submittedAt = now.toISOString();
  const seq = String(randomInt(100000, 999999));
  const number = `USC/${now.getUTCFullYear()}/${seq}`;
  const digest = createHash('sha256').update(`${number}|${account.id}|${submittedAt}|${JSON.stringify(fields)}`).digest('hex');
  return {
    id: `${account.id}-${seq}`,
    number,
    kind: 'odpis_aktu_urodzenia',
    title: TITLES.odpis_aktu_urodzenia,
    recipient: { type: 'usc', name: `Urząd Stanu Cywilnego – ${account.person.city}` },
    channel: 'gov.pl – rejestr stanu cywilnego',
    submittedAt,
    status: 'przyjety',
    fields,
    warnings,
    upo: { number: `UPP/${now.getUTCFullYear()}/${seq}`, digest: digest.slice(0, 32) },
  };
}

function currentTitle(account: Account, today: string): InsuranceTitle | null {
  return account.insurance.find((t) => t.from <= today && (!t.to || t.to >= today)) ?? null;
}

export function buildApplication(account: Account, input: ApplicationInput, params: BenefitParams, now = new Date()): Application {
  const kind = input.kind as ApplicationKind;
  if (!(kind in TITLES)) throw new BadRequestException('Wybierz rodzaj wniosku.');
  if (input.confirmed !== true) throw new BadRequestException('Potwierdź, że dane we wniosku są zgodne z prawdą.');

  const today = new Date(`${iso(now)}T00:00:00Z`);
  const title = currentTitle(account, iso(today));
  const name = `${account.person.firstName} ${account.person.lastName}`;
  const birth = account.family.childBirthDate ? new Date(`${account.family.childBirthDate}T00:00:00Z`) : null;
  if (kind === 'odpis_aktu_urodzenia') return buildCertificateRequest(account, input, birth, name, now);
  const expected = account.family.expectedBirthDate ? new Date(`${account.family.expectedBirthDate}T00:00:00Z`) : null;
  const start = parseDate(input.startDate, 'od kiedy');
  const daysAhead = Math.round((start.getTime() - today.getTime()) / DAY);
  const warnings: string[] = [];
  const fields: Application['fields'] = [
    { label: 'Wnioskodawca', value: `${name}, PESEL ${account.person.peselMasked}` },
  ];

  const weeksInt = (max: number, min = 1) => {
    const w = Number(input.weeks);
    if (!Number.isInteger(w) || w < min || w > max) throw new BadRequestException(`Liczba tygodni musi wynosić od ${min} do ${max}.`);
    return w;
  };

  // Leave requests go to the employer – only employees have them (Kodeks pracy).
  if (kind !== 'zam') {
    if (title?.type !== 'umowa_o_prace') {
      throw new BadRequestException(
        'Wniosek o urlop składa się do pracodawcy, więc dotyczy tylko umowy o pracę. Przy umowie zlecenia lub działalności złóż od razu wniosek ZAM do ZUS.',
      );
    }
    fields.push({ label: 'Pracodawca', value: title.payer.name });
  }

  if (kind === 'urlop_ojcowski') {
    if (!birth) throw new BadRequestException('Urlop ojcowski przysługuje po urodzeniu dziecka – uzupełnij datę urodzenia w ZUS.');
    const weeks = weeksInt(params.PATERNITY_TOTAL_WEEKS);
    const end = addWeeks(start, weeks);
    const limit = addMonths(birth, params.PATERNITY_MAX_CHILD_AGE_MONTHS_BIRTH);
    if (start < birth) throw new BadRequestException('Urlop ojcowski może zacząć się najwcześniej w dniu urodzenia dziecka.');
    if (end >= limit) {
      throw new BadRequestException(`Urlop ojcowski trzeba wykorzystać do ${plDate(new Date(limit.getTime() - DAY))} (12 miesięcy życia dziecka).`);
    }
    if (daysAhead < 7) {
      warnings.push('Wniosek o urlop ojcowski składa się co najmniej 7 dni przed jego rozpoczęciem (art. 182^3 § 2 KP). Pracodawca może nie udzielić urlopu w tym terminie.');
    }
    fields.push({ label: 'Okres urlopu', value: `${plDate(start)} – ${plDate(end)} (${weeks} tyg.)` });
    fields.push({ label: 'Data urodzenia dziecka', value: plDate(birth) });
  }

  if (kind === 'urlop_rodzicielski') {
    // One parent can use at most the pool minus the other parent's non-transferable weeks (Art. 182^1a § 4 KP).
    const weeks = weeksInt(parentalMaxPerParent(params));
    const end = addWeeks(start, weeks);
    if (daysAhead < 21) {
      warnings.push('Wniosek o urlop rodzicielski składa się co najmniej 21 dni przed jego rozpoczęciem (art. 182^1d § 1 KP). Pracodawca może przesunąć termin.');
    }
    fields.push({ label: 'Okres urlopu', value: `${plDate(start)} – ${plDate(end)} (${weeks} tyg.)` });
    fields.push({ label: 'Zasiłek za ten okres', value: `${Math.round(params.RATE_PARENTAL_70 * 100)}% podstawy wymiaru` });
  }

  if (kind === 'urlop_macierzynski') {
    const max = params.MATERNITY_WEEKS_BY_CHILDREN[1];
    const weeks = weeksInt(max);
    const combined = input.combined === true;
    const reference = birth ?? expected;
    if (reference && start < new Date(reference.getTime() - params.MATERNITY_MAX_PRENATAL_WEEKS * 7 * DAY)) {
      throw new BadRequestException(`Przed porodem można wykorzystać najwyżej ${params.MATERNITY_MAX_PRENATAL_WEEKS} tygodni urlopu macierzyńskiego.`);
    }
    fields.push({ label: 'Okres urlopu macierzyńskiego', value: `od ${plDate(start)}, ${weeks} tyg.` });
    if (combined) {
      const parental = parentalMaxPerParent(params);
      const deadline = birth ? new Date(birth.getTime() + params.COMBINED_APPLICATION_DEADLINE_DAYS * DAY) : null;
      fields.push({
        label: 'Bezpośrednio po nim urlop rodzicielski',
        value: `${parental} tyg. (wniosek łączny – zasiłek ${(params.RATE_COMBINED_21_DAYS * 100).toLocaleString('pl-PL')}% za cały okres)`,
      });
      if (deadline && today > deadline) {
        warnings.push(`Wniosek łączny trzeba było złożyć do ${plDate(deadline)} (21 dni po porodzie, art. 30a ustawy zasiłkowej) – stawka 81,5% nie będzie przysługiwać; za urlop rodzicielski zasiłek wyniesie 70%.`);
      }
    }
  }

  if (kind === 'zam') {
    const period = input.period as ZamPeriod;
    if (!(period in PERIOD_LABEL)) throw new BadRequestException('Wybierz, za jaki okres wnioskujesz o zasiłek.');
    const bank = normalizeBankAccount(input.bankAccount);
    if (!bank) throw new BadRequestException('Numer rachunku jest niepoprawny – sprawdź 26 cyfr numeru konta.');
    const maxWeeks =
      period === 'ojcowski' ? params.PATERNITY_TOTAL_WEEKS : period === 'rodzicielski' ? parentalMaxPerParent(params) : params.MATERNITY_WEEKS_BY_CHILDREN[1];
    const weeks = weeksInt(maxWeeks);
    fields.push({ label: 'Zasiłek macierzyński za okres', value: `${PERIOD_LABEL[period]}: od ${plDate(start)}, ${weeks} tyg.` });
    fields.push({ label: 'Rachunek do wypłaty', value: bank });
    if (title) fields.push({ label: 'Tytuł ubezpieczenia', value: `${title.payer.name}` });

    if (!title || title.sickness === 'brak') {
      warnings.push('Nie masz ubezpieczenia chorobowego – ZUS najpewniej wyda decyzję odmowną. Sprawdź, czy możesz otrzymać świadczenie rodzicielskie (1000 zł/mies.) w gminie.');
    }
    const threshold = Math.round(params.MIN_WAGE_2026_GROSS * params.DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
    if (title?.sickness === 'dobrowolne' && account.debt.amount > threshold) {
      warnings.push(
        `Masz zaległość w składkach (${account.debt.amount.toFixed(2).replace('.', ',')} zł). Jeśli w dniu porodu przekroczy ${threshold.toFixed(2).replace('.', ',')} zł, prawo do zasiłku nie powstanie (art. 2a ustawy zasiłkowej) – spłać ją przed porodem.`,
      );
    }
    if (!birth) warnings.push('Do wniosku dołącz skrócony odpis aktu urodzenia dziecka po porodzie – ZUS pobierze go z rejestru, jeśli dziecko jest już zarejestrowane.');
    if (title?.type === 'umowa_o_prace' && title.payer.over20Insured) {
      warnings.push('Twój pracodawca zgłasza ponad 20 osób, więc to on wypłaca zasiłek – przekażemy wniosek do pracodawcy, a nie bezpośrednio do ZUS.');
    }
  }

  const employerPays = kind !== 'zam' || (title?.type === 'umowa_o_prace' && title.payer.over20Insured);
  const submittedAt = now.toISOString();
  const seq = String(randomInt(100000, 999999));
  const number = employerPays ? `WN/${now.getUTCFullYear()}/${seq}` : `ZUS/PUE/${now.getUTCFullYear()}/${seq}`;
  const digest = createHash('sha256').update(`${number}|${account.id}|${submittedAt}|${JSON.stringify(fields)}`).digest('hex');

  return {
    id: `${account.id}-${seq}`,
    number,
    kind,
    title: TITLES[kind],
    recipient: employerPays ? { type: 'pracodawca', name: title?.payer.name ?? 'pracodawca' } : { type: 'zus', name: 'Zakład Ubezpieczeń Społecznych' },
    channel: employerPays ? 'elektronicznie do pracodawcy' : 'PUE/eZUS',
    submittedAt,
    status: employerPays ? 'doreczony' : 'przyjety',
    fields,
    warnings,
    upo: employerPays ? null : { number: `UPO/${now.getUTCFullYear()}/${seq}`, digest: digest.slice(0, 32) },
  };
}
