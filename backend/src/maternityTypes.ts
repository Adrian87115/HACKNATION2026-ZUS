export type MaternityBenefitBasisType =
  | 'birth' // Art. 29 ust. 1 pkt 1
  | 'adoption' // Art. 29 ust. 1 pkt 2
  | 'foster_care_non_professional'; // Art. 29 ust. 1 pkt 3

export type LeaveSegmentType =
  | 'maternity' // urlop macierzyński
  | 'maternity_conditions' // urlop na warunkach urlopu macierzyńskiego (adopcja / rodzina zastępcza)
  | 'supplementary_maternity' // uzupełniający urlop macierzyńskiego
  | 'parental' // urlop rodzicielski
  | 'paternity'; // urlop ojcowski

export type MotherTakeoverCircumstance =
  | 'standard_resignation' // Art. 29 ust. 3 (po 14 tyg.)
  | 'mother_incapacity_for_independent_living' // Art. 29 ust. 5 (po 8 tyg.)
  | 'mother_hospitalization' // Art. 29 ust. 6 (po 8 tyg.)
  | 'mother_abandonment' // Art. 29 ust. 7 (po 8 tyg.)
  | 'mother_death' // Art. 29 ust. 7 lub ust. 9 pkt 1 (od dnia zgonu)
  | 'uninsured_mother_abandonment_or_incapacity' // Art. 29 ust. 9 pkt 2–3
  | 'uninsured_mother_started_work'; // Art. 29 ust. 10 (min. 1/2 etatu)

export interface MaternityRateInput {
  segmentType: LeaveSegmentType;
  submittedCombinedApplicationWithin21Days: boolean; // Art. 30a ust. 1–2
  isSecondParentNonTransferablePart: boolean; // Art. 182^1a § 4 KP -> zawsze 70% (Art. 31 ust. 3f)
  zeroParentalDaysUsedInFirstYearOfLife: boolean; // Art. 31 ust. 3g -> obniża rodzicielski z 81,5% do 70%
  /** Wymiar etatu wykonywanej pracy podczas urlopu rodzicielskiego (0 = brak pracy, np. 0.5 = 1/2 etatu) – Art. 31 ust. 4a */
  workingFteDuringParentalLeave: number;
}

/** Dane zewnętrzne, które zostaną zasilone z Kodeksu pracy i ustawy „Za życiem” w kolejnych plikach */
export interface ExternalLaborCodeLeaveLimits {
  maternityWeeks: number; // zależne od liczby dzieci przy jednym porodzie/przyjęciu (KP)
  supplementaryMaternityWeeks: number; // wcześniaki / hospitalizacja dziecka (KP)
  parentalTotalWeeks: number; // standard vs. zaświadczenie „Za życiem” (KP + Za życiem)
  secondParentExclusiveParentalWeeks: number; // nieprzenoszalna część z Art. 182^1a § 4 KP
  paternityWeeks: number; // urlop ojcowski (KP)
}

export interface MonthlyEmployeeEarnings {
  year: number;
  month: number;
  /** Wynagrodzenie po odliczeniu składek pracownika (emerytalna, rentowa, chorobowa) – Art. 3 pkt 3 */
  netOfSocialContributionsSalary: number;
  /** Wypłacone premie/nagrody miesięczne wliczane do podstawy – Art. 42 ust. 1 */
  monthlyBonuses: number;
  daysWorked: number;
  daysScheduledToWork: number;
  hasExcusedAbsence: boolean;
}

export interface EmployeeBasisInput {
  /** Liczba pełnych miesięcy kalendarzowych przerwy od poprzedniego zasiłku (np. chorobowego w ciąży) – Art. 43 */
  fullCalendarMonthsSincePreviousBenefit: number | null;
  previousBenefitDailyOrMonthlyBasis?: number;
  /** Czy w miesiącu powstania prawa lub w okresie bazowym nastąpiła zmiana etatu – Art. 40 */
  fteChangeNewMonthlySalary?: number;
  /** Wynagrodzenie z umowy za pełny miesiąc (gdy prawo powstało przed upływem 1. pełnego mies. kalendarzowego) – Art. 37 */
  contractFullMonthSalaryIfUnderOneMonth?: number;
  /** Historyczne miesiące (maks. 12 pełnych miesięcy kalendarzowych przed miesiącem porodu/przyjęcia) – Art. 36 */
  historyMonths: readonly MonthlyEmployeeEarnings[];
  /** Suma premii kwartalnych z 4 poprzednich kwartałów – Art. 42 ust. 2 */
  quarterlyBonusesLast4Quarters: number;
  /** Suma premii rocznych z roku poprzedzającego – Art. 42 ust. 3 */
  annualBonusesLastYear: number;
  isFullTimeEmployee: boolean;
  currentMinimumWage: number;
}
