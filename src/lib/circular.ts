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
  const m = after.match(new RegExp(`^(${tok})(?:\\s+(${tok}))?`));
  if (!m) return null;
  const [, a, b] = m;
  let ref: string | null = null;
  if (/\d/.test(a)) ref = a;
  else if (b && /\d/.test(b) && /^[A-Z]{2,6}$/.test(a)) ref = `${a} ${b}`;
  if (!ref) return null;
  return ref.replace(/[.,;:]+$/, '');
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

const HEAD_START = /^(?:the\s+)?(?:department|ministry)\s+of\b|^office\s+of\s+the\b|^(?:the\s+)?presidency\b|^national\s+treasury\b|^provincial\s+(?:treasury|administration)\b|^public\s+service\s+commission\b|^statistics\s+south\s+africa\b|^south\s+african\s+(?:police|revenue|social|national|qualifications)\b/i;
const NOT_HEAD = /\b(?:is|are|will|invites?|has|have|must|should|please|following|applications?|vacanc\w*|requirements?|duties|enquiries|closing|salary|centre|ref|no)\b|[0-9.:;]/i;

export function isDeptHeading(line: string): boolean {
  const l = line.trim();
  if (l.length < 8 || l.length > 95 || !HEAD_START.test(l)) return false;
  const upper = !/[a-z]/.test(l);
  if (!upper && NOT_HEAD.test(l)) return false;
  // Upper-case headings may still be a job title like "DEPARTMENT OF ... MANAGER"; reject those with a duty keyword.
  return !/\b(?:ref|no|post|salary|centre)\b[\s:.]*\d?/i.test(l);
}

/** Collapse the text to one line, remembering where each department heading starts. */
function flatten(raw: string): { text: string; heads: Head[] } {
  const lines = raw.split(/\r?\n/).map(normalizeText).filter(Boolean);
  const heads: Head[] = [];
  let flat = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let name = '';
    if (isDeptHeading(line) || (HEAD_START.test(line) && !/[a-z]/.test(line) && line.length <= 95 && !NOT_HEAD.test(line))) {
      name = line;
      // A long heading may wrap onto the next line ("... LAND REFORM AND" / "RURAL DEVELOPMENT").
      while (/(?:\band|\bof|&|,)$/i.test(name) && i + 1 < lines.length && !/[a-z]/.test(lines[i + 1]) && name.length < 90) {
        name += ' ' + lines[++i];
      }
      line = name;
    }
    const pos = flat ? flat.length + 1 : 0;
    flat += (flat ? ' ' : '') + line;
    if (name) heads.push({ pos, end: pos + line.length, name: line });
  }
  return { text: flat, heads };
}

const ONLINE_RE = /\b(?:apply|applying|applications?|submit(?:ted)?|submission)\b[^.]{0,80}\b(?:online|on-line|e-?recruitment|recruitment portal|career(?:s)? portal)\b|\bonline\s+(?:application|system|portal|platform|recruitment)|\bonly\b[^.]{0,25}\bonline\b|\be-?recruitment\b|\bapply\s+online\b/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const LOOKS_LIKE_REF = (w: string) => /\d/.test(w) && /[/\\-]/.test(w);

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

