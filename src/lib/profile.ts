import type { CvInfo, Profile, YesNo } from './types';
import { idDetails } from './cv';

const KEY = 'z83.profile.v1';

export const emptyProfile = (): Profile => ({
  surname: '', firstNames: '', idNumber: '', passport: '', dob: '', race: '', gender: '',
  disability: '', citizen: '', nationality: '', workPermit: '',
  convicted: '', convictedDetails: '', pendingCriminal: '', pendingCriminalDetails: '',
  dismissed: '', dismissedDetails: '', pendingDisciplinary: '', pendingDisciplinaryDetails: '',
  resigned: '', resignedDetails: '', illHealth: '', businessWithState: '', businessDetails: '', relinquish: '',
  yearsPrivate: '', yearsPublic: '', regDate: '', regNo: '', notice: '', prefLanguage: 'English',
  method: 'email', contact: '', languages: [], qualifications: [], currentStudy: '', work: [],
  reappointCondition: '', reappointDetails: '', references: [], signature: '', initials: '', signatureConsent: false, cvKey: '',
});

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyProfile(), ...(JSON.parse(raw) as Partial<Profile>) } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(p: Profile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Bump this whenever the CV reader changes, so lists saved from an older reading are re-read. */
export const CV_PARSER_VERSION = 3;

export function cvKeyOf(cv: CvInfo): string {
  let h = 5381;
  for (let i = 0; i < cv.text.length; i++) h = ((h << 5) + h + cv.text.charCodeAt(i)) | 0;
  return `${CV_PARSER_VERSION}:${(h >>> 0).toString(36)}:${cv.text.length}`;
}

/** Where each auto-filled field came from, so the screen can say "From your CV — please check". */
export type Source = 'cv' | 'saved' | 'you';

export type FilledFrom = Partial<Record<keyof Profile, Source>>;

/**
 * Merge CV details into the profile. Anything the person already typed or saved wins,
 * except empty fields, which the CV fills. Returns which fields came from the CV.
 */
export function mergeCv(savedIn: Profile, cv: CvInfo): { profile: Profile; from: FilledFrom } {
  // Lists read from a CV belong to that CV: a different CV (or a newer reader) means they are read again.
  const key = cvKeyOf(cv);
  const saved: Profile =
    savedIn.cvKey === key
      ? savedIn
      : { ...savedIn, qualifications: [], work: [], references: [], languages: [], currentStudy: '', yearsPrivate: '', yearsPublic: '', regDate: '', regNo: '' };
  const p: Profile = { ...saved, cvKey: key };
  const from: FilledFrom = {};
  const fill = <K extends keyof Profile>(k: K, v: Profile[K] | undefined | null) => {
    const cur = p[k];
    const empty = Array.isArray(cur) ? cur.length === 0 : !cur;
    if (empty && v && !(Array.isArray(v) && v.length === 0)) {
      p[k] = v;
      from[k] = 'cv';
    } else if (!empty) from[k] = 'saved';
  };
  fill('surname', cv.surname);
  fill('firstNames', cv.firstNames);
  fill('idNumber', cv.idNumber);
  fill('dob', cv.dob);
  fill('race', cv.race || undefined);
  fill('gender', cv.gender || undefined);
  fill('disability', (cv.disability || undefined) as YesNo | undefined);
  fill('nationality', cv.nationality);
  fill('notice', cv.notice);
  fill('regNo', cv.registration);
  // Use the applicant's own email if the CV has one, otherwise their phone number.
  fill('contact', cv.email || cv.phone);
  if (!saved.contact && !cv.email && cv.phone) p.method = 'telephone';
  fill('yearsPrivate', cv.totalYears !== null && cv.publicYears !== null ? String(Math.max(0, Math.round((cv.totalYears - cv.publicYears) * 10) / 10)) : undefined);
  fill('yearsPublic', cv.publicYears !== null ? String(cv.publicYears) : undefined);
  fill('languages', cv.languages.slice(0, 5));
  fill('qualifications', cv.qualifications.slice(0, 4).map((q) => ({ school: q.school, qualification: q.text, year: q.year })));
  fill('work', cv.work.slice(0, 3));
  fill('references', cv.references.slice(0, 3));
  if (!p.citizen && /south african/i.test(cv.nationality)) {
    p.citizen = 'yes';
    from.citizen = 'cv';
  }
  const id = idDetails(p.idNumber);
  if (id) {
    if (!p.dob) p.dob = id.dob;
    if (!p.gender) p.gender = id.gender;
  }
  return { profile: p, from };
}

/** Required Z83 answers. Returns a list of plain-English problems; empty means ready. */
export function validateProfile(p: Profile): { field: keyof Profile; message: string }[] {
  const e: { field: keyof Profile; message: string }[] = [];
  const need = (f: keyof Profile, msg: string) => {
    const v = p[f];
    if (!v || (Array.isArray(v) && !v.length)) e.push({ field: f, message: msg });
  };
  need('surname', 'Enter your surname.');
  need('firstNames', 'Enter your full first names.');
  if (!p.idNumber && !p.passport) e.push({ field: 'idNumber', message: 'Enter your ID number (or passport number).' });
  if (p.idNumber && !/^\d{13}$/.test(p.idNumber)) e.push({ field: 'idNumber', message: 'An ID number has 13 digits.' });
  need('race', 'Choose your race (needed for the Z83 equity section).');
  need('gender', 'Choose your gender.');
  const yn: [keyof Profile, string][] = [
    ['disability', 'Do you have a disability?'], ['citizen', 'Are you a South African citizen?'],
    ['convicted', 'Have you been convicted of a criminal offence?'], ['pendingCriminal', 'Do you have a pending criminal case?'],
    ['dismissed', 'Have you been dismissed for misconduct from the Public Service?'], ['pendingDisciplinary', 'Do you have a pending disciplinary case?'],
    ['resigned', 'Have you resigned pending a disciplinary proceeding?'], ['illHealth', 'Were you discharged or retired from the Public Service on ill-health grounds?'],
    ['businessWithState', 'Are you conducting business with the State?'], ['relinquish', 'Will you relinquish such business interests?'],
  ];
  for (const [f, q] of yn) if (!p[f]) e.push({ field: f, message: `Answer: ${q}` });
  if (p.citizen === 'no') {
    need('nationality', 'Enter your nationality.');
    if (!p.workPermit) e.push({ field: 'workPermit', message: 'Answer: Do you have a valid work permit?' });
  }
  const details: [keyof Profile, keyof Profile, string][] = [
    ['convicted', 'convictedDetails', 'conviction'], ['pendingCriminal', 'pendingCriminalDetails', 'pending criminal case'],
    ['dismissed', 'dismissedDetails', 'dismissal'], ['pendingDisciplinary', 'pendingDisciplinaryDetails', 'pending disciplinary case'],
    ['businessWithState', 'businessDetails', 'business with the State'],
  ];
  for (const [a, d, label] of details) if (p[a] === 'yes' && !String(p[d]).trim()) e.push({ field: d, message: `Give details of the ${label}.` });
  if (!p.contact) e.push({ field: 'contact', message: 'Enter your contact details (email or phone).' });
  need('notice', 'Say when you can start, or how much notice you must serve (for example “1 calendar month”).');
  need('prefLanguage', 'Enter your preferred language for correspondence.');
  need('method', 'Choose how the Department should contact you.');
  const langs = p.languages.filter((l) => l.language.trim());
  if (langs.length === 0) e.push({ field: 'languages', message: 'Add at least one language and say how well you speak and write it.' });
  else if (langs.some((l) => !l.speak || !l.write)) e.push({ field: 'languages', message: 'Choose good, fair or poor for speaking and for writing, for every language.' });
  if (!p.qualifications.some((q) => q.qualification.trim())) e.push({ field: 'qualifications', message: 'Add at least one formal qualification (your highest first).' });
  else if (p.qualifications.some((q) => !q.qualification.trim() || !q.school.trim())) e.push({ field: 'qualifications', message: 'Fill in the school or college and the qualification for every row, or remove the empty row.' });
  if (!p.work.some((w) => w.employer.trim() || w.post.trim())) e.push({ field: 'work', message: 'Add your work experience (at least your current or last job).' });
  else if (p.work.some((w) => !w.employer.trim() || !w.post.trim())) e.push({ field: 'work', message: 'Fill in the employer and the post held for every job, or remove the empty row.' });
  if (!p.yearsPrivate.trim() && !p.yearsPublic.trim()) e.push({ field: 'yearsPrivate', message: 'Enter your years of experience (use 0 if you have none in that sector).' });
  if (!p.reappointCondition) e.push({ field: 'reappointCondition', message: 'Answer whether a condition prevents your re-appointment (choose No if you were never in the Public Service).' });
  if (p.references.some((r) => !r.name.trim() || !r.relationship.trim() || !r.tel.trim()))
    e.push({ field: 'references', message: 'Fill in the name, the relationship to you and the phone number for every referee, or remove the empty row.' });
  if (!p.signature) e.push({ field: 'signature', message: 'Draw your signature.' });
  if (!p.initials) e.push({ field: 'initials', message: 'Draw your initials.' });
  if (!p.signatureConsent) e.push({ field: 'signatureConsent', message: 'Tick the box to confirm the signature and initials are yours.' });
  return e;
}
