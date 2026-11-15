import * as path from 'path';
import * as fs from 'fs';

const IMAGE_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif', '.bmp', '.ico']);

/**
 * Resolve `relative` inside `root`, refusing anything that escapes it
 * ("../", absolute paths, drive letters) or that isn't an image file.
 * Returns the absolute path if the file exists, otherwise null.
 */
export function resolveImageInRoot(root: string, relative: string): string | null {
  if (typeof relative !== 'string' || relative.length === 0 || relative.length > 1024) return null;
  if (relative.includes('\0')) return null;
  const rootAbs = path.resolve(root);
  const candidate = path.resolve(rootAbs, relative.replace(/^[\\/]+/, ''));
  const rel = path.relative(rootAbs, candidate);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (!IMAGE_EXTENSIONS.has(path.extname(candidate).toLowerCase())) return null;
  try {
    const real = fs.realpathSync(candidate);
    const realRoot = fs.realpathSync(rootAbs);
    const realRel = path.relative(realRoot, real);
    if (!realRel || realRel.startsWith('..') || path.isAbsolute(realRel)) return null;
    if (!fs.statSync(real).isFile()) return null;
    return real;
  } catch {
    return null;
  }
}

/** Build a local-image:// URL for a path relative to one of the image roots. */
export function localImageUrl(relative: string): string {
  const clean = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  return 'local-image:///' + clean.split('/').map(encodeURIComponent).join('/');
}
