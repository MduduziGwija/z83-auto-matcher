import { describe, it, expect } from 'vitest';
import { parseCv } from '../src/lib/cv';

const head = `NOMSA KHUMALO
Cell: 082 555 1234 | nomsa@example.com
ID Number: 8001015009087
Languages: English, isiXhosa
`;
const jobs = (body: string) => parseCv(head + 'Work Experience\n' + body + '\nEducation\nNational Diploma: Information Technology\nTshwane University of Technology, 2012\n');
const quals = (body: string) => parseCv(head + 'Education\n' + body + '\nWork Experience\nBusiness Analyst\nDepartment of Health\nMar 2016 - Present\n').qualifications;

describe('how people write experience dates', () => {
  const periodOf = (body: string) => jobs(body).experience.map((e) => e.period);
  it.each([
    ['Clerk, Department of Health, 01 January 2018 – 31 December 2020', 'Jan 2018 – Dec 2020'],
    ['Clerk, Department of Health, 1st March 2019 to 30th June 2021', 'Mar 2019 – Jun 2021'],
    ["Clerk, Department of Health, Jan'18 – Dec'20", 'Jan 2018 – Dec 2020'],
    ['Clerk, Department of Health, Jan 18 - Dec 20', 'Jan 2018 – Dec 2020'],
    ['Clerk, Department of Health, 01/03/2018 - 28/02/2020', 'Mar 2018 – Feb 2020'],
    ['Clerk, Department of Health, 2018/03 – 2020/02', 'Mar 2018 – Feb 2020'],
    ['Clerk, Department of Health, Sept 2018 – Sept. 2019', 'Sep 2018 – Sep 2019'],
    ['Clerk, Department of Health, January–December 2020', 'Jan 2020 – Dec 2020'],
    ['Clerk, Department of Health, Jan-Dec 2020', 'Jan 2020 – Dec 2020'],
  ])('reads "%s"', (line, period) => {
    expect(periodOf(line)[0]).toBe(period);
  });
  it.each([
    'Clerk, Department of Health, March 2019 - till date',
    'Clerk, Department of Health, March 2019 – to present',
    'Clerk, Department of Health, March 2019 till present',
    'Clerk, Department of Health, since March 2019',
    'Clerk, Department of Health, From March 2019 (current)',
    'Clerk, Department of Health, 03/2019 - Date',
  ])('treats "%s" as still working there', (line) => {
    const e = jobs(line).experience[0];
    expect(e).toBeDefined();
    expect(e.present).toBe(true);
    expect(e.period).toMatch(/^Mar 2019/);
  });
  it('reads jobs split over lines with the dates on their own line', () => {
    const e = jobs('Administrative Clerk\nDepartment of Health\n2018 – 2020\n• Filing and capturing\n').experience;
    expect(e).toHaveLength(1);
    expect(e[0].post).toMatch(/clerk/i);
  });
  it('counts a job written only as a duration, and says it has no dates', () => {
    const cv = jobs('Administrative Clerk, Department of Health (2 years 3 months)');
    expect(cv.experience).toHaveLength(0);
    expect(cv.totalYears).toBeCloseTo(2.3, 1);
    expect(cv.gaps.join(' ')).toMatch(/start and end dates/i);
  });
  it('reads "Duration: 18 months" and "3 yrs" too', () => {
    expect(jobs('Intern, Department of Health\nDuration: 18 months').totalYears).toBeCloseTo(1.5, 1);
    expect(jobs('Intern, Department of Health - 3 yrs').totalYears).toBe(3);
  });
});

describe('how people write qualifications', () => {
  it('reads name, school and a year range on one line', () => {
    const q = quals('BCom Accounting – University of Johannesburg (2018–2020)');
    expect(q[0]).toMatchObject({ level: 7, year: '2020' });
    expect(q[0].text).toMatch(/BCom Accounting/);
    expect(q[0].school).toMatch(/Johannesburg/);
  });
  it('reads a year range at the front', () => {
    const q = quals('2019 – 2021 N.Dip Public Management, Tshwane University of Technology');
    expect(q[0]).toMatchObject({ level: 6, year: '2021' });
    expect(q[0].school).toMatch(/Tshwane/);
  });
  it('reads a school written as an acronym after a comma', () => {
    const q = quals('Diploma in Human Resource Management, TUT, 2021');
    expect(q[0].school).toBe('TUT');
    expect(q[0].text).toMatch(/Diploma in Human Resource Management/);
  });
  it('reads labelled blocks', () => {
    const q = quals('Qualification: BA Public Administration\nInstitution: University of Fort Hare\nYear Completed: 2022\nQualification: Matric (NSC)\nInstitution: Pretoria High School\nYear: 2015');
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ level: 7, year: '2022' });
    expect(q[0].school).toMatch(/Fort Hare/);
    expect(q[1]).toMatchObject({ level: 4, year: '2015' });
  });
  it.each([
    ['Std 10 / Senior Certificate, Pretoria High School, 2005', 4],
    ['Grade 12 (NSC) - Soweto High School - 2015', 4],
    ['Higher Certificate in Project Management, CTI Education Group, 2019', 5],
    ['PGCE, University of Pretoria, 2020', 7],
    ['BTech: Public Management, Tshwane University of Technology - Completed 2023', 7],
    ['B.Admin (Hons) Public Administration, University of the Western Cape, 2024', 8],
    ['Bachelor of Arts in Social Science, UKZN, 2017', 7],
    ['Master of Public Administration (MPA), Wits, 2022', 9],
    ['NCV Level 4 Office Administration, Ekurhuleni West TVET College, 2016', 4],
  ])('reads the level of "%s"', (line, level) => {
    expect(quals(line)[0]?.level).toBe(level);
  });
  it('does not turn "Duration: 3 years" or a module list into a qualification', () => {
    const q = quals('National Diploma: Information Technology (NQF 6)\nDuration: 3 years\nModules: Programming, Networks\nTshwane University of Technology, 2012');
    expect(q).toHaveLength(1);
    expect(q.map((x) => x.text).join('|')).not.toMatch(/duration|modules/i);
  });
  it('removes "3-year" style durations from the name but keeps the qualification', () => {
    const q = quals('3-year Diploma in Public Management (3 years), TUT, 2018');
    expect(q[0].text).not.toMatch(/year/i);
    expect(q[0].text).toMatch(/Diploma in Public Management/);
    expect(q[0].year).toBe('2018');
  });
});
