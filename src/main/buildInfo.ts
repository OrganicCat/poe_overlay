import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** What scripts/build-info.mjs writes next to the compiled main process. */
export interface BuildInfo {
  version: string;
  upstreamVersion: string;
  forkBuild: number | null;
  commit: string | null;
  dirty: boolean;
  commitDate: string | null;
  builtAt: string | null;
}

let cached: BuildInfo | null = null;

export function getBuildInfo(): BuildInfo {
  if (cached) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'build-info.json'), 'utf8'));
    if (raw && typeof raw.version === 'string') {
      cached = raw as BuildInfo;
      return cached;
    }
  } catch { /* not built with scripts/build-info.mjs */ }
  let version = '0.0.0';
  try { version = app.getVersion(); } catch { /* ignore */ }
  cached = { version, upstreamVersion: version, forkBuild: null, commit: null, dirty: false, commitDate: null, builtAt: null };
  return cached;
}

/** e.g. "0.6.12+fork.12 (fb1221f, 2026-11-15)" */
export function describeBuild(info: BuildInfo = getBuildInfo()): string {
  const parts = [info.commit, info.commitDate].filter(Boolean);
  return parts.length ? `${info.version} (${parts.join(', ')})` : info.version;
}

const MAX_LOG_BYTES = 512 * 1024;

/**
 * Print the build to the console and append one line per launch to
 * <userData>/logs/xilehud.log, so there's always a record of which version
 * ran when. The log is cut back to empty once it passes 512 KB.
 */
export function logStartup(): void {
  const info = getBuildInfo();
  const display = process.platform === 'linux'
    ? (process.argv.some((a) => a === '--ozone-platform=x11') ? 'X11' : (process.env.XDG_SESSION_TYPE || 'unknown'))
    : process.platform;
  const line = `${new Date().toISOString()} started XileHUD ${describeBuild(info)}`
    + ` · Electron ${process.versions.electron} · ${os.platform()} ${os.arch()} · display ${display}`
    + (info.builtAt ? ` · built ${info.builtAt}` : '');
  console.log(`[XileHUD] ${line}`);
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'xilehud.log');
    try { if (fs.statSync(file).size > MAX_LOG_BYTES) fs.writeFileSync(file, ''); } catch { /* new file */ }
    fs.appendFileSync(file, line + '\n');
  } catch (err) {
    console.warn('[XileHUD] Could not write startup log:', err);
  }
}
