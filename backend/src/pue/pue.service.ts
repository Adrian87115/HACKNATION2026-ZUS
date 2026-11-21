import { randomBytes, randomInt } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EngineService } from '../engine/engine.service.js';
import { buildApplication, type Application, type ApplicationInput } from './pue.applications.js';
import { ACCOUNTS, PERSONAS, type Account } from './pue.data.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

type Session = { accountId: string; expiresAt: number };

export type DebtCertificate = {
  number: string;
  issuedAt: string;
  asOf: string;
  status: 'brak_zaleglosci' | 'zaleglosc';
  amount: number;
  /** Debt above this amount (1% of the minimum wage) blocks benefit payment – Art. 2a. */
  threshold: number;
  blocksBenefits: boolean;
  text: string;
};

/**
 * Simulated mObywatel sign-in and PUE/eZUS data. Sessions are kept in memory (demo only).
 */
@Injectable()
export class PueService {
  private readonly sessions = new Map<string, Session>();
  /** Submitted applications per account – kept across sign-ins until the server restarts (demo only). */
  private readonly applications = new Map<string, Application[]>();

  constructor(private readonly engine: EngineService) {}

  personas() {
    return PERSONAS;
  }

  login(personaId: unknown) {
    const account = ACCOUNTS.find((a) => a.id === personaId);
    if (!account) throw new NotFoundException('Nie znaleziono wybranego profilu demonstracyjnego.');
    this.prune();
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(token, { accountId: account.id, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  logout(token: string) {
    this.sessions.delete(token);
  }

  /** Resolve a session token to an account (used by the guard). */
  accountFor(token: string): Account {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      throw new UnauthorizedException('Sesja wygasła. Zaloguj się ponownie.');
    }
    const account = ACCOUNTS.find((a) => a.id === session.accountId);
    if (!account) throw new UnauthorizedException('Sesja wygasła. Zaloguj się ponownie.');
    return account;
  }

  /** Simulated "zaświadczenie o niezaleganiu / stanie zadłużenia" for the day the right to benefit arises. */
  debtCertificate(account: Account): DebtCertificate {
    const params = this.engine.getParams();
    const threshold = Math.round(params.MIN_WAGE_2026_GROSS * params.DEBT_EXCLUSION_MIN_WAGE_RATIO * 100) / 100;
    const now = new Date();
    const amount = account.debt.amount;
    const name = `${account.person.firstName} ${account.person.lastName}`;
    return {
      number: `SIM/ZAS/${now.getFullYear()}/${String(randomInt(100000, 999999))}`,
      issuedAt: now.toISOString(),
      asOf: account.debt.asOf,
      status: amount > 0 ? 'zaleglosc' : 'brak_zaleglosci',
      amount,
      threshold,
      blocksBenefits: amount > threshold,
      text:
        amount > 0
          ? `Zakład Ubezpieczeń Społecznych zaświadcza, że ${name} na dzień ${account.debt.asOf} posiada zaległość z tytułu składek na ubezpieczenia społeczne w kwocie ${amount.toFixed(2)} zł.`
          : `Zakład Ubezpieczeń Społecznych zaświadcza, że ${name} na dzień ${account.debt.asOf} nie posiada zaległości z tytułu składek na ubezpieczenia społeczne.`,
    };
  }

  listApplications(account: Account): Application[] {
    return this.applications.get(account.id) ?? [];
  }

  /** Simulated e-submission: validates the request, "delivers" it and returns the confirmation (UPO for ZUS). */
  submitApplication(account: Account, input: ApplicationInput): Application {
    const application = buildApplication(account, input ?? {}, this.engine.getParams());
    this.applications.set(account.id, [application, ...this.listApplications(account)].slice(0, 50));
    return application;
  }

  private prune() {
    const now = Date.now();
    for (const [token, session] of this.sessions) if (session.expiresAt < now) this.sessions.delete(token);
  }
}
