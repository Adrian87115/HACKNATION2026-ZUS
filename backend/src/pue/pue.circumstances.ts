/**
 * Circumstances entered by the user on top of the PUE/eZUS data (e.g. planned due date, a change of job).
 * They are the user's own statement – never mixed with registry data – and are used to tailor calculators,
 * hints and ZUSia's answers. Hints quote the rules they come from (Labour Code, benefits act).
 */
import { BadRequestException } from '@nestjs/common';
import type { BenefitParams } from '@zus/engine';
import type { Account } from './pue.data.js';

export const EMPLOYMENT_CHANGES = [
  'brak',
  'nowa_umowa_o_prace',
  'umowa_zlecenia',
  'dzialalnosc',
  'koniec_umowy_na_czas_okreslony',
  'likwidacja_pracodawcy',
  'wypowiedzenie',
] as const;
export type EmploymentChange = (typeof EMPLOYMENT_CHANGES)[number];

export type Circumstances = {
  expectedBirthDate: string | null;
  expectedChildren: number;
  employmentChange: EmploymentChange;
  employmentChangeDate: string | null;
  notes: string;
  updatedAt: string | null;
};

export type CircumstancesView = Circumstances & { hints: string[] };

export const EMPTY_CIRCUMSTANCES: Circumstances = {
  expectedBirthDate: null,
  expectedChildren: 1,
  employmentChange: 'brak',
  employmentChangeDate: null,
  notes: '',
  updatedAt: null,
};

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(v: unknown, label: string): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !ISO.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new BadRequestException(`Podaj poprawną datę w polu „${label}”.`);
  }
  return new Date(`${v}T00:00:00Z`);
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const plDate = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function normalizeCircumstances(input: Record<string, unknown> | null | undefined, now = new Date()): Circumstances {
  const body = input ?? {};
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const due = parseDate(body.expectedBirthDate, 'Przewidywana data porodu');
  if (due && (due.getTime() < today - 60 * DAY || due.getTime() > today + 300 * DAY)) {
    throw new BadRequestException('Przewidywana data porodu powinna przypadać w ciągu najbliższych 10 miesięcy.');
  }

  const children = body.expectedChildren === undefined || body.expectedChildren === null ? 1 : Number(body.expectedChildren);
  if (!Number.isInteger(children) || children < 1 || children > 5) {
    throw new BadRequestException('Liczba dzieci powinna wynosić od 1 do 5.');
  }

  const change = (body.employmentChange ?? 'brak') as EmploymentChange;
  if (!EMPLOYMENT_CHANGES.includes(change)) throw new BadRequestException('Wybierz zmianę sytuacji zawodowej z listy.');
  const changeDate = change === 'brak' ? null : parseDate(body.employmentChangeDate, 'Data zmiany');
  if (change !== 'brak' && !changeDate) throw new BadRequestException('Podaj datę zmiany sytuacji zawodowej.');

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > 500) throw new BadRequestException('Uwagi mogą mieć maksymalnie 500 znaków.');

  return {
    expectedBirthDate: iso(due),
    expectedChildren: children,
    employmentChange: change,
    employmentChangeDate: iso(changeDate),
    notes,
    updatedAt: now.toISOString(),
  };
}

/** Due date the app should use: the user's own entry wins over the one in the account. */
export function effectiveDueDate(account: Account, c: Circumstances): string | null {
  return c.expectedBirthDate ?? account.family.expectedBirthDate;
}

