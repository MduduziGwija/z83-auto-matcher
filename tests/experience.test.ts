import { describe, it, expect } from 'vitest';
import { parseCv } from '../src/lib/cv';
import { emptyProfile, mergeCv } from '../src/lib/profile';
import { entryMonths, experienceTotals, formatMonths } from '../src/lib/experience';
import type { ExpEntry } from '../src/lib/types';

const NOW = new Date(2026, 9, 16); // 16 October 2026

const entry = (o: Partial<ExpEntry>): ExpEntry => ({
  id: 'x', employer: '', post: '', startIdx: 2024 * 12 + 10, endIdx: 2024 * 12 + 10, present: false, approx: false,
  sector: 'private', include: true, period: '', note: '', ...o,
});

describe('experienceTotals', () => {
  it('counts a current job up to today, not to the end of the month', () => {
    const e = entry({ startIdx: 2024 * 12 + 10, present: true, sector: 'public' }); // Nov 2024 - now
    expect(entryMonths(e, NOW)).toBeCloseTo(23.5, 1);
    expect(formatMonths(experienceTotals([e], NOW).publicMonths)).toBe('1 yr 11 mths');
  });
  it('counts the month a job ended in, and counts overlapping jobs once', () => {
    const a = entry({ startIdx: 2022 * 12, endIdx: 2024 * 12 + 10 }); // Jan 2022 - Nov 2024 = 35 months
    const b = entry({ startIdx: 2023 * 12 + 5, endIdx: 2023 * 12 + 10 }); // inside the first
    expect(experienceTotals([a, b], NOW).privateMonths).toBe(35);
    expect(formatMonths(35)).toBe('2 yrs 11 mths');
  });
  it('keeps public and private apart and ignores jobs that are not ticked', () => {
    const t = experienceTotals([entry({ sector: 'public', startIdx: 0, endIdx: 11 }), entry({ sector: 'private', startIdx: 0, endIdx: 5 }), entry({ include: false, startIdx: 0, endIdx: 99 })], NOW);
    expect(t.publicMonths).toBe(12);
    expect(t.privateMonths).toBe(6);
  });
  it('formats', () => {
    expect(formatMonths(0)).toBe('0');
    expect(formatMonths(12)).toBe('1 yr');
    expect(formatMonths(13)).toBe('1 yr 1 mth');
    expect(formatMonths(5.9)).toBe('5 mths');
  });
});

const CV = `SAM EXAMPLE
Experience
Graduate Intern, Western Cape Department of Infrastructure (DOI)                     Nov 2024 – Current
Student Assistant, University of the Western Cape                                    Jan 2022 – Nov 2024
Scriber, Sixth World Conference on Remedies to Social and Racial Inequality          Sep 2024- Sep 2024
Chief Invigilator, University of the Western Cape                                       Jun 2023 – Nov 2023
Volunteer, EDHE Lekgotla and Studentpreneurs Indaba                                     Sep 2023 – Sep 2023
Junior Developer | ABC Software (Pty) Ltd | 2013 - 2016
`;

describe('experience read from a CV', () => {
  const cv = parseCv(CV);
  const by = (post: string) => cv.experience.find((e) => e.post === post)!;
  it('puts government departments in the public sector, universities and companies in private', () => {
    expect(by('Graduate Intern').sector).toBe('public');
    expect(by('Student Assistant').sector).toBe('private');
    expect(by('Junior Developer').sector).toBe('private');
  });
  it('leaves volunteer work and one-month events unticked', () => {
    expect(by('Volunteer').include).toBe(false);
    expect(by('Scriber').include).toBe(false);
    expect(by('Chief Invigilator').include).toBe(true);
  });
  it('counts year-only ranges as the difference of the years', () => {
    const j = by('Junior Developer');
    expect(j.approx).toBe(true);
    expect(entryMonths(j, NOW)).toBe(36); // 2013 - 2016 is 3 years, not 4
  });
  it('fills the Z83 years from the ticked jobs, and keeps numbers the person typed', () => {
    const merged = mergeCv(emptyProfile(), cv).profile;
    expect(merged.yearsPublic).toMatch(/yr/);
    expect(merged.yearsPrivate).toMatch(/yr/);
    const typed = { ...merged, yearsPrivate: '5', yearsManual: true };
    expect(mergeCv(typed, cv).profile.yearsPrivate).toBe('5');
  });
});
