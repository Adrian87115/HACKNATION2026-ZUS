import { benefitAmount, benefitRate, type SegmentType } from './amounts.js';
import {
  maternityConditionsLeave,
  maternityDaysAfterChildLoss,
  maternityLeaveWeeks,
  maxExtendedParentalWeeks,
  parentalLeaveDeadline,
  parentalLeaveWeeks,
  paternityLeaveDeadline,
  supplementaryMaternityWeeks,
  type ChildLossInput,
  type SupplementaryInput,
} from './leaveDurations.js';
import type { BenefitParams } from './params.js';
import {
  addDays,
  addYears,
  EngineInputError,
  formatDate,
  formatDatePl,
  parseDate,
  requireNonNegative,
  requirePositiveInt,
  round2,
} from './utils.js';

/**
 * Zintegrowany kalkulator zasiłku macierzyńskiego – okres trwania i wysokość dla obojga rodziców:
 *  (b) urodzenie dziecka – liczba dzieci, „Za życiem”, wcześniak/hospitalizacja, martwe urodzenie,
 *  (c) łączenie urlopu rodzicielskiego z pracą,
 *  (d) podział uprawnień między oboje rodziców,
 *  (e) adopcja i rodzina zastępcza niezawodowa.
 * Wysokość liczona jest od indywidualnej podstawy wymiaru każdego rodzica – kalkulator (f), basis.ts.
 */

export type FamilyEvent = 'birth' | 'adoption' | 'foster';

/** primary = matka / rodzic, który przyjął dziecko; secondary = ojciec / drugi rodzic. */
export type ParentRole = 'primary' | 'secondary';

export interface ParentProfile {
  /** Miesięczna podstawa wymiaru zasiłku (z calculateBasis albo wpisana ręcznie). */
  monthlyBasis: number;
  /** Podlega ubezpieczeniu chorobowemu w dniu porodu / przyjęcia dziecka. Domyślnie true. */
  insured?: boolean;
  /** Pracownik (umowa o pracę) – tylko pracownik może łączyć urlop rodzicielski z pracą. Domyślnie true. */
  isEmployee?: boolean;
  /** Zadłużenie z tytułu składek na dzień powstania prawa (Art. 2a – dot. m.in. przedsiębiorców). */
  contributionDebt?: number;
}

export interface ParentalPartInput {
  parent: ParentRole;
  /** Tygodnie urlopu rodzicielskiego zużywane z puli (bez wydłużenia za pracę). */
  weeks: number;
  /** Wymiar etatu pracy w trakcie urlopu (0-0,5) – Art. 182^1e KP. */
  workFte?: number;
  /** Data rozpoczęcia; domyślnie dzień po zakończeniu poprzedniego okresu. */
  startDate?: string;
}

export interface MaternityPlanInput {
  event: FamilyEvent;
  /** Data porodu albo przyjęcia dziecka na wychowanie (YYYY-MM-DD). */
  eventDate: string;
  /** Liczba dzieci urodzonych przy jednym porodzie / przyjętych jednocześnie. */
  childrenCount: number;
  /** Zaświadczenie „Za życiem” (Art. 182^1a § 2 KP). */
  zaZyciem?: boolean;
  /** Data urodzenia dziecka – wymagana przy adopcji i rodzinie zastępczej. */
  childBirthDate?: string;
  /** Odroczony obowiązek szkolny – rodzina zastępcza (Art. 183 § 1 KP). */
  deferredSchoolObligation?: boolean;
  /** Data uprawomocnienia przysposobienia – termin urlopu ojcowskiego przy adopcji. */
  adoptionDecreeDate?: string;
  /** Tygodnie urlopu macierzyńskiego wykorzystane przed porodem (maks. 6). */
  prenatalWeeks?: number;
  /** Urodzenie martwego dziecka / zgon dziecka. */
  childLoss?: ChildLossInput;
  /** Uzupełniający urlop macierzyński. Domyślnie wykorzystuje go rodzic, który kończy urlop macierzyński. */
  supplementary?: SupplementaryInput & { parent?: ParentRole };
  /** Wniosek o zasiłek za urlop macierzyński i rodzicielski złożony do 21 dni (81,5% – Art. 30a, 31 ust. 3). */
  combinedApplicationWithin21Days?: boolean;
  parents: { primary: ParentProfile; secondary?: ParentProfile };
  /** Część urlopu macierzyńskiego przejęta przez drugiego rodzica (Art. 180 § 4-13 KP). */
  maternityTransfer?: {
    weeks: number;
    /** standard = po 14 tyg.; special = po 8 tyg. (szpital, niezdolność do samodzielnej egzystencji, porzucenie). */
    circumstance?: 'standard' | 'special';
  };
  /** Urlop ojcowski – maks. 2 części po min. 1 tydzień (Art. 182^3 KP). */
  paternity?: { weeks: number; startDate?: string }[];
  /** Części urlopu rodzicielskiego w kolejności (maks. 5). */
  parentalParts?: ParentalPartInput[];
}

