import type { CircularInfo, Post, Req } from './types';
import { levelOf, titleCase } from './text';

const MONTHS = 'january february march april may june july august september october november december'.split(' ');
const MONTH_RE = '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)';
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const TITLE_STOP = new Set(
  'OTHER POSTS POST ADVERTISEMENTS ADVERTISEMENT CIRCULAR ANNEXURE NOTE DUTIES ENQUIRIES APPLICATIONS SALARY CENTRE REQUIREMENTS NO REF DEPARTMENT VACANCIES VACANCY'.split(' '),
);

export function normalizeText(t: string): string {
  return t.replace(/[  ​]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface FoundDate {
  index: number;
  date: Date;
  hasTime: boolean;
  keyword: boolean;
}

function monthIndex(m: string): number {
  const k = m.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((x) => x.startsWith(k));
}

export function findDates(text: string): FoundDate[] {
  const re = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?,?\\s+(\\d{4})(?:\\s*(?:at|@|,|-)?\\s*(\\d{1,2})\\s*[:h.]\\s*(\\d{2}))?`, 'gi');
  const out: FoundDate[] = [];
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    const hasTime = m[4] !== undefined;
    const date = new Date(Number(m[3]), monthIndex(m[2]), Number(m[1]), hasTime ? Number(m[4]) : 23, hasTime ? Number(m[5]) : 59, 59);
    const before = text.slice(Math.max(0, idx - 45), idx);
    out.push({ index: idx, date, hasTime, keyword: /clos|deadline|apply\s*(?:by|before)|no later than|until/i.test(before) });
  }
  return out;
}

function readRef(after: string): string | null {
  const tok = '[A-Za-z0-9][A-Za-z0-9/\\\\\\-._]*';
  const m = after.replace(/^[\s(]+/, '').replace(/([/\-])\s+(?=[A-Za-z0-9])/g, '$1').match(new RegExp(`^(${tok})(?:\\s+(${tok}))?`));
  if (!m) return null;
  const [, a, b] = m;
  let ref: string | null = null;
  if (/\d/.test(a)) ref = a;
  else if (b && /\d/.test(b) && /^[A-Z]{2,6}$/.test(a)) ref = `${a} ${b}`;
  if (!ref) return null;
  if (b && /^20\d{2}$/.test(b) && !/20\d{2}$/.test(ref)) ref += ' ' + b;
  return ref.replace(/[.,;:]+$/, '');
}

/** For references without digits, e.g. "REF NO: CAC", "REF NO: D – BIEA&E" or one wrapped over two lines. */
function readRefLoose(after: string): string | null {
  const cut = after.search(/\b(?:SALARY|CENTRE|Directorate|Branch|REQUIREMENTS?|ENQUIRIES|APPLICATIONS?|DUTIES|POST\s+\d|REF\b|Business\s+Unit|Chief\s+Directorate)|\(?\s*X\s*\d+\s*POSTS?|\bR\s?\d{1,3}\s\d{3}/i);
  const s = (cut >= 0 ? after.slice(0, cut) : after.slice(0, 40))
    .replace(/^[\s(:]+/, '')
    .replace(/([-/])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:(]+$/, '')
    .trim();
  if (s.length < 2 || s.length > 45 || s.split(' ').length > 6 || !/[A-Za-z0-9]/.test(s)) return null;
  return s;
}

function readTitle(before: string, absStart: number): { title: string; start: number } {
  const words = [...before.matchAll(/\S+/g)].map((m) => ({ w: m[0], i: m.index ?? 0 }));
  let k = words.length;
  while (k > 0 && !/[a-z]/.test(words[k - 1].w) && /[A-Za-z0-9]/.test(words[k - 1].w.replace(/^[:\-–]+|[:\-–]+$/g, '') || ':')) k--;
  let run = words.slice(k);
  const hadCapitals = run.length > 0;
  // Cut everything up to the last heading word (e.g. "OTHER POSTS", "POST 36/02") or reference/date.
  let cut = -1;
  run.forEach((x, i) => {
    const bare = x.w.replace(/[^A-Za-z0-9/\\-]/g, '');
    if (TITLE_STOP.has(bare) || /^\d+\/\d+$/.test(bare) || /^[:\-–]+$/.test(x.w) || (/\d/.test(bare) && /[/\\-]/.test(bare))) cut = i;
  });
  run = run.slice(cut + 1);
  // A stray number (e.g. the year of a closing date) never starts a title.
  while (run.length && !/[A-Za-z]/.test(run[0].w)) run.shift();
  if (run.length === 0 && !hadCapitals) {
    // Title is not in capitals: fall back to the last few words after the last sentence end.
    const tail = words.slice(-8);
    let s = 0;
    tail.forEach((x, i) => {
      if (/[.:;]$/.test(x.w)) s = i + 1;
    });
    run = tail.slice(s);
  }
  if (run.length === 0) return { title: '', start: absStart + before.length };
  const title = run.map((x) => x.w).join(' ').replace(/^[:\-–\s]+|[:\-–\s]+$/g, '');
  return { title: titleCase(title), start: absStart + run[0].i };
}

function words(n: string): number {
  return NUM_WORDS[n.toLowerCase()] ?? Number(n);
}

const QUAL_WORD = '(?:national|grade|diploma|degree|b[. ]?tech|bachelor|honou?rs|master|certificate|advanced|postgraduate|nqf|matric|n[4-6])';

function parseQualParts(sentence: string): Req[] {
  // "Grade 12 is required coupled with a minimum National Diploma ..." is two requirements.
  const parts = sentence.split(new RegExp(`\\s+(?:and|coupled with|together with|plus|as well as)\\s+(?:a\\s+|an\\s+|minimum\\s+|a minimum\\s+)*(?=${QUAL_WORD})`, 'i'));
  const out: Req[] = [];
  for (const part of parts) {
    const nqfs = [...part.matchAll(/nqf\s*(?:level)?\s*(\d{1,2})/gi)].map((m) => Number(m[1]));
    const lvl = nqfs.length ? Math.min(...nqfs) : levelOf(part);
    if (!lvl && !/qualification/i.test(part)) continue;
    let lead = part
      .replace(/^.*?(?:in possession of|must have|must be in possession of)\s+/i, '')
      .replace(/^(?:an?\s+)?(?:minimum\s+(?:of\s+)?)?(?:an?\s+)?/i, '')
      .trim();
    const m = lead.match(/\b(?:in|of)\s+([^()]+?)(?:\(|\bnqf\b|$|\.|,\s*(?:with|and))/i);
    let fields: string[] = [];
    if (m) {
      fields = m[1]
        .split(/\s*[/&]\s*|\s+or\s+|,\s*/i)
        .map((f) => f.replace(/\b(?:a|an|the|relevant|related|equivalent|as recognised by saqa)\b/gi, '').replace(/\s+/g, ' ').trim())
        .filter((f) => f.length > 2 && !/^(possession|nqf|which|that)/i.test(f));
    }
    lead = lead.replace(/\s+is\s+required.*$/i, '').replace(/\s+/g, ' ').replace(/[.;,]+$/, '').trim();
    out.push({ id: '', kind: 'qualification', text: lead, nqf: lvl || undefined, fields: fields.length ? fields : undefined });
  }
  return out;
}

const SENIORITY_RE = /\b(?:at|as|in|of)\s+(?:an?\s+|the\s+)?((?:assistant|deputy|chief)\s+director|director|senior\s+manager|manager|supervisor\w*|middle\s+management|senior\s+management|MMS|SMS)\b|\b(supervisory|managerial)\b/i;
const GENERIC = /\b(?:environment|environments|field|fields|sector|area|areas|similar|related|relevant|equivalent|work|role|roles|position|positions|level)\b/gi;

/** Pull the kind(s) of work out of an experience requirement, e.g. "financial markets, fixed income trading". */
function experienceDomain(s: string): { topic: string; domain: string[] } {
  const obtained = s.match(/\bobtained\s+(?:in|within|from)\s+(.*)$/i);
  const general = s.match(/experience\s*(?:\w+\s+){0,2}?(?:in|within|of|as|at|with)\s+(?!which\b)(.*)$/i);
  const raw = (obtained?.[1] ?? general?.[1] ?? '').replace(/[.;]+$/, '').trim();
  const alts = raw
    .split(/\s*(?:,|;|\/|\bor\b|\bwith\b|\bwithin\b)\s*/i)
    .map((a) => a.replace(GENERIC, ' ').replace(/^(?:an?|the)\s+/i, '').replace(/\s+/g, ' ').trim())
    .filter((a) => a.length > 2);
  return { topic: raw, domain: alts };
}

export function parseRequirements(reqText: string): Req[] {
  const reqs: Req[] = [];
  const split = reqText.split(/Job[\s-]*related\s+(?:knowledge|skills?|competenc\w+)\s*:?/i);
  const core = split[0];
  const rest = reqText.slice(core.length);
  const sentences = core.split(/(?<=[.;])(?<![\s/(,][A-Za-z]\.)\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const y = s.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\(\d+\))?\s*(?:\+\s*)?years?\b/i);
    if (y && /experience|exposure|supervis|managerial|working/i.test(s)) {
      const { topic, domain } = experienceDomain(s);
      const sen = s.match(SENIORITY_RE);
      reqs.push({
        id: '',
        kind: 'experience',
        text: s.replace(/[.;]+$/, ''),
        years: words(y[1]),
        topic,
        domain: domain.length ? domain : undefined,
        seniority: sen ? (sen[1] ?? sen[2]).toLowerCase().replace(/\s+/g, ' ') : undefined,
      });
      continue;
    }
    if (/driver[’']?s?[’']?\s*licen[cs]e/i.test(s)) {
      reqs.push({ id: '', kind: 'licence', text: "Valid driver's licence" });
      continue;
    }
    if (levelOf(s) || /qualification|in possession/i.test(s)) reqs.push(...parseQualParts(s));
  }
  // Knowledge / skills lists: short items only; stop at the first duty-like sentence.
  const lists = rest.split(/(Job[\s-]*related\s+(?:knowledge|skills?|competenc\w+)\s*:?)/i);
  let kind: 'knowledge' | 'skill' = 'knowledge';
  for (const chunk of lists) {
    if (/job[\s-]*related\s+skills?/i.test(chunk)) kind = 'skill';
    else if (/job[\s-]*related\s+(?:knowledge|competenc)/i.test(chunk)) kind = 'knowledge';
    else {
      const protectedChunk = chunk.replace(/\(([^)]*)\)/g, (m) => m.replace(/,/g, '\u0001'));
      const items = protectedChunk.split(/[.;,]\s*/).map((x) => x.replace(/\u0001/g, ',').trim()).filter(Boolean);
      for (const it of items) {
        if (it.split(' ').length > 7) break;
        if (/driver[’']?s?[’']?\s*licen[cs]e/i.test(it)) {
          if (!reqs.some((r) => r.kind === 'licence')) reqs.push({ id: '', kind: 'licence', text: "Valid driver's licence" });
          continue;
        }
        reqs.push({ id: '', kind, text: it });
      }
    }
  }
  const seen = new Set<string>();
  return reqs
    .filter((r) => {
      const k = r.kind + r.text.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r, i) => ({ ...r, id: `r${i}` }));
}

/** Split flattened circular text into readable paragraphs (without breaking after initials like "B. Tech"). */
export function toParagraphs(text: string): string[] {
  return text
    .replace(/\s+(?=Job[\s-]*related\s+(?:knowledge|skills?|competenc\w+)\s*:)/gi, '\n')
    .split(/\n|(?<=[.;])(?<![\s/(,][A-Za-z]\.)\s+(?=[A-Z(])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function requirementsSection(seg: string): string {
  const m = seg.match(/Applicants?\s+must|Candidates?\s+must|Minimum\s+requirements?\s*:?|\bRequirements?\s*:|Applicants?\s+should/i);
  if (!m || m.index === undefined) return '';
  const isLabel = /^(?:minimum\s+)?requirements?\s*:?$/i.test(m[0].trim());
  const after = seg.slice(m.index + (isLabel ? m[0].length : 0)).trim();
  const end = after.search(/\bDUTIES\b|\bDuties\s*:|Key\s+(?:performance|responsibilit)|\bENQUIRIES\b|\bEnquiries\s*:/);
  return end > 0 ? after.slice(0, end) : after;
}

interface Head {
  pos: number;
  end: number;
  name: string;
}

interface Mark {
  pos: number;
  name: string;
}

const HEAD_START = /^(?:the\s+)?(?:department|ministry)\s+of\b|^office\s+of\s+the\b|^(?:the\s+)?presidency\b|^national\s+treasury\b|^provincial\s+treasury\b|^public\s+service\s+commission\b|^statistics\s+south\s+africa\b|^south\s+african\s+(?:police|revenue|social|national|qualifications)\b/i;
const NOT_HEAD = /\b(?:is|are|will|invites?|has|have|must|should|please|following|applications?|vacanc\w*|requirements?|duties|enquiries|closing|salary|centre|ref|no)\b|[0-9.:;]/i;
// Words that make a line a sentence about the posts rather than the name of a department.
const SENTENCE_WORDS = /\b(?:reserves?|reserved|right|fill|filling|below|above|mentioned|kindly|note|notice|posts?|advertis\w*|candidates?|applicants?|employer|equity|dispute|complaints?|read|submit\w*|attach\w*|certified|copies)\b/i;
const ADDRESS_START = /[,;:\-–\s]*(?:private\s*bag|privatebag|p\.?\s?o\.?\s*box|postnet|physical\s+address|postal\s+address|tel\b|fax\b|e-?mail|www\.|http).*$/i;
const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'to', 'on', '&', 'with', 'at']);

const PROVINCES: Record<string, string> = {
  easterncape: 'Eastern Cape',
  freestate: 'Free State',
  gauteng: 'Gauteng',
  kwazulunatal: 'KwaZulu-Natal',
  limpopo: 'Limpopo',
  mpumalanga: 'Mpumalanga',
  northerncape: 'Northern Cape',
  northwest: 'North West',
  westerncape: 'Western Cape',
};

/** "PROVINCIAL ADMINISTRATION: EASTERN CAPE" on a line of its own starts that province's section. */
export function provinceOfLine(line: string): string {
  const m = line.trim().match(/^PROVINCIAL\s+ADMINISTRATION\s*:\s*([A-Za-z][A-Za-z \-]+)$/i);
  return m ? PROVINCES[m[1].toLowerCase().replace(/[^a-z]/g, '')] ?? '' : '';
}

/** "Department of Public Works & Infrastructure, Private BAG X Bloemfontein," -> "Department of Public Works and Infrastructure". */
export function cleanDeptName(raw: string): string {
  const n = raw
    .replace(/\s+/g, ' ')
    .replace(ADDRESS_START, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\(\s*[A-Za-z]{2,8}\s*\)\s*$/, '')
    .replace(/[,;:\-–\s]+$/g, '')
    .replace(/^[,;:\-–\s]+/g, '')
    .trim();
  return titleCase(n);
}

/** Key for treating spelling variants of the same department as one. */
export function deptKey(name: string): string {
  return cleanDeptName(name).toLowerCase().replace(/\band\b/g, '').replace(/[^a-z0-9]/g, '');
}

export function isDeptHeading(line: string): boolean {
  const l = line.trim();
  if (l.length < 8 || l.length > 95 || !HEAD_START.test(l)) return false;
  const upper = !/[a-z]/.test(l);
  const cleaned = l.replace(ADDRESS_START, '').trim();
  if (!upper && (NOT_HEAD.test(cleaned) || SENTENCE_WORDS.test(cleaned))) return false;
  const words = cleaned.split(/\s+/);
  // Mixed-case headings are written in title case. A lower-case word such as "external" means the line is a sentence.
  if (!upper && words.some((w) => /^[a-z]/.test(w) && !SMALL_WORDS.has(w.toLowerCase()))) return false;
  // Only "Department/Ministry of ..." may be long in mixed case; other names ("National Treasury") must be short.
  if (!upper && !/^(?:the\s+)?(?:department|ministry)\s+of\b/i.test(cleaned) && words.length > 5) return false;
  if (words.length > 14) return false;
  // Upper-case headings may still be a job title like "DEPARTMENT OF ... MANAGER"; reject those with a duty keyword.
  return !/\b(?:ref|no|post|salary|centre)\b[\s:.]*\d?/i.test(l);
}

/** Collapse the text to one line, remembering where headings, provinces and annexures start. */
function flatten(raw: string): { text: string; heads: Head[]; provinces: Mark[]; bodyStart: number; lineStarts: number[]; lineTexts: string[] } {
  const lines = raw.split(/\r?\n/).map(normalizeText).filter(Boolean);
  const heads: Head[] = [];
  const provinces: Mark[] = [];
  const lineStarts: number[] = [];
  const lineTexts: string[] = [];
  let bodyStart = -1;
  let flat = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let name = '';
    const province = provinceOfLine(line);
    if (!province && isDeptHeading(line)) {
      name = line;
      // A long heading may wrap onto the next line ("... LAND REFORM AND" / "RURAL DEVELOPMENT").
      while (/(?:\band|\bof|&|,)$/i.test(name) && i + 1 < lines.length && !/[a-z]/.test(lines[i + 1]) && name.length < 90) {
        name += ' ' + lines[++i];
      }
      line = name;
    }
    const pos = flat ? flat.length + 1 : 0;
    lineStarts.push(pos);
    lineTexts.push(line);
    flat += (flat ? ' ' : '') + line;
    if (name) heads.push({ pos, end: pos + line.length, name: line });
    if (province) provinces.push({ pos, name: province });
    // Everything before "ANNEXURE A" is the circular's front matter (notices, amendments, index), not posts.
    if (bodyStart < 0 && /^ANNEXURE\s+A$/i.test(line)) bodyStart = pos;
  }
  return { text: flat, heads, provinces, bodyStart: Math.max(bodyStart, 0), lineStarts, lineTexts };
}

const ONLINE_RE = /\b(?:apply|applying|applications?|submit(?:ted)?|submission)\b[^.]{0,80}\b(?:online|on-line|e-?recruitment|recruitment portal|career(?:s)? portal)\b|\bonline\s+(?:application|system|portal|platform|recruitment)|\bonly\b[^.]{0,25}\bonline\b|\be-?recruitment\b|\bapply\s+online\b/i;
// Wording that rules email out, e.g. "Do not send any applications to this email address" or "e-mailed applications will not be accepted".
const NO_EMAIL_RE = /do\s+not\s+send[^.]{0,60}applications?[^.]{0,60}e-?mail|e-?mail(?:ed)?\s*(?:,|and|or)?[^.]{0,120}(?:will\s+not|shall\s+not|not\s+be)\s+(?:be\s+)?(?:accepted|considered)|no\s+e-?mail\s+applications?|not\s+accept\s+(?:any\s+)?e-?mail/i;
const EMAIL_RE = /[A-Za-z0-9._%+/-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const LOOKS_LIKE_REF = (w: string) => /\d/.test(w) && /[A-Za-z0-9][/\\-][A-Za-z0-9]/.test(w) && !/^\d{4}[/-]\d{2,4}$/.test(w) && !/^\d{1,2}[-–/]\d{1,2}(?:TH)?$/i.test(w);

/** A title must not be (or contain) a reference number or a date. */
function validTitle(t: string): boolean {
  if (!t || t.length < 3) return false;
  if (!/[A-Za-z]{3}/.test(t)) return false;
  return !t.split(/\s+/).some(LOOKS_LIKE_REF);
}

/** Fallbacks when the words before "REF NO" are not a job title (e.g. only the previous post's reference). */
function recoverTitle(rest: string): string {
  const label = rest.match(/\b(?:POST|POSITION|JOB\s*TITLE)\s*:\s*(.{3,120}?)(?=\s+(?:REF\b|SALARY|CENTRE|DIRECTORATE|REQUIREMENTS|R\s?\d{3})|$)/i);
  if (label && validTitle(label[1].trim())) return titleCase(label[1].trim().replace(/[:\s]+$/, ''));
  // A run of capital letters straight after the reference number.
  const words = rest.split(/\s+/);
  const run: string[] = [];
  for (const w of words.slice(0, 18)) {
    if (/[a-z]/.test(w) || LOOKS_LIKE_REF(w) || TITLE_STOP.has(w.replace(/[^A-Za-z]/g, ''))) break;
    if (/^R\d/.test(w)) break;
    run.push(w);
  }
  const t = run.join(' ').replace(/[:\-–\s]+$/, '');
  return validTitle(t) ? titleCase(t) : '';
}

const NOT_A_TITLE = /^(?:applications?|enquiries|closing|note|salary|requirements?|duties|directorate|centre|location|please|the department|ref\b)/i;

function stripHeadingWords(l: string): string {
  const w = l.split(/\s+/);
  while (w.length && (TITLE_STOP.has(w[0].replace(/[^A-Za-z]/g, '')) || /^\d+\/\d+$/.test(w[0]))) w.shift();
  return w.join(' ');
}

function cleanTitleLine(l: string): string {
  return stripHeadingWords(l)
    .replace(/^(?:POST|POSITION)\s*(?:[A-Z]{1,8}\s*)?\d[\d/\\\-. ]*\s*[:\-–]?\s*/i, '')
    .replace(/^(?:POST|POSITION|JOB\s*TITLE)\s*:\s*/i, '')
    .replace(/\s*(?:REF(?:ERENCE)?\.?\s*(?:NO|NUMBER)?\.?\s*:?)\s*$/i, '')
    .replace(/^[:\-–\s]+|[:\-–\s]+$/g, '')
    .trim();
}

function plausibleTitle(t: string): boolean {
  return validTitle(t) && t.length <= 160 && t.split(/\s+/).length <= 20 && !/@/.test(t) && !NOT_A_TITLE.test(t) && !isDeptHeading(t);
}

/** Why a position name should be double-checked by the applicant (empty when it looks fine). */
export function titleProblem(title: string, ref: string): string {
  if (!title.trim()) return 'We could not find the position name.';
  if (ref && title.trim().toLowerCase() === `post ${ref}`.toLowerCase()) return 'We could not find the position name.';
  if (title.split(/\s+/).some(LOOKS_LIKE_REF)) return 'The position name looks like a reference number or a date.';
  if (title.length > 120) return 'The position name is very long.';
  if (/@|applications?\s*:|enquiries/i.test(title)) return 'The position name looks wrong.';
  return '';
}

const POST_LABEL = /\bPOST\s+(\d+\/\d+)\s*[:\-–]\s*/gi;
const LABEL_STOP = /\bREF(?:ERENCE)?\b\s*(?:NO|NUMBER|NR)?\s*[:.]?|\bSALARY\b|\bCENTRE\b|\bDirectorate\b|\bBranch\b|\bREQUIREMENTS?\b|\bDUTIES\b|\bENQUIRIES\b|\bAPPLICATIONS?\b|\bCLOSING\b|\bNOTE\b|\bGrade\s+\d\s*:/;

/** The title that follows "POST 36/128 :" (it may wrap onto the next line), without "(X2 POSTS)". */
function titleFromLabel(text: string, labelEnd: number): string {
  const after = text.slice(labelEnd, labelEnd + 400);
  const cut = after.search(LABEL_STOP);
  const t = (cut >= 0 ? after.slice(0, cut) : after.slice(0, 120))
    .replace(/\(?\s*X\s*\d+\s*POSTS?\s*\)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s:\-–,;(]+$/g, '')
    .trim();
  return t ? titleCase(t) : '';
}

/** Salary level, only from the post's salary line ("(Level 08)"). Empty when the post does not state one. */
export function parseLevel(body: string): string {
  const re = /\b(?:salary\s+)?level\s*0?(\d{1,2})\b/i;
  const sal = body.match(/SALARY\s*:?\s*(.{0,300})/i)?.[1] ?? '';
  const m = sal.match(re) ?? body.slice(0, 400).match(re);
  return m ? String(Number(m[1])) : '';
}

export function parseCircular(rawText: string): CircularInfo {
  const flat = flatten(rawText);
  const { text, provinces, bodyStart, lineStarts, lineTexts } = flat;
  const heads = flat.heads.filter((h) => h.pos >= bodyStart);
  const refRe = /\bREF(?:ERENCE)?\b(?:\s*(?:NO|NUMBER|NR|NUM)\b\.?)?\s*[:：.]?\s*/gi;
  // Circulars label every post "POST 36/128 : TITLE". When they do, that label is the most reliable anchor.
  const labels = [...text.matchAll(POST_LABEL)].filter((m) => (m.index ?? 0) >= bodyStart).map((m) => ({ pos: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  const labelled = labels.length >= 3;
  const labelFor = (idx: number) => (labelled ? [...labels].reverse().find((l) => l.pos < idx && idx - l.pos < 3000) : undefined);

  const markers: { idx: number; end: number; ref: string }[] = [];
  const seenRef = new Set<string>();
  for (const m of text.matchAll(refRe)) {
    const idx = m.index ?? 0;
    if (idx < bodyStart) continue;
    const end = idx + m[0].length;
    let ref = readRef(text.slice(end, end + 60));
    // "REF NO: CAC" has no digits: accept it when it sits just under a post label.
    if (!ref && labelled && /^REF\s*NO/i.test(m[0])) {
      const lb = labelFor(idx);
      if (lb && idx - lb.pos < 800) ref = readRefLoose(text.slice(end, end + 90));
    }
    if (!ref || seenRef.has(ref)) continue;
    seenRef.add(ref);
    markers.push({ idx, end, ref });
  }

  const dates = findDates(text);
  const candidates = dates.filter((d) => d.hasTime || d.keyword);
  // "CLOSING DATE : 26 October 2026" is the real closing date. Dates inside notices ("...the closing date of 05 October...") are not.
  const labelledDates = candidates.filter((d) => /CLOSING\s+DATE\s*[:\-–]?\s*$/i.test(text.slice(Math.max(0, d.index - 30), d.index)));
  const closing = labelledDates.length ? labelledDates : candidates;
  const emails = [...new Set([...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]))];

  const seenDept = new Map<string, string>();
  const deptName = (raw: string, pos: number) => {
    const prov = [...provinces].reverse().find((p) => p.pos <= pos);
    const full = `${prov ? prov.name + ' ' : ''}${cleanDeptName(raw)}`;
    const key = deptKey(full);
    if (!seenDept.has(key)) seenDept.set(key, full);
    return seenDept.get(key)!;
  };
  const lineAt = (idx: number) => {
    let k = 0;
    for (let j = 0; j < lineStarts.length; j++) if (lineStarts[j] <= idx) k = j;
    return k;
  };
  const titles = markers.map((mk, i) => {
    const label = labelFor(mk.idx);
    if (label) {
      const t = titleFromLabel(text, label.end);
      if (plausibleTitle(t)) return { title: t, start: label.pos };
    }
    const prevEnd = i === 0 ? 0 : markers[i - 1].end;
    const lastHead = [...heads].reverse().find((h) => h.end <= mk.idx);
    const floor = Math.max(prevEnd, lastHead ? lastHead.end : 0);
    const from = Math.max(floor, mk.idx - 220);
    const li = lineAt(mk.idx);
    // 1. The title is usually on the same line as "REF NO" (the PDF's own line structure is the most reliable guide).
    const same = cleanTitleLine(text.slice(lineStarts[li], mk.idx));
    if (lineStarts[li] >= floor && plausibleTitle(same)) return { title: titleCase(same), start: lineStarts[li] };
    // 2. Capital letters straight before "REF NO" (works when the PDF runs everything together on one line).
    const first = readTitle(text.slice(from, mk.idx), from);
    if (plausibleTitle(first.title)) return first;
    // 3. One of the two lines above.
    for (let k = 1; k <= 2; k++) {
      const j = li - k;
      if (j < 0 || lineStarts[j] < floor) break;
      const cand = cleanTitleLine(lineTexts[j]);
      if (plausibleTitle(cand)) return { title: titleCase(cand), start: lineStarts[j] };
    }
    return first;
  });
  const starts = markers.map((_, i) => titles[i].start);
  const boundaries = [...heads.map((h) => h.pos), ...provinces.map((p) => p.pos).filter((p) => p >= bodyStart)].sort((a, b) => a - b);

  const posts: Post[] = markers.map((mk, i) => {
    const label = labelFor(mk.idx);
    const segStart = label ? label.pos : mk.idx;
    const nextStart = labelled ? labels.find((l) => l.pos > mk.idx)?.pos ?? text.length : i + 1 < markers.length ? titles[i + 1].start : text.length;
    const nextBoundary = boundaries.find((b) => b > mk.idx) ?? text.length;
    const segEnd = Math.min(nextStart, nextBoundary);
    const seg = text.slice(segStart, segEnd);
    // With labelled posts the whole block after the label belongs to the post, whichever order its parts come in.
    const rest = label ? text.slice(label.end, segEnd) : text.slice(mk.end, segEnd);
    const inSeg = closing.find((d) => d.index >= segStart && d.index < segEnd);
    const before = [...closing].reverse().find((d) => d.index < segStart);
    const after = closing.find((d) => d.index >= segEnd);
    const closingDate = (inSeg ?? before ?? after)?.date ?? null;
    const dir = rest.match(/Directorate\s*:?\s*(.+?)(?=\s+R\s?\d|\s+per annum|\s+Level|\s+Grade|\s+SALARY|\s+CENTRE|\s+Gauteng|$)/i);
    const sal = rest.match(/R\s?\d{1,3}(?:[ ,]\d{3})+(?:\.\d{2})?(?:\s*(?:per annum|p\.?a\.?))?/i);
    const loc = rest.match(/CENTRE\s*:?\s*([^.]{2,60}?)(?=\s+REQUIREMENTS|\s+DUTIES|$)/i) ?? rest.match(/(?:Gauteng|Western Cape|Eastern Cape|Northern Cape|KwaZulu-Natal|Free State|Limpopo|Mpumalanga|North West)(?:\s*\([^)]+\))?/i);
    const headIdx = heads.reduce((k, h, j) => (h.pos <= segStart ? j : k), -1);
    const head = headIdx >= 0 ? heads[headIdx] : null;
    const blockStart = head ? head.pos : 0;
    const blockEnd = headIdx >= 0 && headIdx + 1 < heads.length ? heads[headIdx + 1].pos : text.length;
    const block = text.slice(blockStart, blockEnd);
    const firstInBlock = starts.find((t) => t >= blockStart) ?? blockEnd;
    const preamble = text.slice(blockStart, Math.min(firstInBlock, blockEnd));
    // The route comes from the post's own APPLICATIONS text. An address in the ENQUIRIES text is for questions, not applications.
    const appRaw = seg.match(/\bAPPLICATIONS\b\s*:?\s*(.{0,700})|\bApplications\s*:\s*(.{0,700})/)?.slice(1).find(Boolean) ?? '';
    // The instruction ends where the next labelled part of the post starts (NOTE, ENQUIRIES, CLOSING DATE ...).
    const appEnd = appRaw.search(/\b(?:ENQUIRIES|NOTE|CLOSING\s+DATE|DUTIES|REQUIREMENTS|SALARY|CENTRE|POST\s+\d+\/\d+)\b/);
    const appCut = appEnd >= 0 ? appRaw.slice(0, appEnd) : appRaw;
    // In scrambled layouts the "text" after APPLICATIONS is just more labels; that is no instruction at all.
    const appText = appCut.trim().length >= 8 ? appCut : '';
    const enqText = seg.match(/\bENQUIRIES\b\s*:?\s*(.{0,300})/)?.[1] ?? '';
    const appEmail = appText.match(EMAIL_RE)?.[0] ?? '';
    const segEmail = [...seg.matchAll(new RegExp(EMAIL_RE.source, 'g'))].map((m) => m[0]).find((e) => !enqText.includes(e)) ?? '';
    const segOnline = ONLINE_RE.test(seg);
    const blockEmail = preamble.match(EMAIL_RE)?.[0] ?? block.match(EMAIL_RE)?.[0] ?? (heads.length === 0 && emails.length === 1 ? emails[0] : '');
    const blockOnline = ONLINE_RE.test(preamble);
    const NOT_BY_EMAIL = 'The circular does not take email applications for this post (online system or hand delivery).';
    let applyBy: Post['applyBy'] = 'none';
    let email = '';
    let applyNote = '';
    if (NO_EMAIL_RE.test(appText) || NO_EMAIL_RE.test(seg)) { applyBy = 'online'; applyNote = NOT_BY_EMAIL; }
    else if (appEmail) { applyBy = 'email'; email = appEmail; }
    else if (appText) { applyBy = 'online'; applyNote = NOT_BY_EMAIL; } // the post's own instruction names no email address
    else if (segEmail) { applyBy = 'email'; email = segEmail; }
    else if (segOnline) { applyBy = 'online'; applyNote = NOT_BY_EMAIL; }
    else if (NO_EMAIL_RE.test(preamble) || (blockOnline && !preamble.match(EMAIL_RE))) { applyBy = 'online'; applyNote = NOT_BY_EMAIL; }
    else if (blockEmail) { applyBy = 'email'; email = blockEmail; }
    else applyNote = 'No email address was found for this post.';
    const enq = seg.match(/ENQUIRIES\s*:?\s*(.+?)(?=\s+APPLICATIONS|\s+NOTE|$)/i) ?? seg.match(/(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+[A-Z]\s+[A-Z][a-z]+\s+Tel[^.]{0,40}/);
    const reqSection = requirementsSection(rest);
    const reqs = parseRequirements(reqSection);
    return {
      id: `p${i}`,
      title: plausibleTitle(titles[i].title) ? titles[i].title : recoverTitle(rest.startsWith(mk.ref) ? rest.slice(mk.ref.length).trim() : text.slice(mk.end, segEnd)) || `Post ${mk.ref}`,
      ref: mk.ref,
      directorate: dir ? dir[1].trim().slice(0, 90) : '',
      salary: sal ? sal[0].replace(/\s+/g, ' ').trim() : '',
      level: parseLevel(rest),
      levelFromSalary: false,
      location: loc ? (loc[1] ?? loc[0]).trim() : '',
      closing: closingDate,
      email,
      applyBy,
      applyNote,
      department: head ? deptName(head.name, head.pos) : '',
      enquiries: enq ? (enq[1] ?? enq[0]).trim().slice(0, 80) : '',
      reqs,
      requirements: reqSection.trim(),
      raw: seg,
    };
  });

  // Many posts print only a salary. Other posts in the same circular pair that salary with a stated level,
  // so a salary that always goes with one level tells us the level of the posts that leave it out.
  const startOf = (sal: string) => {
    const m = sal.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+)/);
    return m ? Number(m[1].replace(/[ ,]/g, '')) : 0;
  };
  const bySalary = new Map<number, Map<string, number>>();
  for (const p of posts) {
    const k = startOf(p.salary);
    if (!k || !p.level) continue;
    const m = bySalary.get(k) ?? new Map<string, number>();
    m.set(p.level, (m.get(p.level) ?? 0) + 1);
    bySalary.set(k, m);
  }
  for (const p of posts) {
    if (p.level) continue;
    const m = bySalary.get(startOf(p.salary));
    if (m && m.size === 1) {
      p.level = [...m.keys()][0];
      p.levelFromSalary = true;
    }
  }

  const NOT_NAME = 'PUBLIC\\b|SERVICE\\b|VACANC|CIRCULAR|REF\\b|NOTE\\b|ANNEXURE|ADVERT|POSTS?\\b|NO\\b|CLOSING|DATE\\b';
  const dept =
    text.match(new RegExp(`\\bDEPARTMENT OF [A-Z][A-Z,&]*(?: (?!${NOT_NAME})[A-Z,&]+){0,5}`))?.[0] ??
    text.match(/\bDepartment of (?:the )?[A-Z][A-Za-z&]*(?: (?:and |of |&)?[A-Z][A-Za-z&]*){0,4}/)?.[0] ??
    '';

  const departments = [...new Set(posts.map((p) => p.department).filter(Boolean))];
  const subj = text.match(/[^.]*\b(?:subject|quote|state|indicate|reference)[^.]{0,40}\b(?:reference|ref)\s*(?:number|no)?[^.]*(?:subject|heading|header)[^.]*\./i);
  const size = text.match(/maximum of\s*(\d+)\s*(?:megabytes|mb)/i);

  return {
    posts,
    department: departments[0] ?? titleCase(dept.replace(/\s+/g, ' ').trim()),
    departments,
    emails,
    subjectRule: subj ? subj[0].trim() : null,
    maxSizeMb: size ? Number(size[1]) : null,
  };
}

export function isClosed(p: Post, now = new Date()): boolean {
  return p.closing !== null && p.closing.getTime() < now.getTime();
}

export function fmtDate(d: Date | null): string {
  if (!d) return 'Closing date not found';
  const hasTime = d.getHours() !== 23 || d.getMinutes() !== 59;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) + (hasTime ? ' at ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '');
}
