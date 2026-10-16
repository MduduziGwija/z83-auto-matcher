import equivalency from '../data/equivalency.json';
import type { CvInfo, MatchItem, MatchResult, Outcome, Post, Req } from './types';
import { containsPhrase, coverage, levelOf, norm, tokenSet, tokens } from './text';

export const DISCLAIMER =
  'This match score and qualification equivalency list may not be fully accurate. You may still qualify even if not shown as a strong match — always check the actual post requirements yourself.';

const EXTRA_KEY = 'z83.equivalency.extra';

export type Groups = string[][];

export function loadExtraGroups(): Groups {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    return raw ? (JSON.parse(raw) as Groups) : [];
  } catch {
    return [];
  }
}

export function saveExtraGroups(g: Groups): void {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(g));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function allGroups(extra: Groups = loadExtraGroups()): Groups {
  return [...(equivalency.groups as Groups), ...extra];
}

const ALIASES = equivalency.skillAliases as Record<string, string[]>;
const WEIGHT: Record<Outcome, number> = { direct: 1, equivalent: 0.8, partial: 0.4, missing: 0 };

interface Ctx {
  cv: CvInfo;
  cvNorm: string;
  cvTokens: Set<string>;
  qualNorm: string;
  groups: Groups;
}

function makeCtx(cv: CvInfo, groups: Groups): Ctx {
  const qualText = cv.qualifications.map((q) => `${q.text} ${q.school}`).join(' \n ');
  // Fields of study are only looked for in the qualification lines, never in the whole CV
  // (a module in a degree, or a skill, is not a qualification).
  return { cv, cvNorm: norm(cv.text), cvTokens: tokenSet(cv.text), qualNorm: norm(qualText), groups };
}

function fieldMatch(field: string, ctx: Ctx): { kind: 'direct' | 'equivalent' | 'none'; via?: string } {
  if (containsPhrase(ctx.qualNorm, field) || coverage(field, tokenSet(ctx.qualNorm)) >= 0.99) return { kind: 'direct' };
  for (const g of ctx.groups) {
    if (!g.some((m) => norm(m) === norm(field))) continue;
    for (const alt of g) {
      if (norm(alt) === norm(field)) continue;
      if (containsPhrase(ctx.qualNorm, alt)) return { kind: 'equivalent', via: alt };
    }
  }
  return { kind: 'none' };
}

function bestLevel(cv: CvInfo): number {
  return cv.qualifications.reduce((m, q) => Math.max(m, q.level), 0);
}

function matchQualification(r: Req, ctx: Ctx): MatchItem {
  const need = r.nqf ?? 0;
  const have = bestLevel(ctx.cv) || (/matric|grade 12|senior certificate/i.test(ctx.cv.text) ? 4 : 0);
  const levelOk = have >= need;
  if (!r.fields?.length) {
    return levelOk && have > 0
      ? { req: r, outcome: 'direct', evidence: need === 4 ? 'Your CV shows a matric or higher qualification.' : `Your CV shows a qualification at NQF level ${have}.`, advice: '' }
      : { req: r, outcome: 'missing', evidence: 'No matching qualification found in your CV.', advice: `Add this qualification to your CV: ${r.text}.` };
  }
  let best: { kind: 'direct' | 'equivalent' | 'none'; via?: string; field?: string } = { kind: 'none' };
  for (const f of r.fields) {
    const m = fieldMatch(f, ctx);
    if (m.kind === 'direct') {
      best = { ...m, field: f };
      break;
    }
    if (m.kind === 'equivalent' && best.kind === 'none') best = { ...m, field: f };
  }
  if (best.kind === 'direct') {
    return levelOk
      ? { req: r, outcome: 'direct', evidence: `Your CV lists ${best.field}.`, advice: '' }
      : { req: r, outcome: 'partial', evidence: `Your CV lists ${best.field}, but the level (NQF ${have || 'unknown'}) looks lower than NQF ${need}.`, advice: `Make sure your CV states the NQF level of your ${best.field} qualification.` };
  }
  if (best.kind === 'equivalent') {
    return levelOk
      ? { req: r, outcome: 'equivalent', evidence: `Your CV lists ${best.via}, which is often treated as equal to ${best.field}.`, advice: `Departments decide this — mention in your CV that ${best.via} is equivalent to ${best.field}.` }
      : { req: r, outcome: 'partial', evidence: `${best.via} is often treated as ${best.field}, but the level looks lower than NQF ${need}.`, advice: 'State the NQF level of this qualification on your CV.' };
  }
  return levelOk && need > 0
    ? { req: r, outcome: 'partial', evidence: `Your highest level (NQF ${have}) is enough, but we did not find ${r.fields.join(' / ')} in your CV.`, advice: `If you studied ${r.fields[0]} (or similar), name it clearly on your CV.` }
    : { req: r, outcome: 'missing', evidence: `We did not find ${r.fields.join(' / ')} in your CV.`, advice: `Add the qualification if you have it: ${r.text}.` };
}

