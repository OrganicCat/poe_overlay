import * as path from 'path';
import type { WebPreferences } from 'electron';

/** Compiled location: dist/main/windowPreload.js (this file is dist/main/security/). */
export const WINDOW_PRELOAD_PATH = path.join(__dirname, '..', 'windowPreload.js');

/**
 * webPreferences for every auxiliary window that renders our own HTML.
 *
 * Node.js stays out of the page, the page runs in Chromium's sandbox, and the
 * only bridge to the main process is the shared preload (see windowPreload.ts).
 * Callers can pass extra non-security options (backgroundThrottling, etc.);
 * the security-relevant keys always win.
 */
export function secureWebPreferences(extra: WebPreferences = {}): WebPreferences {
  return {
    ...extra,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    preload: WINDOW_PRELOAD_PATH
  };
}
