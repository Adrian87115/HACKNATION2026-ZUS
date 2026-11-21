import type { BenefitParams } from './params.js';
import { EngineInputError, requireNonNegative, round2 } from './utils.js';

/**
 * Kalkulator (f) – podstawa wymiaru zasiłku (Art. 36-52 ustawy zasiłkowej).
 * Kwoty wejściowe to kwoty BRUTTO (przychód stanowiący podstawę wymiaru składek);
 * silnik sam odlicza składki finansowane przez ubezpieczonego (13,71%).
 */

interface PreviousBasis {
  /** Podstawa ustalona dla poprzedniego zasiłku (np. chorobowego w ciąży). */
  previousBasis?: number;
  /** Przerwa między zasiłkami krótsza niż miesiąc kalendarzowy → podstawy nie ustala się na nowo (Art. 43). */
  gapShorterThanOneMonth?: boolean;
}

export interface EmployeeMonth {
  /** Wynagrodzenie brutto wypłacone za miesiąc (wraz z premiami miesięcznymi – Art. 42 ust. 1). */
  grossSalary: number;
  /** Przepracowano mniej niż połowę obowiązującego czasu pracy → miesiąc wyłączony (Art. 38 ust. 2 pkt 1). */
  workedLessThanHalf?: boolean;
  /** Wynagrodzenie po uzupełnieniu do pełnego miesiąca (Art. 38 ust. 2 pkt 2, Art. 37 ust. 2). */
  supplementedGross?: number;
}

export interface EmployeeBasisInput extends PreviousBasis {
  kind: 'employee';
  /** Pełne miesiące kalendarzowe (maks. 12) poprzedzające miesiąc powstania prawa do zasiłku (Art. 36 ust. 1-2). */
  months: EmployeeMonth[];
  /** Suma premii kwartalnych wypłaconych za 4 kwartały poprzedzające (Art. 42 ust. 2). */
  quarterlyBonusesLast4Quarters?: number;
  /** Premie/nagrody roczne wypłacone za poprzedni rok (Art. 42 ust. 3). */
  annualBonusesLastYear?: number;
  /** Wynagrodzenie brutto z umowy za pełny miesiąc – gdy prawo powstało przed upływem pełnego miesiąca (Art. 37). */
  contractMonthlyGross?: number;
  /** Pełny wymiar czasu pracy → podstawa nie niższa niż minimalna (Art. 45). Domyślnie true. */
  fullTime?: boolean;
}

export interface NonEmployeeMonth {
  /** Podstawa wymiaru składki na ubezpieczenie chorobowe za miesiąc (przychód / zadeklarowana kwota). */
  contributionBasis: number;
  /** Działalność wykonywana przez mniej niż połowę miesiąca z powodu zasiłku itp. (Art. 50 ust. 1 pkt 1). */
  workedLessThanHalf?: boolean;
}

export interface NonEmployeeBasisInput extends PreviousBasis {
  kind: 'non_employee';
  /** Pełne miesiące kalendarzowe (maks. 12) poprzedzające miesiąc powstania prawa do zasiłku (Art. 48 ust. 1). */
  months: NonEmployeeMonth[];
  /** Zadeklarowana podstawa – gdy prawo powstało przed upływem pełnego miesiąca ubezpieczenia (Art. 49). */
  contractMonthlyBasis?: number;
}

export type BasisInput = EmployeeBasisInput | NonEmployeeBasisInput;

export interface BasisResult {
  /** Miesięczna podstawa wymiaru zasiłku. */
  monthlyBasis: number;
  /** Podstawa za jeden dzień = 1/30 podstawy miesięcznej (Art. 36 ust. 3). */
  dailyBasis: number;
  monthsCounted: number;
  /** Zastosowane reguły – do wyświetlenia użytkownikowi „skąd ta kwota”. */
  appliedRules: string[];
}

const average = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

