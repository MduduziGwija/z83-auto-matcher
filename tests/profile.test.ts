import { describe, it, expect } from 'vitest';
import { emptyProfile, mergeCv, validateProfile } from '../src/lib/profile';
import { parseCv } from '../src/lib/cv';
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

describe('referees must be complete', () => {
  it('needs name, relationship and phone on every row that exists', () => {
    const half = { ...complete(), references: [{ name: 'Ms Arnold', relationship: '', tel: '0214835395' }] };
    expect(validateProfile(half).map((e) => e.field)).toEqual(['references']);
    const full = { ...complete(), references: [{ name: 'Ms Arnold', relationship: 'Line manager', tel: '0214835395' }] };
    expect(validateProfile(full)).toEqual([]);
  });
});

describe('saved lists belong to the CV they were read from', () => {
  const cvA = parseCv('SAM EXAMPLE\nEducation\nHonours degree in Public Administration | UWC 2024 - 2024\nExperience\nIntern, Department of Health  Nov 2024 – Current\n');
  const cvB = parseCv('JO OTHER\nEducation\nBTech Engineering | TUT 2018 - 2018\n');
  it('keeps edits for the same CV and re-reads for a different one', () => {
    const first = mergeCv(emptyProfile(), cvA).profile;
    const edited = { ...first, qualifications: [{ school: 'UWC', qualification: 'EDITED', year: '2024' }] };
    expect(mergeCv(edited, cvA).profile.qualifications[0].qualification).toBe('EDITED');
    const other = mergeCv(edited, cvB).profile;
    expect(other.qualifications.map((q) => q.qualification).join()).toMatch(/BTech/);
    expect(other.work).toEqual([]);
  });
  it('re-reads when the CV reader version changed (stale saved data)', () => {
    const first = mergeCv(emptyProfile(), cvA).profile;
    const stale = { ...first, cvKey: '1:old', work: [{ employer: 'Western Cape Department of Infrastructure (', post: '', fromMM: '', fromYY: '', toMM: '', toYY: '', reason: '' }] };
    expect(mergeCv(stale, cvA).profile.work[0].employer).not.toMatch(/\($/);
  });
});
