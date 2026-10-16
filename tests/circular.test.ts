import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseCircular, isClosed } from '../src/lib/circular';

const sample = readFileSync(new URL('./circular-sample.txt', import.meta.url), 'utf8');

describe('parseCircular (DOA sample)', () => {
  const c = parseCircular(sample);
  it('finds both posts with refs and titles', () => {
    expect(c.posts.map((p) => p.ref)).toEqual(['3/3/1/85/2026', '3/3/1/91/2026']);
    expect(c.posts.map((p) => p.title)).toEqual(['ICT Specialist (Business Analyst)', 'Land Administrative Officer']);
  });
  it('reads closing date, emails, salary, level', () => {
    expect(c.posts[0].closing?.getFullYear()).toBe(2026);
    expect(c.posts[0].closing?.getMonth()).toBe(9);
    expect(c.posts[0].closing?.getDate()).toBe(23);
    expect(c.posts[0].email).toBe('ICTSrecruit85@nda.gov.za');
    expect(c.posts[1].email).toBe('LAOrecruit91@nda.gov.za');
    expect(c.posts[0].salary).toMatch(/R932 292/);
    expect(c.posts[0].level).toBe('11');
    expect(c.posts[0].directorate).toBe('ICT Solution Development');
    expect(c.maxSizeMb).toBe(10);
  });
  it('extracts requirements', () => {
    const r = c.posts[0].reqs;
    const q = r.filter((x) => x.kind === 'qualification');
    expect(q.map((x) => x.nqf)).toEqual([4, 6]);
    expect(q[1].fields).toEqual(['Computer Science', 'Information Technology']);
    const e = r.find((x) => x.kind === 'experience')!;
    expect(e.years).toBe(3);
    expect(r.some((x) => x.kind === 'licence')).toBe(true);
    const e2 = c.posts[1].reqs.find((x) => x.kind === 'experience')!;
    expect(e2.years).toBe(2);
    expect(e2.topic).toMatch(/Land/);
    // duties must not leak in as skills
    expect(c.posts[1].reqs.some((x) => /Facilitate the disposal/.test(x.text))).toBe(false);
  });
  it('closed check', () => {
    expect(isClosed(c.posts[0], new Date(2026, 9, 16))).toBe(false);
    expect(isClosed(c.posts[0], new Date(2026, 9, 24))).toBe(true);
  });
});
