import { BenefitEngine, EngineInputError, type MaternityPlanInput } from '@zus/engine';

const engine = new BenefitEngine();
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const birth = (overrides: Partial<MaternityPlanInput> = {}): MaternityPlanInput => ({
  event: 'birth',
  eventDate: '2026-03-01',
  childrenCount: 1,
  parents: { primary: { monthlyBasis: 6000 }, secondary: { monthlyBasis: 9000 } },
  ...overrides,
});

describe('podstawa wymiaru (f)', () => {
  it('średnia z 12 miesięcy pomniejszona o 13,71%', () => {
    const r = engine.calculateBasis({
      kind: 'employee',
      months: Array.from({ length: 12 }, () => ({ grossSalary: 6000 })),
    });
    expect(r.monthlyBasis).toBe(5177.4);
    expect(r.dailyBasis).toBe(172.58);
    expect(r.monthsCounted).toBe(12);
  });

  it('wyłącza miesiące z pracą < 1/2 etatu i dolicza premie kwartalne/roczne', () => {
    const r = engine.calculateBasis({
      kind: 'employee',
      months: [{ grossSalary: 6000 }, { grossSalary: 1000, workedLessThanHalf: true }],
      quarterlyBonusesLast4Quarters: 1200,
      annualBonusesLastYear: 1200,
    });
    expect(r.monthsCounted).toBe(1);
    expect(r.monthlyBasis).toBe(5349.98); // (6000 + 100 + 100) * 0.8629
  });

  it('podnosi podstawę do minimalnej dla pełnego etatu (Art. 45)', () => {
    const r = engine.calculateBasis({ kind: 'employee', months: [{ grossSalary: 3000 }] });
    expect(r.monthlyBasis).toBe(4147.1);
  });

  it('ogranicza przychód niebędącego pracownikiem do limitu', () => {
    const r = engine.calculateBasis({ kind: 'non_employee', months: [{ contributionBasis: 30000 }] });
    expect(r.monthlyBasis).toBe(20321.3);
  });

  it('przerwa < 1 miesiąca – podstawa poprzedniego zasiłku (Art. 43)', () => {
    const r = engine.calculateBasis({
      kind: 'employee',
      months: [],
      previousBasis: 4500,
      gapShorterThanOneMonth: true,
    });
    expect(r.monthlyBasis).toBe(4500);
  });
});

