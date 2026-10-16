import { AlertTriangle, CheckCircle2, CircleDot, Info, Lock, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MatchResult, Outcome } from '../lib/types';
import type { Source } from '../lib/profile';

export const STEPS = ['Upload', 'Results', 'Profile', 'Download'] as const;

export function Stepper({ step, onGo, maxStep }: { step: number; onGo: (n: number) => void; maxStep: number }) {
  return (
    <nav aria-label="Progress" className="stepper">
      <ol>
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          const can = i <= maxStep && i !== step;
          return (
            <li key={s} className={`step step-${state}`} aria-current={i === step ? 'step' : undefined}>
              <button type="button" disabled={!can} onClick={() => onGo(i)} className="step-btn">
                <span className="step-dot" aria-hidden>{state === 'done' ? '✓' : i + 1}</span>
                <span className="step-label">{s}</span>
                <span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PrivacyNote() {
  return (
    <p className="privacy">
      <Lock size={16} aria-hidden /> Your documents never leave your device.
    </p>
  );
}

export function Notice({ kind = 'info', title, children, role }: { kind?: 'info' | 'warn' | 'error' | 'ok'; title?: string; children: ReactNode; role?: 'alert' | 'status' }) {
  const Icon = kind === 'error' ? XCircle : kind === 'warn' ? AlertTriangle : kind === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`notice notice-${kind}`} role={role}>
      <Icon size={20} aria-hidden className="notice-icon" />
      <div>
        {title && <strong className="notice-title">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function ScoreRing({ score, status }: { score: number; status: MatchResult['status'] }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ring-${status}`} role="img" aria-label={`Match score ${score} percent`}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="ring-bg" />
        <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span className="ring-num">{score}%</span>
    </div>
  );
}

const STATUS_TEXT = { strong: 'Strong match', partial: 'Partial match', low: 'Missing requirements' } as const;

export function StatusBadge({ status }: { status: MatchResult['status'] }) {
  const Icon = status === 'strong' ? CheckCircle2 : status === 'partial' ? CircleDot : AlertTriangle;
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={16} aria-hidden /> {STATUS_TEXT[status]}
    </span>
  );
}

const OUTCOME_TEXT: Record<Outcome, string> = { direct: 'Matched', equivalent: 'Matched via equivalency', partial: 'Partly matched', missing: 'Missing' };

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const Icon = outcome === 'direct' ? CheckCircle2 : outcome === 'equivalent' ? CheckCircle2 : outcome === 'partial' ? CircleDot : XCircle;
  const cls = outcome === 'direct' ? 'strong' : outcome === 'equivalent' ? 'equiv' : outcome === 'partial' ? 'partial' : 'low';
  return (
    <span className={`badge badge-${cls}`}>
      <Icon size={16} aria-hidden /> {OUTCOME_TEXT[outcome]}
    </span>
  );
}

export function SourceTag({ from }: { from?: Source }) {
  if (from === 'cv') return <span className="tag tag-cv">From your CV: please check</span>;
  if (from === 'saved') return <span className="tag tag-saved">Saved from last time</span>;
  return <span className="tag tag-new">Please fill in</span>;
}
