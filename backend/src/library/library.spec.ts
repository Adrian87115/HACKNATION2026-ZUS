import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { LibraryService } from './library.service.js';
import { LibraryStore } from './library.store.js';

const service = () => new LibraryService(new LibraryStore(path.join(mkdtempSync(path.join(tmpdir(), 'lib-')), 'library.json')));

describe('document library', () => {
  it('starts from the seed with the version history of legal acts', () => {
    const act = service().get('ustawa-zasilkowa');
    expect(act.versions.length).toBeGreaterThan(1);
    expect(act.versions[0].validFrom! >= act.versions[1].validFrom!).toBe(true);
  });

  it('adds a form, publishes a new version and withdraws it – and keeps the changes after a restart', () => {
    const store = new LibraryStore(path.join(mkdtempSync(path.join(tmpdir(), 'lib-')), 'library.json'));
    const lib = new LibraryService(store);
    lib.create({ kind: 'formularz', section: 'wnioski', code: 'ZAS-99', title: 'Testowy wniosek', topics: ['ciaza'], pageUrl: 'https://www.zus.pl/x', version: '2026-01', url: 'https://www.zus.pl/x.pdf' });
    lib.addVersion('formularz-zas-99', { version: '2026-12', url: 'https://www.zus.pl/y.pdf', changes: 'Nowe pole na numer rachunku.' });
    lib.withdraw('formularz-zas-99', { reason: 'Zastąpiony przez ZAM.', replacedBy: 'formularz-zam' });

    const reloaded = new LibraryService(store).get('formularz-zas-99');
    expect(reloaded.versions.map((v) => v.version)).toEqual(['2026-12', '2026-01']);
    expect(reloaded.status).toBe('wycofany');
    expect(reloaded.withdrawn?.replacedBy).toBe('formularz-zam');
  });

  it('groups every seed document into a category and section, with a local copy of the file', () => {
    const docs = service().list();
    expect(docs.every((d) => d.category && d.section)).toBe(true);
    expect(docs.filter((d) => d.kind !== 'poradnik').every((d) => d.versions[0].file?.path.startsWith('/dokumenty/'))).toBe(true);
  });

  it('rejects incomplete input with a friendly message', () => {
    expect(() => service().create({ kind: 'formularz', title: 'Bez symbolu', topics: ['ciaza'] })).toThrow(BadRequestException);
    expect(() => service().addVersion('formularz-zam', { version: 'x', url: 'https://a.pl' })).toThrow(BadRequestException);
  });
});
