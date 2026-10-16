import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildApplicationPdf } from '../src/lib/z83';
import { emptyProfile } from '../src/lib/profile';

// 1x1 transparent-ish PNG used as a stand-in for a drawn signature.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

it('fills and merges', async () => {
  const tpl = readFileSync('public/Z83.pdf');
  const cv = await PDFDocument.create();
  cv.addPage().drawText('CV PAGE');
  const p = {
    ...emptyProfile(),
    surname: 'Mokoena', firstNames: 'Thabo Sipho', idNumber: '8001015009087', dob: '01/01/80', race: 'african' as const, gender: 'male' as const,
    disability: 'no' as const, citizen: 'yes' as const, workPermit: '' as const, convicted: 'yes' as const, convictedDetails: 'Traffic fine 2015, paid admission of guilt, no custodial sentence',
    pendingCriminal: 'no' as const, dismissed: 'no' as const, pendingDisciplinary: 'no' as const, resigned: 'no' as const, illHealth: 'no' as const,
    businessWithState: 'yes' as const, businessDetails: 'Director of ABC Pty Ltd, supplies stationery to the Dept of Health', relinquish: 'yes' as const,
    yearsPrivate: '3', yearsPublic: '10', regDate: '2012', regNo: 'ECSA 12345', notice: '1 calendar month', prefLanguage: 'English', method: 'email' as const,
    contact: 'thabo@example.com / 082 555 1234', languages: [{ language: 'English', speak: 'good', write: 'good' }, { language: 'isiZulu', speak: 'good', write: 'fair' }],
    qualifications: [{ school: 'Tshwane University of Technology', qualification: 'National Diploma: Information Technology', year: '2012' }, { school: 'Pretoria Boys High', qualification: 'Matric', year: '2008' }],
    currentStudy: 'UNISA - BTech Information Technology',
    work: [{ employer: 'Department of Health', post: 'Business Analyst', fromMM: '03', fromYY: '16', toMM: 'Pres', toYY: '', reason: '' }, { employer: 'ABC Software (Pty) Ltd', post: 'Junior Developer', fromMM: '', fromYY: '13', toMM: '', toYY: '16', reason: 'Career growth' }],
    reappointCondition: 'no' as const,
    references: [{ name: 'Dr Sipho Dlamini', relationship: 'Director: ICT', tel: '012 555 0000' }, { name: 'Ms Anna Botha', relationship: 'Line manager', tel: '082 111 2222' }],
    signature: PNG, initials: PNG, signatureConsent: true,
  };
  const r = await buildApplicationPdf(tpl, await cv.save(), {
    post: { title: 'ICT Specialist (Business Analyst)', ref: '3/3/1/85/2026' }, department: 'Department of Agriculture (DOA)', profile: p,
  });
  expect(r.pages).toBe(3);
  mkdirSync('tests/out', { recursive: true });
  writeFileSync('tests/out/filled.pdf', r.bytes);
});
