import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { Post, Profile, YesNo } from './types';

/** Coordinates were measured on a 110-dpi render of the official Z83 (top-left origin). */
const K = 72 / 110;
const PAGE_H = 841.89;
// Government forms are completed in black.
const INK = rgb(0, 0, 0);

// Only characters Helvetica (WinAnsi) can print; anything else becomes "?" instead of crashing.
function clean(s: string): string {
  return (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ]/g, '?')
    .trim();
}

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
}

function text(c: Ctx, page: PDFPage, s: string, xPx: number, yPx: number, o: { size?: number; maxPx?: number; min?: number; center?: boolean } = {}) {
  const t = clean(s);
  if (!t) return;
  let size = o.size ?? 9;
  const max = o.maxPx ? o.maxPx * K : Infinity;
  const min = o.min ?? 5.5;
  while (size > min && c.font.widthOfTextAtSize(t, size) > max) size -= 0.25;
  let out = t;
  while (out.length > 1 && c.font.widthOfTextAtSize(out, size) > max) out = out.slice(0, -1);
  if (out !== t) out = out.slice(0, -2) + '..';
  const w = c.font.widthOfTextAtSize(out, size);
  const x = xPx * K - (o.center ? w / 2 : 0);
  page.drawText(out, { x, y: PAGE_H - yPx * K, size, font: c.font, color: INK });
}

function wrap(c: Ctx, page: PDFPage, s: string, xPx: number, yPx: number, widthPx: number, o: { size?: number; lines?: number; leadPx?: number } = {}) {
  const t = clean(s);
  if (!t) return;
  const size = o.size ?? 8.5;
  const lines: string[] = [];
  let cur = '';
  for (const w of t.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (c.font.widthOfTextAtSize(next, size) <= widthPx * K) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const maxLines = o.lines ?? 2;
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/.{0,3}$/, '') + '...';
  shown.forEach((l, i) => text(c, page, l, xPx, yPx + i * (o.leadPx ?? 13), { size, maxPx: widthPx }));
}

function xMark(page: PDFPage, xPx: number, yPx: number) {
  const r = 4.2 * K * 1.2;
  const cx = xPx * K;
  const cy = PAGE_H - yPx * K;
  const t = 1.3;
  page.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, thickness: t, color: INK });
  page.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, thickness: t, color: INK });
}

function yesNo(page: PDFPage, v: YesNo, yPx: number) {
  if (v === 'yes') xMark(page, 727, yPx);
  else if (v === 'no') xMark(page, 809, yPx);
}

/** Yes/No answers on Z83 page 1: label midline (px) for each question. */
const ROW = { disability: 611, citizen: 633, permit: 676, convicted: 694, pendingCrim: 738, dismissed: 780, pendingDisc: 830, resigned: 873, illHealth: 932, business: 972, relinquish: 1027 };

