/**
 * Simulated data from ZUS systems (PUE/eZUS) for the demo – fictional people, no real personal data.
 * In production this module would call ZUS registers (KSI) after a real mObywatel / login.gov.pl sign-in.
 */

export type InsuranceTitle = {
  type: 'umowa_o_prace' | 'umowa_zlecenia' | 'dzialalnosc';
  payer: { name: string; nip: string; over20Insured: boolean };
  from: string;
  to: string | null;
  sickness: 'obowiazkowe' | 'dobrowolne' | 'brak';
  fullTime?: boolean;
};

export type ContributionMonth = { month: string; gross: number; sicknessBasis: number };

export type EZla = {
  number: string;
  from: string;
  to: string;
  pregnancyCodeB: boolean;
  issuer: string;
  status: 'aktywne' | 'zakonczone';
};

export type BenefitRecord = {
  type: 'zasilek_chorobowy' | 'wynagrodzenie_chorobowe' | 'zasilek_macierzynski';
  from: string;
  to: string;
  status: 'wyplacony' | 'w_trakcie' | 'oczekuje_na_dokumenty';
  amount: number | null;
  paidBy: 'zus' | 'platnik';
};

export type Account = {
  id: string;
  role: 'mother' | 'father';
  person: { firstName: string; lastName: string; birthDate: string; peselMasked: string; city: string };
  insurance: InsuranceTitle[];
  contributionBases: ContributionMonth[];
  debt: { amount: number; asOf: string };
  eZla: EZla[];
  benefits: BenefitRecord[];
  family: { expectedBirthDate: string | null; childBirthDate: string | null };
};

export type Persona = { id: string; label: string; description: string };

/** 12 full months before `untilMonth` (exclusive), e.g. untilMonth 2026-11 → 2025-11 … 2026-10. */
const months = (untilMonth: string, gross: (i: number) => number, sicknessRatio = 1): ContributionMonth[] => {
  const [y, m] = untilMonth.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - 12 + i, 1));
    const g = gross(i);
    return {
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      gross: g,
      sicknessBasis: Math.round(g * sicknessRatio * 100) / 100,
    };
  });
};

export const ACCOUNTS: Account[] = [
  {
    id: 'pracownica-w-ciazy',
    role: 'mother',
    person: { firstName: 'Anna', lastName: 'Przykładowa', birthDate: '1994-04-12', peselMasked: '•••••••1284', city: 'Warszawa' },
    insurance: [
      {
        type: 'umowa_o_prace',
        payer: { name: 'Biuro Projektów Północ sp. z o.o.', nip: '•••-•••-41-07', over20Insured: true },
        from: '2021-03-01',
        to: null,
        sickness: 'obowiazkowe',
        fullTime: true,
      },
    ],
    contributionBases: months('2026-11', (i) => (i === 5 ? 9800 : 7200)),
    debt: { amount: 0, asOf: '2026-11-21' },
    eZla: [
      { number: 'ZY 4821773', from: '2026-09-15', to: '2026-10-14', pregnancyCodeB: true, issuer: 'lek. ginekolog, Warszawa', status: 'zakonczone' },
      { number: 'ZY 4930518', from: '2026-10-15', to: '2026-12-31', pregnancyCodeB: true, issuer: 'lek. ginekolog, Warszawa', status: 'aktywne' },
    ],
    benefits: [
      { type: 'wynagrodzenie_chorobowe', from: '2026-09-15', to: '2026-10-17', status: 'wyplacony', amount: 7039.89, paidBy: 'platnik' },
      { type: 'zasilek_chorobowy', from: '2026-10-18', to: '2026-11-21', status: 'w_trakcie', amount: null, paidBy: 'platnik' },
    ],
    family: { expectedBirthDate: '2027-01-20', childBirthDate: null },
  },
  {
    id: 'dzialalnosc-z-zadluzeniem',
    role: 'mother',
    person: { firstName: 'Magdalena', lastName: 'Testowa', birthDate: '1991-09-03', peselMasked: '•••••••5530', city: 'Kraków' },
    insurance: [
      {
        type: 'dzialalnosc',
        payer: { name: 'Pozarolnicza działalność gospodarcza (własna)', nip: '•••-•••-88-21', over20Insured: false },
        from: '2024-02-01',
        to: null,
        sickness: 'dobrowolne',
      },
    ],
    contributionBases: months('2026-11', () => 5652),
    debt: { amount: 312.45, asOf: '2026-11-21' },
    eZla: [],
    benefits: [],
    family: { expectedBirthDate: '2027-02-14', childBirthDate: null },
  },
  {
    id: 'zlecenie-bez-chorobowego',
    role: 'mother',
    person: { firstName: 'Katarzyna', lastName: 'Demonstracyjna', birthDate: '1998-01-27', peselMasked: '•••••••2046', city: 'Gdańsk' },
    insurance: [
      {
        type: 'umowa_zlecenia',
        payer: { name: 'Agencja Wydarzeń Morskich s.c.', nip: '•••-•••-19-55', over20Insured: false },
        from: '2025-06-01',
        to: '2027-05-31',
        sickness: 'brak',
      },
    ],
    contributionBases: months('2026-11', (i) => 3800 + (i % 3) * 400, 0),
    debt: { amount: 0, asOf: '2026-11-21' },
    eZla: [{ number: 'ZY 5012260', from: '2026-11-03', to: '2026-11-30', pregnancyCodeB: true, issuer: 'lek. położnik, Gdańsk', status: 'aktywne' }],
    benefits: [],
    family: { expectedBirthDate: '2027-03-05', childBirthDate: null },
  },
  {
    id: 'ojciec-po-porodzie',
    role: 'father',
    person: { firstName: 'Tomasz', lastName: 'Przykładowy', birthDate: '1990-06-18', peselMasked: '•••••••7719', city: 'Poznań' },
    insurance: [
      {
        type: 'umowa_o_prace',
        payer: { name: 'Zakłady Mechaniczne Warta S.A.', nip: '•••-•••-02-63', over20Insured: true },
        from: '2018-09-01',
        to: null,
        sickness: 'obowiazkowe',
        fullTime: true,
      },
    ],
    contributionBases: months('2026-11', () => 8900),
    debt: { amount: 0, asOf: '2026-11-21' },
    eZla: [],
    benefits: [],
    family: { expectedBirthDate: null, childBirthDate: '2026-11-02' },
  },
];

export const PERSONAS: Persona[] = [
  { id: 'pracownica-w-ciazy', label: 'Anna – umowa o pracę, w ciąży', description: 'Zwolnienie lekarskie z kodem „B”, duży pracodawca, bez zaległości.' },
  { id: 'dzialalnosc-z-zadluzeniem', label: 'Magdalena – własna działalność', description: 'Dobrowolne ubezpieczenie chorobowe, zaległość w składkach.' },
  { id: 'zlecenie-bez-chorobowego', label: 'Katarzyna – umowa zlecenia', description: 'Bez dobrowolnego ubezpieczenia chorobowego.' },
  { id: 'ojciec-po-porodzie', label: 'Tomasz – ojciec, umowa o pracę', description: 'Dziecko urodzone w listopadzie 2026 – urlop ojcowski i rodzicielski.' },
];
