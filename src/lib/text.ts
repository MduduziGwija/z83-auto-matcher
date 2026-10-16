const STOP = new Set(
  'a an and are as at be by for from in is it of on or the to with within who will have has must can their this that any all per not such other related relevant knowledge skills skill experience minimum applicants applicant ability good high working understanding basic'.split(' '),
);

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(w: string): string {
  w = w.replace(/'s?$/, '');
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokens(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}

export function tokenSet(s: string): Set<string> {
  return new Set(tokens(s));
}

/** Share of the phrase's meaningful words that appear in the haystack token set (0..1). */
export function coverage(phrase: string, hay: Set<string>): number {
  const t = tokens(phrase);
  if (!t.length) return 0;
  return t.filter((w) => hay.has(w)).length / t.length;
}

export function containsPhrase(haystackNorm: string, phrase: string): boolean {
  const p = norm(phrase);
  return p.length > 1 && (' ' + haystackNorm + ' ').includes(' ' + p + ' ');
}

const SMALL = new Set(['of', 'and', 'the', 'in', 'to', 'for', 'on', 'at', 'a']);
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      const bare = w.replace(/[^a-z]/g, '');
      if (bare.length > 0 && bare.length <= 3 && !SMALL.has(bare) && !/^(sub|dep|dir|man|ass)$/.test(bare)) return w.toUpperCase();
      if (i > 0 && SMALL.has(bare)) return w;
      return w.replace(/[a-z]/, (c) => c.toUpperCase());
    })
    .join(' ');
}

export function levelOf(text: string): number {
  const t = text.toLowerCase();
  const nqf = t.match(/nqf\s*(?:level)?\s*(\d{1,2})/);
  if (nqf) return Math.min(10, Number(nqf[1]));
  if (/ph\.?d|doctora/.test(t)) return 10;
  if (/master|m\.?\s?(?:sc|com|a|ed|phil|tech)\b|mba|mpa/.test(t)) return 9;
  if (/honou?rs|postgraduate|post-graduate|pgdip|\bb\.?\s?tech|btech|\bbhons|advanced diploma/.test(t)) return /advanced diploma/.test(t) ? 7 : 8;
  if (/bachelor|degree|\bb\.?\s?(?:sc|com|a|ed|admin|ph|proc|tech)\b|\bllb\b/.test(t)) return 7;
  if (/national diploma|diploma|n\.?\s?dip|ndip/.test(t)) return 6;
  if (/grade\s*12|matric|senior certificate|nsc\b|national senior/.test(t)) return 4;
  if (/higher certificate|national certificate|certificate|n[4-6]\b/.test(t)) return 5;
  return 0;
}
