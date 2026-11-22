import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LibraryDocument } from './library.types.js';

/** One entry of the admin change log of the library. */
export type LibraryLogEntry = { at: string; action: 'dodano' | 'nowa_wersja' | 'zmieniono' | 'wycofano' | 'przywrocono'; documentId: string; title: string; note: string };

export type LibraryState = { documents: LibraryDocument[] | null; log: LibraryLogEntry[] };

const MAX_LOG = 100;

/**
 * Persists the library after the first admin change (until then the generated seed is used) together with
 * the change log. Path: LIBRARY_FILE or ./data/library.json.
 */
export class LibraryStore {
  constructor(readonly file = process.env.LIBRARY_FILE ?? path.join(process.cwd(), 'data', 'library.json')) {}

  load(): LibraryState {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<LibraryState>;
      return { documents: parsed.documents ?? null, log: parsed.log ?? [] };
    } catch {
      return { documents: null, log: [] };
    }
  }

  save(state: LibraryState): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ documents: state.documents, log: state.log.slice(0, MAX_LOG) }, null, 2));
    renameSync(tmp, this.file);
  }
}
