import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Run through XWayland on Linux.
 *
 * Since Electron 38, apps launched in a Wayland session run as native Wayland
 * clients. Wayland doesn't let a client place its own windows or keep them
 * above a fullscreen game, and global input hooks (uiohook) only see X11
 * events, so the overlay can't work there. Path of Exile under Proton/Wine is
 * an X11 window anyway.
 *
 * The backend can only be chosen with the --ozone-platform command-line flag:
 * app.commandLine.appendSwitch() from JS leaves the main process on Wayland
 * and only switches the GPU process, which breaks rendering. So if the flag
 * is missing, relaunch once with it. The packaged .desktop launcher already
 * passes it, so the relaunch only happens when started some other way.
 *
 * Set XILEHUD_WAYLAND=1 to opt out. Returns true if the caller should stop
 * (a relaunch is under way).
 */
export function relaunchForX11IfNeeded(): boolean {
  if (process.platform !== 'linux') return false;
  if (process.env.XILEHUD_WAYLAND === '1') return false;
  if (process.argv.some((arg) => arg.startsWith('--ozone-platform'))) return false;
  if (!process.env.DISPLAY) return false; // no XWayland/X server to use
  app.relaunch({ args: [...process.argv.slice(1), '--ozone-platform=x11'] });
  app.exit(0);
  return true;
}

/** Steam library roots on this machine (native, Flatpak, and extra libraries). */
export function getSteamLibraryRoots(): string[] {
  const home = os.homedir();
  const steamRoots = [
    path.join(home, '.local', 'share', 'Steam'),
    path.join(home, '.steam', 'steam'),
    path.join(home, '.steam', 'root'),
    path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
    path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam')
  ];

  const libraries = new Set<string>();
  for (const root of steamRoots) {
    if (!safeIsDir(root)) continue;
    libraries.add(safeRealpath(root));
    // Additional library folders (other drives) are listed in libraryfolders.vdf.
    for (const vdf of [
      path.join(root, 'steamapps', 'libraryfolders.vdf'),
      path.join(root, 'config', 'libraryfolders.vdf')
    ]) {
      try {
        const text = fs.readFileSync(vdf, 'utf8');
        for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) {
          const lib = m[1].replace(/\\\\/g, '\\');
          if (safeIsDir(lib)) libraries.add(safeRealpath(lib));
        }
      } catch { /* not present */ }
    }
  }
  return Array.from(libraries);
}

/**
 * Candidate Client.txt locations for a Linux install.
 * gameFolder is "Path of Exile" or "Path of Exile 2".
 */
export function getLinuxClientTxtCandidates(gameFolder: string): string[] {
  const candidates: string[] = [];
  for (const lib of getSteamLibraryRoots()) {
    candidates.push(path.join(lib, 'steamapps', 'common', gameFolder, 'logs', 'Client.txt'));
    candidates.push(path.join(lib, 'steamapps', 'common', gameFolder, 'logs', 'client.txt'));
  }
  // Standalone (non-Steam) client installed through Wine, Lutris, or Bottles.
  const home = os.homedir();
  const winePrefixes = [
    path.join(home, '.wine'),
    path.join(home, 'Games', 'path-of-exile'),
    path.join(home, 'Games', 'path-of-exile-2'),
    path.join(home, 'Games', 'Path of Exile'),
    path.join(home, 'Games', 'Path of Exile 2')
  ];
  for (const prefix of winePrefixes) {
    for (const base of ['Program Files (x86)', 'Program Files']) {
      candidates.push(path.join(prefix, 'drive_c', base, 'Grinding Gear Games', gameFolder, 'logs', 'Client.txt'));
    }
  }
  return candidates;
}

/**
 * Find the game directory from a running process on Linux by scanning /proc.
 * Works for Proton/Wine (the .exe path appears in the command line, either as
 * a Linux path or a Wine "Z:\..." path).
 */
export function findPoeProcessDirsLinux(): string[] {
  const dirs = new Set<string>();
  let pids: string[] = [];
  try { pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)); } catch { return []; }
  for (const pid of pids) {
    let cmdline = '';
    try { cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch { continue; }
    if (!/pathofexile/i.test(cmdline)) continue;
    for (const arg of cmdline.split('\0')) {
      if (!/pathofexile[^\\/]*\.exe$/i.test(arg)) continue;
      let p = arg;
      const wine = /^[a-z]:\\/i.exec(p);
      if (wine) {
        // Z:\ is Wine's mapping of the Linux root filesystem.
        if (/^z:/i.test(p)) p = p.slice(2).replace(/\\/g, '/');
        else continue;
      }
      const dir = path.dirname(p);
      if (safeIsDir(dir)) dirs.add(dir);
    }
  }
  return Array.from(dirs);
}

function safeIsDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function safeRealpath(p: string): string {
  try { return fs.realpathSync(p); } catch { return p; }
}
