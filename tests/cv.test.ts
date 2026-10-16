import { describe, it, expect } from 'vitest';
import { parseCv, detectDemographics, isValidSaId } from '../src/lib/cv';

const CV = `THABO MOKOENA
Cell: 082 555 1234 | thabo@example.com
Personal Details
Black African Male
ID Number: 8001015009087
Nationality: South African
Languages
English - fluent, isiZulu - fluent, Afrikaans - fair
Education
National Diploma: Information Technology
Tshwane University of Technology, 2012
Matric
Pretoria Boys High School 2008
Work Experience
Business Analyst
Department of Health
Mar 2016 - Present
Reason for leaving: n/a
Junior Developer | ABC Software (Pty) Ltd | 2013 - 2016
References
Dr Sipho Dlamini
Director: ICT
012 555 0000
Ms Anna Botha
Line manager
082 111 2222
`;

describe('parseCv', () => {
  const c = parseCv(CV);
  it('reads identity + contact', () => {
    expect(c.surname).toBe('MOKOENA');
    expect(c.email).toBe('thabo@example.com');
    expect(c.phone).toMatch(/082/);
    expect(c.nationality).toBe('South African');
  });
  it('reads qualifications and work', () => {
    expect(c.qualifications[0].text).toMatch(/Diploma/);
    expect(c.qualifications[0].school).toMatch(/Tshwane/);
    expect(c.qualifications.find((q) => /Matric/.test(q.text))!.school).toMatch(/Pretoria Boys/);
    expect(c.qualifications[0].school).toBe('Tshwane University of Technology');
    expect(c.work.map((w) => w.employer)).toContain('ABC Software (Pty) Ltd');
    expect(c.work.length).toBe(2);
    expect(c.work[0].toMM).toBe('Pres');
    expect(c.totalYears).toBeGreaterThan(10);
    expect(c.languages.map((l) => l.language).sort()).toEqual(["Afrikaans", "English", "isiZulu"]);
  });
  it('reads references', () => {
    expect(c.hasReferences).toBe(true);
    expect(c.references.length).toBe(2);
  });
  it('warns when no references', () => {
    const n = parseCv(CV.split('References')[0]);
    expect(n.hasReferences).toBe(false);
    expect(n.gaps.join(' ')).toMatch(/no references/);
  });
});

describe('detectDemographics', () => {
  const cases: [string, string, string][] = [
    ['Black African Male', 'african', 'male'],
    ['Coloured female', 'coloured', 'female'],
    ['Race: Indian\nGender: F', 'indian', 'female'],
    ['Female, White', 'white', 'female'],
    ['Black female', 'african', 'female'],
    ['I worked for the South African Revenue Service', '', ''],
    ['Ethnicity - African', 'african', ''],
  ];
  for (const [t, r, g] of cases) it(t.replace(/\n/g, ' / '), () => {
    const d = detectDemographics(t);
    expect(d.race).toBe(r);
    expect(d.gender).toBe(g);
  });
  it('id check', () => expect(isValidSaId('8001015009087')).toBe(true));
});
