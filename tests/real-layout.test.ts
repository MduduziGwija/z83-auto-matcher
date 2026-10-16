import { describe, it, expect } from 'vitest';
import { isClosed, parseCircular, parseLevel, provinceOfLine } from '../src/lib/circular';

// Snippets copied in shape from a real Public Service Vacancy Circular (labels, wrapping, notices, provinces).
const RAW = `PUBLIC SERVICE VACANCY CIRCULAR
PUBLICATION NO 36 OF 2026
AMENDMENTS : DEPARTMENT OF SPORT, ARTS AND CULTURE: Kindly note the amendments to the post (DSAC-11/09/2026) with the closing date of 5 October 2026.
PROVINCIAL ADMINISTRATION: GAUTENG: DEPARTMENT OF SPORT, ARTS,
CULTURE AND RECREATION: Kindly note that the post of Chief Director with reference number: Refs/050114 was advertised with a closing date of 24 July 2026 and has been withdrawn.
INDEX
ANNEXURE A
DEPARTMENT OF HEALTH
CLOSING DATE : 30 October 2026 at 16:00
NOTE : To apply, submit a completed Z83 form. The closing date of the previous circular was 5 October 2026.
OTHER POSTS
POST 36/01 : MEDICAL OFFICER GRADE 1 -3 REF NO: ECHEALTH/MO/APL/BCM-
FPS/01/10/2026
SALARY : R1 041 402 per annum
CENTRE : Bhisho Hospital
REQUIREMENTS : MBChB degree. Registration with the HPCSA.
ENQUIRIES : Dr A Person, Email: enquiries@health.gov.za, Tel No: (012) 123 4567
APPLICATIONS : Applications must be e-mailed to apply@health.gov.za or be hand delivered.
POST 36/02 : CHIEF ACCOUNTING CLERK REF NO: CAC
SALARY : R338 106 per annum (Level 08)
CENTRE : Pretoria
REQUIREMENTS : Grade 12 and 3 years experience in accounting.
APPLICATIONS : Email to apply@health.gov.za
POST 36/03 : ENGINEERING TECHNOLOGIST: INFRASTRUCTURE FOR EDUCATION
FACILITIES AND OTHER DEPARTMENTS (X2 POSTS)
SALARY : R338 106 per annum
CENTRE : Bhisho:
Ref No: DPWI 04/09/2026
Ref No: DPWI 05/09/2026
REQUIREMENTS : National Senior Certificate, B. Tech in Engineering. A valid driver's license.
APPLICATIONS : Email to apply@health.gov.za
POST 36/04 : GRADUATE INTERNSHIP PROGRAMME 2027/2029 REF NO: S.5/8/1/3/2
SALARY : R100 000 per annum
APPLICATIONS : Applications should be posted / hand delivered to: The HR Manager, Private Bag X1, Pretoria. FOR ATTENTION : Mr Z
ENQUIRIES : Ms B, Email: contact.person@health.gov.za
POST 36/05 : DIRECTOR: COMMUNICATIONS & MARKETING SERVICES REF NO: DIR-
COMMS- 02/ SEPT 2026
Business Unit: Corporate Services
SALARY : R1 317 384 per annum (Level 13)
APPLICATIONS : Email to apply@health.gov.za
ANNEXURE B
DEPARTMENT OF PUBLIC WORKS & INFRASTRUCTURE
CLOSING DATE : 23 October 2026
APPLICATIONS : All applications to be submitted online at https://jobs.example.gov.za
POST 36/06 : CLERK REF NO: PWI 1/2026
SALARY : R200 000 per annum
ANNEXURE C
PROVINCIAL ADMINISTRATION: FREE STATE
DEPARTMENT OF HEALTH
CLOSING DATE : 27 October 2026
APPLICATIONS : Applicants must use the provincial e-recruitment system. To report challenges send an email to: help@fs.gov.za. Do not send any applications to this email address.
POST 36/07 : NURSE REF NO: FSH 1/2026
SALARY : R200 000 per annum
ANNEXURE D
PROVINCIAL ADMINISTRATION: EASTERN CAPE
DEPARTMENT OF HEALTH
CLOSING DATE : 28 October 2026
POST 36/08 : DRIVER REF NO: ECH 1/2026
SALARY : R200 000 per annum
APPLICATIONS : Email to 2026/140/OCJ@judiciary.org.za
`;

