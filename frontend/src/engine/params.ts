import { BENEFIT_ENGINE_CONSTANTS_2026 } from './benefits2026.js';
import { MATERNITY_BENEFIT_CONSTANTS } from './maternityConstants.js';

/**
 * Parametry silnika, których nie ma w benefits2026.ts.
 * Wszystkie liczby, z których korzysta silnik, przechodzą przez obiekt BenefitParams,
 * dzięki czemu panel administracyjny może je zmienić bez zmian w kodzie (wymaganie z pkt 3 zadania).
 */
const EXTRA_PARAMS_2026 = {
  // Urlop macierzyński (Art. 180 § 2 i § 4 KP, Art. 29 ust. 3, 5-7 ustawy zasiłkowej)
  MATERNITY_MAX_PRENATAL_WEEKS: 6,
  MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD:
    MATERNITY_BENEFIT_CONSTANTS.MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD, // 14
  MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL:
    MATERNITY_BENEFIT_CONSTANTS.MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL, // 8

  // Urodzenie martwego dziecka / zgon dziecka (Art. 180^1 KP)
  CHILD_LOSS_MATERNITY_WEEKS: 8,
  CHILD_LOSS_MIN_DAYS_AFTER_DEATH: 7,

  // Granice wieku dziecka przy przyjęciu na wychowanie (Art. 29 ust. 1 pkt 2-3 ustawy, Art. 183 KP)
  ADOPTION_MAX_CHILD_AGE_YEARS:
    MATERNITY_BENEFIT_CONSTANTS.ADOPTION_MAX_CHILD_AGE_YEARS, // 14
  FOSTER_MAX_CHILD_AGE_YEARS:
    MATERNITY_BENEFIT_CONSTANTS.FOSTER_MAX_CHILD_AGE_YEARS, // 7
  FOSTER_DEFERRED_SCHOOL_MAX_CHILD_AGE_YEARS:
    MATERNITY_BENEFIT_CONSTANTS.FOSTER_DEFERRED_SCHOOL_MAX_CHILD_AGE_YEARS, // 10

  // Urlop rodzicielski (Art. 182^1c KP) – maks. 5 części, do końca roku, w którym dziecko kończy 6 lat
  PARENTAL_MAX_PARTS: 5,
  PARENTAL_DEADLINE_CHILD_AGE_YEARS: 6,

  // Zasiłek chorobowy w ciąży (pkt 3a zadania)
  SICKNESS_WAITING_DAYS_MANDATORY: 30, // Art. 4 ust. 1 pkt 1 – ubezpieczenie obowiązkowe
  SICKNESS_WAITING_DAYS_VOLUNTARY: 90, // Art. 4 ust. 1 pkt 2 – ubezpieczenie dobrowolne
  EMPLOYER_SICK_PAY_DAYS_PER_YEAR: 33, // Art. 92 § 1 KP – wynagrodzenie chorobowe od pracodawcy
  EMPLOYER_SICK_PAY_DAYS_PER_YEAR_50_PLUS: 14, // Art. 92 § 1 KP – pracownik po 50. r.ż.
  SICKNESS_PERIOD_MAX_DAYS_PREGNANCY: 270, // Art. 8 – okres zasiłkowy w czasie ciąży
  RATE_SICKNESS_PREGNANCY: 1, // Art. 11 ust. 2 pkt 2 – 100% (kod „B” na e-ZLA)
  RATE_SICKNESS_STANDARD: 0.8, // Art. 11 ust. 1 – 80% (zaświadczenie bez kodu „B”)
  REHABILITATION_MAX_MONTHS: 12, // Art. 18 ust. 2 – świadczenie rehabilitacyjne
  RATE_REHABILITATION_PREGNANCY: 1, // Art. 19 ust. 2 – 100% w czasie ciąży

  // Art. 31 ust. 3a – zasiłek nie niższy niż świadczenie rodzicielskie (ustawa o świadczeniach rodzinnych).
  // Kwoty nie ma w materiałach konkursowych – 1000 zł/mies. (wartość obowiązująca), do weryfikacji.
  PARENTAL_BENEFIT_FLOOR_MONTHLY: 1000,
} as const;

const ALL_DEFAULTS_2026 = {
  ...BENEFIT_ENGINE_CONSTANTS_2026,
  ...EXTRA_PARAMS_2026,
};

type Widen<T> = T extends number ? number : T;

/** Pełny zestaw parametrów silnika (wartości liczbowe poszerzone do `number`, aby dało się je nadpisać). */
export type BenefitParams = {
  [K in keyof typeof ALL_DEFAULTS_2026]: Widen<(typeof ALL_DEFAULTS_2026)[K]>;
};

export const DEFAULT_PARAMS_2026: Readonly<BenefitParams> = Object.freeze({
  ...ALL_DEFAULTS_2026,
  MATERNITY_WEEKS_BY_CHILDREN: {
    ...BENEFIT_ENGINE_CONSTANTS_2026.MATERNITY_WEEKS_BY_CHILDREN,
  },
});

/** Zwraca nowy zestaw parametrów z nadpisanymi wartościami (np. z panelu administracyjnego). */
export function withOverrides(
  base: Readonly<BenefitParams>,
  overrides: Partial<BenefitParams>,
): BenefitParams {
  return {
    ...base,
    ...overrides,
    MATERNITY_WEEKS_BY_CHILDREN: {
      ...base.MATERNITY_WEEKS_BY_CHILDREN,
      ...overrides.MATERNITY_WEEKS_BY_CHILDREN,
    },
  };
}