export interface PlanSegment {
  type: SegmentType;
  parent: ParentRole;
  startDate: string;
  endDate: string;
  /** Dni kalendarzowe pobierania zasiłku (z wydłużeniem przy łączeniu z pracą). */
  days: number;
  /** Tygodnie zużyte z wymiaru urlopu. */
  leaveWeeks: number;
  workFte: number;
  rate: number;
  monthlyAmount: number;
  dailyAmount: number;
  totalAmount: number;
  payable: boolean;
  notPayableReason?: string;
  legalBasis: string;
}

export interface MaternityPlanResult {
  entitlements: {
    maternityDays: number;
    maternityWeeks: number;
    supplementaryWeeks: number;
    parentalWeeks: number;
    /** Maks. tygodnie rodzicielskiego dla jednego rodzica (pula minus 9 tyg. drugiego rodzica). */
    parentalWeeksPerParentMax: number;
    maxExtendedParentalWeeks: number;
    paternityWeeks: number;
  };
  segments: PlanSegment[];
  parentalUsage: { primaryWeeks: number; secondaryWeeks: number; remainingWeeks: number };
  totals: { primary: number; secondary: number; all: number };
  /** Naruszenia przepisów – plan w tej postaci nie jest możliwy. */
  errors: string[];
  warnings: string[];
  notes: string[];
}

const LEGAL_BASIS: Record<SegmentType, string> = {
  maternity: 'Art. 180 KP; Art. 29, 31 ust. 1 i 3 ustawy zasiłkowej',
  maternity_conditions: 'Art. 183 KP; Art. 29 ust. 1 pkt 2-3, Art. 31 ust. 1 i 3 ustawy zasiłkowej',
  supplementary_maternity: 'Art. 180^2 KP; Art. 31 ust. 1 ustawy zasiłkowej',
  parental: 'Art. 182^1a, 182^1e-f KP; Art. 31 ust. 2, 3, 3f, 4a ustawy zasiłkowej',
  paternity: 'Art. 182^3 KP; Art. 31 ust. 1 ustawy zasiłkowej',
};

