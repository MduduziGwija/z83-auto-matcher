import { CheckCircle2, ChevronDown, CircleDot, Pencil, Plus, Search, X, XCircle } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { deptKey, fmtDate, isClosed, titleProblem, toParagraphs } from '../lib/circular';
import { DISCLAIMER, allGroups, loadExtraGroups, saveExtraGroups } from '../lib/match';
import type { CircularInfo, CvInfo, MatchResult, Post, PostEdit } from '../lib/types';
import { Notice, OutcomeBadge, PrivacyNote, ScoreRing, StatusBadge } from './ui';

interface Props {
  circular: CircularInfo;
  cv: CvInfo;
  results: Record<string, MatchResult>;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  overrides: Record<string, PostEdit>;
  setOverrides: (m: Record<string, PostEdit>) => void;
  rematch: () => void;
  onBack: () => void;
  onContinue: () => void;
}

type Filter = 'all' | 'strong' | 'partial' | 'low' | 'selected';
const PAGE = 30;
const ANALYSIS_KEY = 'z83.showAnalysis';

/** Off by default: the analysis only shows if the person has switched it on. */
function loadAnalysis(): boolean {
  try {
    return localStorage.getItem(ANALYSIS_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Marks the words the user searched for. */
function Mark({ text, q }: { text: string; q: string }) {
  const words = q.split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'ig'));
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export default function Results({ circular, cv, results, selected, setSelected, overrides, setOverrides, rematch, onBack, onContinue }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [reqOpen, setReqOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [extra, setExtra] = useState(loadExtraGroups());
  const [pair, setPair] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dept, setDept] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [analysis, setAnalysisState] = useState(loadAnalysis);
  const now = new Date();

  const setAnalysis = (on: boolean) => {
    setAnalysisState(on);
    if (!on && filter !== 'all' && filter !== 'selected') setFilter('all');
    try {
      localStorage.setItem(ANALYSIS_KEY, on ? 'on' : 'off');
    } catch {
      /* storage unavailable: the choice just lasts for this visit */
    }
  };

  const deptOf = (p: Post) => overrides[p.id]?.department ?? (p.department || circular.department);
  const titleOf = (p: Post) => overrides[p.id]?.title ?? p.title;
  const refOf = (p: Post) => overrides[p.id]?.ref ?? p.ref;
  const problemOf = (p: Post) => titleProblem(titleOf(p), refOf(p));
  const edit = (p: Post, patch: PostEdit) => setOverrides({ ...overrides, [p.id]: { ...overrides[p.id], ...patch } });
  const closed = (p: Post) => isClosed(p, now);
  const canEmail = (p: Post) => p.applyBy === 'email';
  const selectable = (p: Post) => !closed(p) && canEmail(p);

  const hiddenCount = circular.posts.filter((p) => !closed(p) && !canEmail(p)).length;
  // Departments with how many posts each has (only posts that are still open and, unless shown, can be applied for by email).
  const NO_DEPT = '__none__';
  const deptCounts = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const p of circular.posts) {
      if (closed(p) || (!showHidden && !canEmail(p))) continue;
      const d = deptOf(p);
      const key = d ? deptKey(d) : NO_DEPT;
      const cur = m.get(key);
      if (cur) cur.count += 1;
      else m.set(key, { name: d || 'Department not found', count: 1 });
    }
    return [...m.entries()].sort((a, b) => (a[0] === NO_DEPT ? 1 : b[0] === NO_DEPT ? -1 : a[1].name.localeCompare(b[1].name)));
  }, [circular, overrides, showHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return circular.posts
      .filter((p) => (showHidden ? true : canEmail(p)))
      .filter((p) => !dept || (dept === NO_DEPT ? !deptOf(p) : deptKey(deptOf(p)) === dept))
      .filter((p) => (filter === 'all' ? true : filter === 'selected' ? selected.has(p.id) : results[p.id].status === filter))
      .filter((p) => {
        if (!words.length) return true;
        const hay = `${titleOf(p)} ${refOf(p)} ${deptOf(p)} ${p.directorate} ${p.location} ${p.level}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) =>
        Number(closed(a)) - Number(closed(b)) ||
        Number(canEmail(b)) - Number(canEmail(a)) ||
        (analysis
          ? results[b.id].score - results[a.id].score
          : (a.closing?.getTime() ?? Infinity) - (b.closing?.getTime() ?? Infinity) || titleOf(a).localeCompare(titleOf(b))),
      );
  }, [circular, q, filter, dept, showHidden, selected, results, overrides, analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const selectShown = () => {
    const s = new Set(selected);
    shown.filter(selectable).forEach((p) => s.add(p.id));
    setSelected(s);
  };
  const addPair = () => {
    const parts = pair.split(/\s*=\s*|\s*≈\s*/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return;
    const next = [...extra, parts];
    setExtra(next);
    saveExtraGroups(next);
    setPair('');
    rematch();
  };
  const removePair = (i: number) => {
    const next = extra.filter((_, k) => k !== i);
    setExtra(next);
    saveExtraGroups(next);
    rematch();
  };

  const emailable = circular.posts.filter((p) => !closed(p) && canEmail(p)).length;
  const counts: Record<Filter, number> = {
    all: shown.length,
    strong: circular.posts.filter((p) => canEmail(p) && results[p.id].status === 'strong').length,
    partial: circular.posts.filter((p) => canEmail(p) && results[p.id].status === 'partial').length,
    low: circular.posts.filter((p) => canEmail(p) && results[p.id].status === 'low').length,
    selected: selected.size,
  };

  return (
    <section aria-labelledby="res-h">
      <h1 id="res-h">Your matches</h1>
      <p className="lead">
        {circular.posts.length} post{circular.posts.length === 1 ? '' : 's'} found. {emailable} can be applied for by email{hiddenCount > 0 ? `, and ${hiddenCount} are hidden because they need online or other applications` : ''}. Pick any posts you want to apply for.{analysis ? ' A low score never blocks you.' : ''}
      </p>
      <PrivacyNote />

      <div className="switchrow card">
        <div>
          <p className="label" id="analysis-label">Show match analysis</p>
          <p className="hint" id="analysis-hint">
            {analysis
              ? 'On: each post gets a score and a reason. Turn it off if you only want to pick the posts you choose yourself.'
              : 'Off: posts are listed without scores. Your CV is still used to fill in your Z83.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={analysis} aria-labelledby="analysis-label" aria-describedby="analysis-hint" className={`switch ${analysis ? 'switch-on' : ''}`} onClick={() => setAnalysis(!analysis)}>
          <span className="switch-knob" aria-hidden />
          <span className="sr-only">{analysis ? 'On' : 'Off'}</span>
        </button>
      </div>

      {analysis && <Notice kind="warn" title="This matcher can be wrong">{DISCLAIMER}</Notice>}

      {cv.gaps.length > 0 && (
        <Notice kind="warn" title="Things to check on your CV">
          <ul className="plain">
            {cv.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Notice>
      )}

      <details className="equiv">
        <summary>Qualification equivalency list</summary>
        <p className="hint">Fields the system treats as interchangeable (for example Public Administration = Public Management). Add your own pairs. They are saved on this device.</p>
        <div className="row">
          <label htmlFor="pair" className="sr-only">New equivalent pair</label>
          <input id="pair" className="input" value={pair} onChange={(e) => setPair(e.target.value)} placeholder="Public Administration = Public Management" onKeyDown={(e) => e.key === 'Enter' && addPair()} />
          <button type="button" className="btn btn-secondary" onClick={addPair}><Plus size={18} aria-hidden /> Add</button>
        </div>
        {extra.length > 0 && (
          <ul className="chips">
            {extra.map((g, i) => (
              <li key={g.join('|')} className="chip">
                {g.join(' = ')}
                <button type="button" aria-label={`Remove ${g.join(' = ')}`} onClick={() => removePair(i)}><X size={14} aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">{allGroups(extra).length} groups in use.</p>
      </details>

      <div className="search card" role="search">
        <div className="field">
          <label htmlFor="q" className="label">Search posts</label>
          <div className="searchbox">
            <Search size={18} aria-hidden />
            <input id="q" type="search" className="input" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Job title, reference number, department…" autoComplete="off" />
          </div>
        </div>
        <div className="choice-row" role="group" aria-label="Filter posts">
          {([['all', 'All'], ['strong', 'Strong'], ['partial', 'Partial'], ['low', 'Missing requirements'], ['selected', 'Selected']] as [Filter, string][])
            .filter(([f]) => analysis || f === 'all' || f === 'selected')
            .map(([f, l]) => (
            <button key={f} type="button" className={`pill ${filter === f ? 'pill-on' : ''}`} aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }}>
              {l} <span className="count">{f === 'all' ? shown.length : counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="deptf" className="label">Filter by department</label>
          <select id="deptf" className="input" value={dept} onChange={(e) => { setDept(e.target.value); setLimit(PAGE); }}>
            <option value="">All departments ({deptCounts.length}), {deptCounts.reduce((n, [, v]) => n + v.count, 0)} posts</option>
            {deptCounts.map(([key, v]) => (
              <option key={key} value={key}>{v.name} ({v.count})</option>
            ))}
          </select>
          {deptCounts.length === 1 && <p className="hint">Only one department was found in this circular.</p>}
        </div>
        {hiddenCount > 0 && (
          <label className="checkline">
            <input type="checkbox" className="check" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            <span>Also show the {hiddenCount} posts that can’t be applied for by email (online systems, hand delivery)</span>
          </label>
        )}
      </div>

      <div className="bulk">
        <button type="button" className="btn btn-secondary btn-sm" onClick={selectShown}>Select all shown</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        <span className="muted" role="status">Showing {Math.min(limit, shown.length)} of {shown.length}</span>
      </div>

      {shown.length === 0 && <Notice kind="info" role="status">No posts match your search. Try fewer words, or clear the filters.</Notice>}

      <ul className="posts">
        {shown.slice(0, limit).map((p) => {
          const r = results[p.id];
          const isClosedPost = closed(p);
          const ok = selectable(p);
          const isOpen = !!open[p.id];
          const hard = r.items.filter((i) => i.req.kind === 'qualification' || i.req.kind === 'experience' || i.req.kind === 'licence');
          const soft = r.items.filter((i) => i.req.kind === 'knowledge' || i.req.kind === 'skill');
          const groups = [
            ['Matched directly', hard.filter((i) => i.outcome === 'direct')],
            ['Matched via equivalency', hard.filter((i) => i.outcome === 'equivalent')],
            ['Partly matched', hard.filter((i) => i.outcome === 'partial')],
            ['Missing: add to your CV', hard.filter((i) => i.outcome === 'missing')],
          ] as const;
          const softFound = soft.filter((i) => i.outcome === 'direct' || i.outcome === 'equivalent');
          const softPartial = soft.filter((i) => i.outcome === 'partial');
          const softMissing = soft.filter((i) => i.outcome === 'missing');
          return (
            <li key={p.id} className={`post ${!ok ? 'post-closed' : ''}`}>
              <div className="post-top">
                <input id={`sel-${p.id}`} type="checkbox" className="check" checked={selected.has(p.id)} disabled={!ok} onChange={() => toggle(p.id)} aria-describedby={`d-${p.id}`} />
                <div className="post-main">
                  <label htmlFor={`sel-${p.id}`} className="post-title"><Mark text={titleOf(p)} q={q} /></label>
                  {problemOf(p) && (
                    <p className="post-meta warnline" role="status">
                      <span className="tag tag-new">Check position name</span> {problemOf(p)} Please correct it with “Edit details”.
                    </p>
                  )}
                  <p className="post-meta" id={`d-${p.id}`}>
                    Ref <Mark text={refOf(p)} q={q} />
                    {p.directorate && <> · {p.directorate}</>}
                    {p.level && <> · Level {p.level}</>}
                    {p.location && <> · {p.location}</>}
                  </p>
                  <p className="post-meta">
                    <span className="dept"><Mark text={deptOf(p) || 'Department not found'} q={q} /></span>{' '}
                    <button type="button" className="btn btn-link btn-inline" aria-expanded={editing === p.id} onClick={() => setEditing(editing === p.id ? null : p.id)} aria-label={`Edit details for ${titleOf(p)}`}><Pencil size={14} aria-hidden /> Edit details</button>
                  </p>
                  {editing === p.id && (
                    <div className="editbox">
                      <p className="hint">This is what is printed on the Z83. Correct anything that is wrong.</p>
                      <div className="field">
                        <label htmlFor={`ed-t-${p.id}`} className="label">Position name</label>
                        <input id={`ed-t-${p.id}`} className="input" value={titleOf(p)} onChange={(e) => edit(p, { title: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="field">
                        <label htmlFor={`ed-r-${p.id}`} className="label">Reference number</label>
                        <input id={`ed-r-${p.id}`} className="input" value={refOf(p)} onChange={(e) => edit(p, { ref: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="field">
                        <label htmlFor={`ed-d-${p.id}`} className="label">Department</label>
                        <input id={`ed-d-${p.id}`} className="input" value={deptOf(p)} onChange={(e) => edit(p, { department: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="actions wrap">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>Done</button>
                        {overrides[p.id] && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const { [p.id]: _x, ...rest } = overrides; setOverrides(rest); }}>Reset to what the circular says</button>}
                      </div>
                    </div>
                  )}
                  <p className="post-meta">
                    <span className={isClosedPost ? 'tag tag-closed' : 'tag'}>{isClosedPost ? 'Closed' : 'Closes'} {fmtDate(p.closing)}</span>
                    {p.salary && <span className="muted"> · {p.salary}</span>}
                  </p>
                  {canEmail(p) ? (
                    <p className="post-meta">Email: <span className="mono">{p.email}</span></p>
                  ) : (
                    <p className="post-meta"><span className="tag tag-new">Not by email</span> {p.applyNote}</p>
                  )}
                </div>
                {analysis && !isClosedPost && <ScoreRing score={r.score} status={r.status} />}
              </div>
              <div className="post-bar">
                {analysis && !isClosedPost ? <StatusBadge status={r.status} /> : <span />}
                <span className="post-actions">
                  <button type="button" className="btn btn-ghost btn-sm" aria-expanded={!!reqOpen[p.id]} aria-controls={`req-${p.id}`} onClick={() => setReqOpen({ ...reqOpen, [p.id]: !reqOpen[p.id] })}>
                    Requirements <ChevronDown size={16} aria-hidden className={reqOpen[p.id] ? 'flip' : ''} />
                  </button>
                  {analysis && !isClosedPost && (
                    <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isOpen} aria-controls={`why-${p.id}`} onClick={() => setOpen({ ...open, [p.id]: !isOpen })}>
                      Why this score <ChevronDown size={16} aria-hidden className={isOpen ? 'flip' : ''} />
                    </button>
                  )}
                </span>
              </div>
              {reqOpen[p.id] && (
                <div id={`req-${p.id}`} className="why reqpanel">
                  <h3>Requirements (as written in the circular)</h3>
                  {p.requirements ? (
                    toParagraphs(p.requirements).map((t, i) => (
                      <p key={i} className={/^Job[\s-]*related/i.test(t) ? 'req-head' : undefined}>{t}</p>
                    ))
                  ) : (
                    <p className="muted">We could not pick the requirements out of this post. Please read the full post text below.</p>
                  )}
                  <details className="fulltext" open={!p.requirements}>
                    <summary>Full post text from the circular</summary>
                    {toParagraphs(p.raw).map((t, i) => (
                      <p key={i}>{t}</p>
                    ))}
                  </details>
                  <p className="hint">Always check the circular itself. Our text is read automatically and may be incomplete.</p>
                </div>
              )}
              {analysis && isOpen && !isClosedPost && (
                <div id={`why-${p.id}`} className="why">
                  {r.items.length === 0 && <p>We could not read the requirements for this post. Please read the circular yourself.</p>}
                  {groups.map(([h, list]) =>
                    list.length ? (
                      <div key={h}>
                        <h3>{h}</h3>
                        <ul>
                          {list.map((i) => (
                            <li key={i.req.id}>
                              <OutcomeBadge outcome={i.outcome} />
                              <p><strong>{i.req.text}</strong></p>
                              {i.evidence && <p className="muted">{i.evidence}</p>}
                              {i.advice && <p className="advice">{i.advice}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                  {soft.length > 0 && (
                    <div>
                      <h3>Job knowledge and skills: {softFound.length} of {soft.length} found in your CV</h3>
                      {softFound.length > 0 && <ChipList label="Found" items={softFound.map((i) => i.req.text)} cls="strong" />}
                      {softPartial.length > 0 && <ChipList label="Partly found" items={softPartial.map((i) => i.req.text)} cls="partial" />}
                      {softMissing.length > 0 && (
                        <>
                          <ChipList label="Not found" items={softMissing.map((i) => i.req.text)} cls="low" />
                          <p className="advice">If you really have these, use the same words on your CV and give a short example of each.</p>
                        </>
                      )}
                    </div>
                  )}
                  <p className="hint">{DISCLAIMER}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {limit < shown.length && (
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>
        </div>
      )}

      <div className="actions sticky">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary btn-lg" disabled={selected.size === 0} onClick={onContinue}>
          Continue with {selected.size} post{selected.size === 1 ? '' : 's'}
        </button>
      </div>
    </section>
  );
}

function ChipList({ label, items, cls }: { label: string; items: string[]; cls: 'strong' | 'partial' | 'low' }) {
  const Icon = cls === 'strong' ? CheckCircle2 : cls === 'partial' ? CircleDot : XCircle;
  return (
    <div className="chiplist">
      <p className="chiplist-label"><Icon size={16} aria-hidden /> {label}</p>
      <ul className="chips">
        {items.map((t) => (
          <li key={t} className={`chip chip-${cls}`}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