/** What the entered circumstances mean for benefits – plain-language hints with the legal basis. */
export function circumstanceHints(account: Account, c: Circumstances, params: BenefitParams): string[] {
  const hints: string[] = [];
  const dueIso = effectiveDueDate(account, c);
  const due = dueIso ? new Date(`${dueIso}T00:00:00Z`) : null;
  const mother = account.role === 'mother';

  if (c.expectedChildren > 1) {
    const maternity = params.MATERNITY_WEEKS_BY_CHILDREN[Math.min(c.expectedChildren, 5)];
    hints.push(
      `Przy ${c.expectedChildren} dzieciach z jednego porodu urlop macierzyński wynosi ${maternity} tygodni, a rodzicielski ` +
        `${params.PARENTAL_WEEKS_MULTIPLE_CHILDREN} tygodni (art. 180 § 1 i art. 182^1a § 1 Kodeksu pracy).`,
    );
  }

  const changeDate = c.employmentChangeDate ? new Date(`${c.employmentChangeDate}T00:00:00Z`) : null;
  switch (c.employmentChange) {
    case 'koniec_umowy_na_czas_okreslony': {
      if (!mother || !due || !changeDate) {
        hints.push('Umowa na czas określony kończy się w ustalonym terminie. Zasiłek macierzyński przysługuje, jeśli w dniu porodu podlegasz ubezpieczeniu chorobowemu.');
        break;
      }
      // pregnancy start ≈ 280 days before the due date; the end of the 3rd month ≈ 3 months later
      const start = new Date(due.getTime() - 280 * DAY);
      const thirdMonthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate()));
      if (changeDate > thirdMonthEnd && changeDate < due) {
        hints.push(
          `Umowa kończy się ${plDate(changeDate)}, czyli po trzecim miesiącu ciąży – zostanie przedłużona do dnia porodu ` +
            '(art. 177 § 3 Kodeksu pracy), a zasiłek macierzyński przysługuje także po jej ustaniu (art. 30 ust. 4 ustawy zasiłkowej). ' +
            'Wyjątek: umowa zawarta na zastępstwo nie jest przedłużana (art. 177 § 3^1 KP). Przekaż pracodawcy zaświadczenie o ciąży.',
        );
      } else if (changeDate <= thirdMonthEnd) {
        hints.push(
          `Umowa kończy się ${plDate(changeDate)}, przed upływem trzeciego miesiąca ciąży, więc nie zostanie przedłużona. ` +
            'Po ustaniu ubezpieczenia zasiłek macierzyński co do zasady nie przysługuje – rozważ nowe zatrudnienie albo dobrowolne ubezpieczenie chorobowe (np. z działalności).',
        );
      }
      break;
    }
    case 'likwidacja_pracodawcy':
      hints.push(
        'Jeśli w ciąży stracisz pracę z powodu upadłości lub likwidacji pracodawcy i nie dostaniesz innego zatrudnienia, do dnia porodu ' +
          'przysługuje Ci zasiłek w wysokości zasiłku macierzyńskiego, a po porodzie – zasiłek macierzyński; wypłaca je ZUS ' +
          '(art. 30 ust. 1 pkt 1 i ust. 3 ustawy zasiłkowej).',
      );
      break;
    case 'wypowiedzenie':
      hints.push(
        mother
          ? 'W ciąży pracodawca nie może wypowiedzieć ani rozwiązać umowy o pracę, poza zwolnieniem dyscyplinarnym za zgodą związków zawodowych albo likwidacją lub upadłością firmy ' +
              '(art. 177 § 1 i § 4 KP). Odwołaj się do sądu pracy w ciągu 21 dni – bezpłatnie doradzi Państwowa Inspekcja Pracy.'
          : 'Od dnia złożenia wniosku o urlop ojcowski lub rodzicielski do jego końca pracodawca nie może wypowiedzieć umowy (art. 177 § 1 KP). ' +
              'Odwołaj się do sądu pracy w ciągu 21 dni – bezpłatnie doradzi Państwowa Inspekcja Pracy.',
      );
      break;
    case 'nowa_umowa_o_prace':
      hints.push(
        'Z umowy o pracę podlegasz ubezpieczeniu chorobowemu od pierwszego dnia. Zasiłek macierzyński nie wymaga okresu wyczekiwania, ' +
          `zasiłek chorobowy przysługuje po ${params.SICKNESS_WAITING_DAYS_MANDATORY} dniach ubezpieczenia (art. 4 ust. 1 ustawy zasiłkowej). ` +
          'Podstawę zasiłku ustali się z wynagrodzenia z nowej umowy.',
      );
      break;
    case 'umowa_zlecenia':
    case 'dzialalnosc':
      hints.push(
        `${c.employmentChange === 'dzialalnosc' ? 'Przy działalności gospodarczej' : 'Przy umowie zlecenia'} ubezpieczenie chorobowe jest dobrowolne – ` +
          'zgłoś się do niego od początku. Zasiłek macierzyński przysługuje, jeśli podlegasz mu w dniu porodu (bez okresu wyczekiwania), ' +
          `a zasiłek chorobowy – po ${params.SICKNESS_WAITING_DAYS_VOLUNTARY} dniach nieprzerwanego ubezpieczenia (art. 4 ust. 1 pkt 2 ustawy zasiłkowej).` +
          (c.employmentChange === 'dzialalnosc' ? ' Pilnuj terminowego opłacania składek – zaległość powyżej 1% płacy minimalnej wstrzymuje wypłatę (art. 2a).' : ''),
      );
      break;
    case 'brak':
      break;
  }

  if (c.expectedBirthDate && account.family.expectedBirthDate && c.expectedBirthDate !== account.family.expectedBirthDate) {
    hints.push('Przewidywana data porodu różni się od daty z zaświadczenia lekarskiego na koncie – ZUS i pracodawca przyjmą datę z dokumentów.');
  }
  return hints;
}
