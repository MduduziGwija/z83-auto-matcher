import JSZip from 'jszip';
import { CheckCircle2, Copy, Download as DownloadIcon, Eye, Loader2, Mail, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate, titleProblem } from '../lib/circular';
import { NameStyle, emailSubject, pdfName, uniqueNames } from '../lib/filename';
import type { CircularInfo, Post, Profile } from '../lib/types';
import { buildApplicationPdf } from '../lib/z83';
import { PackItem, buildDetailsText, buildEmailBody, gmailLink, mailtoLink } from '../lib/emailText';
import { Notice, PrivacyNote } from './ui';

interface Built {
  post: Post;
  bytes?: Uint8Array;
  error?: string;
}

interface Props {
  circular: CircularInfo;
  posts: Post[];
  profile: Profile;
  cvBytes: ArrayBuffer;
  hasReferences: boolean;
  onBack: () => void;
  onEdit: () => void;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

/** One-tap email: the phone's share sheet attaches the PDF; on a computer we download it and open a ready draft. */
function SendBox({ to, subject, body, fileName, bytes, onDownload, copied, copy, id }: { to: string; subject: string; body: string; fileName: string; bytes: Uint8Array; onDownload: () => void; copied: string; copy: (what: string, text: string) => void; id: string }) {
  const [note, setNote] = useState('');
  const shareMode = useMemo(() => {
    try {
      const probe = new File([new Blob(['x'])], 'a.pdf', { type: 'application/pdf' });
      return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }) && window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }, []);

  const send = async () => {
    setNote('');
    if (shareMode) {
      try {
        const file = new File([bytes as BlobPart], fileName, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: subject, text: body });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setNote('Your phone could not open the share list. Use “Download merged PDF” above, then the copy buttons below.');
      }
      return;
    }
    onDownload();
    window.location.href = mailtoLink(to, subject, body);
    setNote(`Your PDF was saved as “${fileName}”. In the email that opened, attach it from your Downloads folder.`);
  };

  const Row = ({ k, label, value, show }: { k: string; label: string; value: string; show?: string }) => (
    <div className="copyrow">
      <div className="copyrow-text">
        <span className="copyrow-label">{label}</span>
        <span className="copyrow-value">{show ?? value}</span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(`${id}-${k}`, value)} aria-label={`Copy ${label.toLowerCase()}`}>
        <Copy size={16} aria-hidden /> {copied === `${id}-${k}` ? 'Copied' : 'Copy'}
      </button>
    </div>
  );

  return (
    <div className="send">
      <h3 className="send-title"><Send size={18} aria-hidden /> Send this application</h3>
      <ol className="send-steps">
        {shareMode ? (
          <>
            <li>Tap the green button. Your phone shows its share list: choose <strong>Gmail</strong> or your email app. The PDF, subject and message are filled in for you.</li>
            <li>In the <strong>To</strong> box, paste the address (tap <strong>Copy</strong> next to it first).</li>
            <li>Check it, then press <strong>Send</strong>.</li>
          </>
        ) : (
          <>
            <li>Click the green button. Your PDF downloads and an email opens with the address, subject and message filled in.</li>
            <li>Attach the PDF called <strong>{fileName}</strong> from your Downloads folder.</li>
            <li>Check it, then press <strong>Send</strong>.</li>
          </>
        )}
      </ol>
      {to ? <Row k="to" label="Send to" value={to} /> : <p className="hint">No email address was found for this post. Check the circular for where to send it.</p>}
      <button type="button" className="btn btn-accent btn-lg send-go" onClick={send}>
        <Mail size={20} aria-hidden /> {shareMode ? 'Share PDF to my email app' : 'Open email draft and download PDF'}
      </button>
      {note && <p className="status send-note" role="status">{note}</p>}
      <details className="send-more">
        <summary>Copy each part yourself</summary>
        <Row k="subject" label="Subject" value={subject} />
        <Row k="body" label="Message" value={body} show="Short message for the email body" />
        <Row k="file" label="File to attach" value={fileName} />
        {to && <p className="hint"><a href={gmailLink(to, subject, body)} target="_blank" rel="noreferrer">Open this draft in Gmail on the web</a> (you still attach the PDF).</p>}
      </details>
    </div>
  );
}

