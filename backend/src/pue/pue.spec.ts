import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EngineService } from '../engine/engine.service.js';
import { ParamsStore } from '../engine/params.store.js';
import { PueService } from './pue.service.js';

describe('PueService (simulated mObywatel / PUE)', () => {
  let dir: string;
  let pue: PueService;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pue-'));
    pue = new PueService(new EngineService(new ParamsStore(path.join(dir, 'params.json'))));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('logs in with a demo persona and resolves the session', () => {
    const { token } = pue.login('pracownica-w-ciazy');
    expect(pue.accountFor(token).person.firstName).toBe('Anna');
  });

  it('rejects unknown personas, unknown tokens and logged-out sessions', () => {
    expect(() => pue.login('nobody')).toThrow(NotFoundException);
    expect(() => pue.accountFor('nope')).toThrow(UnauthorizedException);
    const { token } = pue.login('ojciec-po-porodzie');
    pue.logout(token);
    expect(() => pue.accountFor(token)).toThrow(UnauthorizedException);
  });

  it('issues a debt certificate that flags arrears above 1% of the minimum wage', () => {
    const withDebt = pue.accountFor(pue.login('dzialalnosc-z-zadluzeniem').token);
    const cert = pue.debtCertificate(withDebt);
    expect(cert.status).toBe('zaleglosc');
    expect(cert.threshold).toBe(48.06);
    expect(cert.blocksBenefits).toBe(true);

    const clean = pue.debtCertificate(pue.accountFor(pue.login('pracownica-w-ciazy').token));
    expect(clean.status).toBe('brak_zaleglosci');
    expect(clean.blocksBenefits).toBe(false);
  });
});
