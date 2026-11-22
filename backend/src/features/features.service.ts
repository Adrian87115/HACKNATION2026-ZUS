import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';

/** System features the admin can switch on and off without a deployment, plus an announcement banner. */
export type Features = {
  assistant: boolean;
  caseImport: boolean;
  onlineApplications: boolean;
  announcement: { enabled: boolean; tone: 'info' | 'warning'; text: string };
};

export type FeaturesLogEntry = { at: string; changes: string[] };

export const DEFAULT_FEATURES: Features = {
  assistant: true,
  caseImport: true,
  onlineApplications: true,
  announcement: { enabled: false, tone: 'info', text: '' },
};

const LABELS: Record<Exclude<keyof Features, 'announcement'>, string> = {
  assistant: 'Asystentka ZUSia',
  caseImport: 'Odczyt dokumentów sprawy (AI)',
  onlineApplications: 'Składanie wniosków online',
};

/** Persisted in FEATURES_FILE or ./data/features.json together with a change log. */
export class FeaturesStore {
  constructor(readonly file = process.env.FEATURES_FILE ?? path.join(process.cwd(), 'data', 'features.json')) {}

  load(): { features: Features; log: FeaturesLogEntry[] } {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as { features?: Partial<Features>; log?: FeaturesLogEntry[] };
      return { features: { ...DEFAULT_FEATURES, ...parsed.features }, log: parsed.log ?? [] };
    } catch {
      return { features: DEFAULT_FEATURES, log: [] };
    }
  }

  save(state: { features: Features; log: FeaturesLogEntry[] }): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ features: state.features, log: state.log.slice(0, 50) }, null, 2));
    renameSync(tmp, this.file);
  }
}

@Injectable()
export class FeaturesService {
  private state: { features: Features; log: FeaturesLogEntry[] };

  constructor(private readonly store: FeaturesStore) {
    this.state = store.load();
  }

  get(): Features {
    return this.state.features;
  }

  log(): FeaturesLogEntry[] {
    return this.state.log;
  }

  update(input: Record<string, unknown>): Features {
    const prev = this.state.features;
    const next: Features = { ...prev, announcement: { ...prev.announcement } };
    for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
      if (input[key] === undefined) continue;
      if (typeof input[key] !== 'boolean') throw new BadRequestException(`Nieprawidłowa wartość dla „${LABELS[key]}”.`);
      next[key] = input[key];
    }
    const a = input.announcement as Partial<Features['announcement']> | undefined;
    if (a !== undefined) {
      if (typeof a !== 'object' || a === null) throw new BadRequestException('Nieprawidłowy komunikat.');
      const text = typeof a.text === 'string' ? a.text.trim() : prev.announcement.text;
      if (text.length > 300) throw new BadRequestException('Komunikat może mieć maksymalnie 300 znaków.');
      const enabled = typeof a.enabled === 'boolean' ? a.enabled : prev.announcement.enabled;
      if (enabled && !text) throw new BadRequestException('Wpisz treść komunikatu, zanim go włączysz.');
      next.announcement = { enabled, text, tone: a.tone === 'warning' ? 'warning' : 'info' };
    }

    const changes = (Object.keys(LABELS) as (keyof typeof LABELS)[])
      .filter((k) => prev[k] !== next[k])
      .map((k) => `${LABELS[k]}: ${next[k] ? 'włączono' : 'wyłączono'}`);
    if (JSON.stringify(prev.announcement) !== JSON.stringify(next.announcement)) {
      changes.push(next.announcement.enabled ? `Komunikat: „${next.announcement.text}”` : 'Komunikat: wyłączono');
    }
    if (!changes.length) return prev;
    this.state = { features: next, log: [{ at: new Date().toISOString(), changes }, ...this.state.log] };
    this.store.save(this.state);
    return next;
  }
}
