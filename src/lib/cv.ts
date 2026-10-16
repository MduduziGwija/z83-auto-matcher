import type { CvInfo, CvQualification, CvWork } from './types';
import { levelOf } from './text';

const MON = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const MON_RE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DATE_TOKEN = `(?:${MON_RE}\\s+\\d{4}|\\d{1,2}[/.\\-]\\d{4}|\\d{4}[/.\\-]\\d{1,2}|\\d{4})`;
const RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to|until|till)\\s*(${DATE_TOKEN}|present|current|date|now|today|ongoing)`, 'i');

const LANGS: Record<string, string> = {
  english: 'English', afrikaans: 'Afrikaans', isizulu: 'isiZulu', zulu: 'isiZulu', isixhosa: 'isiXhosa', xhosa: 'isiXhosa',
  sesotho: 'Sesotho', 'southern sotho': 'Sesotho', sotho: 'Sesotho', setswana: 'Setswana', tswana: 'Setswana',
  sepedi: 'Sepedi', 'northern sotho': 'Sepedi', pedi: 'Sepedi', xitsonga: 'Xitsonga', tsonga: 'Xitsonga',
  siswati: 'siSwati', swati: 'siSwati', tshivenda: 'Tshivenda', venda: 'Tshivenda', isindebele: 'isiNdebele', ndebele: 'isiNdebele',
};

const HEAD: Record<string, RegExp> = {
  education: /^(?:education|qualifications?|academic(?:\s+(?:qualifications?|background|record))?|educational background|education and training|training and education|tertiary education)\b/i,
  experience: /^(?:(?:work|employment|professional|career|relevant)\s+)?(?:experience|history)\b|^employment\b|^work\s+history\b|^career\s+history\b/i,
  languages: /^languages?\b/i,
  references: /^(?:references?|referees?)\b/i,
  skills: /^(?:key\s+|core\s+|technical\s+|computer\s+)?(?:skills|competenc\w+)\b/i,
};
const OTHER_HEAD = /^(?:summary|profile|objective|career objective|personal\s+(?:details|information|particulars|profile)|interests?|hobbies|achievements?|awards?|courses|certifications?|projects?|declaration|additional information|contact(?:\s+details)?)\b/i;

export type Sections = Partial<Record<keyof typeof HEAD, string[]>>;

export function splitSections(lines: string[]): Sections {
  const out: Sections = {};
  let cur: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const head = line.replace(/[:\-–_]+$/g, '').trim();
    if (head && head.length < 48 && !/\d{4}/.test(head)) {
      const key = (Object.keys(HEAD) as (keyof typeof HEAD)[]).find((k) => HEAD[k].test(head));
      if (key) {
        cur = key;
        out[key] = out[key] ?? [];
        const rest = head.replace(HEAD[key], '').trim();
        if (rest && /^[:-]/.test(line.slice(head.length - rest.length - 1))) out[key]!.push(rest);
        continue;
      }
      if (OTHER_HEAD.test(head) && head.split(' ').length <= 4) {
        cur = null;
        continue;
      }
    }
    if (cur) out[cur]!.push(line);
  }
  return out;
}

export function isValidSaId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let d = Number(id[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function idDetails(id: string): { dob: string; gender: 'male' | 'female' } | null {
  if (!/^\d{13}$/.test(id)) return null;
  return { dob: `${id.slice(4, 6)}/${id.slice(2, 4)}/${id.slice(0, 2)}`, gender: Number(id.slice(6, 10)) >= 5000 ? 'male' : 'female' };
}

type Race = CvInfo['race'];
export function mapRace(word: string): Race {
  const w = word.toLowerCase();
  if (/\b(black|african)\b/.test(w)) return 'african';
  if (/colou?red/.test(w)) return 'coloured';
  if (/indian|asian/.test(w)) return 'indian';
  if (/white|caucasian/.test(w)) return 'white';
  return w.trim() ? 'other' : '';
}

/** Finds race/gender however the person wrote it, e.g. "Black African Male", "Coloured female", "Race: Indian". */
export function detectDemographics(text: string): { race: Race; gender: CvInfo['gender']; disability: CvInfo['disability'] } {
  const t = text.replace(/[’‘]/g, "'");
  let race: Race = '';
  const labelled = t.match(/(?:race|ethnic(?:ity)?|population group|racial classification|equity(?: status| group)?)\s*[:\-–]\s*([A-Za-z ]{3,24})/i);
  if (labelled) race = mapRace(labelled[1]);
  if (!race) {
    const combo = t.match(/\b(black(?:\s+african)?|(?<!south\s)(?<!southern\s)(?<!pan[\s-])african|colou?red|indian|asian|white|caucasian)\s*(?:,|\/|-)?\s*(?:south african\s+)?(female|male|woman|man|lady|gentleman)\b/i)
      ?? t.match(/\b(female|male)\s*[,/-]?\s*(black(?:\s+african)?|(?<!south\s)(?<!southern\s)(?<!pan[\s-])african|colou?red|indian|asian|white|caucasian)\b/i);
    if (combo) race = mapRace(/^(female|male)/i.test(combo[1]) ? combo[2] : combo[1]);
  }
  if (!race) {
    // Only trust a lone word when it sits in a short "personal details" style line.
    for (const line of t.split('\n')) {
      if (line.length > 60) continue;
      const m = line.match(/^\s*(?:population group|race|ethnicity)?\s*[:\-]?\s*(black african|black|coloured|colored|indian|african)\s*$/i);
      if (m) {
        race = mapRace(m[1]);
        break;
      }
    }
  }
  let gender: CvInfo['gender'] = '';
  const g = t.match(/(?:gender|sex)\s*[:\-–]\s*(female|male|f|m|woman|man)\b/i);
  if (g) gender = /^f|^w/i.test(g[1]) ? 'female' : 'male';
  else if (/\bfemale\b/i.test(t)) gender = 'female';
  else if (/\bmale\b/i.test(t)) gender = 'male';
  let disability: CvInfo['disability'] = '';
  const d = t.match(/disabilit(?:y|ies)\s*(?:status)?\s*[:\-–]?\s*(none|no|nil|n\/a|not applicable|yes|physical|visual|hearing|[a-z]+)/i);
  if (d) disability = /^(none|no|nil|n\/a|not)/i.test(d[1]) ? 'no' : /^(yes|physical|visual|hearing)/i.test(d[1]) ? 'yes' : '';
  return { race, gender, disability };
}

function parseDateTok(tok: string): { mm: string; yy: string; idx: number } | null {
  const t = tok.trim().toLowerCase();
  let m = t.match(new RegExp(`^(${MON_RE})\\s+(\\d{4})$`));
  if (m) {
    const mi = MON.indexOf(m[1].slice(0, 3));
    return { mm: String(mi + 1).padStart(2, '0'), yy: m[2].slice(2), idx: Number(m[2]) * 12 + mi };
  }
  m = t.match(/^(\d{1,2})[/.\-](\d{4})$/);
  if (m) return { mm: m[1].padStart(2, '0'), yy: m[2].slice(2), idx: Number(m[2]) * 12 + Number(m[1]) - 1 };
  m = t.match(/^(\d{4})[/.\-](\d{1,2})$/);
  if (m) return { mm: m[2].padStart(2, '0'), yy: m[1].slice(2), idx: Number(m[1]) * 12 + Number(m[2]) - 1 };
  m = t.match(/^(\d{4})$/);
  if (m) return { mm: '', yy: m[1].slice(2), idx: Number(m[1]) * 12 };
  return null;
}

const TITLE_WORDS = /\b(manager|officer|analyst|clerk|developer|engineer|director|assistant|administrator|coordinator|specialist|consultant|supervisor|technician|intern|lecturer|teacher|accountant|practitioner|head|executive|controller|advisor|adviser|secretary|receptionist|driver|auditor|planner|architect|designer|tester|representative|agent|lead|principal|artisan|operator|inspector|trainee|learner|learnership|researcher)\b/i;
const ORG_WORDS = /\b(pty|ltd|limited|department|dept|municipality|council|university|bank|group|holdings|services|solutions|trust|hospital|agency|authority|board|npc|inc|cc|soc|company|corporation|ministry|government|treasury|college|institute|sars|saps|sassa|eskom|transnet|school|association|foundation|municipal|provincial)\b/i;
const PUBLIC_WORDS = /\b(department|dept|municipality|municipal|provincial|government|council|treasury|sars|saps|sassa|sandf|presidency|public service|parliament|legislature|national school|public works|metro)\b/i;

interface Range {
  from: number;
  to: number;
  fromTok: { mm: string; yy: string };
  toTok: { mm: string; yy: string; present: boolean };
}

function parseRange(line: string): (Range & { match: string }) | null {
  const m = line.match(RANGE_RE);
  if (!m) return null;
  const a = parseDateTok(m[1]);
  if (!a) return null;
  const present = /present|current|date|now|today|ongoing/i.test(m[2]);
  const now = new Date();
  const b = present ? { mm: String(now.getMonth() + 1).padStart(2, '0'), yy: String(now.getFullYear()).slice(2), idx: now.getFullYear() * 12 + now.getMonth() } : parseDateTok(m[2]);
  if (!b) return null;
  if (b.idx < a.idx) return null;
  return { from: a.idx, to: b.idx + (b.mm === '' ? 11 : 0), fromTok: a, toTok: { mm: b.mm, yy: b.yy, present }, match: m[0] };
}

function mergedMonths(ranges: { from: number; to: number }[]): number {
  const s = [...ranges].sort((x, y) => x.from - y.from);
  let total = 0;
  let curEnd = -1;
  let curStart = -1;
  for (const r of s) {
    if (curEnd < 0 || r.from > curEnd) {
      if (curEnd >= 0) total += curEnd - curStart + 1;
      curStart = r.from;
      curEnd = r.to;
    } else curEnd = Math.max(curEnd, r.to);
  }
  if (curEnd >= 0) total += curEnd - curStart + 1;
  return total;
}

const isBullet = (l: string) => /^\s*[•·▪●○\-*–]\s/.test(l) || l.length > 90;

/** Split on separators but keep commas that sit inside brackets, e.g. "ABC Software (Pty) Ltd". */
function splitParts(line: string): string[] {
  const guarded = line.replace(/\(([^)]*)\)/g, (m) => m.replace(/,/g, '\u0001'));
  return guarded
    .split(/\s[|·•–—-]\s|\|\s*|,\s+/)
    .map((x) => x.replace(/\u0001/g, ',').replace(/^[\s,:;-]+|[\s,:;-]+$/g, '').trim())
    .filter((x) => x.length > 1);
}

function parseWork(lines: string[]): { work: CvWork[]; ranges: { from: number; to: number; pub: boolean }[] } {
  const work: (CvWork & { idx: number })[] = [];
  const ranges: { from: number; to: number; pub: boolean }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const r = parseRange(lines[i]);
    if (!r) continue;
    if (levelOf(lines[i]) > 0 && !TITLE_WORDS.test(lines[i])) continue; // a study date range
    const parts = splitParts(lines[i].replace(r.match, ' '));
    // Layout B: the title/employer sit on the lines around a lone date line.
    if (parts.length < 2) {
      for (const k of [i - 1, i - 2, i + 1]) {
        const l = lines[k]?.trim();
        if (l && !isBullet(l) && !parseRange(l) && l.length < 80 && !/:$/.test(l) && parts.length < 3) parts.push(...splitParts(l));
      }
    }
    let post = parts.find((c) => TITLE_WORDS.test(c) && !ORG_WORDS.test(c)) ?? '';
    let employer = parts.find((c) => ORG_WORDS.test(c) && c !== post) ?? '';
    const rest = parts.filter((c) => c !== post && c !== employer);
    if (!post && rest.length && !(employer === '' && rest.length === 1)) post = rest.shift()!;
    if (!employer && rest.length) employer = rest.shift()!;
    if (!post && !employer && parts[0]) post = parts[0];
    let reason = '';
    for (let k = i; k < Math.min(lines.length, i + 8); k++) {
      const rm = lines[k].match(/reason for leaving\s*[:\-]\s*(.+)$/i);
      if (rm) reason = rm[1].trim().slice(0, 60);
    }
    work.push({
      employer: employer.slice(0, 70),
      post: post.slice(0, 60),
      fromMM: r.fromTok.mm,
      fromYY: r.fromTok.yy,
      toMM: r.toTok.present ? 'Pres' : r.toTok.mm,
      toYY: r.toTok.present ? '' : r.toTok.yy,
      reason,
      idx: r.to,
    });
    ranges.push({ from: r.from, to: r.to, pub: PUBLIC_WORDS.test(employer + ' ' + post) });
  }
  work.sort((a, b) => b.idx - a.idx);
  return { work: work.map(({ idx: _i, ...w }) => w), ranges };
}

const SCHOOL_RE = /\b(university|college|school|institute|tvet|academy|high|technikon|unisa|wits|nwu|tut|cput|uj|ukzn|ufs|up|stellenbosch|polytechnic|varsity)\b/i;

function parseQuals(lines: string[]): CvQualification[] {
  const out: CvQualification[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || (isBullet(l) && l.length > 90)) continue;
    if (/\b(modules?|subjects?|courses? (?:include|covered))\b\s*:?/i.test(l)) continue; // lists of modules are not qualifications
    const lvl = levelOf(l);
    if (!lvl && !/\b(diploma|degree|certificate|matric|grade 12|honou?rs|masters?|bachelor)\b/i.test(l)) continue;
    if (TITLE_WORDS.test(l) && !/diploma|degree|certificate|bachelor|honou?rs|master/i.test(l)) continue;
    const neighbours = [lines[i - 1], lines[i + 1], lines[i + 2]].filter(Boolean).map((x) => x.trim());
    const years = [l, ...neighbours.slice(0, 2)].join(' ').match(/\b(19[6-9]\d|20[0-3]\d)\b/g);
    // Look forward first: the institution usually follows its qualification, and the line before is often the previous qualification's institution.
    const after = [lines[i + 1], lines[i + 2]].filter(Boolean).map((x) => x.trim());
    const prev = lines[i - 1]?.trim() ?? '';
    const prevIsQual = !prev || levelOf(prev) > 0 || SCHOOL_RE.test(prev) && /\b(19|20)\d{2}\b/.test(prev);
    let school = l.match(SCHOOL_RE) ? '' : after.find((n) => SCHOOL_RE.test(n) && n.length < 80 && !levelOf(n)) ?? (!prevIsQual && SCHOOL_RE.test(prev) ? prev : '');
    school = school.replace(/\b(19[6-9]\d|20[0-3]\d)\b/g, '').replace(/[,\-–\s]+$/g, '').trim();
    let text = l.replace(/\b(19[6-9]\d|20[0-3]\d)\b/g, '').replace(/[()|,\-–]+\s*$/g, '').replace(/^\W+/, '').trim();
    const inline = text.split(/\s[|–—-]\s|,\s(?=(?:university|college|school))/i);
    if (inline.length > 1) {
      const sch = inline.find((x) => SCHOOL_RE.test(x));
      if (sch && !school) {
        school = sch.trim();
        text = inline.filter((x) => x !== sch).join(' - ').trim();
      }
    }
    if (text.length < 4) continue;
    out.push({ text: text.slice(0, 90), school: school.slice(0, 70), level: lvl || 5, year: years ? years[years.length - 1] : '' });
  }
  const seen = new Set<string>();
  return out
    .filter((q) => (seen.has(q.text.toLowerCase()) ? false : (seen.add(q.text.toLowerCase()), true)))
    .sort((a, b) => b.level - a.level);
}

function parseLanguages(lines: string[]): CvInfo['languages'] {
  const found = new Map<string, string>();
  for (const l of lines) {
    const low = l.toLowerCase();
    for (const [k, v] of Object.entries(LANGS)) {
      if (new RegExp(`\\b${k}\\b`).test(low) && !found.has(v)) {
        const seg = low.split(/[,;/|]/).find((s) => s.includes(k)) ?? low;
        const lvl = /poor|limited|beginner|very basic/.test(seg) ? 'poor' : /fair|average|intermediate|basic|moderate/.test(seg) ? 'fair' : 'good';
        found.set(v, lvl);
      }
    }
  }
  return [...found].map(([language, lvl]) => ({ language, speak: lvl, write: lvl }));
}

const PHONE_RE = /(?<!\d)(?:\+27|0027|0)[\s().-]?\d{2}[\s().-]?\d{3}[\s.-]?\d{4}(?!\d)/;

const NAME_PART = "(?:[A-Z][A-Za-z'’-]*\\.?|(?:van|der|de|den|du|le|la|von|bin|ben)\\b)";
const TITLED = new RegExp(`^(?:name\\s*[:\\-]\\s*)?((?:Mr|Mrs|Ms|Miss|Dr|Prof|Adv|Pastor|Rev|Hon)\\.?\\s+(?:${NAME_PART}\\s*){1,5})$`);
const PLAIN = new RegExp(`^(?:name\\s*[:\\-]\\s*)?((?:${NAME_PART}\\s+){1,4}${NAME_PART})$`);
const CONTACT_LINE = /^(?:tel(?:ephone)?|cell(?:phone)?|mobile|phone|e-?mail|work|office|fax|contact)\b/i;

function parseRefs(lines: string[]): CvInfo['references'] {
  const groups: string[][] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || /available (?:up)?on request|on request/i.test(l)) continue;
    const titled = TITLED.test(l) && !/@|\d/.test(l);
    const plain = groups.length === 0 && PLAIN.test(l) && !/@|\d/.test(l) && !ORG_WORDS.test(l);
    if (titled || plain) groups.push([l]);
    else if (groups.length) groups[groups.length - 1].push(l);
  }
  const refs: CvInfo['references'] = [];
  for (const g of groups) {
    const name = (g[0].match(TITLED) ?? g[0].match(PLAIN))?.[1]?.trim() ?? g[0];
    const phone = g.slice(1).map((l) => l.match(PHONE_RE)?.[0]).find(Boolean) ?? '';
    const rel = g.slice(1).find((l) => !PHONE_RE.test(l) && !/@/.test(l) && !CONTACT_LINE.test(l) && l.length < 110) ?? '';
    const labelled = g.map((l) => l.match(/relationship\s*[:\-]\s*(.+)$/i)?.[1]).find(Boolean);
    refs.push({ name, relationship: (labelled ?? rel).trim().slice(0, 80), tel: phone.trim() });
  }
  return refs.filter((r) => r.name).slice(0, 3);
}

export function parseCv(rawText: string): CvInfo {
  const full = rawText.replace(/\r/g, '').replace(/[\u00a0\u2009]/g, ' ');
  const allLines = full.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const sec = splitSections(allLines);
  // Everything before the references heading is "the CV body". Referee titles, emails and
  // phone numbers must never be mistaken for the applicant's own.
  const refAt = allLines.findIndex((l, i) => i > 5 && l.length < 30 && HEAD.references.test(l.replace(/[:\-–_]+$/g, '').trim()));
  const lines = refAt > 0 ? allLines.slice(0, refAt) : allLines;
  const text = lines.join('\n');
  const gaps: string[] = [];

  const idCand = (text.match(/\b\d{13}\b/g) ?? []).find(isValidSaId) ?? (text.match(/(?:id|identity)\s*(?:no|number)?\s*[:\-]?\s*(\d{13})/i)?.[1] ?? '');
  const details = idDetails(idCand);
  const demo = detectDemographics(text);
  if (details) demo.gender = details.gender;

  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? '';
  const phone = text.replace(/\b\d{13}\b/g, ' ').match(PHONE_RE)?.[0].trim() ?? '';

  let surname = text.match(/\bsurname\s*[:\-]\s*([A-Za-z'’ -]{2,30})/i)?.[1]?.trim() ?? '';
  let firstNames = text.match(/\b(?:first\s*names?|full\s*names?|given\s*names?|names?)\s*[:\-]\s*([A-Za-z'’ -]{2,40})/i)?.[1]?.trim() ?? '';
  let name = '';
  if (!surname || !firstNames) {
    const head = lines.slice(0, 12).filter(Boolean);
    const cand = head.find((l) => /^(?:curriculum vitae|cv|resume)\s*(?:of|:|-)\s*/i.test(l))?.replace(/^(?:curriculum vitae|cv|resume)\s*(?:of|:|-)\s*/i, '')
      ?? head.find((l) => /^[A-Za-z'’-]+(?:\s+[A-Za-z'’-]+){1,3}$/.test(l) && !/curriculum|vitae|resume|^cv$|profile|contact|personal|details|summary/i.test(l) && l.length < 40);
    if (cand) {
      name = cand.trim();
      const parts = name.split(/\s+/);
      const upper = parts.find((p) => p.length > 1 && p === p.toUpperCase() && parts.some((q) => q !== q.toUpperCase()));
      if (!surname) surname = upper ?? parts[parts.length - 1];
      if (!firstNames) firstNames = parts.filter((p) => p !== surname).join(' ');
    }
  }
  name = name || `${firstNames} ${surname}`.trim();
  const cap = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
  surname = surname === surname.toUpperCase() ? surname : surname;
  firstNames = firstNames === firstNames.toUpperCase() ? cap(firstNames) : firstNames;

  const nationality = text.match(/nationality\s*[:\-]\s*([A-Za-z ]{3,25})/i)?.[1]?.trim() ?? (idCand ? 'South African' : '');

  const expLines = sec.experience ?? lines.filter((l) => !(levelOf(l) > 0 && !TITLE_WORDS.test(l)));
  const { work, ranges } = parseWork(expLines);
  const total = ranges.length ? mergedMonths(ranges) / 12 : null;
  const pubMonths = ranges.length ? mergedMonths(ranges.filter((r) => r.pub)) : 0;
  const stated = text.match(/(\d{1,2})\+?\s*years?(?:['’]s)?\s*(?:of\s+)?(?:relevant\s+|working\s+|professional\s+)?experience/i);
  const totalYears = total ?? (stated ? Number(stated[1]) : null);

  const qualifications = parseQuals(sec.education ?? lines);
  const languages = parseLanguages(sec.languages ?? lines.filter((l) => /language/i.test(l)));
  const refLines = sec.references ?? [];
  const references = parseRefs(refLines);
  const hasReferences = references.length > 0;

  const reg = text.match(/\b(ECSA|HPCSA|SAICA|SAIPA|SACE|SACSSP|SANC|SAPC|SACPCMP|PSIRA|CIMA|LPC|SAIT|SAQA)\b[^\n]{0,30}?(\d{4,})/i);
  const notice = text.match(/notice period\s*[:\-]\s*([^\n]{1,30})/i)?.[1]?.trim() ?? (/available immediately|immediately available/i.test(text) ? 'Immediately' : '');

  if (!idCand) gaps.push('We could not find your ID number in the CV.');
  if (!email) gaps.push('We could not find your own email address on the CV. Add it near your name, so the Department can reach you.');
  if (!languages.length) gaps.push('We could not find a languages section on your CV. The Z83 asks how well you speak, read and write official languages.');
  if (!qualifications.length) gaps.push('We could not find your qualifications. Check your CV has an "Education" or "Qualifications" heading.');
  if (!work.length) gaps.push('We could not find dated work experience (for example "Jan 2018 - Present").');
  if (!hasReferences) gaps.push('Your CV has no references. Please update your CV with at least 3 referees (name, relationship, phone number). You can still create your application pack now.');

  return {
    text,
    name,
    surname,
    firstNames,
    idNumber: idCand,
    email,
    phone,
    nationality,
    race: demo.race,
    gender: demo.gender,
    disability: demo.disability,
    dob: details?.dob ?? '',
    notice,
    registration: reg ? `${reg[1].toUpperCase()} ${reg[2]}` : '',
    qualifications,
    work,
    languages,
    references,
    hasReferences,
    totalYears: totalYears !== null ? Math.round(totalYears * 10) / 10 : null,
    publicYears: ranges.length ? Math.round((pubMonths / 12) * 10) / 10 : null,
    driversLicence: /driver[’']?s?[’']?\s*licen[cs]e|licen[cs]e\s*:?\s*code|\bcode\s*(?:08|10|14|b|eb|c1)\b/i.test(text),
    gaps,
  };
}
