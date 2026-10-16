import { describe, it, expect } from 'vitest';
import { parseCircular, isDeptHeading } from '../src/lib/circular';

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
  it('keeps only email-able posts: flags online-only and no-email posts', () => {
    expect(c.posts.map((p) => [p.ref, p.applyBy, p.email])).toEqual([
      ['DSAC/01/2026', 'email', 'recruit@dsac.gov.za'],
      ['DALRRD/09/2026', 'online', ''],
      ['DOH/44/2026', 'none', ''],
      ['DOH/45/2026', 'email', 'hr@health.gov.za'],
    ]);
  });
});
