import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BenefitEngine,
  DEFAULT_PARAMS_2026,
  EngineInputError,
  type BasisInput,
  type BenefitParams,
  type MaternityPlanInput,
  type PregnancyBenefitInput,
} from './index.js';
import { ParamsStore, type ParamsHistoryEntry } from './params.store.js';
import { ParamsValidationError, diffParams, validateOverrides } from './params.validation.js';

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);
  private readonly engine = new BenefitEngine();
  private readonly store: ParamsStore;
  /** Differences from the 2026 defaults (what gets persisted). */
  private overrides: Partial<BenefitParams> = {};
  private history: ParamsHistoryEntry[] = [];

  constructor(store: ParamsStore) {
    this.store = store;
    const saved = this.store.load();
    try {
      if (Object.keys(saved.overrides).length > 0) {
        this.overrides = validateOverrides(saved.overrides);
        this.engine.updateParams(this.overrides);
      }
      this.history = saved.history;
    } catch (error) {
      this.logger.error(`Ignoring invalid saved parameters in ${this.store.file}: ${(error as Error).message}`);
    }
  }

  getParams() {
    return this.engine.getParams();
  }

  getDefaults() {
    return DEFAULT_PARAMS_2026;
  }

  getHistory() {
    return this.history;
  }

  updateParams(input: unknown) {
    let overrides: Partial<BenefitParams>;
    try {
      overrides = validateOverrides(input);
    } catch (error) {
      if (error instanceof ParamsValidationError) throw new BadRequestException(error.problems);
      throw error;
    }

    const changes = diffParams(this.engine.getParams(), overrides);
    if (changes.length === 0) return this.engine.getParams();

    const params = this.engine.updateParams(overrides);
    this.overrides = this.onlyDifferences(params);
    this.record({ at: new Date().toISOString(), action: 'update', changes });
    return params;
  }

  resetParams() {
    const changes = diffParams(this.engine.getParams(), DEFAULT_PARAMS_2026);
    const params = this.engine.resetParams();
    this.overrides = {};
    if (changes.length > 0) this.record({ at: new Date().toISOString(), action: 'reset', changes });
    return params;
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

  private onlyDifferences(params: Readonly<BenefitParams>): Partial<BenefitParams> {
    const defaults = DEFAULT_PARAMS_2026 as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(params).filter(([key, value]) => JSON.stringify(defaults[key]) !== JSON.stringify(value)),
    ) as Partial<BenefitParams>;
  }

  private record(entry: ParamsHistoryEntry) {
    this.history = [entry, ...this.history];
    try {
      this.store.save({ overrides: this.overrides, history: this.history });
    } catch (error) {
      // Parameters still apply until restart – make the persistence failure visible in the logs.
      this.logger.error(`Could not save engine parameters to ${this.store.file}: ${(error as Error).message}`);
    }
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
