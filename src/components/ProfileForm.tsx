import { Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { idDetails } from '../lib/cv';
import type { FilledFrom, Source } from '../lib/profile';
import type { CvInfo, Profile, YesNo } from '../lib/types';
import SignaturePad from './SignaturePad';
import { Notice, PrivacyNote, SourceTag } from './ui';

type Err = { field: keyof Profile; message: string }[];

interface Props {
  profile: Profile;
  setProfile: (p: Profile) => void;
  from: FilledFrom;
  cv: CvInfo;
  errors: Err;
  onBack: () => void;
  onContinue: () => void;
  onClear: () => void;
}

function Text({ id, label, value, onChange, from, error, hint, tag = true, inputMode, maxLength, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; from?: Source; error?: string; hint?: string; tag?: boolean;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text'; maxLength?: number; placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label} {tag && <SourceTag from={value ? from : undefined} />}</label>
      <input id={id} className={`input ${error ? 'input-error' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} autoComplete="off" />
      {hint && !error && <p className="hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="error" id={`${id}-e`}>{error}</p>}
    </div>
  );
}

function Choice<T extends string>({ name, legend, value, options, onChange, from, error, hint }: {
  name: string; legend: string; value: T | ''; options: [T, string][]; onChange: (v: T) => void; from?: Source; error?: string; hint?: string;
}) {
  return (
    <fieldset className={`choice ${error ? 'choice-error' : ''}`} id={name}>
      <legend className="label">{legend} {value && from && <SourceTag from={from} />}</legend>
      <div className="choice-row">
        {options.map(([v, l]) => (
          <label key={v} className={`pill ${value === v ? 'pill-on' : ''}`}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </fieldset>
  );
}

const YN: [YesNo & ('yes' | 'no'), string][] = [['yes', 'Yes'], ['no', 'No']];

export default function ProfileForm({ profile: p, setProfile, from, cv, errors, onBack, onContinue, onClear }: Props) {
  const summary = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile({ ...p, [k]: v });
  const err = (f: keyof Profile) => errors.find((e) => e.field === f)?.message;

  const onId = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 13);
    const d = idDetails(digits);
    setProfile({ ...p, idNumber: digits, dob: d && !p.dob ? d.dob : p.dob, gender: d ? d.gender : p.gender });
  };

  const yn = (k: keyof Profile, q: string, detailsKey?: keyof Profile, detailsLabel = 'Give details') => (
    <div className="qa" key={k}>
      <Choice name={String(k)} legend={q} value={p[k] as YesNo} options={YN} onChange={(v) => set(k, v as never)} from={from[k]} error={err(k)} />
      {detailsKey && p[k] === 'yes' && (
        <Text id={String(detailsKey)} label={detailsLabel} value={String(p[detailsKey])} onChange={(v) => set(detailsKey, v as never)} error={err(detailsKey)} tag={false} hint="Keep it short. The Z83 has a small box. You can attach more details to your CV." />
      )}
    </div>
  );

  const submit = () => {
    onContinue();
    setTimeout(() => summary.current?.focus(), 0);
  };

  return (
    <section aria-labelledby="pr-h">
      <h1 id="pr-h">Your Z83 details</h1>
      <p className="lead">You only do this once. We saved what we could from your CV. Check each answer, because you are declaring it to the Department.</p>
      <PrivacyNote />
      <p className="hint">Saved in this browser only. Use “Clear saved details” at the bottom to remove it.</p>

      {errors.length > 0 && (
        <div ref={summary} tabIndex={-1} role="alert" className="notice notice-error errsum">
          <div>
            <strong className="notice-title">Please fix {errors.length} thing{errors.length === 1 ? '' : 's'} before you continue</strong>
            <ul className="plain">
              {errors.map((e) => (
                <li key={e.field + e.message}><a href={`#${String(e.field)}`} onClick={(ev) => { ev.preventDefault(); const el = document.getElementById(String(e.field)); el?.scrollIntoView({ block: 'center' }); (el?.querySelector('input,button') as HTMLElement | null)?.focus() ?? el?.focus(); }}>{e.message}</a></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card">
        <h2>1. About you</h2>
        <Text id="surname" label="Surname" value={p.surname} onChange={(v) => set('surname', v)} from={from.surname} error={err('surname')} />
        <Text id="firstNames" label="Full first names" value={p.firstNames} onChange={(v) => set('firstNames', v)} from={from.firstNames} error={err('firstNames')} />
        <Text id="idNumber" label="ID number" value={p.idNumber} onChange={onId} from={from.idNumber} error={err('idNumber')} inputMode="numeric" maxLength={13} hint="13 digits. Your date of birth and gender are worked out from it." />
        <Text id="passport" label="Passport number (only if not a South African)" value={p.passport} onChange={(v) => set('passport', v)} tag={false} />
        <Text id="dob" label="Date of birth (DD/MM/YY)" value={p.dob} onChange={(v) => set('dob', v)} from={from.dob} placeholder="01/01/80" />
        <Choice name="race" legend="Race (for the Employment Equity Act)" value={p.race} onChange={(v) => set('race', v)} from={from.race} error={err('race')}
          options={[['african', 'African / Black'], ['coloured', 'Coloured'], ['indian', 'Indian / Asian'], ['white', 'White'], ['other', 'Other']]}
          hint={from.race === 'cv' ? 'We read this from your CV. Change it if it is wrong.' : 'We did not find this in your CV, so please choose. It is saved for next time.'} />
        <Choice name="gender" legend="Gender" value={p.gender} onChange={(v) => set('gender', v)} from={from.gender} error={err('gender')} options={[['female', 'Female'], ['male', 'Male']]} />
        {yn('disability', 'Do you have a disability?')}
        {yn('citizen', 'Are you a South African citizen?')}
        {p.citizen === 'no' && (
          <>
            <Text id="nationality" label="Your nationality" value={p.nationality} onChange={(v) => set('nationality', v)} from={from.nationality} error={err('nationality')} />
            {yn('workPermit', 'Do you have a valid work permit?')}
          </>
        )}
      </div>

      <div className="card">
        <h2>2. Declarations</h2>
        <p className="hint">Answer honestly. A false answer can disqualify you or lead to disciplinary action.</p>
        {yn('convicted', 'Have you been convicted or found guilty of a criminal offence (including an admission of guilt)?', 'convictedDetails', 'Give details of the offence')}
        {yn('pendingCriminal', 'Do you have any pending criminal case against you?', 'pendingCriminalDetails', 'Give details of the case')}
        {yn('dismissed', 'Have you ever been dismissed for misconduct from the Public Service?', 'dismissedDetails', 'Give details')}
        {yn('pendingDisciplinary', 'Do you have any pending disciplinary case against you?', 'pendingDisciplinaryDetails', 'Give details')}
        {yn('resigned', 'Have you resigned from a recent job pending a disciplinary proceeding against you?', 'resignedDetails', 'Give details')}
        {yn('illHealth', 'Have you been discharged or retired from the Public Service on grounds of ill-health, or on condition that you cannot be re-employed?')}
        {yn('businessWithState', 'Are you conducting business with the State, or a Director of a company that does?', 'businessDetails', 'Give details of the business')}
        {yn('relinquish', 'If employed in the Public Service, will you immediately relinquish such business interests?')}
      </div>

      <div className="card">
        <h2>3. Contact and languages</h2>
        <Text id="notice" label="If offered the job: when can you start, or how much notice must you serve?" value={p.notice} onChange={(v) => set('notice', v)} from={from.notice} placeholder="e.g. 1 calendar month" />
        <Text id="prefLanguage" label="Preferred language for correspondence" value={p.prefLanguage} onChange={(v) => set('prefLanguage', v)} tag={false} />
        <Choice name="method" legend="How should the Department contact you?" value={p.method} onChange={(v) => set('method', v)} options={[['email', 'E-mail'], ['telephone', 'Telephone'], ['post', 'Post'], ['fax', 'Fax']]} />
        <Text id="contact" label="Your contact details for that method" value={p.contact} onChange={(v) => set('contact', v)} from={from.contact} error={err('contact')} hint="Example: you@email.com / 082 000 0000" />
        <h3>Official language proficiency</h3>
        <p className="hint">Use good, fair or poor. Up to 5 languages.{from.languages === 'cv' ? ' Taken from your CV.' : ''}</p>
        {p.languages.map((l, i) => (
          <div className="rowset" key={i}>
            <Text id={`lang${i}`} label="Language" tag={false} value={l.language} onChange={(v) => set('languages', p.languages.map((x, k) => (k === i ? { ...x, language: v } : x)))} />
            <Select id={`sp${i}`} label="Speak" value={l.speak} onChange={(v) => set('languages', p.languages.map((x, k) => (k === i ? { ...x, speak: v } : x)))} />
            <Select id={`wr${i}`} label="Write / read" value={l.write} onChange={(v) => set('languages', p.languages.map((x, k) => (k === i ? { ...x, write: v } : x)))} />
            <RemoveBtn onClick={() => set('languages', p.languages.filter((_, k) => k !== i))} what="language" />
          </div>
        ))}
        {p.languages.length < 5 && <AddBtn onClick={() => set('languages', [...p.languages, { language: '', speak: 'good', write: 'good' }])} label="Add language" />}
      </div>

      <div className="card">
        <h2>4. Qualifications and work</h2>
        <p className="hint">Highest qualification first. We took these from your CV{from.qualifications === 'cv' ? '' : ' (or your saved details)'}. Fix anything that looks wrong.</p>
        {p.qualifications.map((q, i) => (
          <div className="rowset" key={i}>
            <Text id={`qs${i}`} label="School / college" tag={false} value={q.school} onChange={(v) => set('qualifications', p.qualifications.map((x, k) => (k === i ? { ...x, school: v } : x)))} />
            <Text id={`qq${i}`} label="Qualification" tag={false} value={q.qualification} onChange={(v) => set('qualifications', p.qualifications.map((x, k) => (k === i ? { ...x, qualification: v } : x)))} />
            <Text id={`qy${i}`} label="Year" tag={false} value={q.year} inputMode="numeric" onChange={(v) => set('qualifications', p.qualifications.map((x, k) => (k === i ? { ...x, year: v } : x)))} />
            <RemoveBtn onClick={() => set('qualifications', p.qualifications.filter((_, k) => k !== i))} what="qualification" />
          </div>
        ))}
        {p.qualifications.length < 4 && <AddBtn onClick={() => set('qualifications', [...p.qualifications, { school: '', qualification: '', year: '' }])} label="Add qualification" />}
        {p.qualifications.length === 0 && <Notice kind="warn">We found no qualifications in your CV. Add them here, and add an Education heading to your CV.</Notice>}
        <Text id="currentStudy" label="Current study (institution and qualification), if any" value={p.currentStudy} onChange={(v) => set('currentStudy', v)} tag={false} />

        <h3>Work experience (most recent first)</h3>
        <p className="hint">The Z83 has room for 3 jobs. Your full CV is attached behind it.</p>
        {p.work.map((w, i) => (
          <div className="rowset rowset-work" key={i}>
            <Text id={`we${i}`} label="Employer" tag={false} value={w.employer} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, employer: v } : x)))} />
            <Text id={`wp${i}`} label="Post held" tag={false} value={w.post} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, post: v } : x)))} />
            <div className="dates">
              <Text id={`wfm${i}`} label="From MM" tag={false} value={w.fromMM} inputMode="numeric" maxLength={2} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, fromMM: v } : x)))} />
              <Text id={`wfy${i}`} label="From YY" tag={false} value={w.fromYY} inputMode="numeric" maxLength={2} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, fromYY: v } : x)))} />
              <Text id={`wtm${i}`} label="To MM" tag={false} value={w.toMM} maxLength={4} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, toMM: v } : x)))} />
              <Text id={`wty${i}`} label="To YY" tag={false} value={w.toYY} inputMode="numeric" maxLength={2} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, toYY: v } : x)))} />
            </div>
            <Text id={`wr${i}r`} label="Reason for leaving" tag={false} value={w.reason} onChange={(v) => set('work', p.work.map((x, k) => (k === i ? { ...x, reason: v } : x)))} />
            <RemoveBtn onClick={() => set('work', p.work.filter((_, k) => k !== i))} what="job" />
          </div>
        ))}
        {p.work.length < 3 && <AddBtn onClick={() => set('work', [...p.work, { employer: '', post: '', fromMM: '', fromYY: '', toMM: '', toYY: '', reason: '' }])} label="Add job" />}
        <div className="grid2">
          <Text id="yearsPrivate" label="Years of experience: private sector" value={p.yearsPrivate} onChange={(v) => set('yearsPrivate', v)} from={from.yearsPrivate} inputMode="numeric" />
          <Text id="yearsPublic" label="Years of experience: public sector" value={p.yearsPublic} onChange={(v) => set('yearsPublic', v)} from={from.yearsPublic} inputMode="numeric" />
          <Text id="regDate" label="Professional registration date (if any)" value={p.regDate} onChange={(v) => set('regDate', v)} tag={false} />
          <Text id="regNo" label="Registration number (if any)" value={p.regNo} onChange={(v) => set('regNo', v)} from={from.regNo} />
        </div>
        <Choice name="reappointCondition" legend="Previously in the Public Service: is there a condition that prevents your re-appointment?" value={p.reappointCondition} options={YN} onChange={(v) => set('reappointCondition', v)} hint="Leave blank if you were never employed in the Public Service." />
        {p.reappointCondition === 'yes' && <Text id="reappointDetails" label="Previous department and the condition" value={p.reappointDetails} onChange={(v) => set('reappointDetails', v)} tag={false} />}
      </div>

      <div className="card">
        <h2>5. References</h2>
        {!cv.hasReferences && p.references.length === 0 && (
          <Notice kind="warn" title="Your CV has no references">
            Please update your CV with at least 3 referees (name, relationship, phone number). You can still continue and create your application pack now. You can also type referees below.
          </Notice>
        )}
        {p.references.map((r, i) => (
          <div className="rowset" key={i}>
            <Text id={`rn${i}`} label="Name" tag={false} value={r.name} onChange={(v) => set('references', p.references.map((x, k) => (k === i ? { ...x, name: v } : x)))} />
            <Text id={`rr${i}`} label="Relationship to you" tag={false} value={r.relationship} onChange={(v) => set('references', p.references.map((x, k) => (k === i ? { ...x, relationship: v } : x)))} />
            <Text id={`rt${i}`} label="Phone (office hours)" tag={false} value={r.tel} inputMode="tel" onChange={(v) => set('references', p.references.map((x, k) => (k === i ? { ...x, tel: v } : x)))} />
            <RemoveBtn onClick={() => set('references', p.references.filter((_, k) => k !== i))} what="referee" />
          </div>
        ))}
        {p.references.length < 3 && <AddBtn onClick={() => set('references', [...p.references, { name: '', relationship: '', tel: '' }])} label="Add referee" />}
      </div>

      <div className="card" id="signature">
        <h2>6. Signature and initials</h2>
        <p className="hint">Draw them once. We place them on page 2 (signature, with today’s date) and as initials at the bottom of each Z83 page. They stay on this device.</p>
        <SignaturePad label="Signature" value={p.signature} onChange={(v) => set('signature', v)} />
        {err('signature') && <p className="error">{err('signature')}</p>}
        <div id="initials"><SignaturePad label="Initials" value={p.initials} onChange={(v) => set('initials', v)} height={110} /></div>
        {err('initials') && <p className="error">{err('initials')}</p>}
        <div className="field" id="signatureConsent">
          <label className="checkline">
            <input type="checkbox" className="check" checked={p.signatureConsent} onChange={(e) => set('signatureConsent', e.target.checked)} />
            <span>I confirm this is my own signature and initials, and I declare that the information I provide is complete and correct.</span>
          </label>
          {err('signatureConsent') && <p className="error">{err('signatureConsent')}</p>}
        </div>
        <Notice kind="info">Please review every Z83 and sign again by hand if the Department asks for a wet-ink signature.</Notice>
      </div>

      <div className="actions sticky">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary btn-lg" onClick={submit}>Save and create my PDFs</button>
      </div>
      <p><button type="button" className="btn btn-link" onClick={onClear}>Clear saved details from this device</button></p>
    </section>
  );
}

function Select({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="poor">Poor</option>
      </select>
    </div>
  );
}

const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" className="btn btn-secondary btn-sm" onClick={onClick}><Plus size={16} aria-hidden /> {label}</button>
);
const RemoveBtn = ({ onClick, what }: { onClick: () => void; what: string }) => (
  <button type="button" className="btn btn-ghost btn-sm remove" onClick={onClick} aria-label={`Remove this ${what}`}><Trash2 size={16} aria-hidden /> Remove</button>
);
