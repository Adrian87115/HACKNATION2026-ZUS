import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BenefitEngine,
  EngineInputError,
  type BasisInput,
  type BenefitParams,
  type MaternityPlanInput,
  type PregnancyBenefitInput,
} from './index.js';

@Injectable()
export class EngineService {
  // Parametry trzymane w pamięci – docelowo do podmiany na odczyt z bazy (panel administracyjny).
  private readonly engine = new BenefitEngine();

  getParams() {
    return this.engine.getParams();
  }

  updateParams(overrides: Partial<BenefitParams>) {
    return this.engine.updateParams(overrides);
  }

  resetParams() {
    return this.engine.resetParams();
  }

  calculateBasis(input: BasisInput) {
    return this.run(() => this.engine.calculateBasis(input));
  }

  calculatePregnancyBenefits(input: PregnancyBenefitInput) {
    return this.run(() => this.engine.calculatePregnancyBenefits(input));
  }

  planMaternity(input: MaternityPlanInput) {
    return this.run(() => this.engine.planMaternity(input));
  }

  private run<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof EngineInputError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
