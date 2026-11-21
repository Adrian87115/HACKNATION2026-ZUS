import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException, ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard.js';
import { EngineService } from './engine.service.js';
import { ParamsStore } from './params.store.js';
import { DEFAULT_PARAMS_2026, ParamsValidationError, validateOverrides } from '@zus/engine';

describe('validateOverrides', () => {
  it('accepts known parameters with valid values', () => {
    expect(validateOverrides({ RATE_COMBINED_21_DAYS: 0.8, PATERNITY_TOTAL_WEEKS: 3 })).toEqual({
      RATE_COMBINED_21_DAYS: 0.8,
      PATERNITY_TOTAL_WEEKS: 3,
    });
  });

  it('rejects unknown keys, percentages given as whole numbers and fractional weeks', () => {
    expect(() => validateOverrides({ FOO: 1 })).toThrow(ParamsValidationError);
    expect(() => validateOverrides({ RATE_FULL: 100 })).toThrow(/od 0 do 1/);
    expect(() => validateOverrides({ PATERNITY_TOTAL_WEEKS: 2.5 })).toThrow(/całkowitą/);
    // a rate whose name ends in _DAYS is still a fraction
    expect(validateOverrides({ RATE_COMBINED_21_DAYS: 0.8 })).toEqual({ RATE_COMBINED_21_DAYS: 0.8 });
    expect(() => validateOverrides({ MIN_WAGE_2026_GROSS: -1 })).toThrow(/ujemny/);
    expect(() => validateOverrides({})).toThrow(ParamsValidationError);
  });

  it('validates the maternity weeks table', () => {
    expect(validateOverrides({ MATERNITY_WEEKS_BY_CHILDREN: { 1: 21, 2: 31, 3: 33, 4: 35, 5: 37 } })).toEqual({
      MATERNITY_WEEKS_BY_CHILDREN: { 1: 21, 2: 31, 3: 33, 4: 35, 5: 37 },
    });
    expect(() => validateOverrides({ MATERNITY_WEEKS_BY_CHILDREN: { 1: 0 } })).toThrow(ParamsValidationError);
  });
});

describe('EngineService – admin parameters', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'engine-params-'));
    file = path.join(dir, 'params.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('applies, persists and restores overrides with a history entry', () => {
    const service = new EngineService(new ParamsStore(file));
    service.updateParams({ RATE_COMBINED_21_DAYS: 0.8 });

    expect(service.getParams().RATE_COMBINED_21_DAYS).toBe(0.8);
    expect(service.getHistory()[0].changes).toEqual([{ key: 'RATE_COMBINED_21_DAYS', from: 0.815, to: 0.8 }]);
    expect(JSON.parse(readFileSync(file, 'utf8')).overrides).toEqual({ RATE_COMBINED_21_DAYS: 0.8 });

    const restarted = new EngineService(new ParamsStore(file));
    expect(restarted.getParams().RATE_COMBINED_21_DAYS).toBe(0.8);
  });

  it('turns validation problems into 400 and ignores no-op updates', () => {
    const service = new EngineService(new ParamsStore(file));
    expect(() => service.updateParams({ RATE_FULL: 2 })).toThrow(BadRequestException);
    service.updateParams({ RATE_FULL: DEFAULT_PARAMS_2026.RATE_FULL });
    expect(service.getHistory()).toHaveLength(0);
  });

  it('reset restores the 2026 defaults and clears saved overrides', () => {
    const service = new EngineService(new ParamsStore(file));
    service.updateParams({ PATERNITY_TOTAL_WEEKS: 3 });
    service.resetParams();
    expect(service.getParams().PATERNITY_TOTAL_WEEKS).toBe(2);
    expect(JSON.parse(readFileSync(file, 'utf8')).overrides).toEqual({});
    expect(service.getHistory()[0].action).toBe('reset');
  });
});

describe('AdminTokenGuard', () => {
  const ctx = (authorization?: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) }) as unknown as ExecutionContext;
  const original = process.env.ADMIN_TOKEN;
  afterEach(() => {
    process.env.ADMIN_TOKEN = original;
  });

  it('is disabled without ADMIN_TOKEN and checks the bearer token', () => {
    const guard = new AdminTokenGuard();
    delete process.env.ADMIN_TOKEN;
    expect(() => guard.canActivate(ctx('Bearer x'))).toThrow(ForbiddenException);

    process.env.ADMIN_TOKEN = 'secret-token';
    expect(() => guard.canActivate(ctx('Bearer wrong'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    expect(guard.canActivate(ctx('Bearer secret-token'))).toBe(true);
  });
});
