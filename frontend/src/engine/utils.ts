/** Błąd niepoprawnych danych wejściowych (np. brak wymaganego pola). Warstwa HTTP mapuje go na 400. */
export class EngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineInputError';
  }
}

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parsuje datę w formacie YYYY-MM-DD (UTC, bez stref czasowych). */
export function parseDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new EngineInputError(`Pole "${field}" musi być datą w formacie YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new EngineInputError(`Pole "${field}" zawiera niepoprawną datę.`);
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
    throw new EngineInputError(`Pole "${field}" musi być dodatnią liczbą całkowitą.`);
  }
  return value;
}

export function requireNonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EngineInputError(`Pole "${field}" musi być liczbą nieujemną.`);
  }
  return value;
}
