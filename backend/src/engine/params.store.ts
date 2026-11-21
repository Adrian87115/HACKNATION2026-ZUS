import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BenefitParams } from './params.js';
import type { ParamChange } from './params.validation.js';

/** One entry of the admin change log. */
export type ParamsHistoryEntry = {
  at: string;
  action: 'update' | 'reset';
  changes: ParamChange[];
};

type StoredState = { overrides: Partial<BenefitParams>; history: ParamsHistoryEntry[] };

const MAX_HISTORY = 50;

/**
 * Persists parameter overrides (only the differences from the 2026 defaults) and the change log
 * to a JSON file, so admin changes survive restarts. Path: ENGINE_PARAMS_FILE or ./data/engine-params.json.
 */
export class ParamsStore {
  readonly file: string;

  constructor(file = process.env.ENGINE_PARAMS_FILE ?? path.join(process.cwd(), 'data', 'engine-params.json')) {
    this.file = file;
  }

  load(): StoredState {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<StoredState>;
      return { overrides: parsed.overrides ?? {}, history: parsed.history ?? [] };
    } catch {
      return { overrides: {}, history: [] };
    }
  }

  save(state: StoredState): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    const data: StoredState = { overrides: state.overrides, history: state.history.slice(0, MAX_HISTORY) };
    // write-then-rename so a crash never leaves a half-written file
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, this.file);
  }
}
