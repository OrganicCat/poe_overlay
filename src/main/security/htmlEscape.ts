/**
 * Helpers for building the inline HTML templates that auxiliary windows load
 * from data: URLs. Anything that came from outside the app (Path of Building
 * imports, pobb.in, maxroll, mobalytics, the user's own settings) must go
 * through one of these before it lands in a template.
 */

/** Escape text for use inside HTML element content or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialize a value as JSON that is safe to embed inside an inline <script>.
 *
 * Plain JSON.stringify leaves "</script>" intact, so a string such as a gear
 * set title containing "</script><script>..." would close the script block and
 * inject markup. Escaping "<" (and the two line terminators JavaScript treats
 * differently from JSON) prevents that while keeping the value identical once
 * parsed. `undefined` becomes `null` so the result is always a valid
 * expression.
 */
export function jsonForScript(value: unknown): string {
  const json = JSON.stringify(value === undefined ? null : value) ?? 'null';
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