describe('zasiłek macierzyński – urodzenie (b, d)', () => {
  it('standard: 20 tyg. 100% + rodzicielski 70% podzielony między rodziców', () => {
    const r = engine.planMaternity(
      birth({
        parentalParts: [
          { parent: 'primary', weeks: 32 },
          { parent: 'secondary', weeks: 9 },
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    const [maternity, primaryParental, secondaryParental] = r.segments;
    expect(maternity).toMatchObject({ type: 'maternity', days: 140, rate: 1, dailyAmount: 200, totalAmount: 28000 });
    expect(maternity.startDate).toBe('2026-03-01');
    expect(primaryParental).toMatchObject({ rate: 0.7, days: 224, dailyAmount: 140, startDate: '2026-07-19' });
    expect(secondaryParental).toMatchObject({ parent: 'secondary', rate: 0.7, dailyAmount: 210 });
    expect(r.parentalUsage.remainingWeeks).toBe(0);
    expect(r.totals.all).toBe(sum(r.segments.map((s) => s.totalAmount)));
  });

  it('wniosek do 21 dni: 81,5%, a 9 tyg. drugiego rodzica 70%', () => {
    const r = engine.planMaternity(
      birth({
        combinedApplicationWithin21Days: true,
        parentalParts: [
          { parent: 'primary', weeks: 30 },
          { parent: 'secondary', weeks: 11 },
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    const rates = r.segments.map((s) => [s.type, s.parent, s.rate, s.leaveWeeks]);
    expect(rates).toEqual([
      ['maternity', 'primary', 0.815, 20],
      ['parental', 'primary', 0.815, 30],
      ['parental', 'secondary', 0.7, 9],
      ['parental', 'secondary', 0.815, 2],
    ]);
  });

  it('bliźnięta z zaświadczeniem „Za życiem” – 31 + 67 tyg.', () => {
    const r = engine.planMaternity(birth({ childrenCount: 2, zaZyciem: true }));
    expect(r.entitlements.maternityWeeks).toBe(31);
    expect(r.entitlements.parentalWeeks).toBe(67);
    expect(r.entitlements.parentalWeeksPerParentMax).toBe(58);
  });

  it('nie pozwala jednemu rodzicowi zabrać 9 tyg. drugiego rodzica', () => {
    const r = engine.planMaternity(birth({ parentalParts: [{ parent: 'primary', weeks: 41 }] }));
    expect(r.errors.some((e) => e.includes('182^1a § 4'))).toBe(true);
  });

  it('przejęcie urlopu macierzyńskiego przez ojca dopiero po 14 tyg.', () => {
    const ok = engine.planMaternity(birth({ maternityTransfer: { weeks: 6 } }));
    expect(ok.errors).toEqual([]);
    expect(ok.segments.map((s) => [s.parent, s.days])).toEqual([
      ['primary', 98],
      ['secondary', 42],
    ]);
    const tooEarly = engine.planMaternity(birth({ maternityTransfer: { weeks: 7 } }));
    expect(tooEarly.errors.length).toBeGreaterThan(0);
  });

  it('urlop przed porodem przesuwa start, nie wydłuża urlopu', () => {
    const r = engine.planMaternity(birth({ prenatalWeeks: 2 }));
    expect(r.segments[0]).toMatchObject({ startDate: '2026-02-15', days: 140 });
  });

  it('uzupełniający urlop macierzyński – wcześniak < 28 tyg., 50 dni w szpitalu → 8 tyg.', () => {
    const r = engine.planMaternity(
      birth({ supplementary: { gestationWeeks: 26, birthWeightGrams: 900, hospitalizationDays: 50 } }),
    );
    expect(r.entitlements.supplementaryWeeks).toBe(8);
    expect(r.segments[1]).toMatchObject({ type: 'supplementary_maternity', days: 56, rate: 1 });
  });

  it('martwe urodzenie – 8 tyg. urlopu macierzyńskiego, bez rodzicielskiego', () => {
    const r = engine.planMaternity(birth({ childLoss: { survivingChildren: 0 } }));
    expect(r.entitlements.maternityDays).toBe(56);
    expect(r.entitlements.parentalWeeks).toBe(0);
  });

  it('urlop ojcowski 2 tyg. 100%', () => {
    const r = engine.planMaternity(birth({ paternity: [{ weeks: 2, startDate: '2026-03-10' }] }));
    const paternity = r.segments.find((s) => s.type === 'paternity');
    expect(paternity).toMatchObject({ parent: 'secondary', days: 14, rate: 1, dailyAmount: 300 });
  });

  it('brak wypłaty przy braku ubezpieczenia lub zadłużeniu składkowym', () => {
    const r = engine.planMaternity(
      birth({ parents: { primary: { monthlyBasis: 6000, contributionDebt: 500 } } }),
    );
    expect(r.segments[0].payable).toBe(false);
    expect(r.totals.all).toBe(0);
  });

  it('podwyższa zasiłek do kwoty świadczenia rodzicielskiego (Art. 31 ust. 3a)', () => {
    const r = engine.planMaternity(birth({ parents: { primary: { monthlyBasis: 800 } } }));
    expect(r.segments[0].monthlyAmount).toBe(1000);
  });
});

describe('łączenie urlopu rodzicielskiego z pracą (c)', () => {
  it('praca na 1/2 etatu wydłuża urlop 2x i obniża zasiłek proporcjonalnie', () => {
    const r = engine.planMaternity(birth({ parentalParts: [{ parent: 'primary', weeks: 32, workFte: 0.5 }] }));
    expect(r.errors).toEqual([]);
    const parental = r.segments[1];
    expect(parental).toMatchObject({ days: 448, workFte: 0.5, monthlyAmount: 2100, dailyAmount: 70 });
  });

  it('odrzuca pracę powyżej 1/2 etatu i u niepracownika', () => {
    const r = engine.planMaternity(
      birth({
        parents: { primary: { monthlyBasis: 6000, isEmployee: false } },
        parentalParts: [{ parent: 'primary', weeks: 10, workFte: 0.6 }],
      }),
    );
    expect(r.errors).toHaveLength(2);
  });
});

describe('adopcja i rodzina zastępcza (e)', () => {
  it('adopcja 1 dziecka – 20 + 41 tyg.', () => {
    const r = engine.planMaternity({
      event: 'adoption',
      eventDate: '2026-05-01',
      childBirthDate: '2022-01-01',
      childrenCount: 1,
      parents: { primary: { monthlyBasis: 6000 } },
    });
    expect(r.segments[0]).toMatchObject({ type: 'maternity_conditions', days: 140, rate: 1 });
    expect(r.entitlements.parentalWeeks).toBe(41);
  });

  it('dziecko tuż przed 14. urodzinami – gwarantowane 9 tyg. i 38 tyg. rodzicielskiego', () => {
    const r = engine.planMaternity({
      event: 'adoption',
      eventDate: '2026-05-01',
      childBirthDate: '2012-05-20',
      childrenCount: 1,
      parents: { primary: { monthlyBasis: 6000 } },
    });
    expect(r.entitlements.maternityDays).toBe(63);
    expect(r.entitlements.parentalWeeks).toBe(38);
  });

  it('rodzina zastępcza – dziecko powyżej 7 lat nie daje prawa do zasiłku', () => {
    expect(() =>
      engine.planMaternity({
        event: 'foster',
        eventDate: '2026-05-01',
        childBirthDate: '2018-01-01',
        childrenCount: 1,
        parents: { primary: { monthlyBasis: 6000 } },
      }),
    ).toThrow(EngineInputError);
  });
});

describe('zasiłek chorobowy w ciąży (a)', () => {
  const employee = {
    monthlyBasis: 6000,
    insuranceKind: 'mandatory' as const,
    insuranceStartDate: '2025-01-01',
  };

  it('pracownica: 33 dni wynagrodzenia od pracodawcy, potem zasiłek 100%', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      incapacity: { startDate: '2026-03-01', endDate: '2026-04-30' },
    });
    expect(r.entitled).toBe(true);
    expect(r.segments.map((s) => [s.type, s.startDate, s.endDate, s.days, s.paidBy])).toEqual([
      ['employer_sick_pay', '2026-03-01', '2026-04-02', 33, 'employer'],
      ['sickness', '2026-04-03', '2026-04-30', 28, 'zus'],
    ]);
    expect(r.segments[1]).toMatchObject({ rate: 1, dailyAmount: 200, totalAmount: 5600 });
    expect(r.totals).toEqual({ employer: 6600, benefit: 5600, all: 12200 });
  });

  it('ubezpieczenie dobrowolne: 90 dni wyczekiwania, zasiłek od 1. dnia po nim', () => {
    const r = engine.calculatePregnancyBenefits({
      monthlyBasis: 4500,
      insuranceKind: 'voluntary',
      insuranceStartDate: '2026-01-01',
      incapacity: { startDate: '2026-02-01', endDate: '2026-04-30' },
    });
    expect(r.entitlementFromDate).toBe('2026-04-01');
    expect(r.segments.map((s) => [s.type, s.days, s.totalAmount])).toEqual([
      ['waiting_period', 59, 0],
      ['sickness', 30, 4500],
    ]);
  });

  it('wyczerpanie 270 dni okresu zasiłkowego', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      previousIncapacityDaysInPregnancy: 260,
      employerSickDaysUsedThisYear: 33,
      incapacity: { startDate: '2026-06-01', endDate: '2026-06-20' },
    });
    expect(r.segments.map((s) => [s.type, s.days])).toEqual([
      ['sickness', 10],
      ['period_exhausted', 10],
    ]);
    expect(r.sicknessPeriod).toMatchObject({ usedDays: 270, remainingDays: 0, exhaustedOn: '2026-06-11' });
  });

  it('limit 33 dni pracodawcy liczony od nowa w nowym roku', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      employerSickDaysUsedThisYear: 30,
      incapacity: { startDate: '2025-12-20', endDate: '2026-01-31' },
    });
    expect(r.segments.map((s) => [s.type, s.days])).toEqual([
      ['employer_sick_pay', 3],
      ['sickness', 9],
      ['employer_sick_pay', 31],
    ]);
  });

  it('kończy zasiłek chorobowy w dniu porodu', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      expectedBirthDate: '2026-03-20',
      incapacity: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });
    expect(sum(r.segments.map((s) => s.days))).toBe(19);
  });

  it('e-ZLA bez kodu „B” – 80%', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      employerSickDaysUsedThisYear: 33,
      incapacity: { startDate: '2026-03-01', endDate: '2026-03-10', pregnancyCodeB: false },
    });
    expect(r.segments[0]).toMatchObject({ rate: 0.8, dailyAmount: 160 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('likwidacja pracodawcy – zasiłek w wysokości macierzyńskiego do dnia porodu', () => {
    const r = engine.calculatePregnancyBenefits({
      ...employee,
      expectedBirthDate: '2026-08-10',
      jobLoss: { employmentEndDate: '2026-05-31', reason: 'employer_insolvency' },
    });
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({
      type: 'maternity_level',
      startDate: '2026-06-01',
      endDate: '2026-08-09',
      days: 70,
      totalAmount: 14000,
    });
  });

  it('zadłużenie składkowe przedsiębiorczyni – brak wypłaty', () => {
    const r = engine.calculatePregnancyBenefits({
      monthlyBasis: 4500,
      insuranceKind: 'voluntary',
      insuranceStartDate: '2025-01-01',
      contributionDebt: 300,
      incapacity: { startDate: '2026-03-01', endDate: '2026-03-10' },
    });
    expect(r.entitled).toBe(false);
    expect(r.totals.all).toBe(0);
  });
});

