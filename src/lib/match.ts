import equivalency from '../data/equivalency.json';
import type { CvInfo, MatchItem, MatchResult, Outcome, Post, Req } from './types';
import { containsPhrase, coverage, levelOf, norm, tokenSet } from './text';

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
  return { cv, cvNorm: norm(cv.text), cvTokens: tokenSet(cv.text), qualNorm: norm(qualText || cv.text), groups };
}

function fieldMatch(field: string, ctx: Ctx): { kind: 'direct' | 'equivalent' | 'none'; via?: string } {
  if (containsPhrase(ctx.qualNorm, field) || containsPhrase(ctx.cvNorm, field) || coverage(field, tokenSet(ctx.qualNorm)) >= 0.99) return { kind: 'direct' };
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
  return cv.qualifications.reduce((m, q) => Math.max(m, q.level), levelOf(cv.text.slice(0, 0)));
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

function matchExperience(r: Req, ctx: Ctx): MatchItem {
  const need = r.years ?? 0;
  const have = ctx.cv.totalYears;
  const topic = r.topic ?? '';
  let cov = topic ? coverage(topic, ctx.cvTokens) : 1;
  // Allow skill aliases to help (e.g. "project management" -> "projects").
  for (const [k, alts] of Object.entries(ALIASES)) if (topic && norm(topic).includes(k) && alts.some((a) => containsPhrase(ctx.cvNorm, a))) cov = Math.max(cov, 0.7);
  const yearsOk = have === null ? null : have >= need;
  let outcome: Outcome;
  if (yearsOk && cov >= 0.5) outcome = 'direct';
  else if ((yearsOk && cov >= 0.25) || (yearsOk === null && cov >= 0.5) || (have !== null && have >= need * 0.7 && cov >= 0.5)) outcome = 'partial';
  else outcome = 'missing';
  const yrs = have === null ? 'We could not work out your total years of experience.' : `Your CV shows about ${have} years of experience.`;
  const rel = topic ? (cov >= 0.5 ? 'Your CV mentions this kind of work.' : cov >= 0.25 ? 'Your CV only partly mentions this kind of work.' : 'We did not find this kind of work in your CV.') : '';
  return {
    req: r,
    outcome,
    evidence: `${yrs} ${rel}`.trim(),
    advice: outcome === 'direct' ? '' : `Show clearly on your CV how many years you have in: ${topic || r.text}. Use start and end dates for each job.`,
  };
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
  if (direct >= 0.3) return { req: r, outcome: 'partial', evidence: 'Partly found in your CV.', advice: `Use the words "${r.text}" on your CV if they describe your work.` };
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
  const status: MatchResult['status'] = items.length === 0 ? 'low' : score >= 75 && !hardMissing ? 'strong' : score >= 45 ? 'partial' : 'low';
  return { postId: post.id, score, status, items };
}