export function calculateBasis(p: BenefitParams, input: BasisInput): BasisResult {
  const rules: string[] = [];
  const net = (gross: number) => gross * (1 - p.SOCIAL_CONTRIBUTION_RATE);
  const result = (monthly: number, monthsCounted: number): BasisResult => {
    const monthlyBasis = round2(monthly);
    return {
      monthlyBasis,
      dailyBasis: round2(monthlyBasis / p.STATUTORY_MONTH_DAYS),
      monthsCounted,
      appliedRules: rules,
    };
  };

  if (input.gapShorterThanOneMonth && input.previousBasis !== undefined) {
    rules.push(
      'Przerwa między zasiłkami krótsza niż miesiąc – przyjęto podstawę poprzedniego zasiłku (Art. 43).',
    );
    return result(requireNonNegative(input.previousBasis, 'previousBasis'), 0);
  }

  if (!Array.isArray(input.months) || input.months.length > p.BASIS_MONTHS_COUNT) {
    throw new EngineInputError(
      `Pole "months" musi być listą maksymalnie ${p.BASIS_MONTHS_COUNT} pełnych miesięcy kalendarzowych.`,
    );
  }

  if (input.kind === 'employee') {
    let monthly: number;
    let counted = 0;

    if (input.months.length === 0) {
      if (input.contractMonthlyGross === undefined) {
        throw new EngineInputError(
          'Brak pełnych miesięcy ubezpieczenia – podaj "contractMonthlyGross" (Art. 37).',
        );
      }
      rules.push('Brak pełnego miesiąca ubezpieczenia – wynagrodzenie z umowy za pełny miesiąc (Art. 37).');
      monthly = net(requireNonNegative(input.contractMonthlyGross, 'contractMonthlyGross'));
    } else {
      const valueOf = (m: EmployeeMonth) =>
        requireNonNegative(m.supplementedGross ?? m.grossSalary, 'months[].grossSalary');
      let included = input.months.filter((m) => !m.workedLessThanHalf);
      if (included.length === 0) {
        included = input.months;
        rules.push(
          'W każdym miesiącu przepracowano mniej niż połowę czasu pracy – przyjęto wszystkie miesiące po uzupełnieniu (Art. 38 ust. 3).',
        );
      } else if (included.length < input.months.length) {
        rules.push(
          `Wyłączono ${input.months.length - included.length} mies., w których przepracowano mniej niż połowę czasu pracy (Art. 38 ust. 2 pkt 1).`,
        );
      }
      if (included.some((m) => m.supplementedGross !== undefined)) {
        rules.push('Wynagrodzenie za niepełne miesiące uzupełniono do pełnego miesiąca (Art. 38 ust. 2 pkt 2).');
      }
      counted = included.length;
      monthly = net(average(included.map(valueOf)));
      rules.push(
        `Średnie wynagrodzenie z ${counted} mies. pomniejszone o ${round2(p.SOCIAL_CONTRIBUTION_RATE * 100)}% składek (Art. 36, Art. 3 pkt 3).`,
      );
    }

    const quarterly = requireNonNegative(input.quarterlyBonusesLast4Quarters ?? 0, 'quarterlyBonusesLast4Quarters');
    const annual = requireNonNegative(input.annualBonusesLastYear ?? 0, 'annualBonusesLastYear');
    if (quarterly > 0) rules.push('Dodano 1/12 premii kwartalnych z 4 kwartałów (Art. 42 ust. 2).');
    if (annual > 0) rules.push('Dodano 1/12 premii rocznej za poprzedni rok (Art. 42 ust. 3).');
    monthly += net(quarterly / 12) + net(annual / 12);

    if ((input.fullTime ?? true) && monthly < p.MIN_FULL_TIME_BASIS_2026) {
      rules.push(
        `Podstawa podniesiona do minimalnej (${p.MIN_FULL_TIME_BASIS_2026} zł) dla pełnego etatu (Art. 45).`,
      );
      monthly = p.MIN_FULL_TIME_BASIS_2026;
    }
    return result(monthly, counted);
  }

  // Ubezpieczony niebędący pracownikiem (zleceniobiorca, przedsiębiorca) – Art. 48-50
  const capped = (basis: number) =>
    Math.min(
      requireNonNegative(basis, 'months[].contributionBasis'),
      p.MAX_NON_EMPLOYEE_MONTHLY_CONTRIBUTION_BASIS_2026,
    );

  if (input.months.length === 0) {
    if (input.contractMonthlyBasis === undefined) {
      throw new EngineInputError(
        'Brak pełnych miesięcy ubezpieczenia – podaj "contractMonthlyBasis" (Art. 49).',
      );
    }
    rules.push('Brak pełnego miesiąca ubezpieczenia – kwota z umowy/deklaracji za miesiąc (Art. 49).');
    return result(net(capped(input.contractMonthlyBasis)), 0);
  }

  let included = input.months.filter((m) => !m.workedLessThanHalf);
  if (included.length === 0) {
    included = input.months;
    rules.push('Przychód zmniejszony w każdym miesiącu – przyjęto wszystkie miesiące (Art. 50 ust. 2).');
  } else if (included.length < input.months.length) {
    rules.push(
      `Wyłączono ${input.months.length - included.length} mies. z działalnością krótszą niż połowa miesiąca (Art. 50 ust. 1).`,
    );
  }
  if (input.months.some((m) => m.contributionBasis > p.MAX_NON_EMPLOYEE_MONTHLY_CONTRIBUTION_BASIS_2026)) {
    rules.push(
      `Miesięczny przychód ograniczono do limitu ${p.MAX_NON_EMPLOYEE_MONTHLY_CONTRIBUTION_BASIS_2026} zł.`,
    );
  }
  rules.push(
    `Średni przychód z ${included.length} mies. pomniejszony o ${round2(p.SOCIAL_CONTRIBUTION_RATE * 100)}% (Art. 48, Art. 3 pkt 4).`,
  );
  return result(net(average(included.map((m) => capped(m.contributionBasis)))), included.length);
}
