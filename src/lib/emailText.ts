import { fmtDate } from './circular';
import type { Post, Profile } from './types';

export interface PackItem {
  post: Post;
  fileName: string;
  subject: string;
  to: string;
}

const line = (label: string, value: string) => (value ? `${label}: ${value}\n` : '');

const nice = (w: string) => (w === w.toUpperCase() ? w.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()) : w);
export const applicantName = (profile: Profile) => `${profile.firstNames} ${nice(profile.surname)}`.trim();

/** The message that goes in the email, the same in the details file, the copy button and the draft. */
export function buildEmailBody(profile: Profile, post: Pick<Post, 'title' | 'ref'> & { department?: string }): string {
  const name = applicantName(profile);
  const dept = post.department?.trim();
  const idLine = profile.idNumber ? `ID number: ${profile.idNumber}` : profile.passport ? `Passport number: ${profile.passport}` : '';
  // Every sentence ends with a full stop, so the letter still reads well in apps (like Gmail on an iPhone) that run the lines together.
  return [
    'Dear Sir/Madam,',
    '',
    `Application for the post of ${post.title} (Reference: ${post.ref}).`,
    '',
    `I hereby apply for the above-mentioned post${dept ? ` in the ${dept.replace(/^the\s+/i, '')}` : ''}.`,
    '',
    'Please find attached a single PDF containing my completed Z83 application form, followed by my Curriculum Vitae.',
    '',
    'Should you require any further information or documents, please contact me on the details below.',
    '',
    'Thank you for your time and consideration.',
    '',
    'Yours faithfully,',
    name,
    ...(idLine ? [`${idLine}.`] : []),
    ...(profile.contact ? [`Contact: ${profile.contact}.`] : []),
    '',
  ].join('\n');
}

const crlf = (t: string) => t.replace(/\r?\n/g, '\r\n');

/** A link that opens the person's email app with the address, subject and message filled in. */
export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf(body))}`;
}

/** The same draft in Gmail on the web (for computers where no email app is set up). */
export function gmailLink(to: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** A plain text file with everything needed to copy and paste into the emails. */
export function buildDetailsText(profile: Profile, items: PackItem[], date = new Date()): string {
  const name = applicantName(profile);
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
    t += buildEmailBody(profile, p);
    t += '\n\n';
  });
  t += 'REMINDERS\n---------\n';
  t += '* Send one separate email for each post.\n';
  t += '* Attach the PDF named above. Check the Z83 (especially the declarations) before sending.\n';
  t += '* Check the closing date and the circular for any extra documents you must include.\n';
  return t;
}

const b64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n');
};
const encHeader = (t: string) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${btoa(unescape(encodeURIComponent(t)))}?=`);

/**
 * An unsent email with the PDF already attached (RFC 822 with "X-Unsent: 1").
 * Outlook and Thunderbird on a computer open it as a ready draft: just press Send.
 */
export function buildEml(opts: { to: string; subject: string; body: string; fileName: string; bytes: Uint8Array }): string {
  const boundary = `z83-${Math.random().toString(36).slice(2)}`;
  const safeName = opts.fileName.replace(/[\r\n"]/g, '');
  const body64 = btoa(unescape(encodeURIComponent(crlf(opts.body)))).replace(/.{1,76}/g, '$&\r\n');
  return [
    'X-Unsent: 1',
    `To: ${opts.to}`,
    `Subject: ${encHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body64,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${encHeader(safeName)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${encHeader(safeName)}"`,
    '',
    b64(opts.bytes),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}
