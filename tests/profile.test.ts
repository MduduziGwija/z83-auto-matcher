import { describe, it, expect } from 'vitest';
import { emptyProfile, validateProfile } from '../src/lib/profile';
import type { Profile } from '../src/lib/types';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const complete = (): Profile => ({
  ...emptyProfile(),
  surname: 'Example', firstNames: 'Sam', idNumber: '8001015009087', race: 'african', gender: 'male',
  disability: 'no', citizen: 'yes', convicted: 'no', pendingCriminal: 'no', dismissed: 'no', pendingDisciplinary: 'no',
  resigned: 'no', illHealth: 'no', businessWithState: 'no', relinquish: 'no', contact: 'sam@example.com', notice: '1 month',
  languages: [{ language: 'English', speak: 'good', write: 'good' }],
  qualifications: [{ school: 'UWC', qualification: 'Honours in Public Administration', year: '2024' }],
  work: [{ employer: 'Department of Health', post: 'Intern', fromMM: '11', fromYY: '24', toMM: 'Pres', toYY: '', reason: '' }],
  yearsPublic: '2', reappointCondition: 'no', signature: PNG, initials: PNG, signatureConsent: true,
});

describe('validateProfile: a Z83 cannot go out with blanks', () => {
  it('accepts a complete profile (references are only a warning)', () => {
    expect(validateProfile(complete())).toEqual([]);
  });
  it('lists every unanswered part, top to bottom, with the field to jump to', () => {
    const fields = validateProfile(emptyProfile()).map((e) => e.field);
    for (const f of ['surname', 'firstNames', 'idNumber', 'race', 'gender', 'disability', 'convicted', 'notice', 'languages', 'qualifications', 'work', 'yearsPrivate', 'reappointCondition', 'signature', 'initials', 'signatureConsent'])
      expect(fields).toContain(f);
    expect(fields.indexOf('surname')).toBeLessThan(fields.indexOf('convicted'));
    expect(fields.indexOf('convicted')).toBeLessThan(fields.indexOf('signature'));
  });
  it('insists on signature and initials separately', () => {
    expect(validateProfile({ ...complete(), signature: '' }).map((e) => e.field)).toEqual(['signature']);
    expect(validateProfile({ ...complete(), initials: '' }).map((e) => e.field)).toEqual(['initials']);
  });
  it('asks for details when a declaration is Yes', () => {
    expect(validateProfile({ ...complete(), convicted: 'yes' }).map((e) => e.field)).toEqual(['convictedDetails']);
  });
  it('rejects half-filled rows', () => {
    expect(validateProfile({ ...complete(), work: [{ employer: 'X', post: '', fromMM: '', fromYY: '', toMM: '', toYY: '', reason: '' }] }).map((e) => e.field)).toEqual(['work']);
  });
});
