import { CheckCircle2, ChevronDown, CircleDot, Pencil, Plus, Search, X, XCircle } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { fmtDate, isClosed } from '../lib/circular';
import { DISCLAIMER, allGroups, loadExtraGroups, saveExtraGroups } from '../lib/match';
import type { CircularInfo, CvInfo, MatchResult, Post } from '../lib/types';
import { Notice, OutcomeBadge, PrivacyNote, ScoreRing, StatusBadge } from './ui';

interface Props {
  circular: CircularInfo;
  cv: CvInfo;
  results: Record<string, MatchResult>;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  deptOverride: Record<string, string>;
  setDeptOverride: (m: Record<string, string>) => void;
  rematch: () => void;
  onBack: () => void;
  onContinue: () => void;
}

type Filter = 'all' | 'strong' | 'partial' | 'low' | 'selected';
const PAGE = 30;

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

export default function Results({ circular, cv, results, selected, setSelected, deptOverride, setDeptOverride, rematch, onBack, onContinue }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [extra, setExtra] = useState(loadExtraGroups());
  const [pair, setPair] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dept, setDept] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const now = new Date();

  const deptOf = (p: Post) => deptOverride[p.id] ?? (p.department || circular.department);
  const closed = (p: Post) => isClosed(p, now);
  const canEmail = (p: Post) => p.applyBy === 'email';
  const selectable = (p: Post) => !closed(p) && canEmail(p);

  const hiddenCount = circular.posts.filter((p) => !closed(p) && !canEmail(p)).length;
  const departments = useMemo(() => [...new Set(circular.posts.map(deptOf).filter(Boolean))].sort(), [circular, deptOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return circular.posts
      .filter((p) => (showHidden ? true : canEmail(p)))
      .filter((p) => !dept || deptOf(p) === dept)
      .filter((p) => (filter === 'all' ? true : filter === 'selected' ? selected.has(p.id) : results[p.id].status === filter))
      .filter((p) => {
        if (!words.length) return true;
        const hay = `${p.title} ${p.ref} ${deptOf(p)} ${p.directorate} ${p.location} ${p.level}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(closed(a)) - Number(closed(b)) || Number(canEmail(b)) - Number(canEmail(a)) || results[b.id].score - results[a.id].score);
  }, [circular, q, filter, dept, showHidden, selected, results, deptOverride]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {circular.posts.length} post{circular.posts.length === 1 ? '' : 's'} found. {emailable} can be applied for by email{hiddenCount > 0 ? `, and ${hiddenCount} are hidden because they need online or other applications` : ''}. Pick any posts you want to apply for. A low score never blocks you.
      </p>
      <PrivacyNote />
      <Notice kind="warn" title="This matcher can be wrong">{DISCLAIMER}</Notice>

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
        <div className="choice-row" role="group" aria-label="Filter by match">
          {([['all', 'All'], ['strong', 'Strong'], ['partial', 'Partial'], ['low', 'Missing requirements'], ['selected', 'Selected']] as [Filter, string][]).map(([f, l]) => (
            <button key={f} type="button" className={`pill ${filter === f ? 'pill-on' : ''}`} aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }}>
              {l} <span className="count">{f === 'all' ? shown.length : counts[f]}</span>
            </button>
          ))}
        </div>
        {departments.length > 1 && (
          <div className="field">
            <label htmlFor="deptf" className="label">Department</label>
            <select id="deptf" className="input" value={dept} onChange={(e) => { setDept(e.target.value); setLimit(PAGE); }}>
              <option value="">All departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
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
                  <label htmlFor={`sel-${p.id}`} className="post-title"><Mark text={p.title} q={q} /></label>
                  <p className="post-meta" id={`d-${p.id}`}>
                    Ref <Mark text={p.ref} q={q} />
                    {p.directorate && <> · {p.directorate}</>}
                    {p.level && <> · Level {p.level}</>}
                    {p.location && <> · {p.location}</>}
                  </p>
                  <p className="post-meta">
                    {editing === p.id ? (
                      <span className="row">
                        <label htmlFor={`dep-${p.id}`} className="sr-only">Department for this post</label>
                        <input id={`dep-${p.id}`} className="input" autoFocus value={deptOf(p)} onChange={(e) => setDeptOverride({ ...deptOverride, [p.id]: e.target.value })} onBlur={() => setEditing(null)} onKeyDown={(e) => e.key === 'Enter' && setEditing(null)} />
                      </span>
                    ) : (
                      <>
                        <span className="dept"><Mark text={deptOf(p) || 'Department not found'} q={q} /></span>{' '}
                        <button type="button" className="btn btn-link btn-inline" onClick={() => setEditing(p.id)} aria-label={`Edit department for ${p.title}`}><Pencil size={14} aria-hidden /> Edit</button>
                      </>
                    )}
                  </p>
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
                {!isClosedPost && <ScoreRing score={r.score} status={r.status} />}
              </div>
              {!isClosedPost && (
                <div className="post-bar">
                  <StatusBadge status={r.status} />
                  <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isOpen} aria-controls={`why-${p.id}`} onClick={() => setOpen({ ...open, [p.id]: !isOpen })}>
                    Why this score <ChevronDown size={16} aria-hidden className={isOpen ? 'flip' : ''} />
                  </button>
                </div>
              )}
              {isOpen && !isClosedPost && (
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
