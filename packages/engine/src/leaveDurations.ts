import type { BenefitParams } from './params.js';
import { addDays, addYears, diffDays, EngineInputError } from './utils.js';

/**
 * Wymiary urlopów związanych z rodzicielstwem (Kodeks pracy).
 * Wymiar urlopu = maksymalny okres zasiłku macierzyńskiego (Art. 29a ustawy zasiłkowej) –
 * dotyczy także ubezpieczonych niebędących pracownikami.
 */

/** Art. 180 § 1 KP – urlop macierzyński wg liczby dzieci przy jednym porodzie (5+ = 37 tyg.). */
export function maternityLeaveWeeks(p: BenefitParams, childrenCount: number): number {
  const keys = Object.keys(p.MATERNITY_WEEKS_BY_CHILDREN).map(Number);
  const key = Math.min(Math.max(childrenCount, 1), Math.max(...keys));
  return p.MATERNITY_WEEKS_BY_CHILDREN[key];
}

/** Art. 182^1a § 1-2 KP, Art. 183 § 4-4^5 KP – łączny wymiar urlopu rodzicielskiego dla obojga rodziców. */
export function parentalLeaveWeeks(
  p: BenefitParams,
  opts: { childrenCount: number; zaZyciem: boolean; adoptionMinimumCase?: boolean },
): number {
  if (opts.adoptionMinimumCase) {
    return opts.zaZyciem
      ? p.PARENTAL_WEEKS_ADOPTION_FLOOR_CASE_ZA_ZYCIEM
      : p.PARENTAL_WEEKS_ADOPTION_FLOOR_CASE;
  }
  const multiple = opts.childrenCount > 1;
  if (opts.zaZyciem) {
    return multiple
      ? p.PARENTAL_WEEKS_MULTIPLE_CHILDREN_ZA_ZYCIEM
      : p.PARENTAL_WEEKS_SINGLE_CHILD_ZA_ZYCIEM;
  }
  return multiple ? p.PARENTAL_WEEKS_MULTIPLE_CHILDREN : p.PARENTAL_WEEKS_SINGLE_CHILD;
}

/** Art. 182^1f § 1 i § 1^1 KP – górny limit urlopu rodzicielskiego wydłużonego przez łączenie z pracą. */
export function maxExtendedParentalWeeks(
  p: BenefitParams,
  opts: { childrenCount: number; zaZyciem: boolean },
): number {
  const multiple = opts.childrenCount > 1;
  if (opts.zaZyciem) {
    return multiple
      ? p.MAX_EXTENDED_PARENTAL_WEEKS_MULTIPLE_ZA_ZYCIEM
      : p.MAX_EXTENDED_PARENTAL_WEEKS_SINGLE_ZA_ZYCIEM;
  }
  return multiple ? p.MAX_EXTENDED_PARENTAL_WEEKS_MULTIPLE : p.MAX_EXTENDED_PARENTAL_WEEKS_SINGLE;
}

export interface SupplementaryInput {
  /** Tydzień ciąży, w którym nastąpił poród (np. 27 = przed ukończeniem 28. tygodnia). */
  gestationWeeks: number;
  /** Masa urodzeniowa w gramach – przy kilkorgu dzieci najniższa (Art. 180^2 § 2 KP). */
  birthWeightGrams: number;
  /**
   * Suma dni pobytu dziecka w szpitalu w okresie liczonym przez przepis
   * (do 15./8. tygodnia po porodzie, a w przypadku dziecka donoszonego – od 5. dnia).
   * Przy kilkorgu dzieci – dziecko najdłużej hospitalizowane.
   */
  hospitalizationDays: number;
  /** Tylko dziecko urodzone po 37. tyg.: dzień po porodzie, w którym zaczął się co najmniej 2-dniowy pobyt w szpitalu. */
  hospitalizationStartDay?: number;
}

export type SupplementaryCase = 'extreme_preterm' | 'preterm' | 'term_hospitalized' | 'none';

/** Art. 180^2 KP – uzupełniający urlop macierzyński: 1 tydz. za każdy (rozpoczęty) tydzień pobytu w szpitalu. */
export function supplementaryMaternityWeeks(
  p: BenefitParams,
  input: SupplementaryInput,
): { weeks: number; case: SupplementaryCase; maxWeeks: number } {
  const { gestationWeeks, birthWeightGrams, hospitalizationDays } = input;
  let supplementaryCase: SupplementaryCase;
  let maxWeeks: number;

  if (
    gestationWeeks < p.PRETERM_EXTREME_GESTATION_WEEKS_LIMIT ||
    birthWeightGrams <= p.PRETERM_EXTREME_WEIGHT_GRAMS_LIMIT
  ) {
    supplementaryCase = 'extreme_preterm';
    maxWeeks = p.PRETERM_EXTREME_MAX_WEEKS;
  } else if (gestationWeeks < p.PRETERM_MODERATE_GESTATION_WEEKS_LIMIT) {
    supplementaryCase = 'preterm';
    maxWeeks = p.STANDARD_SUPPLEMENTARY_MAX_WEEKS;
  } else {
    const start = input.hospitalizationStartDay;
    const qualifies =
      hospitalizationDays >= p.TERM_HOSPITAL_MIN_CONSECUTIVE_DAYS &&
      start !== undefined &&
      start >= p.TERM_HOSPITAL_WINDOW_START_DAY &&
      start <= p.TERM_HOSPITAL_WINDOW_END_DAY;
    if (!qualifies) return { weeks: 0, case: 'none', maxWeeks: 0 };
    supplementaryCase = 'term_hospitalized';
    maxWeeks = p.STANDARD_SUPPLEMENTARY_MAX_WEEKS;
  }

  // Art. 180^2 § 3 KP – okresy sumuje się, niepełny tydzień zaokrągla w górę.
  const weeks = Math.min(Math.ceil(hospitalizationDays / 7), maxWeeks);
  return { weeks, case: weeks > 0 ? supplementaryCase : 'none', maxWeeks };
}

