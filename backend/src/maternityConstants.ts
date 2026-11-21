export const MATERNITY_BENEFIT_CONSTANTS = {
  // Przepisy ogólne i wskaźniki (Art. 2a, Art. 3, Art. 11, Art. 36)
  SOCIAL_CONTRIBUTION_DEDUCTION_RATE: 0.1371, // 13,71% (Art. 3 pkt 4, Art. 45 ust. 1)
  MAX_ALLOWED_DEBT_TO_MIN_WAGE_RATIO: 0.01, // 1% minimalnego wynagrodzenia (Art. 2a ust. 1)
  DEBT_PRESCRIPTION_MONTHS: 6, // (Art. 2a ust. 2)
  STATUTORY_MONTH_DAYS: 30, // 1 miesiąc = 30 dni; stawka dzienna = 1/30 podstawy (Art. 11 ust. 5, Art. 36 ust. 3)

  // Granice wieku dziecka – adopcja i rodzina zastępcza (Art. 29 ust. 1 pkt 2 i 3) -> kalkulator (e)
  ADOPTION_MAX_CHILD_AGE_YEARS: 14,
  FOSTER_MAX_CHILD_AGE_YEARS: 7,
  FOSTER_DEFERRED_SCHOOL_MAX_CHILD_AGE_YEARS: 10,

  // Przejęcie zasiłku przez ojca / drugiego rodzica (Art. 29 ust. 3–10) -> kalkulator (d)
  MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD: 14, // rezygnacja ubezpieczonej matki (Art. 29 ust. 3)
  MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL: 8, // niezdolność do samodz. egzystencji, szpital, porzucenie (Art. 29 ust. 5–7)
  NON_INSURED_MOTHER_MIN_EMPLOYMENT_FTE: 0.5, // min. 1/2 pełnego wymiaru czasu pracy (Art. 29 ust. 10)

  // Terminy wniosków i stawki procentowe (Art. 30a, Art. 31) -> kalkulatory (b, c, d, e, f)
  COMBINED_APPLICATION_DEADLINE_DAYS: 21, // po porodzie lub przyjęciu na wychowanie (Art. 30a ust. 1–2)
  RATE_MATERNITY_FULL: 1.0, // 100% – macierzyński, na warunkach macierzyńskiego, uzupełniający, ojcowski (Art. 31 ust. 1)
  RATE_PARENTAL_STANDARD: 0.7, // 70% – urlop rodzicielski bez wniosku w 21 dni / część 9 tyg. drugiego rodzica (Art. 31 ust. 2, 3f, 3g)
  RATE_COMBINED_APPLICATION: 0.815, // 81,5% – cały okres przy wniosku złożonym do 21 dni (Art. 31 ust. 3)

  // Podstawa wymiaru zasiłku (Art. 36–52) -> kalkulator (f)
  BASIS_REFERENCE_MONTHS: 12, // (Art. 36 ust. 1, Art. 48 ust. 1)
  MIN_WORKED_TIME_RATIO_IN_MONTH: 0.5, // próg połowy obowiązującego czasu pracy / połowy miesiąca (Art. 38 ust. 2, Art. 50 ust. 1)
  MAX_INSURANCE_GAP_DAYS_FOR_CONTINUITY: 30, // (Art. 48a ust. 2, Art. 49 ust. 2)
  RECALCULATION_MIN_GAP_CALENDAR_MONTHS: 1, // przerwa krótsza niż 1 mies. kalendarzowy = brak nowego ustalania podstawy (Art. 43)
} as const;
