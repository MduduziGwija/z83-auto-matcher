import { useCallback, useMemo, useRef, useState } from 'react';
import Download from './components/Download';
import ProfileForm from './components/ProfileForm';
import Results from './components/Results';
import Upload from './components/Upload';
import { Stepper } from './components/ui';
import { isClosed, parseCircular } from './lib/circular';
import { parseCv } from './lib/cv';
import { matchPost } from './lib/match';
import { PdfReadError, extractText } from './lib/pdfText';
import { FilledFrom, clearProfile, emptyProfile, loadProfile, mergeCv, saveProfile, validateProfile } from './lib/profile';
import type { CircularInfo, CvInfo, MatchResult, Profile } from './lib/types';

export default function App() {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [circularFile, setCircularFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [closedAll, setClosedAll] = useState(false);
  const [circular, setCircular] = useState<CircularInfo | null>(null);
  const [cv, setCv] = useState<CvInfo | null>(null);
  const cvBytes = useRef<ArrayBuffer | null>(null);
  const [results, setResults] = useState<Record<string, MatchResult>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [department, setDepartment] = useState('');
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [from, setFrom] = useState<FilledFrom>({});
  const [errors, setErrors] = useState<ReturnType<typeof validateProfile>>([]);

  const go = useCallback((n: number) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  }, []);

  const runMatch = useCallback((c: CircularInfo, v: CvInfo) => {
    const r: Record<string, MatchResult> = {};
    c.posts.forEach((p) => (r[p.id] = matchPost(p, v)));
    setResults(r);
  }, []);

  const analyze = async () => {
    if (!circularFile || !cvFile) return;
    setBusy(true);
    setError(null);
    setClosedAll(false);
    try {
      const [cBytes, vBytes] = await Promise.all([circularFile.arrayBuffer(), cvFile.arrayBuffer()]);
      let circText: string;
      let cvText: string;
      try {
        circText = (await extractText(cBytes)).text;
      } catch (e) {
        throw wrap(e, 'circular');
      }
      try {
        cvText = (await extractText(vBytes)).text;
      } catch (e) {
        throw wrap(e, 'CV');
      }
      const c = parseCircular(circText);
      if (c.posts.length === 0) {
        setError({ title: 'No posts found', text: 'We could not find any posts (reference numbers) in this circular. Make sure you uploaded the DPSA vacancy circular, not another document.' });
        return;
      }
      const now = new Date();
      if (c.posts.every((p) => isClosed(p, now))) {
        setClosedAll(true);
        return;
      }
      const v = parseCv(cvText);
      cvBytes.current = vBytes;
      setCircular(c);
      setCv(v);
      setDepartment(c.department);
      runMatch(c, v);
      setSelected(new Set());
      const m = mergeCv(loadProfile(), v);
      setProfile(m.profile);
      setFrom(m.from);
      setMaxStep(1);
      go(1);
    } catch (e) {
      if (e && typeof e === 'object' && 'title' in e) setError(e as { title: string; text: string });
      else setError({ title: 'Something went wrong', text: 'We could not read these files. Please try again, or try different PDFs.' });
    } finally {
      setBusy(false);
    }
  };

  const posts = useMemo(() => (circular ? circular.posts.filter((p) => selected.has(p.id)) : []), [circular, selected]);

  const toDownload = () => {
    const e = validateProfile(profile);
    setErrors(e);
    if (e.length) return;
    saveProfile(profile);
    go(3);
  };

  return (
    <div className="app">
      <header className="top">
        <div className="wrap">
          <span className="brand">Z83 Auto-Matcher</span>
          <Stepper step={step} onGo={go} maxStep={maxStep} />
        </div>
      </header>
      <main className="wrap main" id="main">
        {step === 0 && <Upload circular={circularFile} cv={cvFile} setCircular={setCircularFile} setCv={setCvFile} busy={busy} error={error} closedAll={closedAll} onAnalyze={analyze} />}
        {step === 1 && circular && cv && (
          <Results
            circular={circular}
            cv={cv}
            results={results}
            selected={selected}
            setSelected={setSelected}
            department={department}
            setDepartment={setDepartment}
            rematch={() => runMatch(circular, cv)}
            onBack={() => go(0)}
            onContinue={() => go(2)}
          />
        )}
        {step === 2 && cv && (
          <ProfileForm
            profile={profile}
            setProfile={setProfile}
            from={from}
            cv={cv}
            errors={errors}
            onBack={() => go(1)}
            onContinue={toDownload}
            onClear={() => {
              clearProfile();
              setProfile(mergeCv(emptyProfile(), cv).profile);
              setFrom(mergeCv(emptyProfile(), cv).from);
            }}
          />
        )}
        {step === 3 && circular && cv && cvBytes.current && (
          <Download circular={circular} posts={posts} profile={profile} department={department} cvBytes={cvBytes.current} hasReferences={cv.hasReferences} onBack={() => go(2)} />
        )}
      </main>
      <footer className="foot wrap">
        <p>Made to help applicants. Always check the circular and the Z83 yourself. Nothing is uploaded: all work happens in your browser.</p>
      </footer>
    </div>
  );
}

function wrap(e: unknown, what: string) {
  if (e instanceof PdfReadError) {
    if (e.code === 'scanned')
      return { title: `Your ${what} has no readable text`, text: `It looks like a photo or scan. Please upload a PDF saved from Word or Google Docs (or “Print to PDF”), so the text can be read.` };
    if (e.code === 'password') return { title: `Your ${what} is password protected`, text: 'Remove the password and upload it again.' };
  }
  return { title: `We could not open your ${what}`, text: 'The file may be damaged. Try saving it as a new PDF and upload it again.' };
}
