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
  reappointCondition: '', reappointDetails: '', references: [], signature: '', initials: '', signatureConsent: false,
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

/** Where each auto-filled field came from, so the screen can say "From your CV — please check". */
export type Source = 'cv' | 'saved' | 'you';

export type FilledFrom = Partial<Record<keyof Profile, Source>>;

/**
 * Merge CV details into the profile. Anything the person already typed or saved wins,
 * except empty fields, which the CV fills. Returns which fields came from the CV.
 */
export function mergeCv(saved: Profile, cv: CvInfo): { profile: Profile; from: FilledFrom } {
  const p: Profile = { ...saved };
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
  if (!p.signature) e.push({ field: 'signature', message: 'Draw your signature.' });
  if (!p.initials) e.push({ field: 'initials', message: 'Draw your initials.' });
  if (!p.signatureConsent) e.push({ field: 'signatureConsent', message: 'Tick the box to confirm the signature and initials are yours.' });
  return e;
}