export default function Download({ circular, posts, profile, cvBytes, hasReferences, onBack, onEdit }: Props) {
  const [built, setBuilt] = useState<Built[]>([]);
  const [busy, setBusy] = useState(true);
  const [style, setStyle] = useState<NameStyle>('ref-title');
  const [copied, setCopied] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const run = useRef(0);
  const maxMb = circular.maxSizeMb ?? 10;

  useEffect(() => {
    const id = ++run.current;
    (async () => {
      setBusy(true);
      const out: Built[] = [];
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}Z83.pdf`);
        if (!res.ok) throw new Error('The Z83 template could not be loaded.');
        const tpl = await res.arrayBuffer();
        for (const post of posts) {
          try {
            const r = await buildApplicationPdf(tpl, cvBytes, { post, department: post.department, profile });
            out.push({ post, bytes: r.bytes });
          } catch (e) {
            out.push({ post, error: e instanceof Error ? e.message : 'Could not build this PDF.' });
          }
        }
      } catch (e) {
        posts.forEach((post) => out.push({ post, error: e instanceof Error ? e.message : 'Could not build this PDF.' }));
      }
      if (run.current === id) {
        setBuilt(out);
        setBusy(false);
      }
    })();
  }, [posts, profile, cvBytes]);

  const names = uniqueNames(built.map((b) => pdfName(b.post.ref, b.post.title, style)));
  const ok = built.filter((b) => b.bytes);

  const asBlob = (b: Built) => new Blob([b.bytes as BlobPart], { type: 'application/pdf' });
  const items: PackItem[] = built.map((b, i) => ({ post: b.post, fileName: names[i], subject: emailSubject(b.post.ref, b.post.title), to: b.post.email }));
  const detailsText = () => buildDetailsText(profile, items.filter((_, i) => built[i].bytes));
  const DETAILS_NAME = 'Email details (copy and paste).txt';
  const saveText = () => save(new Blob([detailsText()], { type: 'text/plain;charset=utf-8' }), DETAILS_NAME);
  const zipAll = async () => {
    const zip = new JSZip();
    built.forEach((b, i) => b.bytes && zip.file(names[i], b.bytes));
    zip.file(DETAILS_NAME, detailsText());
    const blob = await zip.generateAsync({ type: 'blob' });
    save(blob, `Z83 applications - ${new Date().toISOString().slice(0, 10)}.zip`);
  };
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  return (
    <section aria-labelledby="dl-h">
      <h1 id="dl-h">Your application packs</h1>
      <p className="lead">One PDF per post: Z83 first, then your CV. Check each one before you send it.</p>
      <PrivacyNote />

      {!hasReferences && profile.references.length === 0 && (
        <Notice kind="warn" title="No references on your CV">
          Please update your CV with at least 3 referees. The packs below still work, but the references section of the Z83 is blank.
        </Notice>
      )}
      <Notice kind="info" title="Before you send">
        Open each PDF and check the Z83 (especially the declarations and the post title and reference number). Send one separate email per post. You press Send yourself: we never send anything for you.
      </Notice>

      <fieldset className="choice naming">
        <legend className="label">PDF file names</legend>
        <div className="choice-row">
          {([['ref-title', 'Reference + post name'], ['ref', 'Reference only'], ['title', 'Post name only']] as [NameStyle, string][]).map(([v, l]) => (
            <label key={v} className={`pill ${style === v ? 'pill-on' : ''}`}>
              <input type="radio" name="naming" checked={style === v} onChange={() => setStyle(v)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {busy && <p className="status" role="status"><Loader2 className="spin" size={20} aria-hidden /> Preparing your PDFs…</p>}

      <ul className="packs">
        {built.map((b, i) => {
          const size = b.bytes?.byteLength ?? 0;
          const to = b.post.email || circular.emails[0] || '';
          const subject = emailSubject(b.post.ref, b.post.title);
          return (
            <li key={b.post.id} className={`pack ${sent.has(b.post.id) ? 'pack-sent' : ''}`}>
              <h2 className="pack-title">{sent.has(b.post.id) && <CheckCircle2 size={22} className="sent-icon" aria-label="Sent" />} {b.post.title}</h2>
              <dl className="printed">
                <dt>Printed on the Z83</dt>
                <dd><strong>Position:</strong> {b.post.title}</dd>
                <dd><strong>Reference:</strong> {b.post.ref}</dd>
                <dd><strong>Department:</strong> {b.post.department || '(none)'}</dd>
              </dl>
              {(titleProblem(b.post.title, b.post.ref) || !b.post.department) && (
                <Notice kind="warn" title="Please check this before you send">
                  {titleProblem(b.post.title, b.post.ref) || 'The department is empty.'}{' '}
                  <button type="button" className="btn btn-link btn-inline" onClick={onEdit}>Go back and correct it</button>
                </Notice>
              )}
              <p className="post-meta">Closes {fmtDate(b.post.closing)}</p>
              {b.error ? (
                <Notice kind="error" role="alert" title="Could not build this PDF">{b.error} Check that your CV is a normal (not locked) PDF and try again.</Notice>
              ) : (
                <>
                  <p className="filename"><strong>File name:</strong> {names[i]} <span className="muted">({mb(size)} MB)</span></p>
                  {size > maxMb * 1024 * 1024 && (
                    <Notice kind="warn" title={`Larger than ${maxMb} MB`}>The circular allows PDFs up to {maxMb} MB. Please make your CV smaller (for example, “reduce file size”) and try again.</Notice>
                  )}
                  <div className="actions wrap">
                    <button type="button" className="btn btn-primary" onClick={() => save(asBlob(b), names[i])}><DownloadIcon size={18} aria-hidden /> Download merged PDF</button>
                    <button type="button" className="btn btn-secondary" onClick={() => window.open(URL.createObjectURL(asBlob(b)), '_blank')}><Eye size={18} aria-hidden /> Preview</button>
                  </div>
                  <SendBox
                    id={`p${i}`}
                    to={to}
                    subject={subject}
                    body={buildEmailBody(profile, b.post)}
                    fileName={names[i]}
                    bytes={b.bytes as Uint8Array}
                    onDownload={() => save(asBlob(b), names[i])}
                    copied={copied}
                    copy={copy}
                  />
                  <label className="checkline sentline">
                    <input type="checkbox" className="check" checked={sent.has(b.post.id)} onChange={(e) => setSent((prev) => { const n = new Set(prev); if (e.target.checked) n.add(b.post.id); else n.delete(b.post.id); return n; })} />
                    <span>I have sent this one</span>
                  </label>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card">
        <h2>Email details to copy and paste</h2>
        <p>A text file with the correct email address, subject line and a short message for each post, to copy and paste. It is also inside the ZIP.</p>
        <button type="button" className="btn btn-secondary" onClick={saveText} disabled={ok.length === 0}><DownloadIcon size={18} aria-hidden /> Download email details (.txt)</button>
      </div>

      {circular.subjectRule && <Notice kind="info" title="What the circular says about applying">{circular.subjectRule}</Notice>}

      <div className="actions sticky">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        {ok.length > 0 && (
          <button type="button" className="btn btn-primary btn-lg" onClick={zipAll}><DownloadIcon size={20} aria-hidden /> Download all as ZIP</button>
        )}
      </div>
    </section>
  );
}