export function planMaternity(p: BenefitParams, input: MaternityPlanInput): MaternityPlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const segments: PlanSegment[] = [];

  if (!['birth', 'adoption', 'foster'].includes(input.event)) {
    throw new EngineInputError('Wybierz rodzaj zdarzenia: urodzenie, adopcja albo rodzina zastępcza.');
  }
  if (!input.parents?.primary) throw new EngineInputError('Uzupełnij dane pierwszego rodzica.');
  requireNonNegative(input.parents.primary.monthlyBasis, 'parents.primary.monthlyBasis');
  if (input.parents.secondary) {
    requireNonNegative(input.parents.secondary.monthlyBasis, 'parents.secondary.monthlyBasis');
  }

  const isBirth = input.event === 'birth';
  const eventDate = parseDate(input.eventDate, 'eventDate');
  const childrenCount = requirePositiveInt(input.childrenCount, 'childrenCount');
  const zaZyciem = input.zaZyciem ?? false;
  const combined = input.combinedApplicationWithin21Days ?? false;
  const parentOf = (role: ParentRole) =>
    role === 'primary' ? input.parents.primary : input.parents.secondary;

  // --- Prawo do wypłaty (ubezpieczenie, zadłużenie składkowe) ---------------------------
  const debtLimit = round2(p.MIN_WAGE_2026_GROSS * p.DEBT_EXCLUSION_MIN_WAGE_RATIO);
  const notPayableReason = (role: ParentRole): string | undefined => {
    const parent = parentOf(role);
    if (!parent) return 'Brak danych drugiego rodzica.';
    if (parent.insured === false) {
      return 'Rodzic nie podlega ubezpieczeniu chorobowemu – zasiłek macierzyński nie przysługuje (Art. 29 ust. 1).';
    }
    if ((parent.contributionDebt ?? 0) > debtLimit) {
      return `Zadłużenie składkowe przekracza ${debtLimit} zł – zasiłek nie jest wypłacany do czasu spłaty całości zadłużenia; prawo przedawnia się po 6 mies. (Art. 2a).`;
    }
    return undefined;
  };

  /** Dodaje okres i zwraca dzień następujący po jego zakończeniu. */
  const addSegment = (
    type: SegmentType,
    role: ParentRole,
    start: Date,
    days: number,
    leaveWeeks: number,
    rate: number,
    workFte = 0,
  ): Date => {
    const reason = notPayableReason(role);
    const amount = benefitAmount(p, {
      monthlyBasis: parentOf(role)?.monthlyBasis ?? 0,
      rate,
      days,
      workFte,
    });
    if (!reason && amount.raisedToFloor) {
      const floorNote = `Zasiłek podwyższono do kwoty świadczenia rodzicielskiego (${p.PARENTAL_BENEFIT_FLOOR_MONTHLY} zł/mies.) – Art. 31 ust. 3a.`;
      if (!notes.includes(floorNote)) notes.push(floorNote);
    }
    segments.push({
      type,
      parent: role,
      startDate: formatDate(start),
      endDate: formatDate(addDays(start, days - 1)),
      days,
      leaveWeeks: round2(leaveWeeks),
      workFte,
      rate,
      monthlyAmount: reason ? 0 : amount.monthlyAmount,
      dailyAmount: reason ? 0 : amount.dailyAmount,
      totalAmount: reason ? 0 : amount.totalAmount,
      payable: !reason,
      notPayableReason: reason,
      legalBasis: LEGAL_BASIS[type],
    });
    return addDays(start, days);
  };

  // --- Wymiar urlopu macierzyńskiego / na warunkach macierzyńskiego -----------------------
  const prenatalWeeks = requireNonNegative(input.prenatalWeeks ?? 0, 'prenatalWeeks');
  if (prenatalWeeks > 0 && !isBirth) errors.push('Urlop przed porodem dotyczy wyłącznie urodzenia dziecka.');
  if (prenatalWeeks > p.MATERNITY_MAX_PRENATAL_WEEKS) {
    errors.push(`Przed porodem można wykorzystać maks. ${p.MATERNITY_MAX_PRENATAL_WEEKS} tyg. urlopu macierzyńskiego (Art. 180 § 2 KP).`);
  }
  const prenatalDays = isBirth ? Math.round(prenatalWeeks * 7) : 0;

  let childBirthDate = eventDate;
  let maternityDays: number;
  let adoptionMinimumCase = false;
  let childrenForParental = childrenCount;

  if (isBirth) {
    maternityDays = maternityLeaveWeeks(p, childrenCount) * 7;
    if (input.childLoss) {
      const surviving = requireNonNegative(input.childLoss.survivingChildren, 'childLoss.survivingChildren');
      if (surviving >= childrenCount) {
        throw new EngineInputError('Liczba żyjących dzieci musi być mniejsza niż łączna liczba dzieci.');
      }
      maternityDays =
        prenatalDays +
        maternityDaysAfterChildLoss(p, {
          birthDate: eventDate,
          deathDate: input.childLoss.dateOfDeath
            ? parseDate(input.childLoss.dateOfDeath, 'childLoss.dateOfDeath')
            : undefined,
          childrenCount,
          survivingChildren: surviving,
        });
      childrenForParental = surviving;
      notes.push('Urodzenie martwego dziecka lub zgon dziecka – wymiar urlopu macierzyńskiego wg Art. 180^1 KP.');
    }
  } else {
    if (!input.childBirthDate) {
      throw new EngineInputError('Przy adopcji i rodzinie zastępczej podaj datę urodzenia dziecka.');
    }
    childBirthDate = parseDate(input.childBirthDate, 'childBirthDate');
    const leave = maternityConditionsLeave(p, {
      kind: input.event === 'adoption' ? 'adoption' : 'foster',
      childrenCount,
      childBirthDate,
      placementDate: eventDate,
      deferredSchoolObligation: input.deferredSchoolObligation,
    });
    maternityDays = leave.days;
    adoptionMinimumCase = leave.minimumApplied;
    if (leave.days < maternityLeaveWeeks(p, childrenCount) * 7) {
      notes.push(
        `Urlop na warunkach urlopu macierzyńskiego skrócony ze względu na wiek dziecka (do ${formatDatePl(leave.ageLimitDate)}), nie krócej niż ${p.ADOPTION_FOSTER_MIN_GUARANTEED_MATERNITY_WEEKS} tyg. (Art. 183 § 3 KP).`,
      );
    }
  }

  // --- Urlop macierzyński matki i ewentualne przejęcie przez drugiego rodzica -----------
  const maternityType: SegmentType = isBirth ? 'maternity' : 'maternity_conditions';
  const maternityRate = benefitRate(p, maternityType, { combinedApplication: combined });
  const transferWeeks = requireNonNegative(input.maternityTransfer?.weeks ?? 0, 'maternityTransfer.weeks');
  const transferDays = Math.round(transferWeeks * 7);
  if (transferDays > 0) {
    const minWeeks =
      input.maternityTransfer?.circumstance === 'special'
        ? p.MOTHER_MIN_POSTPARTUM_WEEKS_SPECIAL
        : p.MOTHER_MIN_POSTPARTUM_WEEKS_STANDARD;
    if (!input.parents.secondary) errors.push('Przejęcie urlopu macierzyńskiego wymaga danych drugiego rodzica.');
    if (maternityDays - prenatalDays - transferDays < minWeeks * 7) {
      errors.push(
        `Przed przekazaniem urlopu matka musi wykorzystać co najmniej ${minWeeks} tyg. po porodzie (Art. 180 § 4 i 6 KP, Art. 29 ust. 3 i 5 ustawy zasiłkowej).`,
      );
    }
  }

  let cursor = addSegment(
    maternityType,
    'primary',
    addDays(eventDate, -prenatalDays),
    Math.max(maternityDays - transferDays, 0),
    Math.max(maternityDays - transferDays, 0) / 7,
    maternityRate,
  );
  if (transferDays > 0) {
    cursor = addSegment(maternityType, 'secondary', cursor, transferDays, transferWeeks, maternityRate);
  }
  if (isBirth && notPayableReason('primary') && input.parents.primary.insured === false) {
    warnings.push(
      'Matka nie jest ubezpieczona – ojciec może mieć prawo do zasiłku za część urlopu macierzyńskiego tylko w szczególnych sytuacjach (Art. 29 ust. 9-10) oraz do zasiłku za urlop rodzicielski.',
    );
  }

  // --- Uzupełniający urlop macierzyński ---------------------------------------------------
  let supplementaryWeeks = 0;
  if (input.supplementary && childrenForParental > 0) {
    const s = supplementaryMaternityWeeks(p, input.supplementary);
    supplementaryWeeks = s.weeks;
    if (s.weeks === 0) {
      warnings.push('Warunki uzupełniającego urlopu macierzyńskiego nie są spełnione (Art. 180^2 KP).');
    } else {
      const role = input.supplementary.parent ?? (transferDays > 0 ? 'secondary' : 'primary');
      cursor = addSegment(
        'supplementary_maternity',
        role,
        cursor,
        s.weeks * 7,
        s.weeks,
        benefitRate(p, 'supplementary_maternity', { combinedApplication: combined }),
      );
    }
  }

  // --- Urlop rodzicielski -------------------------------------------------------------------
  const parentalWeeks =
    childrenForParental === 0
      ? 0
      : parentalLeaveWeeks(p, { childrenCount: childrenForParental, zaZyciem, adoptionMinimumCase });
  const perParentMax = Math.max(0, parentalWeeks - p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS);
  const maxExtended = maxExtendedParentalWeeks(p, { childrenCount: childrenForParental, zaZyciem });
  const parts = input.parentalParts ?? [];

  if (parts.length > p.PARENTAL_MAX_PARTS) {
    errors.push(`Urlop rodzicielski można podzielić na maks. ${p.PARENTAL_MAX_PARTS} części (Art. 182^1c KP).`);
  }
  if (parts.length > 0 && parentalWeeks === 0) {
    errors.push('Urlop rodzicielski nie przysługuje – brak dziecka pozostałego przy życiu.');
  }

  // Pierwszy przebieg: daty startu części (potrzebne dla Art. 31 ust. 3g i ust. 4).
  const normalized = parts.map((part, i) => {
    const weeks = requirePositiveInt(part.weeks, `parentalParts[${i}].weeks`);
    const workFte = requireNonNegative(part.workFte ?? 0, `parentalParts[${i}].workFte`);
    if (part.parent !== 'primary' && part.parent !== 'secondary') {
      throw new EngineInputError(`Wybierz, który rodzic korzysta z części ${i + 1} urlopu rodzicielskiego.`);
    }
    if (workFte > p.MAX_WORK_FTE_DURING_PARENTAL) {
      errors.push(`Praca w trakcie urlopu rodzicielskiego – maks. ${p.MAX_WORK_FTE_DURING_PARENTAL} etatu (Art. 182^1e § 1 KP).`);
    }
    if (workFte > 0 && parentOf(part.parent)?.isEmployee === false) {
      errors.push('Łączenie urlopu rodzicielskiego z pracą przysługuje tylko pracownikowi (Art. 182^1e KP).');
    }
    // Interpretacja Art. 182^1f: praca na ułamek etatu f zużywa (1 - f) tygodnia puli na tydzień kalendarzowy,
    // stąd wymiar kalendarzowy = tygodnie / (1 - f) (np. 41 tyg. przy 1/2 etatu → 82 tyg., zgodnie z limitem).
    const effectiveFte = Math.min(workFte, p.MAX_WORK_FTE_DURING_PARENTAL);
    return { ...part, weeks, workFte: effectiveFte, start: part.startDate ? parseDate(part.startDate, `parentalParts[${i}].startDate`) : undefined };
  });

  const firstBirthday = addYears(childBirthDate, 1);
  let preCursor = cursor;
  const parentalStarts = normalized.map((part) => {
    const start = part.start ?? preCursor;
    preCursor = addDays(start, Math.round((part.weeks * 7) / (1 - part.workFte)));
    return start;
  });
  const noParentalInFirstYear = isBirth && parentalStarts.every((start) => start >= firstBirthday);
  const combinedForParental = combined && !noParentalInFirstYear;
  if (combined && isBirth && normalized.length > 0 && noParentalInFirstYear) {
    warnings.push('Żaden dzień urlopu rodzicielskiego nie przypada w 1. roku życia dziecka – zasiłek za ten urlop wyniesie 70% (Art. 31 ust. 3g).');
  }

  const used: Record<ParentRole, number> = { primary: 0, secondary: 0 };
  const deadline = isBirth
    ? parentalLeaveDeadline(p, childBirthDate)
    : input.event === 'adoption'
      ? addDays(addYears(childBirthDate, p.ADOPTION_MAX_CHILD_AGE_YEARS), -1)
      : undefined;
  let calendarWeeksTotal = 0;

  normalized.forEach((part, i) => {
    // Przy wniosku z Art. 30a pierwsze 9 tyg. drugiego rodzica płatne 70% (Art. 31 ust. 3f).
    const pieces: { weeks: number; exclusive: boolean }[] = [];
    if (part.parent === 'secondary' && combinedForParental) {
      const exclusiveWeeks = Math.min(part.weeks, Math.max(0, p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS - used.secondary));
      if (exclusiveWeeks > 0) pieces.push({ weeks: exclusiveWeeks, exclusive: true });
      if (part.weeks > exclusiveWeeks) pieces.push({ weeks: part.weeks - exclusiveWeeks, exclusive: false });
    } else {
      pieces.push({ weeks: part.weeks, exclusive: false });
    }

    let segmentStart = parentalStarts[i];
    for (const piece of pieces) {
      const rate = benefitRate(p, 'parental', {
        combinedApplication: combinedForParental,
        secondParentExclusivePart: piece.exclusive,
      });
      const days = Math.round((piece.weeks * 7) / (1 - part.workFte));
      segmentStart = addSegment('parental', part.parent, segmentStart, days, piece.weeks, rate, part.workFte);
    }
    cursor = segmentStart;
    used[part.parent] += part.weeks;
    calendarWeeksTotal += part.weeks / (1 - part.workFte);
    if (deadline && addDays(segmentStart, -1) > deadline) {
      errors.push(`Część ${i + 1} urlopu rodzicielskiego kończy się po ${formatDatePl(deadline)} – po terminie wykorzystania urlopu.`);
    }
  });

  if (used.primary > perParentMax || used.secondary > perParentMax) {
    errors.push(
      `Jeden rodzic może wykorzystać maks. ${perParentMax} tyg. urlopu rodzicielskiego – ${p.SECOND_PARENT_EXCLUSIVE_PARENTAL_WEEKS} tyg. przysługuje wyłącznie drugiemu rodzicowi (Art. 182^1a § 4 KP).`,
    );
  }
  if (used.primary + used.secondary > parentalWeeks) {
    errors.push(`Łączny wymiar urlopu rodzicielskiego wynosi ${parentalWeeks} tyg. (Art. 182^1a KP).`);
  }
  if (calendarWeeksTotal > maxExtended + 1e-9) {
    errors.push(`Urlop rodzicielski wydłużony przez pracę nie może przekroczyć ${maxExtended} tyg. (Art. 182^1f KP).`);
  }
  if (combined) {
    notes.push(
      'Wniosek złożony do 21 dni: 81,5% podstawy za urlop macierzyński i rodzicielski; 9 tyg. drugiego rodzica – 70% (Art. 31 ust. 3 i 3f).',
    );
  }
  if (combined && noParentalInFirstYear) {
    const topUp = segments
      .filter((s) => s.type === 'maternity' && s.payable)
      .reduce((sum, s) => {
        const full = benefitAmount(p, { monthlyBasis: parentOf(s.parent)!.monthlyBasis, rate: p.RATE_FULL, days: s.days });
        return sum + full.totalAmount - s.totalAmount;
      }, 0);
    if (topUp > 0) {
      notes.push(
        `Jeśli w 1. roku życia dziecka nie zostanie wykorzystany urlop rodzicielski, na wniosek przysługuje jednorazowe wyrównanie zasiłku za urlop macierzyński do 100% – ok. ${round2(topUp)} zł (Art. 31 ust. 4).`,
      );
    }
  }

  // --- Urlop ojcowski ---------------------------------------------------------------------
  const paternityParts = input.paternity ?? [];
  if (paternityParts.length > 0) {
    if (input.event === 'foster') errors.push('Urlop ojcowski nie przysługuje rodzinie zastępczej (Art. 182^3 KP).');
    if (!input.parents.secondary) errors.push('Urlop ojcowski wymaga danych drugiego rodzica (ojca).');
    if (paternityParts.length > p.PATERNITY_MAX_PARTS) {
      errors.push(`Urlop ojcowski można podzielić na maks. ${p.PATERNITY_MAX_PARTS} części (Art. 182^3 § 1^1 KP).`);
    }
    const paternityDeadline = paternityLeaveDeadline(p, {
      childBirthDate,
      adoptionDecreeDate: input.adoptionDecreeDate
        ? parseDate(input.adoptionDecreeDate, 'adoptionDecreeDate')
        : undefined,
    });
    if (input.event === 'adoption' && !input.adoptionDecreeDate) {
      warnings.push('Przy adopcji urlop ojcowski wykorzystuje się w ciągu 12 mies. od uprawomocnienia przysposobienia – podaj datę uprawomocnienia przysposobienia.');
    }
    let totalPaternityWeeks = 0;
    let paternityCursor = eventDate;
    paternityParts.forEach((part, i) => {
      const weeks = requirePositiveInt(part.weeks, `paternity[${i}].weeks`);
      if (weeks < p.PATERNITY_MIN_PART_WEEKS) {
        errors.push(`Część urlopu ojcowskiego nie może być krótsza niż ${p.PATERNITY_MIN_PART_WEEKS} tydz.`);
      }
      totalPaternityWeeks += weeks;
      const start = part.startDate ? parseDate(part.startDate, `paternity[${i}].startDate`) : paternityCursor;
      paternityCursor = addSegment('paternity', 'secondary', start, weeks * 7, weeks, benefitRate(p, 'paternity', { combinedApplication: combined }));
      if (addDays(paternityCursor, -1) > paternityDeadline) {
        errors.push(`Urlop ojcowski trzeba wykorzystać do ${formatDatePl(paternityDeadline)} (Art. 182^3 § 1 KP).`);
      }
    });
    if (totalPaternityWeeks > p.PATERNITY_TOTAL_WEEKS) {
      errors.push(`Urlop ojcowski wynosi maks. ${p.PATERNITY_TOTAL_WEEKS} tyg. (Art. 182^3 KP).`);
    }
  }

  segments.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const sumFor = (role?: ParentRole) =>
    round2(segments.filter((s) => !role || s.parent === role).reduce((sum, s) => sum + s.totalAmount, 0));

  return {
    entitlements: {
      maternityDays,
      maternityWeeks: round2(maternityDays / 7),
      supplementaryWeeks,
      parentalWeeks,
      parentalWeeksPerParentMax: perParentMax,
      maxExtendedParentalWeeks: maxExtended,
      paternityWeeks: input.event === 'foster' ? 0 : p.PATERNITY_TOTAL_WEEKS,
    },
    segments,
    parentalUsage: {
      primaryWeeks: used.primary,
      secondaryWeeks: used.secondary,
      remainingWeeks: Math.max(0, parentalWeeks - used.primary - used.secondary),
    },
    totals: { primary: sumFor('primary'), secondary: sumFor('secondary'), all: sumFor() },
    errors,
    warnings,
    notes,
  };
}