/** Rough seniority of a job title, from intern (1) up to director (6). */
const RANKS: [RegExp, number][] = [
  [/\b(chief director|director general|general manager|executive|head of department)\b/, 6],
  [/\b(deputy director|senior manager|director)\b/, 5],
  [/\b(assistant director|manager|head of|middle management)\b/, 4],
  [/\b(senior|supervisor|supervisory|team leader|team lead|specialist|coordinator|lead)\b/, 3],
  [/\b(officer|administrator|practitioner|analyst|developer|engineer|technician|accountant|advisor|adviser|consultant|lecturer|planner|auditor)\b/, 2],
  [/\b(intern|trainee|learner|learnership|student|volunteer|clerk|assistant|invigilator|scriber|junior|graduate)\b/, 1],
];
export function titleRank(title: string): number {
  const t = norm(title);
  for (const [re, r] of RANKS) if (re.test(t)) return r;
  return 0;
}
const SENIORITY_NEED: [RegExp, number, string][] = [
  [/chief director/, 6, 'Chief Director'],
  [/deputy director|senior manager|senior management/, 5, 'Deputy Director / Senior Manager'],
  [/assistant director|middle management|\bmms\b/, 4, 'Assistant Director'],
  [/director|manager|\bsms\b|managerial/, 4, 'management'],
  [/supervis/, 3, 'supervisory'],
];
function seniorityNeed(sen: string): { rank: number; label: string } | null {
  for (const [re, rank, label] of SENIORITY_NEED) if (re.test(sen)) return { rank, label };
  return null;
}

function matchExperience(r: Req, ctx: Ctx): MatchItem {
  const need = r.years ?? 0;
  const have = ctx.cv.totalYears;
  const notes: string[] = [];
  const advice: string[] = [];
  let cap: Outcome = 'direct';
  let missing = false;

  // 1. Years
  const yearsOk = have === null ? null : have >= need;
  notes.push(have === null ? 'We could not work out your total years of experience.' : `Your CV shows about ${have} years of experience in total.`);
  if (yearsOk === false) {
    if (have! >= need * 0.7) cap = 'partial';
    else missing = true;
    advice.push(`The post asks for ${need} years. Show every job with start and end dates on your CV.`);
  }

  // 2. The kind of work: at least one alternative must really appear in the CV
  if (r.domain?.length) {
    let best = 0;
    let bestPhrase = '';
    for (const alt of r.domain) {
      const nTok = tokens(alt).length;
      let c = coverage(alt, ctx.cvTokens);
      if (nTok < 2 && c < 1) c = 0;
      const viaAlias = Object.entries(ALIASES).some(([k, alts]) => norm(alt).includes(k) && alts.some((a) => containsPhrase(ctx.cvNorm, a)));
      if (viaAlias) c = Math.max(c, 0.99);
      if (c > best) {
        best = c;
        bestPhrase = alt;
      }
    }
    if (best >= 0.99) notes.push(`Your CV mentions ${bestPhrase}.`);
    else if (best >= 0.67) {
      cap = cap === 'direct' ? 'partial' : cap;
      notes.push(`Your CV only partly mentions this kind of work (${bestPhrase}).`);
      advice.push(`Spell out your experience in: ${r.domain.join(' / ')}.`);
    } else {
      missing = true;
      notes.push(`We did not find this kind of work in your CV: ${r.domain.join(' / ')}.`);
      advice.push(`This post needs experience in ${r.domain.join(' / ')}. Only apply if you have it, and then describe it on your CV.`);
    }
  }

  // 3. Seniority (for example "2 years at Assistant Director level")
  const need2 = r.seniority ? seniorityNeed(r.seniority) : null;
  if (need2) {
    const ranks = ctx.cv.work.map((w) => titleRank(`${w.post} ${w.employer}`));
    const top = ranks.length ? Math.max(...ranks) : 0;
    if (top >= need2.rank) notes.push(`Your CV shows a job title at or near ${need2.label} level.`);
    else {
      cap = cap === 'direct' ? 'partial' : cap;
      notes.push(`The post asks for ${need2.label} level experience. We could not see a title at that level on your CV.`);
      advice.push(`Show your job titles and what you were responsible for. If you did not work at ${need2.label} level, this post may not suit you.`);
    }
  }

  const outcome: Outcome = missing ? 'missing' : cap;
  return { req: r, outcome, evidence: notes.join(' '), advice: outcome === 'direct' ? '' : advice.join(' ') };
}

