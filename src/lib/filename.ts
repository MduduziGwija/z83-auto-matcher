export type NameStyle = 'ref-title' | 'ref' | 'title';

/** Make a name that is safe on Windows, Android and macOS and in email attachments. */
export function safeName(s: string, max = 110): string {
  return s
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[\s.\-]+|[\s.\-]+$/g, '')
    .slice(0, max)
    .trim();
}

export function pdfName(ref: string, title: string, style: NameStyle = 'ref-title'): string {
  const r = safeName(ref);
  const t = safeName(title);
  const base = style === 'ref' ? r : style === 'title' ? t : [r, t].filter(Boolean).join(' - ');
  return `${base || 'Application'}.pdf`;
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = n.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return c === 1 ? n : n.replace(/\.pdf$/i, ` (${c}).pdf`);
  });
}

export function emailSubject(ref: string, title: string): string {
  return `Application: ${title} (Ref: ${ref})`;
}
