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
  // Cut everything up to the last heading word (e.g. "OTHER POSTS", "POST 36/02").
  let cut = -1;
  run.forEach((x, i) => {
    const bare = x.w.replace(/[^A-Za-z0-9/]/g, '');
    if (TITLE_STOP.has(bare) || /^\d+\/\d+$/.test(bare) || /^[:\-–]+$/.test(x.w)) cut = i;
  });
  run = run.slice(cut + 1);
  if (run.length === 0) {
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

function parseQualParts(sentence: string): Req[] {
  const parts = sentence.split(/\s+and\s+(?:a\s+|an\s+)?(?=(?:national|grade|diploma|degree|b[. ]?tech|bachelor|honou?rs|master|certificate|advanced|postgraduate|nqf|matric))/i);
  const out: Req[] = [];
  for (const part of parts) {
    const lvl = levelOf(part);
    if (!lvl && !/qualification/i.test(part)) continue;
    const lead = part.replace(/^.*?(?:in possession of|must have|must be in possession of)\s+/i, '').replace(/^(a|an)\s+/i, '').trim();
    const m = lead.match(/\b(?:in|of)\s+([^()]+?)(?:\(|\bnqf\b|$|\.|,\s*(?:with|and))/i);
    let fields: string[] = [];
    if (m) {
      fields = m[1]
        .split(/\s*[/&]\s*|\s+or\s+|,\s*/i)
        .map((f) => f.replace(/\b(?:a|an|the|relevant|related|equivalent|as recognised by saqa)\b/gi, '').replace(/\s+/g, ' ').trim())
        .filter((f) => f.length > 2 && !/^(possession|nqf)/i.test(f));
    }
    const text = lead;
    out.push({ id: '', kind: 'qualification', text: text.replace(/[.;]+$/, ''), nqf: lvl || undefined, fields: fields.length ? fields : undefined });
  }
  return out;
}

export function parseRequirements(reqText: string): Req[] {
  const reqs: Req[] = [];
  const split = reqText.split(/Job[\s-]*related\s+(?:knowledge|skills?|competenc\w+)\s*:?/i);
  const core = split[0];
  const rest = reqText.slice(core.length);
  const sentences = core.split(/(?<=[.;])\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const y = s.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\(\d+\))?\s*(?:\+\s*)?years?\b/i);
    if (y && /experience|exposure|supervis|managerial|working/i.test(s)) {
      const t = s.match(/experience\s*(?:\w+\s+){0,2}?(?:in|of|as|within|at|with)\s+(.*)$/i);
      const topic = (t ? t[1] : s.replace(/^.*?years?[’']?s?\s*/i, '')).replace(/[.;]+$/, '').trim();
      // "supervisory experience in X" -> keep the adjective as part of the topic
      const adj = s.match(/years?[’']?s?\s+((?:\w+\s+){0,2}?)experience/i)?.[1]?.replace(/relevant/i, '').trim() ?? '';
      reqs.push({ id: '', kind: 'experience', text: s.replace(/[.;]+$/, ''), years: words(y[1]), topic: `${adj} ${topic}`.trim() });
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

function requirementsSection(seg: string): string {
  const start = seg.search(/Applicants?\s+must|Candidates?\s+must|Minimum\s+requirements?|\bRequirements?\s*:|Applicants?\s+should/i);
  if (start < 0) return '';
  const after = seg.slice(start);
  const end = after.search(/\bDUTIES\b|\bDuties\s*:|Key\s+(?:performance|responsibilit)|\bENQUIRIES\b|\bEnquiries\s*:/);
  return end > 0 ? after.slice(0, end) : after;
}

export function parseCircular(rawText: string): CircularInfo {
  const text = normalizeText(rawText);
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
    const from = Math.max(prevEnd, mk.idx - 220);
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
    const em = seg.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const enq = seg.match(/ENQUIRIES\s*:?\s*(.+?)(?=\s+APPLICATIONS|\s+NOTE|$)/i) ?? seg.match(/(?:Mr|Ms|Mrs|Dr|Prof)\.?\s+[A-Z]\s+[A-Z][a-z]+\s+Tel[^.]{0,40}/);
    const reqs = parseRequirements(requirementsSection(rest));
    return {
      id: `p${i}`,
      title: titles[i].title || `Post ${mk.ref}`,
      ref: mk.ref,
      directorate: dir ? dir[1].trim().slice(0, 90) : '',
      salary: sal ? sal[0].replace(/\s+/g, ' ').trim() : '',
      level: lvl ? lvl[1] : '',
      location: loc ? loc[0] : '',
      closing: closingDate,
      email: em ? em[0] : emails[0] ?? '',
      enquiries: enq ? (enq[1] ?? enq[0]).trim().slice(0, 80) : '',
      reqs,
      raw: seg,
    };
  });

  const NOT_NAME = 'PUBLIC\\b|SERVICE\\b|VACANC|CIRCULAR|REF\\b|NOTE\\b|ANNEXURE|ADVERT|POSTS?\\b|NO\\b|CLOSING|DATE\\b';
  const dept =
    text.match(new RegExp(`\\bDEPARTMENT OF [A-Z][A-Z,&]*(?: (?!${NOT_NAME})[A-Z,&]+){0,5}`))?.[0] ??
    text.match(/\bDepartment of (?:the )?[A-Z][A-Za-z&]*(?: (?:and |of |&)?[A-Z][A-Za-z&]*){0,4}/)?.[0] ??
    '';

  const subj = text.match(/[^.]*\b(?:subject|quote|state|indicate|reference)[^.]{0,40}\b(?:reference|ref)\s*(?:number|no)?[^.]*(?:subject|heading|header)[^.]*\./i);
  const size = text.match(/maximum of\s*(\d+)\s*(?:megabytes|mb)/i);

  return {
    posts,
    department: dept.replace(/\s+/g, ' ').trim(),
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
