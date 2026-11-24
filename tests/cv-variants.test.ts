import { describe, it, expect } from 'vitest';
import { parseCv } from '../src/lib/cv';

const head = `NOMSA KHUMALO
Cell: 082 555 1234 | nomsa@example.com
ID Number: 8001015009087
`;
const edu = `Education
National Diploma: Information Technology
Tshwane University of Technology, 2012
Work Experience
Business Analyst
Department of Health
Mar 2016 - Present
`;
const langsOf = (cv: string) => parseCv(cv).languages.map((l) => l.language).sort();
const refsOf = (cv: string) => parseCv(cv).references;

describe('languages in many styles', () => {
  it('reads a plain comma list and normalises Xhosa to isiXhosa', () => {
    expect(langsOf(head + 'Languages: English, Xhosa, Afrikaans\n' + edu)).toEqual(['Afrikaans', 'English', 'isiXhosa']);
  });
  it('reads isiXhosa/IsiZulu/Sesotho spellings', () => {
    expect(langsOf(head + 'LANGUAGES\nIsiXhosa (Mother tongue)\nEnglish (Fluent)\nSesotho\n' + edu)).toEqual(['English', 'Sesotho', 'isiXhosa']);
  });
  it('reads "Language proficiency" and "Languages known" headings', () => {
    expect(langsOf(head + 'Language Proficiency\n• English – Fluent\n• Zulu – Good\n' + edu)).toEqual(['English', 'isiZulu']);
    expect(langsOf(head + 'Languages Known: Tswana, English\n' + edu)).toEqual(['English', 'Setswana']);
  });
  it('reads a language found only in personal details (no languages heading)', () => {
    expect(langsOf(head + 'Personal Details\nHome Language: Xhosa\nOther languages: English and Afrikaans\n' + edu)).toEqual(['Afrikaans', 'English', 'isiXhosa']);
  });
  it('reads a speak / read / write table with separate levels', () => {
    const cv = head + 'Languages\nLanguage Speak Read Write\nEnglish Good Good Good\nisiXhosa Excellent Excellent Fair\nAfrikaans Fair Fair Poor\n' + edu;
    const l = parseCv(cv).languages;
    expect(l.find((x) => x.language === 'isiXhosa')).toMatchObject({ speak: 'good', write: 'fair' });
    expect(l.find((x) => x.language === 'Afrikaans')).toMatchObject({ speak: 'fair', write: 'poor' });
  });
  it('does not treat a surname or place as a language', () => {
    expect(langsOf('ZULU MOKOENA\nZululand Road\n' + head + edu)).toEqual([]);
  });
});

describe('references in many styles', () => {
  const blocks = `Dr Sipho Dlamini
Director: ICT
012 555 0000
Ms Anna Botha
Line manager
082 111 2222
`;
  it.each(['References', 'REFERENCES', 'Referees', 'REFEREES:', 'Professional References', 'Character Referees', 'References and Contact Details', 'Referee Details'])('finds the "%s" heading', (h) => {
    expect(refsOf(head + edu + h + '\n' + blocks)).toHaveLength(2);
  });
  it('reads one-line referees separated by dashes or pipes', () => {
    const r = refsOf(head + edu + 'Referees\nMr Thabo Dlamini – Director: Finance – 012 345 6789\nMs Anna Botha | Line Manager | 082 111 2222\n');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ name: 'Mr Thabo Dlamini', tel: '012 345 6789' });
    expect(r[0].relationship).toMatch(/director/i);
    expect(r[1].tel).toMatch(/082/);
  });
  it('reads labelled referee blocks', () => {
    const r = refsOf(head + edu + 'Referees\nName: Ms Anna Botha\nPosition: Line Manager\nCell: 082 111 2222\nName: Dr Sipho Dlamini\nPosition: Director\nTel: 012 555 0000\n');
    expect(r.map((x) => x.name)).toEqual(['Ms Anna Botha', 'Dr Sipho Dlamini']);
    expect(r[0].tel).toMatch(/082/);
  });
  it('reads numbered referees with the phone on the name line', () => {
    const r = refsOf(head + edu + 'References\n1. Dr Sipho Dlamini 012 555 0000\nDirector: ICT\n2. Ms Anna Botha 082 111 2222\nLine manager\n');
    expect(r).toHaveLength(2);
    expect(r[0].tel).toMatch(/012/);
    expect(r[1].relationship).toMatch(/manager/i);
  });
  it('knows when references are only "available on request"', () => {
    const cv = parseCv(head + edu + 'References available on request\n');
    expect(cv.references).toHaveLength(0);
    expect(cv.gaps.join(' ')).toMatch(/available on request/);
  });
});