describe('parametry (panel administracyjny)', () => {
  it('zmiana stawki wpływa na wynik bez zmian w kodzie', () => {
    const custom = new BenefitEngine();
    custom.updateParams({ RATE_PARENTAL_70: 0.8 });
    const r = custom.planMaternity(birth({ parentalParts: [{ parent: 'primary', weeks: 10 }] }));
    expect(r.segments[1].rate).toBe(0.8);
    expect(engine.getParams().RATE_PARENTAL_70).toBe(0.7);
  });
});

describe('zgon matki (Art. 180, 182^1g KP)', () => {
  const death = (overrides: Partial<MaternityPlanInput> = {}) =>
    birth({
      maternityTransfer: { circumstance: 'death', weeks: 16 },
      parentalParts: [{ parent: 'secondary', weeks: 41 }],
      ...overrides,
    });

  it('ojciec przejmuje resztę urlopu macierzyńskiego od dnia po zgonie, bez minimum 14 tyg. matki', () => {
    const r = engine.planMaternity(death());
    const maternity = r.segments.filter((s) => s.type === 'maternity');
    expect(maternity.map((s) => [s.parent, s.days])).toEqual([
      ['primary', 28],
      ['secondary', 112],
    ]);
    expect(r.errors).toEqual([]);
  });

  it('ojcu przysługuje cała pula urlopu rodzicielskiego – 9 tyg. matki nie przepada', () => {
    const r = engine.planMaternity(death());
    expect(r.entitlements.parentalWeeksPerParentMax).toBe(41);
    expect(r.parentalUsage.secondaryWeeks).toBe(41);
    expect(r.errors).toEqual([]);
  });

  it('nie pozwala zaplanować urlopu rodzicielskiego zmarłej matce', () => {
    const r = engine.planMaternity(death({ parentalParts: [{ parent: 'primary', weeks: 9 }] }));
    expect(r.errors.some((e) => e.includes('tylko ojciec'))).toBe(true);
  });

  it('bez zgonu jeden rodzic nadal ma maks. 32 tyg.', () => {
    const r = engine.planMaternity(birth({ parentalParts: [{ parent: 'secondary', weeks: 41 }] }));
    expect(r.entitlements.parentalWeeksPerParentMax).toBe(32);
    expect(r.errors.some((e) => e.includes('maks. 32 tyg.'))).toBe(true);
  });
});
