import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PARAMS_2026 } from '@zus/engine';
import { circumstanceHints, normalizeCircumstances } from './pue.circumstances.js';
import { ACCOUNTS } from './pue.data.js';

const account = (id: string) => ACCOUNTS.find((a) => a.id === id)!;
const NOW = new Date('2026-11-21T10:00:00Z');

describe('user circumstances', () => {
  it('validates the entered data', () => {
    expect(() => normalizeCircumstances({ expectedBirthDate: '2030-01-01' }, NOW)).toThrow(BadRequestException);
    expect(() => normalizeCircumstances({ expectedChildren: 7 }, NOW)).toThrow(BadRequestException);
    expect(() => normalizeCircumstances({ employmentChange: 'dzialalnosc' }, NOW)).toThrow(BadRequestException);
    const c = normalizeCircumstances({ expectedBirthDate: '2027-03-01', expectedChildren: 2, notes: '  bliźnięta ' }, NOW);
    expect(c).toMatchObject({ expectedBirthDate: '2027-03-01', expectedChildren: 2, employmentChange: 'brak', notes: 'bliźnięta' });
  });

  it('explains longer leave for twins and the extension of a fixed-term contract after the 3rd month', () => {
    const c = normalizeCircumstances(
      { expectedBirthDate: '2027-03-01', expectedChildren: 2, employmentChange: 'koniec_umowy_na_czas_okreslony', employmentChangeDate: '2027-01-31' },
      NOW,
    );
    const hints = circumstanceHints(account('pracownica-w-ciazy'), c, DEFAULT_PARAMS_2026);
    expect(hints.some((h) => h.includes('31 tygodni'))).toBe(true);
    expect(hints.some((h) => h.includes('art. 177 § 3'))).toBe(true);
  });
});
