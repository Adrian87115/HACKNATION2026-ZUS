import { DEFAULT_PARAMS_2026, type BenefitParams } from './params.js';

/** Validation of parameter overrides sent from the admin panel. Messages are user-facing (Polish). */
export class ParamsValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join(' '));
    this.problems = problems;
  }
}

const INTEGER_KEY = /(WEEKS|DAYS|MONTHS|YEARS|PARTS|COUNT|GRAMS|_DAY)$|_DAYS_|_WEEKS_|_MONTHS_|_YEARS_/;
const FRACTION_KEY = /^RATE_|_RATE$|_RATIO$|_FTE_/;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate an overrides object; returns a clean copy with only known keys. */
export function validateOverrides(input: unknown): Partial<BenefitParams> {
  if (!isPlainObject(input) || Object.keys(input).length === 0) {
    throw new ParamsValidationError(['Przekaż co najmniej jeden parametr do zmiany.']);
  }

  const defaults = DEFAULT_PARAMS_2026 as Record<string, unknown>;
  const problems: string[] = [];
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!(key in defaults)) {
      problems.push(`Nieznany parametr: ${key}.`);
      continue;
    }

    if (key === 'MATERNITY_WEEKS_BY_CHILDREN') {
      const expected = Object.keys(defaults[key] as Record<string, number>);
      if (!isPlainObject(value)) {
        problems.push('MATERNITY_WEEKS_BY_CHILDREN musi określać liczbę tygodni dla 1–5 dzieci.');
        continue;
      }
      const table: Record<string, number> = {};
      for (const children of expected) {
        const weeks = value[children];
        if (typeof weeks !== 'number' || !Number.isInteger(weeks) || weeks < 1 || weeks > 104) {
          problems.push(`Wymiar urlopu macierzyńskiego dla ${children} dzieci musi być liczbą całkowitą od 1 do 104 tygodni.`);
        } else {
          table[children] = weeks;
        }
      }
      if (Object.keys(value).some((k) => !expected.includes(k))) {
        problems.push('MATERNITY_WEEKS_BY_CHILDREN może zawierać tylko klucze 1–5.');
      }
      clean[key] = table;
      continue;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      problems.push(`${key} musi być liczbą.`);
      continue;
    }
    if (value < 0) {
      problems.push(`${key} nie może być ujemny.`);
      continue;
    }
    if (key === 'YEAR' && (!Number.isInteger(value) || value < 2000 || value > 2100)) {
      problems.push('YEAR musi być rokiem z zakresu 2000–2100.');
      continue;
    }
    if (FRACTION_KEY.test(key) && value > 1) {
      problems.push(`${key} to ułamek – podaj wartość od 0 do 1 (np. 0.815 zamiast 81.5).`);
      continue;
    }
    // Rates such as RATE_COMBINED_21_DAYS end in _DAYS but are fractions – never force them to integers.
    if (INTEGER_KEY.test(key) && !FRACTION_KEY.test(key) && !Number.isInteger(value)) {
      problems.push(`${key} musi być liczbą całkowitą.`);
      continue;
    }
    clean[key] = value;
  }

  if (problems.length > 0) throw new ParamsValidationError(problems);
  return clean as Partial<BenefitParams>;
}

export type ParamChange = { key: string; from: unknown; to: unknown };

/** Keys whose value actually changes between two parameter sets. */
export function diffParams(before: Readonly<BenefitParams>, overrides: Partial<BenefitParams>): ParamChange[] {
  const current = before as Record<string, unknown>;
  return Object.entries(overrides)
    .filter(([key, to]) => JSON.stringify(current[key]) !== JSON.stringify(to))
    .map(([key, to]) => ({ key, from: current[key], to }));
}
