/**
 * HTML-encode the text fields of a build that came from a website.
 *
 * Builds imported from Path of Building go through sanitizeString() in
 * pob/parser.ts, which encodes & < > " in every string. The leveling windows
 * rely on that and interpolate build strings straight into their templates.
 * Maxroll and Mobalytics imports are converted into the same StoredPobBuild
 * shape from raw page data, so they need the same encoding before they are
 * stored or rendered.
 *
 * Apostrophes are left alone for the same reason sanitizeString leaves them:
 * gem names such as "Sniper's Mark" are used as lookup keys.
 */

/** Keys whose values are identifiers, URLs or raw data, not display text. */
const SKIP_KEYS = new Set([
  'code',
  'url',
  'buildSource',
  'parsedUrl',
  'maxrollHistory',
]);

export function encodeHtmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Return a copy of `value` with every string HTML-encoded, except the values
 * under SKIP_KEYS. Numbers, booleans and other primitives pass through.
 */
export function encodeBuildStrings<T>(value: T): T {
  return encodeValue(value) as T;
}

function encodeValue(value: unknown): unknown {
  if (typeof value === 'string') return encodeHtmlText(value);
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      // Encode object keys too: item sets are keyed by slot name, and the
      // gear window renders those keys.
      const safeKey = encodeHtmlText(key);
      out[safeKey] = SKIP_KEYS.has(key) ? child : encodeValue(child);
    }
    return out;
  }
  return value;
}
