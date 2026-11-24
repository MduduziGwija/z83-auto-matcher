import { describe, it, expect } from 'vitest';
import { buildDetailsText, buildEmailBody, gmailLink, mailtoLink } from '../src/lib/emailText';
import { emptyProfile } from '../src/lib/profile';
import type { Post, Profile } from '../src/lib/types';

const profile: Profile = { ...emptyProfile(), firstNames: 'Nomsa', surname: 'KHUMALO', idNumber: '8001015009087', contact: 'nomsa@example.com' };
const post = { title: 'Data Analyst', ref: '3/3/1/86/2026', department: 'Agriculture', email: 'jobs@dept.gov.za', closing: null } as unknown as Post;

describe('email drafts', () => {
  it('writes the same message everywhere', () => {
    const body = buildEmailBody(profile, post);
    expect(body).toMatch(/post of Data Analyst \(Reference: 3\/3\/1\/86\/2026\)/);
    expect(body).toMatch(/Kind regards\nNomsa Khumalo/);
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
