import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { docLines } from './pdfLines';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfReadError extends Error {
  constructor(public code: 'unreadable' | 'scanned' | 'password', message: string) {
    super(message);
  }
}

/** Reads text from a PDF in the browser. Nothing is uploaded anywhere. */
export async function extractText(bytes: ArrayBuffer): Promise<{ text: string; pages: number }> {
  let doc;
  try {
    // pdf.js transfers the buffer, so give it a copy and keep ours for merging later.
    doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') throw new PdfReadError('password', 'This PDF is password protected.');
    throw new PdfReadError('unreadable', 'We could not open this PDF.');
  }
  const parts = await docLines(doc);
  const text = parts.join('\n');
  const chars = text.replace(/\s/g, '').length;
  if (chars < 40 * Math.max(1, Math.min(doc.numPages, 3)) * 0.5) {
    throw new PdfReadError('scanned', 'This PDF has no readable text. It may be a scan.');
  }
  return { text, pages: doc.numPages };
}
