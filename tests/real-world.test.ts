import { describe, it, expect } from 'vitest';
import { parseCircular } from '../src/lib/circular';
import { parseCv } from '../src/lib/cv';
import { matchPost } from '../src/lib/match';

// Fake CV that mimics the awkward layout of a real one: right-aligned dates, module lists,
// referee titles and emails, and an ID number printed next to a phone number.
const CV = `SAM EXAMPLE
PUBLIC ADMINISTRATOR
8001015009087
12 Fake Street, Cape Town, 7441
0821234567
Professional Summary
A highly proactive Public Administration graduate (Honours, 2024) with 4 years of cumulative work experience.
Skills and Competencies
• Proficient in Microsoft Office Suite (Word, Excel with PivotTables and VLOOKUP, Outlook).
• Sound knowledge of the Public Finance Management Act (PFMA).
Education
Honours degree in Public Administration | University of the Western Cape                    2024 - 2024
BAdmin (Hons) Modules: Human Resource Management & Development, Economics & Public
Sector Financial Management, Policy Analysis.
Bachelor’s degree in Public Administration | University of the Western Cape                 2021 - 2023
BAdmin Modules: Public Administration, Management, Industrial Psychology.
National Senior Certificate (Grade 12) | Laudium Secondary School                                 2019
Experience
Graduate Intern, Western Cape Department of Infrastructure (DOI)                     Nov 2024 – Current
• Executing BAS payments and ensuring adherence to PFMA regulations.
• Providing support for financial administration and supply chain-related activities.
Student Assistant, University of the Western Cape                                    Jan 2022 – Nov 2024
• Delivering administrative support to faculty and central offices
Scriber, Sixth World Conference on Remedies to Social and Racial Inequality          Sep 2024- Sep 2024
Volunteer, EDHE Lekgotla and Studentpreneurs Indaba                                     Sep 2023 – Sep 2023
References
Ms. Jane Referee
Personal Assistant to the Deputy Director General (Western Cape Department of Infrastructure)
Telephone: 0214835395
Email: jane.referee@example.gov.za
Ms. Emily Sample
Administrative Officer (Western Cape Department of Infrastructure)
Telephone: 0214830118
Email: emily.sample@example.gov.za
Dr. F Khaile
Senior Lecturer (University of the Western Cape)
Telephone: 0219593827
Email: fk@example.ac.za
`;

const CIRC = `Closing date: 30 October 2026 at 16:00. To apply, submit a Z83 and CV by email. INVESTMENT ANALYST REF NO: TRE/12/2026 Directorate: Asset Management R733 257 per annum (Level 11) Pretoria REQUIREMENTS : A Grade 12 is required coupled with a minimum National Diploma (NQF 6)/ B. Tech/ Degree (NQF 7) in Economics/ Finance/ Statistics/ Investment Management/ Mathematical Sciences. A minimum 4 years’ experience of which 2 years should be at an Assistant director level or equivalent obtained in financial markets, with fixed income trading or financial research environment. Job related knowledge: Financial markets. Applications: Applications can be submitted by email to recruit@example.gov.za`;

describe('real-world CV', () => {
  const cv = parseCv(CV);
  it("does not mistake a referee's email, or the ID number, for the applicant's contact details", () => {
    expect(cv.email).toBe('');
    expect(cv.phone).toBe('0821234567');
    expect(cv.gaps.join(' ')).toMatch(/email/);
  });
  it('reads job title and employer separately', () => {
    expect(cv.work[0]).toMatchObject({ post: 'Graduate Intern', employer: 'Western Cape Department of Infrastructure (DOI)', toMM: 'Pres' });
    expect(cv.work.find((w) => w.post === 'Scriber')?.employer).toMatch(/Sixth World/);
  });
  it('does not treat module lists as qualifications', () => {
    expect(cv.qualifications.map((q) => q.text.toLowerCase()).join('|')).not.toMatch(/modules/);
    expect(cv.qualifications.length).toBe(3);
  });
  it('reads all three referees with their titles', () => {
    expect(cv.references.map((r) => r.name)).toEqual(['Ms. Jane Referee', 'Ms. Emily Sample', 'Dr. F Khaile']);
    expect(cv.references[1].relationship).toMatch(/Administrative Officer/);
    expect(cv.references[2].tel).toBe('0219593827');
  });
  it('ignores referee titles when judging seniority', () => {
    expect(cv.text).not.toMatch(/Deputy Director General/);
  });
});

describe('requirement text from the circular', () => {
  const c = parseCircular(CIRC);
  const reqs = c.posts[0].reqs;
  it('splits the qualification and keeps "B. Tech" together', () => {
    const q = reqs.filter((r) => r.kind === 'qualification');
    expect(q.map((r) => r.text)).toEqual(['Grade 12', 'National Diploma (NQF 6)/ B. Tech/ Degree (NQF 7) in Economics/ Finance/ Statistics/ Investment Management/ Mathematical Sciences']);
    expect(q[1].nqf).toBe(6);
    expect(q[1].fields).toEqual(['Economics', 'Finance', 'Statistics', 'Investment Management', 'Mathematical Sciences']);
  });
  it('reads the experience, its seniority and its kind of work', () => {
    const e = reqs.find((r) => r.kind === 'experience')!;
    expect(e.years).toBe(4);
    expect(e.seniority).toBe('assistant director');
    expect(e.domain).toEqual(['financial markets', 'fixed income trading', 'financial research']);
  });
});

describe('matching a public administration graduate against a financial markets post', () => {
  const r = matchPost(parseCircular(CIRC).posts[0], parseCv(CV), []);
  it('does not claim the experience or the field of study', () => {
    const exp = r.items.find((i) => i.req.kind === 'experience')!;
    expect(exp.outcome).toBe('missing');
    const deg = r.items.find((i) => i.req.fields)!;
    expect(deg.outcome).not.toBe('direct');
    expect(deg.evidence).not.toMatch(/lists Economics/);
    expect(r.status).toBe('low');
  });
});