function ddmmyyyy(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export interface FillOptions {
  post: Pick<Post, 'title' | 'ref'>;
  department: string;
  profile: Profile;
  date?: Date;
}

/** Draws the applicant's details onto a copy of the official Z83 and returns the PDF document. */
export async function fillZ83(template: ArrayBuffer | Uint8Array, opt: FillOptions): Promise<PDFDocument> {
  const doc = await PDFDocument.load(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const c: Ctx = { doc, font, bold };
  const [p1, p2] = doc.getPages();
  const p = opt.profile;

  // A. The advertised post
  wrap(c, p1, opt.post.title, 326, 306, 232, { size: 9, lines: 2 });
  wrap(c, p1, opt.department, 575, 304, 248, { size: 9, lines: 2 });
  text(c, p1, opt.post.ref, 326, 372, { size: 10, maxPx: 232 });
  wrap(c, p1, p.notice, 575, 392, 248, { size: 9, lines: 2 });

  // B. Personal information
  text(c, p1, p.surname.toUpperCase(), 490, 481, { size: 9.5, maxPx: 330 });
  text(c, p1, p.firstNames, 490, 499, { size: 9.5, maxPx: 330 });
  if (p.dob) {
    p1.drawRectangle({ x: 386 * K, y: PAGE_H - 538 * K, width: 72 * K, height: 15 * K, color: rgb(1, 1, 1) });
    text(c, p1, p.dob, 390, 535, { size: 9 });
  }
  // Centres of the 13 ID boxes (the printed boxes are not evenly spaced), measured from the form.
  const idCentres = [578, 602, 622, 641, 661, 683, 703.5, 723, 742.5, 761.5, 780, 799.5, 818];
  const digits = (s: string, y: number) => [...s.replace(/\s+/g, '').slice(0, 13)].forEach((ch, i) => text(c, p1, ch, idCentres[i], y, { size: 10, center: true }));
  digits(p.idNumber, 523);
  digits(p.passport, 551);

  const raceX = { african: 462, white: 550, coloured: 650, indian: 730, other: 815 } as const;
  if (p.race) xMark(p1, raceX[p.race], 568);
  if (p.gender) xMark(p1, p.gender === 'female' ? 730 : 815, 590);

  yesNo(p1, p.disability, ROW.disability);
  yesNo(p1, p.citizen, ROW.citizen);
  if (p.citizen === 'no') text(c, p1, p.nationality, 330, 654, { size: 9, maxPx: 320 });
  yesNo(p1, p.workPermit, ROW.permit);
  yesNo(p1, p.convicted, ROW.convicted);
  const small = (s: string, y: number) => wrap(c, p1, s, 670, y, 154, { size: 6.2, lines: 2, leadPx: 10 });
  if (p.convicted === 'yes') small(p.convictedDetails, 717);
  yesNo(p1, p.pendingCriminal, ROW.pendingCrim);
  if (p.pendingCriminal === 'yes') small(p.pendingCriminalDetails, 761);
  yesNo(p1, p.dismissed, ROW.dismissed);
  if (p.dismissed === 'yes') small(p.dismissedDetails, 810);
  yesNo(p1, p.pendingDisciplinary, ROW.pendingDisc);
  if (p.pendingDisciplinary === 'yes') small(p.pendingDisciplinaryDetails, 852);
  yesNo(p1, p.resigned, ROW.resigned);
  if (p.resigned === 'yes') small(p.resignedDetails, 898);
  yesNo(p1, p.illHealth, ROW.illHealth);
  yesNo(p1, p.businessWithState, ROW.business);
  if (p.businessWithState === 'yes') wrap(c, p1, p.businessDetails, 670, 996, 154, { size: 6.2, lines: 3, leadPx: 10 });
  yesNo(p1, p.relinquish, ROW.relinquish);

  text(c, p1, p.yearsPrivate, 702, 1096, { size: 7, center: true, maxPx: 68 });
  text(c, p1, p.yearsPublic, 782, 1096, { size: 7, center: true, maxPx: 82 });
  text(c, p1, p.regDate, 702, 1142, { size: 8, center: true, maxPx: 70 });
  text(c, p1, p.regNo, 782, 1142, { size: 8, center: true, maxPx: 85 });

  // C. Contact
  text(c, p2, p.prefLanguage, 672, 176, { size: 9, maxPx: 150 });
  const methodX = { post: 474, email: 566, fax: 666, telephone: 746 } as const;
  if (p.method) xMark(p2, methodX[p.method], 206);
  wrap(c, p2, p.contact, 458, 243, 365, { size: 9, lines: 4, leadPx: 14 });

  // D. Language proficiency
  const colX = [275, 383, 489, 598, 712, 828];
  p.languages.slice(0, 5).forEach((l, i) => {
    const mid = (colX[i] + colX[i + 1]) / 2;
    text(c, p2, l.language, mid, 374, { size: 7.5, center: true, maxPx: 100 });
    text(c, p2, l.speak, mid, 391, { size: 8, center: true });
    text(c, p2, l.write, mid, 410, { size: 8, center: true });
  });

  // E. Formal qualifications (highest first)
  const qy = [497, 511.5, 526, 540];
  p.qualifications.slice(0, 4).forEach((q, i) => {
    text(c, p2, q.school, 84, qy[i], { size: 7.5, maxPx: 270 });
    text(c, p2, q.qualification, 368, qy[i], { size: 7.5, maxPx: 258 });
    text(c, p2, q.year, 637, qy[i], { size: 7.5, maxPx: 180 });
  });
  text(c, p2, p.currentStudy, 318, 556, { size: 8, maxPx: 500 });

  // F. Work experience
  const wy = [665, 687, 709];
  p.work.slice(0, 3).forEach((w, i) => {
    text(c, p2, w.employer, 84, wy[i], { size: 7.5, maxPx: 198 });
    text(c, p2, w.post, 292, wy[i], { size: 7.5, maxPx: 126 });
    text(c, p2, w.fromMM, 446, wy[i], { size: 7.5, center: true });
    text(c, p2, w.fromYY, 494, wy[i], { size: 7.5, center: true });
    text(c, p2, w.toMM, 537, wy[i], { size: 7, center: true, maxPx: 38 });
    text(c, p2, w.toYY, 588, wy[i], { size: 7.5, center: true });
    text(c, p2, w.reason, 622, wy[i], { size: 7, maxPx: 200 });
  });
  if (p.reappointCondition === 'yes') xMark(p2, 660, 729);
  else if (p.reappointCondition === 'no') xMark(p2, 712, 729);
  if (p.reappointCondition === 'yes') wrap(c, p2, p.reappointDetails, 522, 758, 300, { size: 7.5, lines: 2, leadPx: 11 });

  // G. References (may be blank: the app warns the applicant first)
  const ry = [857, 884, 911];
  p.references.slice(0, 3).forEach((r, i) => {
    text(c, p2, r.name, 84, ry[i], { size: 8.5, maxPx: 215 });
    text(c, p2, r.relationship, 308, ry[i], { size: 8.5, maxPx: 215 });
    text(c, p2, r.tel, 533, ry[i], { size: 8.5, maxPx: 290 });
  });

  // Declaration: signature + date. Only drawn when the applicant drew it and confirmed it is theirs.
  if (p.signature && p.signatureConsent) {
    const png = await doc.embedPng(p.signature);
    const maxW = 255 * K;
    const maxH = 50 * K;
    const s = Math.min(maxW / png.width, maxH / png.height);
    p2.drawImage(png, { x: 152 * K, y: PAGE_H - 1042 * K, width: png.width * s, height: png.height * s });
    text(c, p2, ddmmyyyy(opt.date), 462, 1017, { size: 10 });
  }
  if (p.initials && p.signatureConsent) {
    const png = await doc.embedPng(p.initials);
    for (const pg of [p1, p2]) {
      const s = Math.min((36 * K) / png.width, (17 * K) / png.height);
      pg.drawImage(png, { x: 505, y: PAGE_H - 773, width: png.width * s, height: png.height * s });
    }
  }
  return doc;
}

export interface BuildResult {
  bytes: Uint8Array;
  pages: number;
}

/** Z83 pages first, then the applicant's CV pages. */
export async function buildApplicationPdf(template: ArrayBuffer | Uint8Array, cvBytes: ArrayBuffer | Uint8Array, opt: FillOptions): Promise<BuildResult> {
  const doc = await fillZ83(template, opt);
  const cv = await PDFDocument.load(cvBytes, { ignoreEncryption: true });
  const pages = await doc.copyPages(cv, cv.getPageIndices());
  pages.forEach((pg) => doc.addPage(pg));
  doc.setTitle(`${opt.post.ref} - ${opt.post.title}`);
  doc.setSubject('Application for employment (Z83 and CV)');
  const bytes = await doc.save();
  return { bytes, pages: doc.getPageCount() };
}
