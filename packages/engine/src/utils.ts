/** Błąd niepoprawnych danych wejściowych (np. brak wymaganego pola). Warstwa HTTP mapuje go na 400. */
export class EngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineInputError';
  }
}

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nazwy pól zrozumiałe dla użytkownika – komunikaty błędów nie mogą pokazywać nazw technicznych. */
const FIELD_LABELS: Record<string, string> = {
  // podstawa wymiaru
  previousBasis: 'Podstawa poprzedniego zasiłku',
  contractMonthlyGross: 'Wynagrodzenie brutto z umowy',
  contractMonthlyBasis: 'Podstawa składek z umowy',
  'months[].grossSalary': 'Wynagrodzenie brutto',
  'months[].contributionBasis': 'Podstawa składek',
  quarterlyBonusesLast4Quarters: 'Premie kwartalne',
  annualBonusesLastYear: 'Premia roczna',
  // urlopy rodzicielskie
  'parents.primary.monthlyBasis': 'Podstawa wymiaru zasiłku – Rodzic 1',
  'parents.secondary.monthlyBasis': 'Podstawa wymiaru zasiłku – Rodzic 2',
  eventDate: 'Data porodu lub przyjęcia dziecka',
  childrenCount: 'Liczba dzieci',
  prenatalWeeks: 'Tygodnie wykorzystane przed porodem',
  'childLoss.survivingChildren': 'Liczba żyjących dzieci',
  'childLoss.dateOfDeath': 'Data zgonu dziecka',
  childBirthDate: 'Data urodzenia dziecka',
  adoptionDecreeDate: 'Data uprawomocnienia przysposobienia',
  'maternityTransfer.weeks': 'Liczba przejmowanych tygodni urlopu macierzyńskiego',
  // świadczenia w ciąży
  monthlyBasis: 'Podstawa wymiaru zasiłku',
  insuranceStartDate: 'Data objęcia ubezpieczeniem',
  expectedBirthDate: 'Przewidywana data porodu',
  previousInsuranceDays: 'Wcześniejsze dni ubezpieczenia',
  previousIncapacityDaysInPregnancy: 'Wcześniejsze dni zwolnienia w tej ciąży',
  employerSickDaysUsedThisYear: 'Dni wynagrodzenia chorobowego w tym roku',
  'incapacity.startDate': 'Początek zwolnienia lekarskiego',
  'incapacity.endDate': 'Koniec zwolnienia lekarskiego',
  'jobLoss.employmentEndDate': 'Data rozwiązania umowy o pracę',
};

const PART_FIELD_LABELS: Record<string, string> = {
  weeks: 'długość',
  workFte: 'wymiar pracy',
  startDate: 'data rozpoczęcia',
};

/** "paternity[0].weeks" -> "Urlop ojcowski, część 1 – długość". */
export function fieldLabel(field: string): string {
  const part = /^(paternity|parentalParts)\[(\d+)\]\.(\w+)$/.exec(field);
  if (part) {
    const leave = part[1] === 'paternity' ? 'Urlop ojcowski' : 'Urlop rodzicielski';
    return `${leave}, część ${Number(part[2]) + 1} – ${PART_FIELD_LABELS[part[3]] ?? part[3]}`;
  }
  return FIELD_LABELS[field] ?? field;
}

/** Data w komunikatach dla użytkownika, np. „3 września 2026”. */
export const formatDatePl = (date: Date): string =>
  date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Parsuje datę w formacie YYYY-MM-DD (UTC, bez stref czasowych). */
export function parseDate(value: string, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new EngineInputError(`Uzupełnij pole „${fieldLabel(field)}” – wybierz datę z kalendarza.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new EngineInputError(`Data w polu „${fieldLabel(field)}” jest niepoprawna – wybierz ją z kalendarza.`);
  }
  return date;
}

export const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

/** Liczba dni od `from` do `to` (to - from). */
export const diffDays = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

export const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
};

export function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new EngineInputError(
      `Pole „${fieldLabel(field)}” musi zawierać liczbę całkowitą większą od zera (np. 1, 2, 3).`,
    );
  }
  return value;
}

export function requireNonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EngineInputError(`Pole „${fieldLabel(field)}” musi zawierać liczbę równą 0 lub większą.`);
  }
  return value;
}
