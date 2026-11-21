import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PARAMS_2026 } from '@zus/engine';
import { buildApplication, normalizeBankAccount } from './pue.applications.js';
import { ACCOUNTS } from './pue.data.js';

const account = (id: string) => ACCOUNTS.find((a) => a.id === id)!;
const NOW = new Date('2026-11-21T10:00:00Z');
const IBAN = 'PL61 1090 1014 0000 0712 1981 2874';

describe('simulated e-applications', () => {
  it('validates Polish bank account numbers with the mod-97 check', () => {
    expect(normalizeBankAccount(IBAN)).toBe('61 1090 1014 0000 0712 1981 2874');
    expect(normalizeBankAccount('61109010140000071219812875')).toBeNull();
    expect(normalizeBankAccount('123')).toBeNull();
  });

  it('sends a paternity leave request to the employer and warns about the 7-day notice', () => {
    const app = buildApplication(
      account('ojciec-po-porodzie'),
      { kind: 'urlop_ojcowski', startDate: '2026-11-24', weeks: 2, confirmed: true },
      DEFAULT_PARAMS_2026,
      NOW,
    );
    expect(app.recipient).toEqual({ type: 'pracodawca', name: 'Zakłady Mechaniczne Warta S.A.' });
    expect(app.upo).toBeNull();
    expect(app.warnings.some((w) => w.includes('7 dni'))).toBe(true);
  });

  it('rejects a paternity leave that ends after the child is 12 months old', () => {
    expect(() =>
      buildApplication(
        account('ojciec-po-porodzie'),
        { kind: 'urlop_ojcowski', startDate: '2027-10-28', weeks: 2, confirmed: true },
        DEFAULT_PARAMS_2026,
        NOW,
      ),
    ).toThrow(BadRequestException);
  });

  it('does not accept leave requests from people without an employment contract', () => {
    expect(() =>
      buildApplication(
        account('dzialalnosc-z-zadluzeniem'),
        { kind: 'urlop_rodzicielski', startDate: '2027-06-01', weeks: 10, confirmed: true },
        DEFAULT_PARAMS_2026,
        NOW,
      ),
    ).toThrow(BadRequestException);
  });

  it('files ZAM with ZUS, issues an UPO and warns about contribution arrears', () => {
    const app = buildApplication(
      account('dzialalnosc-z-zadluzeniem'),
      { kind: 'zam', period: 'macierzynski', startDate: '2027-02-14', weeks: 20, bankAccount: IBAN, confirmed: true },
      DEFAULT_PARAMS_2026,
      NOW,
    );
    expect(app.recipient.type).toBe('zus');
    expect(app.upo?.number).toMatch(/^UPO\/2026\//);
    expect(app.warnings.some((w) => w.includes('art. 2a'))).toBe(true);
  });

  it('requires the truthfulness statement and a valid bank account', () => {
    const base = { kind: 'zam', period: 'macierzynski', startDate: '2027-02-14', weeks: 20, bankAccount: IBAN };
    expect(() => buildApplication(account('dzialalnosc-z-zadluzeniem'), base, DEFAULT_PARAMS_2026, NOW)).toThrow(BadRequestException);
    expect(() =>
      buildApplication(account('dzialalnosc-z-zadluzeniem'), { ...base, bankAccount: '1234', confirmed: true }, DEFAULT_PARAMS_2026, NOW),
    ).toThrow(BadRequestException);
  });
});
