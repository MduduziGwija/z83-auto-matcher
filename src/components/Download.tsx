import JSZip from 'jszip';
import { Copy, Download as DownloadIcon, Eye, Loader2, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fmtDate, titleProblem } from '../lib/circular';
import { NameStyle, emailSubject, pdfName, uniqueNames } from '../lib/filename';
import type { CircularInfo, Post, Profile } from '../lib/types';
import { buildApplicationPdf } from '../lib/z83';
import { PackItem, buildDetailsText } from '../lib/emailText';
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

export default function Download({ circular, posts, profile, cvBytes, hasReferences, onBack, onEdit }: Props) {
  const [built, setBuilt] = useState<Built[]>([]);
  const [busy, setBusy] = useState(true);
  const [style, setStyle] = useState<NameStyle>('ref-title');
  const [copied, setCopied] = useState('');
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
        Open each PDF and check the Z83 (especially the declarations and the post title and reference number). Send one separate email per post. We do not send anything for you.
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
            <li key={b.post.id} className="pack">
              <h2 className="pack-title">{b.post.title}</h2>
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
                  <div className="mail">
                    <p><Mail size={16} aria-hidden /> <strong>Email it yourself</strong>{to ? <> to <span className="mono">{to}</span></> : ' to the address in the circular'}</p>
                    <div className="actions wrap">
                      {to && <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(`to${i}`, to)}><Copy size={16} aria-hidden /> {copied === `to${i}` ? 'Copied' : 'Copy address'}</button>}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(`s${i}`, subject)}><Copy size={16} aria-hidden /> {copied === `s${i}` ? 'Copied' : 'Copy subject line'}</button>
                      {to && <a className="btn btn-ghost btn-sm" href={`mailto:${to}?subject=${encodeURIComponent(subject)}`}>Open email app</a>}
                    </div>
                    <p className="hint">Suggested subject: {subject}. Attach this PDF yourself.</p>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card">
        <h2>Email details to copy and paste</h2>
        <p>A text file with your details, the correct email address, subject line and a short message for each post. It is also inside the ZIP.</p>
        <button type="button" className="btn btn-secondary" onClick={saveText} disabled={ok.length === 0}><DownloadIcon size={18} aria-hidden /> Download email details (.txt)</button>
      </div>

      {circular.subjectRule && <Notice kind="info" title="What the circular says about applying">{circular.subjectRule}</Notice>}

      <div className="actions sticky">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        {ok.length > 0 && (
          <button type="button" className="btn btn-primary btn-lg" onClick={zipAll}><DownloadIcon size={20} aria-hidden /> Download all as ZIP (PDFs + email details)</button>
        )}
      </div>
    </section>
  );
}