export function parseCircular(rawText: string): CircularInfo {
  const { text, heads } = flatten(rawText);
  const refRe = /\bREF(?:ERENCE)?(?:\s*(?:NO|NUMBER|NR|NUM)\b\.?)?\s*[:：.]?\s*/gi;
  const markers: { idx: number; end: number; ref: string }[] = [];
  const seenRef = new Set<string>();
  for (const m of text.matchAll(refRe)) {
    const idx = m.index ?? 0;
    const end = idx + m[0].length;
    const ref = readRef(text.slice(end, end + 60));
    if (!ref || seenRef.has(ref)) continue;
    seenRef.add(ref);
    markers.push({ idx, end, ref });
  }
  const dates = findDates(text);
  const closing = dates.filter((d) => d.hasTime || d.keyword);
  const emails = [...new Set([...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]))];

  const titles = markers.map((mk, i) => {
    const prevEnd = i === 0 ? 0 : markers[i - 1].end;
    const lastHead = [...heads].reverse().find((h) => h.end <= mk.idx);
    const from = Math.max(prevEnd, mk.idx - 220, lastHead ? lastHead.end : 0);
    return readTitle(text.slice(from, mk.idx), from);
  });

  const posts: Post[] = markers.map((mk, i) => {
    const segEnd = i + 1 < markers.length ? titles[i + 1].start : text.length;
    const seg = text.slice(mk.idx, segEnd);
    const rest = text.slice(mk.end, segEnd);
    const inSeg = closing.find((d) => d.index >= mk.idx && d.index < segEnd);
    const before = [...closing].reverse().find((d) => d.index < titles[i].start);
    const after = closing.find((d) => d.index >= segEnd);
    const closingDate = (inSeg ?? before ?? after)?.date ?? null;
    const dir = rest.match(/Directorate\s*:?\s*(.+?)(?=\s+R\s?\d|\s+per annum|\s+Level|\s+Grade|\s+Gauteng|$)/i);
    const sal = rest.match(/R\s?\d{1,3}(?:[ ,]\d{3})+(?:\.\d{2})?(?:\s*(?:per annum|p\.?a\.?))?/i);
    const lvl = rest.match(/\((?:Level|Grade)\s*(\d{1,2})\)/i) ?? rest.match(/\b(?:Level|Grade)\s*(\d{1,2})\b/i);
    const loc = rest.match(/(?:Gauteng|Western Cape|Eastern Cape|Northern Cape|KwaZulu-Natal|Free State|Limpopo|Mpumalanga|North West)(?:\s*\([^)]+\))?/i);
    const headIdx = heads.reduce((k, h, j) => (h.pos <= titles[i].start ? j : k), -1);
    const head = headIdx >= 0 ? heads[headIdx] : null;
    const blockStart = head ? head.pos : 0;
    const blockEnd = headIdx >= 0 && headIdx + 1 < heads.length ? heads[headIdx + 1].pos : text.length;
    const block = text.slice(blockStart, blockEnd);
    const firstInBlock = markers.map((_, j) => titles[j].start).find((t) => t >= blockStart) ?? blockEnd;
    const preamble = text.slice(blockStart, Math.min(firstInBlock, blockEnd));
    const segEmail = seg.match(EMAIL_RE)?.[0] ?? '';
    const segOnline = ONLINE_RE.test(seg);
    const blockEmail = block.match(EMAIL_RE)?.[0] ?? (heads.length === 0 && emails.length === 1 ? emails[0] : '');
    const blockOnline = ONLINE_RE.test(preamble);
    let applyBy: Post['applyBy'] = 'none';
    let email = '';
    let applyNote = '';
    if (segEmail) { applyBy = 'email'; email = segEmail; }
    else if (segOnline) { applyBy = 'online'; applyNote = 'This post must be applied for online on the department’s own system.'; }
    else if (blockEmail && !(blockOnline && !preamble.match(EMAIL_RE))) { applyBy = 'email'; email = blockEmail; }
    else if (blockOnline) { applyBy = 'online'; applyNote = 'This department asks for online applications on its own system.'; }
    else applyNote = 'No email address was found for this post.';
    const em = email ? [email] : null;
    const enq = seg.match(/ENQUIRIES\s*:?\s*(.+?)(?=\s+APPLICATIONS|\s+NOTE|$)/i) ?? seg.match(/(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+[A-Z]\s+[A-Z][a-z]+\s+Tel[^.]{0,40}/);
    const reqSection = requirementsSection(rest);
    const reqs = parseRequirements(reqSection);
    const nextHead = heads.find((h) => h.pos > mk.idx && h.pos < segEnd);
    const rawSeg = nextHead ? text.slice(mk.idx, nextHead.pos).trim() : seg;
    return {
      id: `p${i}`,
      title: validTitle(titles[i].title) ? titles[i].title : recoverTitle(rest.startsWith(mk.ref) ? rest.slice(mk.ref.length).trim() : rest) || `Post ${mk.ref}`,
      ref: mk.ref,
      directorate: dir ? dir[1].trim().slice(0, 90) : '',
      salary: sal ? sal[0].replace(/\s+/g, ' ').trim() : '',
      level: lvl ? lvl[1] : '',
      location: loc ? loc[0] : '',
      closing: closingDate,
      email,
      applyBy,
      applyNote,
      department: head ? titleCase(head.name) : '',
      enquiries: enq ? (enq[1] ?? enq[0]).trim().slice(0, 80) : '',
      reqs,
      requirements: reqSection.trim(),
      raw: rawSeg,
    };
  });

  const NOT_NAME = 'PUBLIC\\b|SERVICE\\b|VACANC|CIRCULAR|REF\\b|NOTE\\b|ANNEXURE|ADVERT|POSTS?\\b|NO\\b|CLOSING|DATE\\b';
  const dept =
    text.match(new RegExp(`\\bDEPARTMENT OF [A-Z][A-Z,&]*(?: (?!${NOT_NAME})[A-Z,&]+){0,5}`))?.[0] ??
    text.match(/\bDepartment of (?:the )?[A-Z][A-Za-z&]*(?: (?:and |of |&)?[A-Z][A-Za-z&]*){0,4}/)?.[0] ??
    '';

  const departments = [...new Set(heads.map((h) => titleCase(h.name)))];
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
