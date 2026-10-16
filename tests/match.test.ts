import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseCircular } from '../src/lib/circular';
import { parseCv } from '../src/lib/cv';
import { matchPost } from '../src/lib/match';
import { pdfName, uniqueNames } from '../src/lib/filename';

const circ = parseCircular(readFileSync(new URL('./circular-sample.txt', import.meta.url), 'utf8'));
const cv = parseCv(`THABO MOKOENA
thabo@example.com 082 555 1234
Education
National Diploma: Information Technology
Tshwane University of Technology 2012
Matric 2008
Work Experience
Business Analyst
Department of Health
Mar 2016 - Present
Junior Developer | ABC Software (Pty) Ltd | 2013 - 2016
Wrote business case documents and business requirement specification (BRS) for ICT projects. Microsoft Office. Driver's licence code B.
`);

describe('matchPost', () => {
  it('scores the ICT post well', () => {
    const r = matchPost(circ.posts[0], cv, []);
    expect(r.score).toBeGreaterThan(60);
    expect(r.items.find((i) => i.req.kind === 'licence')!.outcome).toBe('direct');
  });
  it('uses equivalency for the agriculture diploma only when listed', () => {
    const none = matchPost(circ.posts[1], cv, []);
    const withEq = matchPost(circ.posts[1], cv, [['Agriculture', 'Information Technology']]);
    expect(withEq.score).toBeGreaterThanOrEqual(none.score);
    expect(withEq.items.find((i) => i.req.kind === 'qualification' && !!i.req.fields)!.outcome).toBe('equivalent');
  });
});

describe('filenames', () => {
  it('is safe and follows reference + title', () => {
    expect(pdfName('3/3/1/85/2026', 'ICT Specialist (Business Analyst)')).toBe('3-3-1-85-2026 - ICT Specialist (Business Analyst).pdf');
    expect(pdfName('3/3/1/85/2026', 'x', 'ref')).toBe('3-3-1-85-2026.pdf');
    expect(uniqueNames(['a.pdf', 'a.pdf'])).toEqual(['a.pdf', 'a (2).pdf']);
  });
});
