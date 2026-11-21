import type { BenefitParams } from "./params.js";
import {
  addDays,
  EngineInputError,
  formatDate,
  formatDatePl,
  parseDate,
  requireNonNegative,
  round2,
} from "./utils.js";

/**
 * Kalkulator (a) – świadczenia w czasie ciąży:
 *  - zasiłek chorobowy w ciąży (z wynagrodzeniem chorobowym płaconym przez pracodawcę),
 *  - zasiłek w wysokości zasiłku macierzyńskiego po utracie pracy w ciąży (Art. 30 ust. 3),
 *  - informacja o świadczeniu rehabilitacyjnym po wyczerpaniu okresu zasiłkowego.
 * Podstawa wymiaru – z kalkulatora (f), basis.ts.
 */

export type PregnancySegmentType =
  /** Okres wyczekiwania – brak prawa do świadczenia (Art. 4). */
  | "waiting_period"
  /** Wynagrodzenie chorobowe płacone przez pracodawcę (Art. 92 KP). */
  | "employer_sick_pay"
  /** Zasiłek chorobowy z FUS (ZUS albo płatnik > 20 ubezpieczonych). */
  | "sickness"
  /** Po wyczerpaniu 270 dni okresu zasiłkowego – zasiłek chorobowy nie przysługuje. */
  | "period_exhausted"
  /** Zasiłek w wysokości zasiłku macierzyńskiego – do dnia porodu (Art. 30 ust. 3). */
  | "maternity_level";

export type PaidBy = "employer" | "payer" | "zus";

export interface PregnancyBenefitInput {
  /** Miesięczna podstawa wymiaru zasiłku (z calculateBasis albo wpisana ręcznie). */
  monthlyBasis: number;
  /** mandatory = np. umowa o pracę (wyczekiwanie 30 dni); voluntary = np. zlecenie, działalność (90 dni). */
  insuranceKind: "mandatory" | "voluntary";
  /** Pracownik – przez pierwsze 33 dni w roku płaci pracodawca. Domyślnie: insuranceKind === 'mandatory'. */
  isEmployee?: boolean;
  /** Podlega ubezpieczeniu chorobowemu w dniu powstania niezdolności do pracy. Domyślnie true. */
  insured?: boolean;
  /** Zadłużenie z tytułu składek na dzień powstania prawa (Art. 2a). */
  contributionDebt?: number;
  /** Data objęcia obecnym ubezpieczeniem chorobowym (YYYY-MM-DD). */
  insuranceStartDate: string;
  /** Wliczane dni wcześniejszego ubezpieczenia (przerwa ≤ 30 dni, urlop wychowawczy itp. – Art. 4 ust. 2). */
  previousInsuranceDays?: number;
  /** Okres wyczekiwania nie obowiązuje (Art. 4 ust. 4, np. absolwent, ≥ 10 lat ubezpieczenia obowiązkowego). */
  waitingPeriodExempt?: boolean;
  /** Pracownik po ukończeniu 50. roku życia – pracodawca płaci 14 dni zamiast 33. */
  employeeAge50Plus?: boolean;
  /** Dni wynagrodzenia chorobowego wykorzystane już w roku kalendarzowym, w którym zaczyna się niezdolność. */
  employerSickDaysUsedThisYear?: number;
  /** Dni niezdolności w tej ciąży już wliczone do okresu zasiłkowego (wcześniejsze e-ZLA). */
  previousIncapacityDaysInPregnancy?: number;
  /** Płatnik zgłasza do ubezpieczenia chorobowego > 20 osób – sam wypłaca zasiłek (Art. 61 ust. 1). */
  payerOver20Insured?: boolean;
  /** Przewidywana albo faktyczna data porodu – od porodu przysługuje zasiłek macierzyński. */
  expectedBirthDate?: string;
  /** Niezdolność do pracy z e-ZLA. */
  incapacity?: { startDate: string; endDate: string; pregnancyCodeB?: boolean };
  /** Rozwiązanie umowy o pracę w ciąży (Art. 30 ust. 3). */
  jobLoss?: {
    employmentEndDate: string;
    /** employer_insolvency = upadłość, likwidacja albo śmierć pracodawcy;
     *  unlawful_termination = naruszenie przepisów stwierdzone prawomocnym wyrokiem sądu. */
    reason: "employer_insolvency" | "unlawful_termination";
  };
}

export interface PregnancySegment {
  type: PregnancySegmentType;
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  dailyAmount: number;
  totalAmount: number;
  payable: boolean;
  paidBy: PaidBy | null;
  notPayableReason?: string;
  legalBasis: string;
}

