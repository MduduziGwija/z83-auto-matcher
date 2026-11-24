import type { CvInfo, CvQualification, CvWork, ExpEntry } from './types';
import { experienceTotals, monthIdx, toYears } from './experience';
import { levelOf } from './text';

const MON = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const MON_RE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
// A year: 2018, '18 or (only straight after a month name) 18.
const YR = "(?:\\d{4}|['\u2019]\\d{2}|\\d{2}(?!\\d))";
const DATE_TOKEN = `(?:${[
  '\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}', // 01/03/2018
  `\\d{1,2}(?:st|nd|rd|th)?\\s+${MON_RE}[\\s,'\u2019]*${YR}`, // 1st March 2019
  `${MON_RE}[\\s,'\u2019]*${YR}`, // Jan 2018, Jan'18, Jan 18
  '\\d{1,2}[/.\\-]\\d{4}',
  '\\d{4}[/.\\-]\\d{1,2}(?!\\d)',
  '\\d{4}',
].join('|')})`;
const NOW_WORDS = 'present|current(?:ly)?|date|now|today|ongoing';
const RANGE_RE = new RegExp(`(?:from\\s+)?(${DATE_TOKEN})\\s*(?:-|\u2013|\u2014|to|until|till|through|thru)\\s*(?:(?:to|till|until)\\s+)?(${DATE_TOKEN}|${NOW_WORDS})`, 'i');
const MONTH_RANGE_RE = new RegExp(`(${MON_RE})\\s*(?:-|\u2013|\u2014|to)\\s*(${MON_RE})[\\s,'\u2019]*(\\d{4})`, 'i');
const SINCE_RE = new RegExp(`(?:since|from)\\s+(${DATE_TOKEN})(?!\\s*(?:-|\u2013|\u2014|to|until|till))`, 'i');
const OPEN_AFTER_RE = new RegExp(`(${DATE_TOKEN})\\s*[(\\[,]?\\s*(?:current(?:ly)?|present|ongoing|to date|till date)\\b\\)?`, 'i');

const LANGS: Record<string, string> = {
  english: 'English', afrikaans: 'Afrikaans', isizulu: 'isiZulu', zulu: 'isiZulu', isixhosa: 'isiXhosa', xhosa: 'isiXhosa',
  sesotho: 'Sesotho', 'southern sotho': 'Sesotho', sotho: 'Sesotho', setswana: 'Setswana', tswana: 'Setswana',
  sepedi: 'Sepedi', 'northern sotho': 'Sepedi', pedi: 'Sepedi', xitsonga: 'Xitsonga', tsonga: 'Xitsonga',
  siswati: 'siSwati', swati: 'siSwati', tshivenda: 'Tshivenda', venda: 'Tshivenda', isindebele: 'isiNdebele', ndebele: 'isiNdebele',
};

const HEAD: Record<string, RegExp> = {
  education: /^(?:education(?:al)?(?:\s+(?:and|&)\s+training|\s+background|\s+qualifications?|\s+history)?|(?:academic\s+|professional\s+)?qualifications?(?:\s+(?:and|&)\s+training)?|academic(?:\s+(?:qualifications?|background|record|history))?|training\s+(?:and|&)\s+education|tertiary\s+education|studies)\b/i,
  experience: /^(?:(?:work|employment|professional|career|relevant)\s+)?(?:experience|history)\b|^employment\b|^work\s+history\b|^career\s+history\b/i,
  languages: /^(?:(?:spoken|written|home|first|other|official|known)\s+)?(?:languages?(?:\s+(?:known|spoken|proficiency|skills?|competenc\w+|ability|abilities))?|language\s+skills?|mother\s+tongue)\b/i,
  references: /^(?:(?:professional|work|character|personal|contactable|employment|business|academic)\s+)?(?:references?|referees?)(?:\s+(?:and|&)\s+contact\s+(?:details|information))?(?:\s+(?:details|information|contacts?|list))?\b/i,
  skills: /^(?:key\s+|core\s+|technical\s+|computer\s+)?(?:skills|competenc\w+)\b/i,
};
const OTHER_HEAD = /^(?:summary|profile|objective|career objective|personal\s+(?:details|information|particulars|profile)|interests?|hobbies|achievements?|awards?|courses|certifications?|projects?|declaration|additional information|contact(?:\s+details)?)\b/i;

export type Sections = Partial<Record<keyof typeof HEAD, string[]>>;

/** Strips bullets, numbering and trailing punctuation so "2. EDUCATION:" and "• Referees" match their heading. */
export function headingText(raw: string): string {
  return raw.trim().replace(/^[\s\u2022\u25cf\u25aa\u25a0\u2023\-–—*#>|]*(?:\d{1,2}[.)]\s+)?/, '').replace(/[:\-–—_.\s]+$/g, '').trim();
}

function sectionKey(head: string): keyof typeof HEAD | undefined {
  return (Object.keys(HEAD) as (keyof typeof HEAD)[]).find((k) => HEAD[k].test(head));
}

export function splitSections(lines: string[]): Sections {
  const out: Sections = {};
  let cur: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    // "Languages: English, Xhosa" on one line: the heading and its content share the line.
    const inline = line.match(/^(.{3,40}?)\s*[:–—-]\s*(\S.*)$/);
    if (inline) {
      const k = sectionKey(headingText(inline[1]));
      if (k && !/\d{4}/.test(inline[1])) {
        // Inside Education, "Qualification: BA ..." is a labelled entry, not a new heading: keep the whole line.
        if (k === 'education' && cur === 'education') {
          out[k]!.push(line);
          continue;
        }
        cur = k;
        out[k] = out[k] ?? [];
        out[k]!.push(inline[2]);
        continue;
      }
    }
    const head = headingText(line);
    if (head && head.length < 48 && !/\d{4}/.test(head)) {
      const key = sectionKey(head);
      if (key) {
        cur = key;
        out[key] = out[key] ?? [];
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

const fullYear = (yy: string) => {
  const n = Number(yy);
  return n <= (new Date().getFullYear() % 100) + 1 ? 2000 + n : 1900 + n;
};

function parseDateTok(tok: string): { mm: string; yy: string; idx: number } | null {
  let t = tok.trim().toLowerCase().replace(/[\u2019]/g, "'");
  let m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/); // 01/03/2018 (day first, as South Africans write it)
  if (m) return { mm: m[2].padStart(2, '0'), yy: m[3].slice(2), idx: Number(m[3]) * 12 + Number(m[2]) - 1 };
  t = t.replace(/^\d{1,2}(?:st|nd|rd|th)?\s+(?=[a-z])/, ''); // drop a leading day: "1st March 2019"
  m = t.match(new RegExp(`^(${MON_RE})[\\s,']*(\\d{4}|\\d{2})$`));
  if (m) {
    const mi = MON.indexOf(m[1].slice(0, 3));
    const year = m[2].length === 2 ? fullYear(m[2]) : Number(m[2]);
    return { mm: String(mi + 1).padStart(2, '0'), yy: String(year).slice(2), idx: year * 12 + mi };
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
  startIdx: number;
  endIdx: number;
  present: boolean;
  approx: boolean;
  fromTok: { mm: string; yy: string };
  toTok: { mm: string; yy: string; present: boolean };
}

const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtIdx = (idx: number, yearOnly: boolean) => (yearOnly ? String(Math.floor(idx / 12)) : `${MON_NAMES[idx % 12]} ${Math.floor(idx / 12)}`);

function parseRange(line: string): (Range & { match: string; period: string }) | null {
  let a: ReturnType<typeof parseDateTok> = null;
  let bTok: string | null = null;
  let bFixed: ReturnType<typeof parseDateTok> = null;
  let matched = '';
  let present = false;
  const m = line.match(RANGE_RE);
  const mr = !m ? line.match(MONTH_RANGE_RE) : null;
  const since = !m && !mr ? line.match(SINCE_RE) ?? line.match(OPEN_AFTER_RE) : null;
  if (m) {
    a = parseDateTok(m[1]);
    bTok = m[2];
    present = new RegExp(`^(?:${NOW_WORDS})$`, 'i').test(m[2].trim());
    matched = m[0];
  } else if (mr) {
    // "Jan-Dec 2020": both months share the year.
    a = parseDateTok(`${mr[1]} ${mr[3]}`);
    bFixed = parseDateTok(`${mr[2]} ${mr[3]}`);
    matched = mr[0];
  } else if (since) {
    // "Since March 2019" or "March 2019 (current)": still there today.
    a = parseDateTok(since[1]);
    present = true;
    matched = since[0];
  }
  if (!a) return null;
  const now = new Date();
  const b = present
    ? { mm: String(now.getMonth() + 1).padStart(2, '0'), yy: String(now.getFullYear()).slice(2), idx: monthIdx(now) }
    : bFixed ?? parseDateTok(bTok ?? '');
  if (!b) return null;
  if (b.idx < a.idx) return null;
  const fromYearOnly = a.mm === '';
  const toYearOnly = !present && b.mm === '';
  // Only years given: "2013 - 2016" is 3 years, not 4. A single year counts as about 6 months.
  let endIdx = present ? b.idx : toYearOnly ? b.idx + 11 : b.idx;
  if (fromYearOnly && toYearOnly) endIdx = a.idx + Math.max(Math.floor(b.idx / 12) - Math.floor(a.idx / 12), 0.5) * 12 - 1;
  const period = `${fmtIdx(a.idx, fromYearOnly)} \u2013 ${present ? 'Present' : fmtIdx(b.idx, toYearOnly)}`;
  return { startIdx: a.idx, endIdx, present, approx: fromYearOnly || toYearOnly, fromTok: a, toTok: { mm: b.mm, yy: b.yy, present }, match: matched, period };
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

const DUR_RE = /(?:(\d+(?:[.,]\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&|,)?\s*(\d{1,2})\s*(?:months?|mths?|mos?))?|(\d{1,3})\s*(?:months?|mths?|mos?))\b/i;

/** "2 years 3 months", "18 months", "3 yrs" in months, or null. */
export function durationMonths(line: string): number | null {
  const m = line.match(DUR_RE);
  if (!m) return null;
  if (m[3]) return Number(m[3]);
  return Math.round(Number(m[1].replace(',', '.')) * 12) + (m[2] ? Number(m[2]) : 0);
}

function parseWork(lines: string[]): { work: CvWork[]; experience: ExpEntry[]; undatedMonths: number; undatedJobs: number } {
  const work: (CvWork & { idx: number })[] = [];
  const experience: ExpEntry[] = [];
  let undatedMonths = 0;
  let undatedJobs = 0;
  const jobLike = (l?: string) => !!l && l.length < 120 && !isBullet(l) && (TITLE_WORDS.test(l) || ORG_WORDS.test(l));
  for (let i = 0; i < lines.length; i++) {
    const r = parseRange(lines[i]);
    if (!r) {
      // A job given only as a length of time, with no start and end dates.
      const line = lines[i].trim();
      const dm = durationMonths(line);
      const near = (i > 0 && !parseRange(lines[i - 1]) && jobLike(lines[i - 1])) || (i > 1 && !parseRange(lines[i - 2]) && jobLike(lines[i - 2]) && !jobLike(lines[i - 1]));
      if (dm && !isBullet(line) && line.length < 120 && !/\b(?:of|with)\s+experience\b|experience\s+of\b/i.test(line) && (jobLike(line) || (/^(?:duration|period|length)\s*[:\-]/i.test(line) && near))) {
        undatedMonths += dm;
        undatedJobs += 1;
      }
      continue;
    }
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
      idx: r.endIdx,
    });
    const label = `${post} ${employer}`;
    const volunteer = /volunteer|voluntary/i.test(label);
    const oneOff = !r.present && !r.approx && r.endIdx - r.startIdx + 1 <= 1; // a single month: an event, not a job
    experience.push({
      id: `x${experience.length}`,
      employer: employer.slice(0, 70),
      post: post.slice(0, 60),
      startIdx: r.startIdx,
      endIdx: r.endIdx,
      present: r.present,
      approx: r.approx,
      sector: PUBLIC_WORDS.test(label) ? 'public' : 'private',
      include: !volunteer && !oneOff,
      period: r.period,
      note: volunteer ? 'Volunteer work, not counted' : oneOff ? 'One month or less, not counted' : '',
    });
  }
  work.sort((a, b) => b.idx - a.idx);
  experience.sort((a, b) => b.endIdx - a.endIdx);
  return { work: work.map(({ idx: _i, ...w }) => w), experience, undatedMonths, undatedJobs };
}

const SCHOOL_RE = /\b(university|college|school|institute|tvet|academy|high|technikon|unisa|wits|nwu|tut|cput|uj|ukzn|ufs|up|uwc|uct|dut|vut|mut|cut|nmu|wsu|ufh|univen|unizulu|smu|spu|ump|rhodes|damelin|boston|milpark|regenesys|cti|lyceum|stellenbosch|polytechnic|varsity|fort hare|ekurhuleni|tshwane)\b/i;

const QUAL_LABEL = /^(?:qualification|degree|diploma|certificate|programme|program|course|field of study)\s*(?:name|obtained|title)?\s*[:\-]\s*(.+)$/i;
const SCHOOL_LABEL = /^(?:institution|institute|university|college|school|studied at|awarded by|provider)\s*(?:name)?\s*[:\-]\s*(.+)$/i;
const YEAR_LABEL = /^(?:year(?:\s+(?:completed|obtained|of completion|awarded|graduated))?|completed|graduated|date(?:\s+completed)?|completion(?:\s+date)?|period)\s*[:\-]\s*(.+)$/i;
const YEAR_RE = /\b(19[6-9]\d|20[0-3]\d)\b/g;
const DURATION_IN_TEXT = /\(?\b\d+(?:[.,]\d)?[\s-]*(?:years?|yrs?)\b(?:\s*(?:and|&)?\s*\d+\s*(?:months?|mths?))?\)?/gi;
const COMPLETION_WORDS = /\(?\b(?:completed|graduated|obtained|awarded|expected(?:\s+in)?|year\s+completed|date\s+completed)\b\s*[:\-]?\s*\)?/gi;

/** Trims separators from the ends of a piece, and a bracket only when it has no partner. */
function trimSeg(x: string): string {
  let t = x.replace(/^[\s,:;\-\u2013\u2014|]+|[\s,:;\-\u2013\u2014|]+$/g, '');
  if ((t.match(/\(/g) ?? []).length > (t.match(/\)/g) ?? []).length) t = t.replace(/\s*\(\s*$/, '').replace(/^\(\s*/, '');
  if ((t.match(/\)/g) ?? []).length > (t.match(/\(/g) ?? []).length) t = t.replace(/^\s*\)\s*/, '').replace(/\s*\)$/, '');
  return t.trim();
}

function tidyQual(raw: string): { text: string; school: string } {
  let text = raw.replace(YEAR_RE, ' ').replace(DURATION_IN_TEXT, ' ').replace(COMPLETION_WORDS, ' ').replace(/\(\s*[\u2013\u2014\-,]*\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  // Split into "name, school" pieces and take the school out by what it looks like.
  const segs = text.split(/\s[|\u2013\u2014-]\s|,\s+|\s\|\s?/).map(trimSeg).filter(Boolean);
  let school = '';
  if (segs.length > 1) {
    const at = segs.findIndex((x, i) => i > 0 && SCHOOL_RE.test(x) && !levelOf(x));
    if (at > 0) {
      school = segs[at];
      segs.splice(at, 1);
    }
  }
  text = segs.join(', ');
  return { text, school };
}

function parseQuals(allLines: string[]): CvQualification[] {
  const out: CvQualification[] = [];
  const lines: string[] = [];
  // Labelled blocks: "Qualification: BA ...", "Institution: ...", "Year Completed: 2022".
  let block: CvQualification | null = null;
  for (const raw of allLines) {
    const l = raw.trim();
    const q = l.match(QUAL_LABEL);
    if (q) {
      const t = tidyQual(q[1]);
      block = { text: t.text.slice(0, 90), school: t.school.slice(0, 70), level: levelOf(q[1]) || 5, year: (q[1].match(YEAR_RE) ?? []).pop() ?? '' };
      if (block.text.length >= 3) out.push(block);
      continue;
    }
    if (block) {
      const sc = l.match(SCHOOL_LABEL);
      const yr = l.match(YEAR_LABEL);
      if (sc) {
        block.school = tidyQual(sc[1]).text.slice(0, 70);
        continue;
      }
      if (yr) {
        block.year = (yr[1].match(YEAR_RE) ?? []).pop() ?? block.year;
        continue;
      }
      if (l) block = null;
    }
    lines.push(raw);
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || (isBullet(l) && l.length > 90)) continue;
    if (/\b(modules?|subjects?|courses? (?:include|covered))\b\s*:?/i.test(l)) continue; // lists of modules are not qualifications
    if (/^(?:duration|period|length)\s*[:\-]/i.test(l)) continue;
    const lvl = levelOf(l);
    if (!lvl && !/\b(diploma|degree|certificate|matric|grade 12|honou?rs|masters?|bachelor|pgce|std\s*10)\b/i.test(l)) continue;
    if (TITLE_WORDS.test(l) && !/diploma|degree|certificate|bachelor|honou?rs|master|pgce/i.test(l)) continue;
    const neighbours = [lines[i - 1], lines[i + 1], lines[i + 2]].filter(Boolean).map((x) => x.trim());
    const years = [l, ...neighbours.slice(0, 2)].join(' ').match(YEAR_RE);
    // Look forward first: the institution usually follows its qualification, and the line before is often the previous qualification's institution.
    const after = [lines[i + 1], lines[i + 2]].filter(Boolean).map((x) => x.trim());
    const prev = lines[i - 1]?.trim() ?? '';
    const prevIsQual = !prev || levelOf(prev) > 0 || SCHOOL_RE.test(prev) && /\b(19|20)\d{2}\b/.test(prev);
    const t = tidyQual(l);
    let school = t.school || (SCHOOL_RE.test(l) ? '' : after.find((n) => SCHOOL_RE.test(n) && n.length < 80 && !levelOf(n)) ?? (!prevIsQual && SCHOOL_RE.test(prev) ? prev : ''));
    school = school.replace(YEAR_RE, '').replace(/[,\-\u2013\s]+$/g, '').trim();
    const text = t.text;
    if (text.length < 4) continue;
    out.push({ text: text.slice(0, 90), school: school.slice(0, 70), level: lvl || 5, year: years ? years[years.length - 1] : '' });
  }
  const seen = new Set<string>();
  return out
    .filter((q) => (seen.has(q.text.toLowerCase()) ? false : (seen.add(q.text.toLowerCase()), true)))
    .sort((a, b) => b.level - a.level);
}

type Level = 'good' | 'fair' | 'poor';
const LEVEL_WORDS = /\b(excellent|fluent|very good|proficient|native|mother tongue|first language|home language|advanced|good|high|expert|average|fair|intermediate|moderate|basic|elementary|poor|limited|beginner|very basic|low)\b/gi;
const levelOfWord = (w: string): Level => {
  const x = w.toLowerCase();
  if (/poor|limited|beginner|very basic|low|elementary/.test(x)) return 'poor';
  if (/fair|average|intermediate|moderate|basic/.test(x)) return 'fair';
  return 'good';
};

/** "isi Xhosa", "isi-Xhosa", "IsiXhosa" and "Xhosa" all become one spelling. */
const flattenLang = (t: string) => t.toLowerCase().replace(/\b(isi|si|se|xi|tshi)[\s-]+(?=[a-z])/g, '$1').replace(/\bsouth(?:ern)?\s+sotho\b/g, 'sesotho').replace(/\bnorth(?:ern)?\s+sotho\b/g, 'sepedi');
const LANG_KEYS = Object.keys(LANGS).filter((k) => !k.includes(' '));
const LANG_RE = new RegExp(`\\b(?:${LANG_KEYS.join('|')})\\b`, 'g');
const langIn = (seg: string): string[] => [...new Set((flattenLang(seg).match(LANG_RE) ?? []).map((k) => LANGS[k]))];

/** A line that is only language names, levels and list glue, e.g. "English, Xhosa and Afrikaans". */
const onlyLanguages = (l: string) => {
  const rest = flattenLang(l).replace(LANG_RE, ' ').replace(LEVEL_WORDS, ' ').replace(/\b(and|or|read|write|written|speak|spoken|reading|writing|speaking|fluently|fluent|language|languages|first|second|third|home|other|mother|tongue)\b/g, ' ').replace(/[^a-z]/g, '');
  return langIn(l).length > 0 && rest.length === 0;
};

function parseLanguages(sectionLines: string[] | undefined, body: string[]): CvInfo['languages'] {
  // Without a "Languages" section, still pick up labelled lines ("Home language: Xhosa") and lines that list only languages.
  const labelled = body.filter((l) => l.length < 160 && /\b(?:languages?|mother tongue|home language)\b/i.test(l) && langIn(l).length > 0);
  const bare = body.filter((l) => l.length < 100 && onlyLanguages(l));
  const lines = (sectionLines && sectionLines.some((l) => langIn(l).length) ? sectionLines : [...labelled, ...bare]).slice(0, 40);

  // "Language  Speak  Read  Write" followed by rows of levels: keep the columns apart.
  const header = lines.find((l) => /\bspeak\w*\b/i.test(l) && /\b(?:write|writ\w+|read\w*)\b/i.test(l) && langIn(l).length === 0);
  const cols: string[] = header ? [...header.toLowerCase().matchAll(/speak\w*|read\w*|writ\w*/g)].map((m) => (m[0].startsWith('s') ? 'speak' : m[0].startsWith('r') ? 'read' : 'write')) : [];

  const found = new Map<string, { speak: Level; write: Level }>();
  for (const l of lines) {
    if (l === header) continue;
    const segs = l.split(/[,;|\u2022]|\s\/\s|\sand\s|\s&\s/i).map((x) => x.trim()).filter(Boolean);
    // keep a level that trails a list: "English, Zulu - Fluent"
    const trailing = l.match(LEVEL_WORDS)?.slice(-1)[0];
    for (const seg of segs) {
      const langs = langIn(seg);
      if (!langs.length) continue;
      const words = [...seg.matchAll(LEVEL_WORDS)].map((m) => levelOfWord(m[0]));
      let speak: Level = 'good';
      let write: Level = 'good';
      if (cols.length && words.length >= cols.length) {
        const at = (c: string) => cols.indexOf(c);
        speak = words[at('speak') >= 0 ? at('speak') : 0];
        write = words[at('write') >= 0 ? at('write') : at('read') >= 0 ? at('read') : words.length - 1];
      } else if (words.length) {
        speak = words[0];
        write = words[words.length - 1];
      } else if (trailing && langs.length > 1) {
        speak = write = levelOfWord(trailing);
      }
      for (const lang of langs) if (!found.has(lang)) found.set(lang, { speak, write });
    }
  }
  return [...found].map(([language, v]) => ({ language, speak: v.speak, write: v.write }));
}

const PHONE_RE = /(?<!\d)(?:\+27|0027|0)[\s().-]?\d{2}[\s().-]?\d{3}[\s.-]?\d{4}(?!\d)/;

const NAME_PART = "(?:[A-Z][A-Za-z'’-]*\\.?|(?:van|der|de|den|du|le|la|von|bin|ben)\\b)";
const TITLED = new RegExp(`^(?:name\\s*[:\\-]\\s*)?((?:Mr|Mrs|Ms|Miss|Dr|Prof|Adv|Pastor|Rev|Hon)\\.?\\s+(?:${NAME_PART}\\s*){1,5})$`);
const PLAIN = new RegExp(`^(?:name\\s*[:\\-]\\s*)?((?:${NAME_PART}\\s+){1,4}${NAME_PART})$`);
const CONTACT_LINE = /^(?:tel(?:ephone)?|cell(?:phone)?|mobile|phone|e-?mail|work|office|fax|contact)\b/i;

const JOB_WORDS = /\b(manager|director|officer|supervisor|head|chief|lecturer|principal|coordinator|hod|executive|administrator|deputy|assistant|clerk|specialist|consultant|lead|professor|teacher|pastor|owner|ceo|cfo|hr)\b/i;
const SEP = /\s*[|\u2013\u2014]\s*|\s-\s|\s*\t+\s*|\s{3,}/;
const LABEL_NAME = /^(?:referee|reference)?\s*(?:full\s+)?name\s*[:\-]\s*(.+)$/i;
const LABEL_REL = /^(?:position|designation|title|job\s*title|relationship|role|occupation|company|organi[sz]ation|employer|department|capacity)\s*[:\-]\s*(.+)$/i;
const LABEL_TEL = /^(?:tel(?:ephone)?|cell(?:phone)?|mobile|phone|contact(?:\s*(?:no|number|details?))?|work|office)\s*(?:no\.?|number)?\s*[:\-]?\s*(.+)$/i;

function parseRefs(lines: string[]): CvInfo['references'] {
  const cleaned = lines
    .map((l) => l.trim().replace(/^[\u2022\u25cf\u25aa*>\-–\s]+/, '').replace(/^(?:(?:referee|reference)\s*)?\d{1,2}\s*[.):\-]\s*/i, '').replace(/^(?:referee|reference)\s*\d{1,2}\s*:?\s*/i, '').trim())
    .filter((l) => l && !/available (?:up)?on request|on request|^(?:name|referee|reference)s?\s*(?:\||\t|\s{2,}).*(?:position|contact|tel|designation|relationship)/i.test(l))
    .filter((l) => !/^(?:referee|reference)s?\s*:?$/i.test(l));
  const nameOf = (t: string) => (t.match(TITLED) ?? t.match(PLAIN))?.[1]?.trim();
  type G = { name: string; rel: string; tel: string; lines: string[] };
  const groups: G[] = [];
  const cur = () => groups[groups.length - 1];
  const telOf = (t: string) => t.match(PHONE_RE)?.[0]?.trim() ?? '';
  const complete = (g?: G) => !!g && (!!g.tel || g.lines.length >= 2);

  for (const l of cleaned) {
    const lab = l.match(LABEL_NAME);
    if (lab) {
      groups.push({ name: lab[1].trim(), rel: '', tel: '', lines: [] });
      continue;
    }
    // One line per referee: "Mr A Dlamini – Director – 012 345 6789"
    const parts = l.split(SEP).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2 && telOf(l) && nameOf(parts[0]) && !/\d/.test(parts[0])) {
      groups.push({ name: nameOf(parts[0])!, rel: parts.slice(1).find((x) => !PHONE_RE.test(x) && !/@/.test(x)) ?? '', tel: telOf(l), lines: [l] });
      continue;
    }
    // Name with the phone number on the same line: "Dr Sipho Dlamini 012 555 0000"
    const tel = telOf(l);
    const noTel = tel ? l.replace(tel, '').replace(/[()|,\-–:\s]+$/g, '').trim() : l;
    const named = nameOf(noTel);
    const titledName = TITLED.test(noTel);
    const startsNew = !/@/.test(noTel) && !!named && !ORG_WORDS.test(noTel) && (titledName || (!JOB_WORDS.test(noTel) && (groups.length === 0 || complete(cur()))));
    if (startsNew && (!/\d/.test(noTel))) {
      groups.push({ name: named!, rel: '', tel, lines: [] });
      continue;
    }
    const g = cur();
    if (!g) continue;
    const rl = l.match(LABEL_REL);
    const tl = l.match(LABEL_TEL);
    if (tl && PHONE_RE.test(tl[1])) g.tel = g.tel || telOf(tl[1]);
    else if (rl) g.rel = g.rel || rl[1].trim();
    else if (tel) g.tel = g.tel || tel;
    else if (!/@/.test(l) && !CONTACT_LINE.test(l) && l.length < 110) {
      if (!g.rel) g.rel = l;
      g.lines.push(l);
    }
  }
  return groups
    .filter((g) => g.name)
    .map((g) => ({ name: g.name.slice(0, 60), relationship: g.rel.replace(/\s+/g, ' ').trim().slice(0, 80), tel: g.tel }))
    .slice(0, 3);
}

export function parseCv(rawText: string): CvInfo {
  const full = rawText.replace(/\r/g, '').replace(/[\u00a0\u2009]/g, ' ');
  const allLines = full.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const sec = splitSections(allLines);
  // Everything before the references heading is "the CV body". Referee titles, emails and
  // phone numbers must never be mistaken for the applicant's own.
  const refAt = allLines.findIndex((l, i) => i > 5 && l.length < 60 && HEAD.references.test(headingText(l)) && !/[,@]/.test(l));
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
  const { work, experience, undatedMonths, undatedJobs } = parseWork(expLines);
  const totals = experience.length ? experienceTotals(experience) : null;
  const total = totals ? totals.totalMonths / 12 : null;
  const stated = text.match(/(\d{1,2})\+?\s*years?(?:['’]s)?\s*(?:of\s+)?(?:relevant\s+|working\s+|professional\s+)?experience/i);
  const totalYears = total ?? (undatedMonths > 0 ? undatedMonths / 12 : stated ? Number(stated[1]) : null);

  const qualifications = parseQuals(sec.education ?? lines);
  const languages = parseLanguages(sec.languages, lines);
  const refLines = sec.references ?? [];
  const references = parseRefs(refLines);
  const hasReferences = references.length > 0;

  const reg = text.match(/\b(ECSA|HPCSA|SAICA|SAIPA|SACE|SACSSP|SANC|SAPC|SACPCMP|PSIRA|CIMA|LPC|SAIT|SAQA)\b[^\n]{0,30}?(\d{4,})/i);
  const notice = text.match(/notice period\s*[:\-]\s*([^\n]{1,30})/i)?.[1]?.trim() ?? (/available immediately|immediately available/i.test(text) ? 'Immediately' : '');

  if (!idCand) gaps.push('We could not find your ID number in the CV.');
  if (!email) gaps.push('We could not find your own email address on the CV. Add it near your name, so the Department can reach you.');
  if (!languages.length) gaps.push('We could not find a languages section on your CV. The Z83 asks how well you speak, read and write official languages.');
  if (!qualifications.length) gaps.push('We could not find your qualifications. Check your CV has an "Education" or "Qualifications" heading.');
  if (undatedJobs > 0) gaps.push(`We found ${undatedJobs === 1 ? 'a job' : `${undatedJobs} jobs`} written as a length of time only (like "2 years"). The Z83 needs start and end dates, so please add start and end dates (for example "Mar 2018 - Dec 2020") on your CV, or type them in below.`);
  else if (!work.length) gaps.push('We could not find dated work experience (for example "Jan 2018 - Present").');
  if (!hasReferences) {
    const onRequest = /references?\b[^\n]{0,40}\bon request|referees?\b[^\n]{0,40}\bon request/i.test(full);
    gaps.push(onRequest
      ? 'Your CV says references are available on request. Please add up to 3 referees below (name, relationship, phone number). You can still create your application pack now.'
      : 'We could not find referee details on your CV. Please add up to 3 referees below (name, relationship, phone number). You can still create your application pack now.');
  }

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
    experience,
    languages,
    references,
    hasReferences,
    totalYears: totalYears !== null ? Math.round(totalYears * 10) / 10 : null,
    publicYears: totals ? toYears(totals.publicMonths) : null,
    driversLicence: /driver[’']?s?[’']?\s*licen[cs]e|licen[cs]e\s*:?\s*code|\bcode\s*(?:08|10|14|b|eb|c1)\b/i.test(text),
    gaps,
  };
}