describe('real circular layout', () => {
  const c = parseCircular(RAW);
  const by = Object.fromEntries(c.posts.map((p) => [p.ref, p]));
  it('ignores notices at the front, including "reference number: Refs/050114"', () => {
    expect(c.posts.map((p) => p.ref)).not.toContain('Refs/050114');
    expect(c.posts.length).toBe(9);
  });
  it('reads references without digits and references wrapped over two lines', () => {
    expect(Object.keys(by)).toEqual(expect.arrayContaining(['ECHEALTH/MO/APL/BCM-FPS/01/10/2026', 'CAC', 'DIR-COMMS-02/SEPT 2026', 'S.5/8/1/3/2', 'DPWI 04/09/2026', 'DPWI 05/09/2026']));
  });
  it('takes the title from the POST label, including wrapped titles and year ranges', () => {
    expect(by['CAC'].title).toBe('Chief Accounting Clerk');
    expect(by['DPWI 04/09/2026'].title).toBe('Engineering Technologist: Infrastructure for Education Facilities and Other Departments');
    expect(by['DPWI 05/09/2026'].title).toBe(by['DPWI 04/09/2026'].title);
    expect(by['S.5/8/1/3/2'].title).toBe('Graduate Internship Programme 2027/2029');
    expect(by['ECHEALTH/MO/APL/BCM-FPS/01/10/2026'].title).toBe('Medical Officer Grade 1 -3');
  });
  it('shares one advert between posts with several references', () => {
    expect(by['DPWI 04/09/2026'].requirements).toMatch(/B\. Tech in Engineering/);
    expect(by['DPWI 05/09/2026'].requirements).toBe(by['DPWI 04/09/2026'].requirements);
    expect(by['DPWI 04/09/2026'].reqs.some((r) => r.kind === 'licence')).toBe(true);
  });
  it('uses the CLOSING DATE line, not dates mentioned in notices', () => {
    expect(by['CAC'].closing?.getDate()).toBe(30);
    expect(by['CAC'].closing?.getMonth()).toBe(9);
    expect(isClosed(by['CAC'], new Date(2026, 9, 16))).toBe(false);
  });
  it('names provincial departments with their province', () => {
    expect(provinceOfLine('PROVINCIAL ADMINISTRATION: EASTERN CAPE')).toBe('Eastern Cape');
    expect(provinceOfLine('PROVINCIAL ADMINISTRATION: GAUTENG: DEPARTMENT OF SPORT, ARTS,')).toBe('');
    expect(by['CAC'].department).toBe('Department of Health');
    expect(by['FSH 1/2026'].department).toBe('Free State Department of Health');
    expect(by['ECH 1/2026'].department).toBe('Eastern Cape Department of Health');
    expect(by['PWI 1/2026'].department).toBe('Department of Public Works and Infrastructure');
  });
  it('only offers email where the post itself accepts email applications', () => {
    expect(by['CAC'].applyBy).toBe('email');
    expect(by['CAC'].email).toBe('apply@health.gov.za');
    // enquiries address is not an application address; the post says post / hand delivery
    expect(by['S.5/8/1/3/2'].applyBy).not.toBe('email');
    // department says online, and "do not send applications to this email address"
    expect(by['PWI 1/2026'].applyBy).toBe('online');
    expect(by['FSH 1/2026'].applyBy).toBe('online');
    expect(by['FSH 1/2026'].email).toBe('');
    // an address may contain a slash
    expect(by['ECH 1/2026'].email).toBe('2026/140/OCJ@judiciary.org.za');
  });
  it('reads salary levels, and learns the level of salary-only posts from the circular', () => {
    expect(by['CAC'].level).toBe('8');
    expect(by['CAC'].levelFromSalary).toBe(false);
    expect(by['DPWI 04/09/2026'].level).toBe('8'); // same salary as the stated Level 08 post
    expect(by['DPWI 04/09/2026'].levelFromSalary).toBe(true);
    expect(by['S.5/8/1/3/2'].level).toBe('');
    expect(parseLevel('SALARY : Grade 1: R1 139 per annum')).toBe(''); // a medical "Grade 1" is not a salary level
    expect(parseLevel('SALARY : R1 317 384 per annum (Level 13)')).toBe('13');
  });
});
