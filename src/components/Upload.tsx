import { FileText, Loader2, Upload as UploadIcon } from 'lucide-react';
import { useRef } from 'react';
import { Notice, PrivacyNote } from './ui';

interface Slot {
  id: string;
  title: string;
  help: string;
  file: File | null;
  onFile: (f: File | null) => void;
}

function DropSlot({ id, title, help, file, onFile }: Slot) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`slot ${file ? 'slot-filled' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <h2 className="slot-title" id={`${id}-t`}>{title}</h2>
      <p className="hint">{help}</p>
      <input
        ref={input}
        id={id}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        aria-labelledby={`${id}-t`}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <label htmlFor={id} className="btn btn-secondary">
        <UploadIcon size={18} aria-hidden /> {file ? 'Choose a different PDF' : 'Choose PDF'}
      </label>
      {file && (
        <p className="slot-file" aria-live="polite">
          <FileText size={18} aria-hidden /> <span>{file.name}</span> <span className="muted">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
        </p>
      )}
    </div>
  );
}

interface Props {
  circular: File | null;
  cv: File | null;
  setCircular: (f: File | null) => void;
  setCv: (f: File | null) => void;
  busy: boolean;
  error: { title: string; text: string } | null;
  closedAll: boolean;
  onAnalyze: () => void;
}

export default function Upload({ circular, cv, setCircular, setCv, busy, error, closedAll, onAnalyze }: Props) {
  return (
    <section aria-labelledby="up-h">
      <h1 id="up-h">Find posts that fit your CV</h1>
      <p className="lead">Upload this week’s DPSA vacancy circular and your CV. We will check every post, then prepare a Z83 + CV PDF for each one you pick.</p>
      <PrivacyNote />
      <div className="slots">
        <DropSlot id="circ" title="1. Vacancy circular (PDF)" help="The DPSA circular, published on Fridays." file={circular} onFile={setCircular} />
        <DropSlot id="cv" title="2. Your CV (PDF)" help="Use a PDF made on a computer or phone, not a photo or scan." file={cv} onFile={setCv} />
      </div>
      {closedAll && (
        <Notice kind="warn" role="alert" title="Circular closed">
          This circular appears to have closed posts. Please upload a newer circular.
        </Notice>
      )}
      {error && (
        <Notice kind="error" role="alert" title={error.title}>
          {error.text}
        </Notice>
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={!circular || !cv || busy} onClick={onAnalyze}>
          {busy ? <><Loader2 size={20} className="spin" aria-hidden /> Reading your files…</> : 'Analyze My Matches'}
        </button>
        {(!circular || !cv) && <p className="hint">Add both PDFs to continue.</p>}
      </div>
    </section>
  );
}
