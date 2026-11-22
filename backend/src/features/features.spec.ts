import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { FeaturesService, FeaturesStore } from './features.service.js';

const store = () => new FeaturesStore(path.join(mkdtempSync(path.join(tmpdir(), 'features-')), 'features.json'));

describe('feature switches', () => {
  it('switches a feature off, logs it and keeps it after a restart', () => {
    const s = store();
    new FeaturesService(s).update({ caseImport: false });
    const reloaded = new FeaturesService(s);
    expect(reloaded.get().caseImport).toBe(false);
    expect(reloaded.log()[0].changes[0]).toContain('wyłączono');
  });

  it('does not enable an empty announcement', () => {
    expect(() => new FeaturesService(store()).update({ announcement: { enabled: true, text: ' ' } })).toThrow(BadRequestException);
  });
});
