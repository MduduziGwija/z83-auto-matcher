import { describe, it, expect } from 'vitest';
import { parseCv } from '../src/lib/cv';
import { mergeCv } from '../src/lib/profile';
import { emptyProfile } from '../src/lib/profile';

// Shaped like a real modern CV: blank line between lines, "Position:" / "Organisation:" labels,
// wrapped bullets (one wrapped line starts with the word "education"), lots of sentence-like text.
const CV = `Sipho Example

PUBLIC ADMINISTRATOR

1 Fake Road, Cape Town, 7441 | 0821234567 | sipho@example.com

Professional Summary

Public Administration professional with almost 4 years of experience in government and higher education

environments, currently serving as a coordinator, and in building digital solutions with SharePoint.

Personal Information

ID Number: 8001015009087

Nationality: South African

Languages: English, IsiXhosa, Setswana

Education

Honours degree in Public Administration | Example University 2024

Major: Public Administration | Minor: Economics

Bachelor’s degree in Public Administration | Example University 2023

National Senior Certificate (Grade 12) | Example Secondary School 2019

Professional Experience

Position: Institutional Coordinator 01 Aug 2026 – Present

Organisation: Example Provincial Government Department of Works (Bursary

Programme)

Key Responsibilities:

• Giving coordinators an at-a-glance view of every bursar’s status across the programme’s higher

education institutions.

• Monitoring results and identifying those requiring academic support, thereby improving prospects.

Position: Graduate Intern 19 Nov 2024 – 30 Jul 2026 (1 Year & 8 Months)

Organisation: Example Provincial Government Department of Works

Key Responsibilities:

• Enabling informed review and decision-making on property enquiries.

• Developed an automated lease register using MS Lists and Power Automate.

Position: Student Assistant 09 Jan 2023 – 15 Nov 2024 (1 Year & 10 Months)

Organisation: Example University

Key Responsibilities:

• Assisted Faculty Officers by preparing datasets to generate data-driven insights that informed administrative planning.

Skills & abilities

• Advanced Computer Literacy (MS Word,

MS Excel)

• Coding (HTML, CSS, Java)

References

Ms. Nandi Fakename

Administrative Officer to the Deputy Director General (Example Provincial Department of

Works)

Telephone: 0215550101

Email: n.fakename@example.gov.za

Ms. Lerato Sample

Personal Assistant to the Chief Director: Immovable Asset Management (Example Provincial Government Department of

Public Works and Infrastructure)

Telephone: 0215550102

Email: l.sample@example.gov.za

Dr. Thandi Example

Senior Lecturer: Example University

Telephone: 0215550103

Email: t.example@example.ac.za
`;

describe('a modern labelled CV with blank lines and wrapped text', () => {
  const cv = parseCv(CV);
  it('finds every job, with the title and employer without their labels', () => {
    expect(cv.experience).toHaveLength(3);
    const [a, b, c] = cv.work;
    expect(a).toMatchObject({ post: 'Institutional Coordinator', toMM: 'Pres' });
    expect(a.employer).toBe('Example Provincial Government Department of Works');
    expect(b).toMatchObject({ post: 'Graduate Intern', fromMM: '11', fromYY: '24', toMM: '07', toYY: '26' });
    expect(c).toMatchObject({ post: 'Student Assistant', employer: 'Example University' });
  });
  it('counts the experience across all three jobs', () => {
    expect(cv.totalYears).toBeGreaterThan(3.4);
    expect(cv.publicYears).toBeGreaterThan(1.5);
  });
  it('does not stop a section at a wrapped line that starts with the word "education"', () => {
    expect(cv.qualifications.map((q) => q.text).join('|')).not.toMatch(/decision-making|insights/);
  });
  it('finds exactly the three real qualifications, matric included, highest first', () => {
    expect(cv.qualifications.map((q) => q.level)).toEqual([8, 7, 4]);
    expect(cv.qualifications[2].text).toMatch(/National Senior Certificate/);
    expect(cv.qualifications[2].school).toBe('Example Secondary School');
  });
  it('joins a referee title that wraps inside brackets', () => {
    expect(cv.references).toHaveLength(3);
    expect(cv.references[0].relationship).toBe('Administrative Officer to the Deputy Director General (Example Provincial Department of Works)');
  });
  it('keeps a long wrapped referee title, shortened sensibly', () => {
    expect(cv.references[1].name).toBe('Ms. Lerato Sample');
    expect(cv.references[1].relationship).toBe('Personal Assistant to the Chief Director: Immovable Asset Management');
  });
  it('takes each qualification year from its own line', () => {
    expect(cv.qualifications.map((q) => q.year)).toEqual(['2024', '2023', '2019']);
  });
  it('never drops matric from the Z83 when there are more than four qualifications', () => {
    const many = { ...cv, qualifications: [9, 8, 7, 6, 4].map((level) => ({ text: `Q${level}${level === 4 ? ' National Senior Certificate' : ''}`, school: 'S', level, year: '2020' })) };
    const p = mergeCv(emptyProfile(), many).profile;
    expect(p.qualifications).toHaveLength(4);
    expect(p.qualifications.some((q) => /National Senior Certificate/.test(q.qualification))).toBe(true);
  });
});

describe('a level is never found inside another word', () => {
  it.each([
    'enabling informed review and decision-making',
    'the committee informed management of the outcome',
    'accommodation and standard operating procedures',
  ])('"%s" is not a qualification', (line) => {
    const q = parseCv(`TEST PERSON\nID Number: 8001015009087\nEducation\n${line}\nHonours degree in Public Administration, UWC, 2024\n`).qualifications;
    expect(q).toHaveLength(1);
  });
});
