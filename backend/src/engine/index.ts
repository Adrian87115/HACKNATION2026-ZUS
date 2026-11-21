import { calculateBasis, type BasisInput, type BasisResult } from './basis.js';
import { planMaternity, type MaternityPlanInput, type MaternityPlanResult } from './maternityPlanner.js';
import { DEFAULT_PARAMS_2026, withOverrides, type BenefitParams } from './params.js';
import {
  calculatePregnancyBenefits,
  type PregnancyBenefitInput,
  type PregnancyBenefitResult,
} from './pregnancyBenefits.js';

/**
 * Silnik kalkulatorów zasiłków. Niezależny od frameworka (czyste funkcje + parametry),
 * więc można go używać w NestJS, w testach albo bezpośrednio na froncie.
 *
 * Parametry (stopy %, wymiary urlopów, kwoty minimalne) są wstrzykiwane – panel administracyjny
 * zmienia je przez `updateParams`, bez zmian w kodzie kalkulatorów.
 */
export class BenefitEngine {
  private params: BenefitParams;

  constructor(params: Readonly<BenefitParams> = DEFAULT_PARAMS_2026) {
    this.params = withOverrides(params, {});
  }

  getParams(): Readonly<BenefitParams> {
    return this.params;
  }

  updateParams(overrides: Partial<BenefitParams>): Readonly<BenefitParams> {
    this.params = withOverrides(this.params, overrides);
    return this.params;
  }

  resetParams(): Readonly<BenefitParams> {
    this.params = withOverrides(DEFAULT_PARAMS_2026, {});
    return this.params;
  }

  /** Kalkulator (f) – podstawa wymiaru zasiłku. */
  calculateBasis(input: BasisInput): BasisResult {
    return calculateBasis(this.params, input);
  }

  /** Kalkulator (a) – zasiłek chorobowy w ciąży i zasiłek w wysokości zasiłku macierzyńskiego. */
  calculatePregnancyBenefits(input: PregnancyBenefitInput): PregnancyBenefitResult {
    return calculatePregnancyBenefits(this.params, input);
  }

  /** Kalkulatory (b)-(e) – okres i wysokość zasiłku macierzyńskiego dla obojga rodziców. */
  planMaternity(input: MaternityPlanInput): MaternityPlanResult {
    return planMaternity(this.params, input);
  }
}

export * from './amounts.js';
export * from './basis.js';
export * from './leaveDurations.js';
export * from './maternityPlanner.js';
export * from './params.js';
export * from './pregnancyBenefits.js';
export { EngineInputError } from './utils.js';
