#!/usr/bin/env node
/**
 * Write dist/main/build-info.json so the running app knows exactly which
 * build it is. Run by `npm run build`.
 *
 *   node scripts/build-info.mjs                 write the file
 *   node scripts/build-info.mjs --print-version print only the version
 *
 * Version scheme for this fork: <upstream version>+fork.<N>, where N is the
 * number of commits since the upstream release tag (v<upstream version>), so
 * every committed change produces a higher version. ".dirty" is appended
 * when the working tree has uncommitted changes. Without git (e.g. a source
 * tarball) the plain upstream version is used.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const base = String(pkg.version).replace(/\+.*$/, '');

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const commit = git('rev-parse', '--short', 'HEAD');
let forkBuild = null;
if (commit) {
  const fromTag = git('rev-list', '--count', `v${base}..HEAD`);
  const mergeBase = fromTag === null ? git('merge-base', 'HEAD', 'upstream/main') : null;
  const fromUpstream = mergeBase ? git('rev-list', '--count', `${mergeBase}..HEAD`) : null;
  const n = Number(fromTag ?? fromUpstream);
  forkBuild = Number.isFinite(n) ? n : null;
}
const dirty = commit ? Boolean(git('status', '--porcelain', '--untracked-files=no')) : false;

const version = forkBuild === null ? base : `${base}+fork.${forkBuild}${dirty ? '.dirty' : ''}`;

if (process.argv.includes('--print-version')) {
  process.stdout.write(version);
  process.exit(0);
}

const info = {
  version,
  upstreamVersion: base,
  forkBuild,
  commit,
  dirty,
  commitDate: commit ? git('log', '-1', '--format=%cs') : null,
  builtAt: new Date().toISOString(),
};
const out = join(root, 'dist', 'main', 'build-info.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log(`build-info: ${version} (${commit ?? 'no git'}${dirty ? ', uncommitted changes' : ''})`);
