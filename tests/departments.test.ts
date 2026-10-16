import { describe, it, expect } from 'vitest';
import { parseCircular, isDeptHeading, toParagraphs } from '../src/lib/circular';

const RAW = `PUBLIC SERVICE VACANCY CIRCULAR 41 OF 2026
Closing date: 30 October 2026 at 16:00
DEPARTMENT OF SPORT, ARTS AND CULTURE
OTHER POSTS
DEPUTY DIRECTOR: SPORT DEVELOPMENT REF NO: DSAC/01/2026
Directorate: Sport R733 257 per annum (Level 11)
Applicants must be in possession of a National Diploma (NQF 6). Minimum of 3 years experience in sport administration.
ENQUIRIES : Ms A Person Tel No: (012) 123 4567
APPLICATIONS : Applications can be submitted by email to recruit@dsac.gov.za
DEPARTMENT OF AGRICULTURE, LAND REFORM AND
RURAL DEVELOPMENT
APPLICATIONS : Applications must be submitted online at www.dalrrd.gov.za/e-recruitment. No e-mail applications will be accepted.
OTHER POSTS
ASSISTANT DIRECTOR: FARM SUPPORT REF NO: DALRRD/09/2026
Directorate: Farms R413 001 per annum (Level 09)
Applicants must be in possession of a National Diploma in Agriculture (NQF Level 6).
DEPARTMENT OF HEALTH
CLERK REF NO: DOH/44/2026
Applicants must be in possession of a Grade 12.
Applications by hand delivery only, to 1 Main Road, Pretoria.
DEPARTMENT OF HEALTH
SENIOR CLERK REF NO: DOH/45/2026
Applicants must be in possession of a Grade 12. Applications can be sent to hr@health.gov.za
`;

describe('departments and how to apply', () => {
  const c = parseCircular(RAW);
  it('recognises department headings, including wrapped ones', () => {
    expect(isDeptHeading('DEPARTMENT OF HEALTH')).toBe(true);
    expect(isDeptHeading('DEPARTMENT OF SPORT, ARTS AND CULTURE')).toBe(true);
    expect(isDeptHeading('Department of Health')).toBe(true);
    expect(isDeptHeading('The Department of Health invites applications for the following posts')).toBe(false);
    expect(c.departments).toEqual(['Department of Sport, Arts and Culture', 'Department of Agriculture, Land Reform and Rural Development', 'Department of Health']);
  });
  it('gives each post its own department and clean title', () => {
    expect(c.posts.map((p) => [p.ref, p.department, p.title])).toEqual([
      ['DSAC/01/2026', 'Department of Sport, Arts and Culture', 'Deputy Director: Sport Development'],
      ['DALRRD/09/2026', 'Department of Agriculture, Land Reform and Rural Development', 'Assistant Director: Farm Support'],
      ['DOH/44/2026', 'Department of Health', 'Clerk'],
      ['DOH/45/2026', 'Department of Health', 'Senior Clerk'],
    ]);
  });
  it('keeps the requirements as written, and the post text stops before the next department', () => {
    const agri = c.posts.find((p) => p.ref === 'DALRRD/09/2026')!;
    expect(agri.requirements).toMatch(/National Diploma in Agriculture \(NQF Level 6\)/);
    const dsac = c.posts[0];
    expect(dsac.requirements).toMatch(/Minimum of 3 years experience in sport administration/);
    expect(dsac.requirements).not.toMatch(/ENQUIRIES/);
    expect(dsac.raw).not.toMatch(/AGRICULTURE, LAND REFORM/);
    expect(toParagraphs(dsac.requirements).length).toBeGreaterThan(1);
  });
  it('keeps only email-able posts: flags online-only and no-email posts', () => {
    expect(c.posts.map((p) => [p.ref, p.applyBy, p.email])).toEqual([
      ['DSAC/01/2026', 'email', 'recruit@dsac.gov.za'],
      ['DALRRD/09/2026', 'online', ''],
      ['DOH/44/2026', 'none', ''],
      ['DOH/45/2026', 'email', 'hr@health.gov.za'],
    ]);
  });
});

describe('titles when the words before REF NO are only references', () => {
  it('recovers the title from a POST: label or from the capitals after the reference', () => {
    const raw = `DEPARTMENT OF PUBLIC WORKS & INFRASTRUCTURE
Closing date: 23 October 2026
CONTROL ENGINEERING TECHNOLOGIST: INFRASTRUCTURE DELIVERY REF NO: DPWI 01/09/2026
Directorate: Delivery R958 776 per annum Applications: e-recruitment-bhisho@ecdpw.gov.za
POST DPWI 04/09/2026 REF NO: DPWI 04/09/2026 CHIEF ENGINEER Directorate: Roads R1 000 000 per annum Applications: e-recruitment-bhisho@ecdpw.gov.za
DPWI 04/09/2026 REF NO: DPWI 05/09/2026 POST: ASSISTANT DIRECTOR: ROADS Directorate: Roads R500 000 per annum Applications: e-recruitment-bhisho@ecdpw.gov.za`;
    const c = parseCircular(raw);
    expect(c.posts.map((p) => [p.ref, p.title])).toEqual([
      ['DPWI 01/09/2026', 'Control Engineering Technologist: Infrastructure Delivery'],
      ['DPWI 04/09/2026', 'Chief Engineer'],
      ['DPWI 05/09/2026', 'Assistant Director: Roads'],
    ]);
    expect(c.posts.every((p) => p.department === 'Department of Public Works & Infrastructure')).toBe(true);
    expect(c.posts.every((p) => p.applyBy === 'email' && p.email === 'e-recruitment-bhisho@ecdpw.gov.za')).toBe(true);
  });
});
