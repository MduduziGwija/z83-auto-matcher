export type YesNo = 'yes' | 'no' | '';

export type ReqKind = 'qualification' | 'experience' | 'knowledge' | 'skill' | 'licence';

export interface Req {
  id: string;
  kind: ReqKind;
  /** The requirement as written in the circular. */
  text: string;
  nqf?: number;
  /** Acceptable fields of study for a qualification (any one will do). */
  fields?: string[];
  years?: number;
  topic?: string;
  /** Alternative kinds of work the experience must be in (any one will do), e.g. financial markets. */
  domain?: string[];
  /** Level of seniority the experience must be at, e.g. "assistant director" or "supervisory". */
  seniority?: string;
}

export interface Post {
  id: string;
  title: string;
  ref: string;
  /** Department that advertised this post (read from the heading above it in the circular). */
  department: string;
  directorate: string;
  salary: string;
  level: string;
  location: string;
  closing: Date | null;
  email: string;
  /** How the circular says to apply: by email (what this app supports), only online, or no email address found. */
  applyBy: 'email' | 'online' | 'none';
  applyNote: string;
  enquiries: string;
  reqs: Req[];
  /** The requirements exactly as written in the circular (always shown to the applicant). */
  requirements: string;
  /** The whole post text from the circular. */
  raw: string;
}

export interface CircularInfo {
  posts: Post[];
  department: string;
  departments: string[];
  emails: string[];
  /** Instruction in the circular about how to name / label the application, if found. */
  subjectRule: string | null;
  /** Free-text note from the circular about the maximum PDF size, if found. */
  maxSizeMb: number | null;
}

export interface CvQualification {
  text: string;
  school: string;
  level: number;
  year: string;
}

export interface CvWork {
  employer: string;
  post: string;
  fromMM: string;
  fromYY: string;
  toMM: string;
  toYY: string;
  reason: string;
}

export interface CvInfo {
  text: string;
  name: string;
  surname: string;
  firstNames: string;
  idNumber: string;
  email: string;
  phone: string;
  nationality: string;
  /** Detected from the CV (people word these differently). Empty when not found. */
  race: '' | 'african' | 'white' | 'coloured' | 'indian' | 'other';
  gender: '' | 'female' | 'male';
  disability: '' | 'yes' | 'no';
  dob: string;
  notice: string;
  registration: string;
  qualifications: CvQualification[];
  work: CvWork[];
  languages: { language: string; speak: string; write: string }[];
  references: { name: string; relationship: string; tel: string }[];
  /** True when the CV has a references heading or any referee details. */
  hasReferences: boolean;
  totalYears: number | null;
  publicYears: number | null;
  driversLicence: boolean;
  /** Plain-language notes about things the parser could not find. */
  gaps: string[];
}

export type Outcome = 'direct' | 'equivalent' | 'partial' | 'missing';

export interface MatchItem {
  req: Req;
  outcome: Outcome;
  evidence: string;
  advice: string;
}

export interface MatchResult {
  postId: string;
  score: number;
  status: 'strong' | 'partial' | 'low';
  items: MatchItem[];
}

export interface RefPerson {
  name: string;
  relationship: string;
  tel: string;
}

export interface LangRow {
  language: string;
  speak: string;
  write: string;
}

export interface QualRow {
  school: string;
  qualification: string;
  year: string;
}

export interface Profile {
  surname: string;
  firstNames: string;
  idNumber: string;
  passport: string;
  dob: string; // DD/MM/YY as printed on the form
  race: '' | 'african' | 'white' | 'coloured' | 'indian' | 'other';
  gender: '' | 'female' | 'male';
  disability: YesNo;
  citizen: YesNo;
  nationality: string;
  workPermit: YesNo;
  convicted: YesNo;
  convictedDetails: string;
  pendingCriminal: YesNo;
  pendingCriminalDetails: string;
  dismissed: YesNo;
  dismissedDetails: string;
  pendingDisciplinary: YesNo;
  pendingDisciplinaryDetails: string;
  resigned: YesNo;
  resignedDetails: string;
  illHealth: YesNo;
  businessWithState: YesNo;
  businessDetails: string;
  relinquish: YesNo;
  yearsPrivate: string;
  yearsPublic: string;
  regDate: string;
  regNo: string;
  notice: string;
  prefLanguage: string;
  method: '' | 'post' | 'email' | 'fax' | 'telephone';
  contact: string;
  languages: LangRow[];
  qualifications: QualRow[];
  currentStudy: string;
  work: CvWork[];
  reappointCondition: YesNo;
  reappointDetails: string;
  references: RefPerson[];
  signature: string; // PNG data URL
  initials: string; // PNG data URL
  signatureConsent: boolean;
}
