import { CheckCircle2, FileText, Files, Loader2, Upload as UploadIcon, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { Notice, PrivacyNote } from './ui';

interface Slot {
  id: string;
  icon: 'circular' | 'cv';
  title: string;
  help: string;
  file: File | null;
  onFile: (f: File | null) => void;
}

function DropSlot({ id, icon, title, help, file, onFile }: Slot) {
  const Icon = file ? CheckCircle2 : icon === 'cv' ? UserRound : Files;
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
      <span className="slot-icon" aria-hidden><Icon size={28} /></span>
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
        <UploadIcon size={18} aria-hidden /> {file ? 'Change PDF' : 'Choose PDF'}
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
  const ready = !!circular && !!cv;
  return (
    <section aria-labelledby="up-h">
      <div className="hero">
        <h1 id="up-h">Find the government jobs that fit you</h1>
        <p className="lead">Add the vacancy circular and your CV. We check every post for you, then fill in a Z83 for each job you pick.</p>
        <PrivacyNote />
      </div>
      <ol className="how" aria-label="How it works">
        <li><span className="how-num" aria-hidden>1</span><div><strong>Add two PDFs</strong><span className="t">The circular and your CV.</span></div></li>
        <li><span className="how-num" aria-hidden>2</span><div><strong>Pick your posts</strong><span className="t">See which jobs match you.</span></div></li>
        <li><span className="how-num" aria-hidden>3</span><div><strong>Download</strong><span className="t">A Z83 + CV, ready to email.</span></div></li>
      </ol>
      <div className="slots">
        <DropSlot id="circ" icon="circular" title="1. Vacancy circular" help="The DPSA Public Service Vacancy Circular (PDF), published on Fridays." file={circular} onFile={setCircular} />
        <DropSlot id="cv" icon="cv" title="2. Your CV" help="A PDF saved from Word, Google Docs or your phone. Not a photo or scan." file={cv} onFile={setCv} />
      </div>
      <details className="help">
        <summary>Need help with these files?</summary>
        <p><strong>Where do I get the circular?</strong> Search for “DPSA Public Service Vacancy Circular” and download this week’s PDF to your phone or computer.</p>
        <p><strong>My CV is a Word file or a photo.</strong> Open it in Word or Google Docs and choose “Download as PDF” (or “Print”, then “Save as PDF”). Photos and scans cannot be read.</p>
        <p><strong>Is my CV safe?</strong> Yes. Everything is read on your own device. Nothing is uploaded or stored on a server.</p>
      </details>
      {closedAll && (
        <Notice kind="warn" role="alert" title="This circular has closed">
          All the posts in this circular have passed their closing date. Please add a newer circular.
        </Notice>
      )}
      {error && (
        <Notice kind="error" role="alert" title={error.title}>
          {error.text}
        </Notice>
      )}
      <div className="upload-cta">
        <button type="button" className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={onAnalyze}>
          {busy ? <><Loader2 size={20} className="spin" aria-hidden /> Reading your files…</> : 'Find my matches'}
        </button>
        {!ready && <p className="hint">{!circular && !cv ? 'Add both PDFs to continue.' : !circular ? 'Now add the vacancy circular.' : 'Now add your CV.'}</p>}
      </div>
      <aside className="about" aria-labelledby="about-h">
        <h2 id="about-h">Why I made this</h2>
        <p>
          Applying for government jobs is frustrating. The same Z83, the same CV, the same details, again and again for every post, and it is hard to know which posts really suit you.
          I made this app to make that a bit easier. I am still improving it.
        </p>
        <p className="about-by">Made by Mduduzi Gwija</p>
      </aside>
    </section>
  );
}
