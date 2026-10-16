import { CheckCircle2, ChevronDown, CircleDot, Plus, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { fmtDate, isClosed } from '../lib/circular';
import { DISCLAIMER, allGroups, loadExtraGroups, saveExtraGroups } from '../lib/match';
import type { CircularInfo, CvInfo, MatchResult } from '../lib/types';
import { Notice, OutcomeBadge, PrivacyNote, ScoreRing, StatusBadge } from './ui';

interface Props {
  circular: CircularInfo;
  cv: CvInfo;
  results: Record<string, MatchResult>;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  department: string;
  setDepartment: (s: string) => void;
  rematch: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function Results({ circular, cv, results, selected, setSelected, department, setDepartment, rematch, onBack, onContinue }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState(loadExtraGroups());
  const [pair, setPair] = useState('');
  const now = new Date();
  const openPosts = circular.posts.filter((p) => !isClosed(p, now));
  const sorted = [...circular.posts].sort((a, b) => Number(isClosed(a, now)) - Number(isClosed(b, now)) || results[b.id].score - results[a.id].score);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
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

  return (
    <section aria-labelledby="res-h">
      <h1 id="res-h">Your matches</h1>
      <p className="lead">
        {circular.posts.length} post{circular.posts.length === 1 ? '' : 's'} found, {openPosts.length} still open. Pick any posts you want to apply for. A low score never blocks you.
      </p>
      <PrivacyNote />
      <Notice kind="info" title="About these scores">{DISCLAIMER}</Notice>

      {cv.gaps.length > 0 && (
        <Notice kind="warn" title="Things to check on your CV">
          <ul className="plain">
            {cv.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="field">
        <label htmlFor="dept" className="label">Department that advertised the posts</label>
        <input id="dept" className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Department of Agriculture" autoComplete="off" />
        <p className="hint">Printed on every Z83. {department ? 'Please check it is correct.' : 'We could not find it in the circular — type it in.'}</p>
      </div>

      <details className="equiv">
        <summary>Qualification equivalency list</summary>
        <p className="hint">Fields the system treats as interchangeable (for example Public Administration = Public Management). Add your own pairs. They are saved on this device. {DISCLAIMER}</p>
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

      <div className="bulk">
        <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set(openPosts.filter((p) => results[p.id].status !== 'low').map((p) => p.id)))}>Select matches</button>
        <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set(openPosts.map((p) => p.id)))}>Select all open</button>
        <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
      </div>

      <ul className="posts">
        {sorted.map((p) => {
          const r = results[p.id];
          const closed = isClosed(p, now);
          const isOpen = !!open[p.id];
          const hard = r.items.filter((i) => i.req.kind === 'qualification' || i.req.kind === 'experience' || i.req.kind === 'licence');
          const soft = r.items.filter((i) => i.req.kind === 'knowledge' || i.req.kind === 'skill');
          const direct = hard.filter((i) => i.outcome === 'direct');
          const equiv = hard.filter((i) => i.outcome === 'equivalent');
          const partial = hard.filter((i) => i.outcome === 'partial');
          const missing = hard.filter((i) => i.outcome === 'missing');
          const softFound = soft.filter((i) => i.outcome === 'direct' || i.outcome === 'equivalent');
          const softPartial = soft.filter((i) => i.outcome === 'partial');
          const softMissing = soft.filter((i) => i.outcome === 'missing');
          return (
            <li key={p.id} className={`post ${closed ? 'post-closed' : ''}`}>
              <div className="post-top">
                <input id={`sel-${p.id}`} type="checkbox" className="check" checked={selected.has(p.id)} disabled={closed} onChange={() => toggle(p.id)} aria-describedby={`d-${p.id}`} />
                <div className="post-main">
                  <label htmlFor={`sel-${p.id}`} className="post-title">{p.title}</label>
                  <p className="post-meta" id={`d-${p.id}`}>
                    Ref {p.ref}
                    {p.directorate && <> · {p.directorate}</>}
                    {p.level && <> · Level {p.level}</>}
                    {p.location && <> · {p.location}</>}
                  </p>
                  <p className="post-meta">
                    <span className={closed ? 'tag tag-closed' : 'tag'}>{closed ? 'Closed' : 'Closes'} {fmtDate(p.closing)}</span>
                    {p.salary && <span className="muted"> · {p.salary}</span>}
                  </p>
                </div>
                {!closed && <ScoreRing score={r.score} status={r.status} />}
              </div>
              {!closed && (
                <div className="post-bar">
                  <StatusBadge status={r.status} />
                  <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isOpen} aria-controls={`why-${p.id}`} onClick={() => setOpen({ ...open, [p.id]: !isOpen })}>
                    Why this score <ChevronDown size={16} aria-hidden className={isOpen ? 'flip' : ''} />
                  </button>
                </div>
              )}
              {isOpen && !closed && (
                <div id={`why-${p.id}`} className="why">
                  {r.items.length === 0 && <p>We could not read the requirements for this post. Please read the circular yourself.</p>}
                  {([['Matched directly', direct], ['Matched via equivalency', equiv], ['Partly matched', partial], ['Missing: add to your CV', missing]] as const).map(([h, list]) =>
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
