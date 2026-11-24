import { describe, it, expect } from 'vitest';
import { buildDetailsText, buildEmailBody, buildEml, gmailLink, mailtoLink } from '../src/lib/emailText';
import { emptyProfile } from '../src/lib/profile';
import type { Post, Profile } from '../src/lib/types';

const profile: Profile = { ...emptyProfile(), firstNames: 'Nomsa', surname: 'KHUMALO', idNumber: '8001015009087', contact: 'nomsa@example.com' };
const post = { title: 'Data Analyst', ref: '3/3/1/86/2026', department: 'Agriculture', email: 'jobs@dept.gov.za', closing: null } as unknown as Post;

describe('email drafts', () => {
  it('reads like a formal application', () => {
    const body = buildEmailBody(profile, post);
    expect(body.startsWith('Dear Sir/Madam\n\nApplication for the post of')).toBe(true);
    expect(body).toContain('I hereby apply for the above-mentioned post in the Agriculture.');
    expect(body).toContain('1. My completed Z83 application form\n2. My Curriculum Vitae');
    expect(body.endsWith('Contact: nomsa@example.com\n')).toBe(true);
  });
  it('leaves out the department and the ID line when they are not known', () => {
    const body = buildEmailBody({ ...profile, idNumber: '', contact: '' }, { title: 'Clerk', ref: 'R1', department: '' });
    expect(body).toContain('I hereby apply for the above-mentioned post.');
    expect(body).not.toMatch(/ID number|Contact:/);
  });
  it('writes the same message everywhere', () => {
    const body = buildEmailBody(profile, post);
    expect(body).toMatch(/Application for the post of Data Analyst \(Reference: 3\/3\/1\/86\/2026\)/);
    expect(body).toMatch(/Yours faithfully\n\nNomsa Khumalo\nID number: 8001015009087\nContact: nomsa@example.com/);
    expect(buildDetailsText(profile, [{ post, fileName: 'x.pdf', subject: 'S', to: 'jobs@dept.gov.za' }])).toContain(body);
  });
  it('builds a mailto link with address, subject and a multi-line message', () => {
    const link = mailtoLink('jobs@dept.gov.za', 'Application: Data Analyst (Ref: 3/3/1/86/2026)', 'Line one\nLine two');
    expect(link.startsWith('mailto:jobs@dept.gov.za?subject=')).toBe(true);
    expect(link).toContain('subject=Application%3A%20Data%20Analyst%20(Ref%3A%203%2F3%2F1%2F86%2F2026)');
    expect(link).toContain('body=Line%20one%0D%0ALine%20two');
  });
  it('builds a Gmail compose link', () => {
    const link = gmailLink('jobs@dept.gov.za', 'Hello & welcome', 'Body');
    expect(link).toContain('to=jobs%40dept.gov.za');
    expect(link).toContain('su=Hello%20%26%20welcome');
  });
});

describe('email draft file', () => {
  it('is an unsent message with the PDF attached', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 test');
    const eml = buildEml({ to: 'jobs@dept.gov.za', subject: 'Application: Data Analyst (Ref: 3/3/1/86/2026)', body: 'Dear Sir\nBody', fileName: 'Ref - Data Analyst.pdf', bytes });
    expect(eml.startsWith('X-Unsent: 1\r\nTo: jobs@dept.gov.za\r\nSubject: Application: Data Analyst')).toBe(true);
    expect(eml).toContain('Content-Type: multipart/mixed; boundary=');
    expect(eml).toContain('Content-Disposition: attachment; filename="Ref - Data Analyst.pdf"');
    expect(eml).toContain(btoa('%PDF-1.4 test'));
  });
  it('encodes a subject with non-ASCII letters', () => {
    const eml = buildEml({ to: 'a@b.za', subject: 'Aansoek: Admin Beampte \u2013 Ref 1', body: 'x', fileName: 'a.pdf', bytes: new Uint8Array([1, 2]) });
    expect(eml).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
});
