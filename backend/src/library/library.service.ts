import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LIBRARY_SEED } from './library.seed.js';
import { LibraryStore, type LibraryLogEntry, type LibraryState } from './library.store.js';
import { LIBRARY_TOPICS, type LibraryDocument, type LibraryKind, type LibraryVersion } from './library.types.js';

const KINDS: LibraryKind[] = ['formularz', 'akt_prawny', 'poradnik'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const text = (v: unknown, label: string, max: number, required = true): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new BadRequestException(`Uzupełnij pole „${label}”.`);
  if (s.length > max) throw new BadRequestException(`Pole „${label}” może mieć maksymalnie ${max} znaków.`);
  return s;
};
const url = (v: unknown, label: string): string => {
  const s = text(v, label, 600);
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
  } catch {
    throw new BadRequestException(`Pole „${label}” musi zawierać poprawny adres strony (https://…).`);
  }
  return s;
};
const date = (v: unknown, label: string): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !ISO.test(v) || Number.isNaN(Date.parse(v))) throw new BadRequestException(`Podaj poprawną datę w polu „${label}”.`);
  return v;
};
const topics = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string' && t in LIBRARY_TOPICS) : [];
  if (!list.length) throw new BadRequestException('Wybierz co najmniej jeden temat.');
  return [...new Set(list)];
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/**
 * Library of official forms, legal acts and guides with version history. Admins add documents, publish new
 * versions (the previous ones stay available as history) and withdraw outdated documents without code changes.
 */
@Injectable()
export class LibraryService {
  private state: LibraryState;

  constructor(private readonly store: LibraryStore) {
    this.state = store.load();
  }

  private get documents(): LibraryDocument[] {
    return this.state.documents ?? LIBRARY_SEED;
  }

  topics() {
    return Object.entries(LIBRARY_TOPICS).map(([value, label]) => ({ value, label }));
  }

  list(): LibraryDocument[] {
    return this.documents;
  }

  get(id: string): LibraryDocument {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) throw new NotFoundException('Nie znaleziono dokumentu.');
    return doc;
  }

  log(): LibraryLogEntry[] {
    return this.state.log;
  }

  create(input: Record<string, unknown>): LibraryDocument {
    const kind = input.kind as LibraryKind;
    if (!KINDS.includes(kind)) throw new BadRequestException('Wybierz rodzaj dokumentu: formularz, akt prawny albo poradnik.');
    const title = text(input.title, 'Nazwa', 200);
    const code = text(input.code, 'Symbol', 30, kind === 'formularz') || null;
    const id = `${kind === 'formularz' ? 'formularz-' : ''}${slug(code ?? title)}`;
    if (this.documents.some((d) => d.id === id)) throw new BadRequestException('Taki dokument już jest w bazie – dodaj do niego nową wersję.');
    const doc: LibraryDocument = {
      id,
      kind,
      code,
      title,
      fullTitle: code ? `${code} – ${title}` : title,
      description: text(input.description, 'Opis', 600, false),
      topics: topics(input.topics),
      status: 'obowiazujacy',
      pageUrl: url(input.pageUrl, 'Strona dokumentu'),
      versions: [this.version(input, 'Pierwsza wersja dodana przez administratora.')],
      amendments: [],
      withdrawn: null,
    };
    this.commit([doc, ...this.documents], { action: 'dodano', documentId: id, title: doc.fullTitle, note: '' });
    return doc;
  }

  addVersion(id: string, input: Record<string, unknown>): LibraryDocument {
    const doc = this.get(id);
    const version = this.version(input);
    if (!version.changes) throw new BadRequestException('Opisz, co zmieniło się w nowej wersji.');
    if (doc.versions.some((v) => v.version === version.version)) throw new BadRequestException('Wersja o takim oznaczeniu już istnieje.');
    const next = { ...doc, versions: [version, ...doc.versions] };
    this.replace(next, { action: 'nowa_wersja', documentId: id, title: doc.fullTitle, note: `${version.version}: ${version.changes}` });
    return next;
  }

  update(id: string, input: Record<string, unknown>): LibraryDocument {
    const doc = this.get(id);
    const title = input.title === undefined ? doc.title : text(input.title, 'Nazwa', 200);
    const next: LibraryDocument = {
      ...doc,
      title,
      fullTitle: doc.code ? `${doc.code} – ${title}` : doc.kind === 'akt_prawny' ? doc.fullTitle : title,
      description: input.description === undefined ? doc.description : text(input.description, 'Opis', 600, false),
      topics: input.topics === undefined ? doc.topics : topics(input.topics),
      pageUrl: input.pageUrl === undefined ? doc.pageUrl : url(input.pageUrl, 'Strona dokumentu'),
    };
    this.replace(next, { action: 'zmieniono', documentId: id, title: next.fullTitle, note: 'Zmieniono opis dokumentu.' });
    return next;
  }

  withdraw(id: string, input: Record<string, unknown>): LibraryDocument {
    const doc = this.get(id);
    if (doc.status === 'wycofany') throw new BadRequestException('Ten dokument jest już wycofany.');
    const reason = text(input.reason, 'Powód wycofania', 400);
    const replacedBy = typeof input.replacedBy === 'string' && input.replacedBy ? this.get(input.replacedBy).id : null;
    const next: LibraryDocument = { ...doc, status: 'wycofany', withdrawn: { at: new Date().toISOString(), reason, replacedBy } };
    this.replace(next, { action: 'wycofano', documentId: id, title: doc.fullTitle, note: reason });
    return next;
  }

  restore(id: string): LibraryDocument {
    const doc = this.get(id);
    if (doc.status !== 'wycofany') throw new BadRequestException('Ten dokument obowiązuje.');
    const next: LibraryDocument = { ...doc, status: 'obowiazujacy', withdrawn: null };
    this.replace(next, { action: 'przywrocono', documentId: id, title: doc.fullTitle, note: '' });
    return next;
  }

  private version(input: Record<string, unknown>, fallbackChanges = ''): LibraryVersion {
    return {
      version: text(input.version, 'Oznaczenie wersji', 80),
      label: text(input.label, 'Rodzaj wersji', 80, false) || 'Nowa wersja',
      validFrom: date(input.validFrom, 'Obowiązuje od'),
      url: url(input.url, 'Adres pliku lub tekstu'),
      changes: text(input.changes, 'Co się zmieniło', 1000, false) || fallbackChanges,
      addedAt: new Date().toISOString().slice(0, 10),
    };
  }

  private replace(doc: LibraryDocument, entry: Omit<LibraryLogEntry, 'at'>) {
    this.commit(
      this.documents.map((d) => (d.id === doc.id ? doc : d)),
      entry,
    );
  }

  private commit(documents: LibraryDocument[], entry: Omit<LibraryLogEntry, 'at'>) {
    this.state = { documents, log: [{ at: new Date().toISOString(), ...entry }, ...this.state.log] };
    this.store.save(this.state);
  }
}