export interface PregnancyBenefitResult {
  /** Czy przysługuje jakiekolwiek świadczenie (wymaganie z pkt 3a: także informacja o braku uprawnień). */
  entitled: boolean;
  dailyBasis: number;
  /** Pierwszy dzień z prawem do świadczenia po okresie wyczekiwania. */
  entitlementFromDate: string;
  sicknessPeriod: {
    maxDays: number;
    /** Dni wliczone do okresu zasiłkowego (łącznie z wcześniejszymi e-ZLA w tej ciąży). */
    usedDays: number;
    remainingDays: number;
    exhaustedOn?: string;
  };
  segments: PregnancySegment[];
  totals: { employer: number; benefit: number; all: number };
  errors: string[];
  warnings: string[];
  notes: string[];
}

const LEGAL_BASIS: Record<PregnancySegmentType, string> = {
  waiting_period: "Art. 4 ust. 1-2 ustawy zasiłkowej",
  employer_sick_pay: "Art. 92 § 1 pkt 2 KP",
  sickness: "Art. 6, 8, 11 ust. 2 pkt 2 ustawy zasiłkowej",
  period_exhausted: "Art. 8, 9 ustawy zasiłkowej",
  maternity_level: "Art. 30 ust. 3 ustawy zasiłkowej",
};

