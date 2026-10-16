import { fmtDate } from './circular';
import type { Post, Profile } from './types';

export interface PackItem {
  post: Post;
  fileName: string;
  subject: string;
  to: string;
}

const line = (label: string, value: string) => (value ? `${label}: ${value}\n` : '');

/** A plain text file with everything needed to copy and paste into the emails. */
export function buildDetailsText(profile: Profile, items: PackItem[], date = new Date()): string {
  const nice = (w: string) => (w === w.toUpperCase() ? w.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()) : w);
  const name = `${profile.firstNames} ${nice(profile.surname)}`.trim();
  let t = 'Z83 APPLICATION PACK: DETAILS FOR YOUR EMAILS\n';
  t += `Created: ${date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
  t += 'YOUR DETAILS\n------------\n';
  t += line('Full name', name);
  t += line('ID number', profile.idNumber || profile.passport);
  t += line('Contact', profile.contact);
  t += '\n';
  items.forEach((it, i) => {
    const p = it.post;
    t += `POST ${i + 1} OF ${items.length}\n-----------------\n`;
    t += line('Post', p.title);
    t += line('Reference number', p.ref);
    t += line('Department', p.department);
    t += line('Closing date', p.closing ? fmtDate(p.closing) : '');
    t += `Send to: ${it.to || '(no email address found: check the circular)'}\n`;
    t += line('Subject', it.subject);
    t += line('Attach', it.fileName);
    t += '\nEmail text (copy and paste):\n';
    t += `Dear Sir/Madam\n\nPlease find attached my application for the post of ${p.title} (Reference: ${p.ref}).\n`;
    t += 'The attached PDF contains my completed Z83 form followed by my CV.\n\n';
    t += `Kind regards\n${name}\n`;
    if (profile.idNumber) t += `ID number: ${profile.idNumber}\n`;
    if (profile.contact) t += `Contact: ${profile.contact}\n`;
    t += '\n\n';
  });
  t += 'REMINDERS\n---------\n';
  t += '* Send one separate email for each post.\n';
  t += '* Attach the PDF yourself. Check the Z83 (especially the declarations) before sending.\n';
  t += '* Check the closing date and the circular for any extra documents you must include.\n';
  return t;
}