function matchLicence(r: Req, ctx: Ctx): MatchItem {
  return ctx.cv.driversLicence
    ? { req: r, outcome: 'direct', evidence: "Your CV mentions a driver's licence.", advice: '' }
    : { req: r, outcome: 'missing', evidence: "No driver's licence found in your CV.", advice: "If you have one, add \"Driver's licence: Code B/EB\" to your CV." };
}

function matchSkill(r: Req, ctx: Ctx): MatchItem {
  const key = Object.keys(ALIASES).find((k) => norm(r.text).includes(k));
  const direct = coverage(r.text, ctx.cvTokens);
  const viaAlias = key ? ALIASES[key].some((a) => containsPhrase(ctx.cvNorm, a)) : false;
  if (direct >= 0.6) return { req: r, outcome: 'direct', evidence: 'Found in your CV.', advice: '' };
  if (viaAlias) return { req: r, outcome: 'equivalent', evidence: 'Related words found in your CV.', advice: '' };
  if (direct >= 0.5 && tokens(r.text).length >= 3) return { req: r, outcome: 'partial', evidence: 'Partly found in your CV.', advice: `Use the words "${r.text}" on your CV if they describe your work.` };
  return { req: r, outcome: 'missing', evidence: 'Not found in your CV.', advice: `If you have this, add "${r.text}" with an example to your CV.` };
}

export function matchPost(post: Post, cv: CvInfo, groups: Groups = allGroups()): MatchResult {
  const ctx = makeCtx(cv, groups);
  const items: MatchItem[] = post.reqs.map((r) =>
    r.kind === 'qualification' ? matchQualification(r, ctx) : r.kind === 'experience' ? matchExperience(r, ctx) : r.kind === 'licence' ? matchLicence(r, ctx) : matchSkill(r, ctx),
  );
  let num = 0;
  let den = 0;
  const soft = items.filter((i) => i.req.kind === 'knowledge' || i.req.kind === 'skill');
  for (const it of items) {
    if (it.req.kind === 'knowledge' || it.req.kind === 'skill') continue;
    const w = it.req.kind === 'licence' ? 1 : 3;
    num += w * WEIGHT[it.outcome];
    den += w;
  }
  if (soft.length) {
    num += 2 * (soft.reduce((s, i) => s + WEIGHT[i.outcome], 0) / soft.length);
    den += 2;
  }
  const score = den === 0 ? 0 : Math.round((num / den) * 100);
  const hardMissing = items.some((i) => (i.req.kind === 'qualification' || i.req.kind === 'experience') && i.outcome === 'missing');
  const status: MatchResult['status'] = items.length === 0 ? 'low' : hardMissing ? (score >= 60 ? 'partial' : 'low') : score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'low';
  return { postId: post.id, score, status, items };
}