export function calculatePregnancyBenefits(
  p: BenefitParams,
  input: PregnancyBenefitInput,
): PregnancyBenefitResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const monthlyBasis = requireNonNegative(input.monthlyBasis, "monthlyBasis");
  if (
    input.insuranceKind !== "mandatory" &&
    input.insuranceKind !== "voluntary"
  ) {
    throw new EngineInputError(
      'Wybierz rodzaj ubezpieczenia: obowiązkowe albo dobrowolne.',
    );
  }
  if (!input.incapacity && !input.jobLoss) {
    throw new EngineInputError(
      "Podaj okres zwolnienia lekarskiego albo zaznacz utratę pracy w ciąży.",
    );
  }

  const isEmployee = input.isEmployee ?? input.insuranceKind === "mandatory";
  const insuranceStart = parseDate(
    input.insuranceStartDate,
    "insuranceStartDate",
  );
  const birthDate = input.expectedBirthDate
    ? parseDate(input.expectedBirthDate, "expectedBirthDate")
    : undefined;
  const previousInsuranceDays = requireNonNegative(
    input.previousInsuranceDays ?? 0,
    "previousInsuranceDays",
  );
  const maxPeriodDays = p.SICKNESS_PERIOD_MAX_DAYS_PREGNANCY;
  let periodUsed = requireNonNegative(
    input.previousIncapacityDaysInPregnancy ?? 0,
    "previousIncapacityDaysInPregnancy",
  );

  // --- Okres wyczekiwania (Art. 4) --------------------------------------------------------
  const waitingDays =
    input.insuranceKind === "voluntary"
      ? p.SICKNESS_WAITING_DAYS_VOLUNTARY
      : p.SICKNESS_WAITING_DAYS_MANDATORY;
  const entitlementFrom = input.waitingPeriodExempt
    ? insuranceStart
    : addDays(insuranceStart, Math.max(0, waitingDays - previousInsuranceDays));

  // --- Prawo do wypłaty (ubezpieczenie, zadłużenie składkowe) ------------------------------
  const debtLimit = round2(
    p.MIN_WAGE_2026_GROSS * p.DEBT_EXCLUSION_MIN_WAGE_RATIO,
  );
  let notPayableReason: string | undefined;
  if (input.insured === false) {
    notPayableReason =
      "Brak ubezpieczenia chorobowego – zasiłek chorobowy nie przysługuje (Art. 4, 6).";
  } else if ((input.contributionDebt ?? 0) > debtLimit) {
    notPayableReason = `Zadłużenie składkowe przekracza ${debtLimit} zł – zasiłek nie jest wypłacany do czasu spłaty całości zadłużenia; prawo przedawnia się po 6 mies. (Art. 2a).`;
  }

  const paidBy = (type: PregnancySegmentType): PaidBy | null => {
    if (type === "employer_sick_pay") return "employer";
    if (type === "maternity_level") return "zus";
    if (type === "sickness") return input.payerOver20Insured ? "payer" : "zus";
    return null;
  };

  const segments: PregnancySegment[] = [];
  /** Dopisuje dzień do bieżącego okresu tego samego typu albo otwiera nowy okres. */
  const pushDay = (type: PregnancySegmentType, day: Date, rate: number) => {
    const isPaidType =
      type === "employer_sick_pay" ||
      type === "sickness" ||
      type === "maternity_level";
    const segmentRate = isPaidType ? rate : 0;
    const last = segments[segments.length - 1];
    if (
      last &&
      last.type === type &&
      last.rate === segmentRate &&
      last.endDate === formatDate(addDays(day, -1))
    ) {
      last.endDate = formatDate(day);
      last.days += 1;
      return;
    }
    segments.push({
      type,
      startDate: formatDate(day),
      endDate: formatDate(day),
      days: 1,
      rate: segmentRate,
      dailyAmount: 0,
      totalAmount: 0,
      payable: isPaidType && !notPayableReason,
      paidBy: isPaidType ? paidBy(type) : null,
      notPayableReason: isPaidType ? notPayableReason : undefined,
      legalBasis: LEGAL_BASIS[type],
    });
  };

  // --- Utrata pracy w ciąży (Art. 30 ust. 3) ----------------------------------------------
  let employmentEnd: Date | undefined;
  if (input.jobLoss) {
    employmentEnd = parseDate(
      input.jobLoss.employmentEndDate,
      "jobLoss.employmentEndDate",
    );
    if (
      !["employer_insolvency", "unlawful_termination"].includes(
        input.jobLoss.reason,
      )
    ) {
      throw new EngineInputError(
        'Wybierz przyczynę utraty pracy.',
      );
    }
    if (!birthDate) {
      throw new EngineInputError(
        "Przy utracie pracy podaj przewidywaną datę porodu.",
      );
    }
  }

  // --- Zasiłek chorobowy / wynagrodzenie chorobowe -----------------------------------------
  let exhaustedOn: Date | undefined;
  if (input.incapacity) {
    const start = parseDate(input.incapacity.startDate, "incapacity.startDate");
    const end = parseDate(input.incapacity.endDate, "incapacity.endDate");
    if (end < start)
      throw new EngineInputError(
        "Koniec zwolnienia lekarskiego nie może być wcześniejszy niż jego początek.",
      );
    if (start < insuranceStart) {
      errors.push(
        "Niezdolność do pracy powstała przed objęciem ubezpieczeniem chorobowym – zasiłek nie przysługuje.",
      );
    }
    if (birthDate && start >= birthDate) {
      errors.push(
        "Niezdolność do pracy zaczyna się w dniu porodu lub później – przysługuje zasiłek macierzyński.",
      );
    }

    const codeB = input.incapacity.pregnancyCodeB ?? true;
    const rate = codeB ? p.RATE_SICKNESS_PREGNANCY : p.RATE_SICKNESS_STANDARD;
    if (!codeB) {
      warnings.push(
        `Zaświadczenie e-ZLA bez kodu „B” – zasiłek wynosi ${rate * 100}% zamiast ${p.RATE_SICKNESS_PREGNANCY * 100}%. Poproś lekarza o oznaczenie ciąży kodem „B” (Art. 11 ust. 2 pkt 2).`,
      );
    }

    // Ostatni dzień: koniec e-ZLA, ale nie później niż dzień przed porodem / ustaniem zatrudnienia.
    let last = end;
    if (birthDate && addDays(birthDate, -1) < last) {
      last = addDays(birthDate, -1);
      notes.push(
        `Od dnia porodu (${formatDatePl(birthDate)}) zamiast zasiłku chorobowego przysługuje zasiłek macierzyński – zob. kalkulator zasiłku macierzyńskiego.`,
      );
    }
    if (employmentEnd && employmentEnd < last) {
      last = employmentEnd;
      notes.push(
        "Po ustaniu zatrudnienia za ten sam okres przysługuje zasiłek w wysokości zasiłku macierzyńskiego.",
      );
    }

    const employerLimit = input.employeeAge50Plus
      ? p.EMPLOYER_SICK_PAY_DAYS_PER_YEAR_50_PLUS
      : p.EMPLOYER_SICK_PAY_DAYS_PER_YEAR;
    let employerYear = start.getUTCFullYear();
    let employerUsed = requireNonNegative(
      input.employerSickDaysUsedThisYear ?? 0,
      "employerSickDaysUsedThisYear",
    );

    if (errors.length === 0) {
      for (let day = start; day <= last; day = addDays(day, 1)) {
        if (day < entitlementFrom) {
          pushDay("waiting_period", day, rate);
          continue;
        }
        // Do okresu zasiłkowego wliczamy dni z prawem do świadczenia (także wynagrodzenia – Art. 9 ust. 1).
        if (periodUsed >= maxPeriodDays) {
          exhaustedOn ??= day;
          pushDay("period_exhausted", day, rate);
          continue;
        }
        periodUsed += 1;
        if (isEmployee) {
          // Limit 33 (14) dni liczony w każdym roku kalendarzowym od nowa.
          if (day.getUTCFullYear() !== employerYear) {
            employerYear = day.getUTCFullYear();
            employerUsed = 0;
          }
          if (employerUsed < employerLimit) {
            employerUsed += 1;
            pushDay("employer_sick_pay", day, rate);
            continue;
          }
        }
        pushDay("sickness", day, rate);
      }
    }

    if (segments.some((s) => s.type === "waiting_period")) {
      warnings.push(
        `Okres wyczekiwania: prawo do zasiłku powstaje po ${waitingDays} dniach ${input.insuranceKind === "voluntary" ? "dobrowolnego" : "nieprzerwanego"} ubezpieczenia, tj. od ${formatDatePl(entitlementFrom)} (Art. 4).`,
      );
    }
    if (segments.some((s) => s.type === "employer_sick_pay")) {
      notes.push(
        `Przez pierwsze ${employerLimit} dni niezdolności w roku kalendarzowym pracodawca wypłaca wynagrodzenie chorobowe (Art. 92 KP), dopiero od kolejnego dnia – zasiłek chorobowy.`,
      );
    }
    if (exhaustedOn) {
      const rehabMonthly = round2(
        monthlyBasis * p.RATE_REHABILITATION_PREGNANCY,
      );
      warnings.push(
        `Okres zasiłkowy (${maxPeriodDays} dni) wyczerpany ${formatDatePl(exhaustedOn)} – od tego dnia zasiłek chorobowy nie przysługuje.`,
      );
      notes.push(
        `Po wyczerpaniu okresu zasiłkowego można wystąpić o świadczenie rehabilitacyjne – do ${p.REHABILITATION_MAX_MONTHS} mies., w ciąży ${p.RATE_REHABILITATION_PREGNANCY * 100}% podstawy (ok. ${rehabMonthly} zł/mies.), jeśli dalsze leczenie rokuje odzyskanie zdolności do pracy (Art. 18, 19).`,
      );
    }
  }

  // --- Zasiłek w wysokości zasiłku macierzyńskiego -----------------------------------------
  if (input.jobLoss && employmentEnd && birthDate) {
    if (!isEmployee) {
      errors.push(
        "Zasiłek w wysokości zasiłku macierzyńskiego przysługuje tylko pracownicy (rozwiązanie umowy o pracę).",
      );
    } else if (employmentEnd >= addDays(birthDate, -1)) {
      errors.push(
        "Umowa o pracę ustała w dniu porodu lub później – zasiłek do dnia porodu nie przysługuje.",
      );
    } else {
      if (input.jobLoss.reason === "unlawful_termination") {
        warnings.push(
          "Wymagany prawomocny wyrok sądu stwierdzający naruszenie przepisów przy rozwiązaniu umowy.",
        );
      }
      const lastDay = addDays(birthDate, -1);
      for (
        let day = addDays(employmentEnd, 1);
        day <= lastDay;
        day = addDays(day, 1)
      ) {
        pushDay("maternity_level", day, p.RATE_FULL);
      }
      notes.push(
        `Zasiłek w wysokości zasiłku macierzyńskiego (${p.RATE_FULL * 100}% podstawy) przysługuje do dnia porodu; od porodu – zasiłek macierzyński.`,
      );
    }
  }

  // --- Kwoty --------------------------------------------------------------------------------
  const dailyBasis = round2(monthlyBasis / p.STATUTORY_MONTH_DAYS);
  for (const s of segments) {
    if (!s.payable) continue;
    s.dailyAmount = round2((monthlyBasis * s.rate) / p.STATUTORY_MONTH_DAYS);
    s.totalAmount = round2(s.dailyAmount * s.days);
  }
  segments.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const sumOf = (filter: (s: PregnancySegment) => boolean) =>
    round2(segments.filter(filter).reduce((acc, s) => acc + s.totalAmount, 0));
  const employerTotal = sumOf((s) => s.paidBy === "employer");
  const benefitTotal = sumOf((s) => s.paidBy === "payer" || s.paidBy === "zus");

  if (notPayableReason) warnings.push(notPayableReason);

  return {
    entitled:
      errors.length === 0 && segments.some((s) => s.payable && s.days > 0),
    dailyBasis,
    entitlementFromDate: formatDate(entitlementFrom),
    sicknessPeriod: {
      maxDays: maxPeriodDays,
      usedDays: periodUsed,
      remainingDays: Math.max(0, maxPeriodDays - periodUsed),
      exhaustedOn: exhaustedOn ? formatDate(exhaustedOn) : undefined,
    },
    segments,
    totals: {
      employer: employerTotal,
      benefit: benefitTotal,
      all: round2(employerTotal + benefitTotal),
    },
    errors,
    warnings,
    notes,
  };
}