export interface ChildLossInput {
  /** Data zgonu dziecka; brak = urodzenie martwego dziecka. */
  dateOfDeath?: string;
  /** Liczba dzieci z tego porodu pozostałych przy życiu. */
  survivingChildren: number;
}

/**
 * Art. 180^1 KP – długość urlopu macierzyńskiego PO PORODZIE (w dniach) w razie urodzenia
 * martwego dziecka albo zgonu dziecka.
 */
export function maternityDaysAfterChildLoss(
  p: BenefitParams,
  opts: { birthDate: Date; deathDate?: Date; childrenCount: number; survivingChildren: number },
): number {
  const fullDays = maternityLeaveWeeks(p, opts.childrenCount) * 7;
  const daysLived = opts.deathDate ? diffDays(opts.birthDate, opts.deathDate) : 0;
  const untilSevenDaysAfterDeath = daysLived + p.CHILD_LOSS_MIN_DAYS_AFTER_DEATH;
  const eightWeeks = p.CHILD_LOSS_MATERNITY_WEEKS * 7;

  if (opts.survivingChildren > 0) {
    // wymiar stosowny do liczby dzieci pozostałych przy życiu, nie krócej niż 7 dni od zgonu
    const survivorsDays = maternityLeaveWeeks(p, opts.survivingChildren) * 7;
    return Math.max(survivorsDays, Math.min(fullDays, untilSevenDaysAfterDeath));
  }
  if (daysLived < eightWeeks) {
    // § 1: 8 tygodni po porodzie, nie krócej niż 7 dni od dnia zgonu
    return Math.max(eightWeeks, untilSevenDaysAfterDeath);
  }
  // § 2: zgon po upływie 8 tygodni życia – prawo zachowane przez 7 dni od zgonu
  return Math.min(fullDays, untilSevenDaysAfterDeath);
}

export type PlacementKind = 'adoption' | 'foster';

/**
 * Art. 183 § 1, § 1^1, § 3 KP – urlop na warunkach urlopu macierzyńskiego (w dniach).
 * Trwa nie dłużej niż do ukończenia przez dziecko 7 lat (rodzina zastępcza; 10 przy odroczeniu
 * obowiązku szkolnego) albo 14 lat (przysposobienie), ale nie krócej niż 9 tygodni.
 */
export function maternityConditionsLeave(
  p: BenefitParams,
  opts: {
    kind: PlacementKind;
    childrenCount: number;
    childBirthDate: Date;
    placementDate: Date;
    deferredSchoolObligation?: boolean;
  },
): { days: number; minimumApplied: boolean; ageLimitDate: Date } {
  const ageLimitYears =
    opts.kind === 'adoption'
      ? p.ADOPTION_MAX_CHILD_AGE_YEARS
      : opts.deferredSchoolObligation
        ? p.FOSTER_DEFERRED_SCHOOL_MAX_CHILD_AGE_YEARS
        : p.FOSTER_MAX_CHILD_AGE_YEARS;
  const ageLimitDate = addYears(opts.childBirthDate, ageLimitYears);

  if (diffDays(opts.placementDate, ageLimitDate) <= 0) {
    throw new EngineInputError(
      `Zasiłek nie przysługuje – dziecko w dniu przyjęcia ukończyło ${ageLimitYears} lat (Art. 29 ust. 1 ustawy zasiłkowej).`,
    );
  }

  const fullDays = maternityLeaveWeeks(p, opts.childrenCount) * 7;
  const minimumDays = p.ADOPTION_FOSTER_MIN_GUARANTEED_MATERNITY_WEEKS * 7;
  const daysUntilAgeLimit = diffDays(opts.placementDate, ageLimitDate);
  const days = Math.max(minimumDays, Math.min(fullDays, daysUntilAgeLimit));
  return { days, minimumApplied: days === minimumDays && fullDays > minimumDays, ageLimitDate };
}

/** Art. 182^1c KP – ostatni dzień, w którym można korzystać z urlopu rodzicielskiego (urodzenie). */
export function parentalLeaveDeadline(p: BenefitParams, childBirthDate: Date): Date {
  const year = childBirthDate.getUTCFullYear() + p.PARENTAL_DEADLINE_CHILD_AGE_YEARS;
  return new Date(Date.UTC(year, 11, 31));
}

/** Art. 182^3 § 1 KP – ostatni dzień na wykorzystanie urlopu ojcowskiego. */
export function paternityLeaveDeadline(
  p: BenefitParams,
  opts: { childBirthDate: Date; adoptionDecreeDate?: Date },
): Date {
  if (!opts.adoptionDecreeDate) {
    const d = new Date(opts.childBirthDate);
    d.setUTCMonth(d.getUTCMonth() + p.PATERNITY_MAX_CHILD_AGE_MONTHS_BIRTH);
    return addDays(d, -1);
  }
  const fromDecree = new Date(opts.adoptionDecreeDate);
  fromDecree.setUTCMonth(fromDecree.getUTCMonth() + p.PATERNITY_MONTHS_FROM_ADOPTION_DECREE);
  const ageLimit = addYears(opts.childBirthDate, p.PATERNITY_MAX_CHILD_AGE_YEARS_ADOPTION);
  return addDays(fromDecree < ageLimit ? fromDecree : ageLimit, -1);
}
