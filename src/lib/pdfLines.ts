/** Minimal shape of a pdf.js document, so the same reader runs in the browser and in tests. */
interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

interface TextItemLike {
  str: string;
  hasEOL?: boolean;
  width: number;
  transform: number[];
}

/** Reads a PDF into lines of text, keeping the order the PDF stores them in. */
export async function docLines(doc: PdfDocLike): Promise<string[]> {
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = '';
    let lastX = 0;
    let lastY = Number.NaN;
    let lastW = 0;
    for (const raw of content.items) {
      if (!raw || typeof raw !== 'object' || !('str' in raw)) continue;
      const it = raw as TextItemLike;
      const x = it.transform[4];
      const y = it.transform[5];
      const sameLine = Number.isNaN(lastY) || Math.abs(y - lastY) < 2.5;
      if (!sameLine && line) {
        parts.push(line);
        line = '';
      } else if (line && x - (lastX + lastW) > 1.5 && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
      line += it.str;
      if (it.hasEOL) {
        parts.push(line);
        line = '';
        lastY = Number.NaN;
      } else {
        lastX = x;
        lastY = y;
        lastW = it.width;
      }
    }
    if (line) parts.push(line);
    parts.push('');
  }
  return parts;
}
