import { app, session, shell, type WebContents } from 'electron';

/**
 * App-wide guards that apply to every window, including ones created later.
 *
 * - Pages the app renders itself (data:, file:, local dev server) can't
 *   navigate away to a remote site. Clicking an http(s) link opens the system
 *   browser instead.
 * - window.open() never creates a new Electron window; http(s) targets go to
 *   the system browser, everything else is dropped.
 * - Powerful permissions (camera, mic, screen capture, USB, etc.) are denied.
 *
 * Windows that load pathofexile.com (login, trade history) keep normal
 * navigation, since the login flow redirects through Steam and console
 * account providers.
 */

const DENIED_PERMISSIONS = new Set<string>([
  'media',
  'display-capture',
  'geolocation',
  'midi',
  'midiSysex',
  'hid',
  'serial',
  'usb',
  'bluetooth',
  'idle-detection',
  'window-management',
  'speaker-selection',
  'storage-access',
  'top-level-storage-access',
  'keyboardLock',
  'pointerLock',
  'openExternal'
]);

function isAppContentUrl(url: string): boolean {
  return /^(data|file|local-image|devtools):/i.test(url) || /^http:\/\/localhost:5173\//i.test(url);
}

function isWebUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const current = contents.getURL();
    if (!current || !isAppContentUrl(current)) return; // e.g. pathofexile.com login flow
    if (url === current) return;
    // Our own pages only ever reload themselves (loadURL from the main process
    // doesn't fire will-navigate). Anything else is a link click or injected
    // script trying to leave.
    event.preventDefault();
    if (isWebUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Opt-in diagnostics: XILEHUD_DEBUG_RENDERER=1 prints renderer warnings,
  // errors, and preload failures to the terminal.
  if (process.env.XILEHUD_DEBUG_RENDERER === '1') {
    contents.on('preload-error', (_event, preloadPath, error) => {
      console.error(`[renderer:${contents.id}] preload failed (${preloadPath}):`, error);
    });
    contents.on('console-message', (event) => {
      const e = event as unknown as { level?: string; message?: string; lineNumber?: number; sourceId?: string };
      if (e.level !== 'warning' && e.level !== 'error') return;
      const where = (contents.getURL() || '').slice(0, 40);
      console.log(`[renderer:${contents.id} ${e.level} ${where}] ${e.message} (${(e.sourceId || '').slice(0, 60)}:${e.lineNumber})`);
    });
    contents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer:${contents.id}] process gone:`, details.reason);
    });
  }
}

export function installAppHardening(): void {
  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents));

  app.whenReady().then(() => {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(!DENIED_PERMISSIONS.has(permission));
    });
    ses.setPermissionCheckHandler((_wc, permission) => !DENIED_PERMISSIONS.has(permission));
  }).catch(() => {});
}
