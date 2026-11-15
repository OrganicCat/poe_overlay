/**
 * Shared preload for the auxiliary windows (settings, leveling, gems, gear,
 * notes, tree, PoB info bar, floating button, hotkey configurator, version
 * prompt).
 *
 * These windows used to run with nodeIntegration enabled and contextIsolation
 * disabled, so any HTML injection in them meant full code execution on the
 * user's machine. They now run sandboxed with contextIsolation, and this
 * preload gives their inline scripts the small slice of Electron they need:
 * IPC messaging and opening http(s) links in the system browser.
 *
 * Templates access these as `window.electronIpc` and `window.electronShell`.
 * The API mirrors ipcRenderer closely enough that existing template code works
 * after swapping `require('electron')` for these globals. One difference:
 * `on`/`once` return an unsubscribe function, because function identity is
 * not preserved across the context bridge, so removeListener(fn) can't work.
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type BridgedListener = (event: Record<string, never>, ...args: unknown[]) => void;

function assertChannel(channel: unknown): asserts channel is string {
  if (typeof channel !== 'string' || channel.length === 0 || channel.length > 200) {
    throw new Error('Invalid IPC channel');
  }
}

const electronIpc = {
  send(channel: string, ...args: unknown[]): void {
    assertChannel(channel);
    ipcRenderer.send(channel, ...args);
  },
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    assertChannel(channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel: string, listener: BridgedListener): () => void {
    assertChannel(channel);
    // Never hand the real IpcRendererEvent to the page; it carries `sender`,
    // which is the full ipcRenderer object.
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener({}, ...args);
    ipcRenderer.on(channel, wrapped);
    return () => { ipcRenderer.removeListener(channel, wrapped); };
  },
  once(channel: string, listener: BridgedListener): () => void {
    assertChannel(channel);
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener({}, ...args);
    ipcRenderer.once(channel, wrapped);
    return () => { ipcRenderer.removeListener(channel, wrapped); };
  },
  removeAllListeners(channel: string): void {
    assertChannel(channel);
    ipcRenderer.removeAllListeners(channel);
  }
};

const electronShell = {
  // The main process validates the URL scheme (http/https only).
  openExternal(url: string): Promise<unknown> {
    return ipcRenderer.invoke('open-external', url);
  }
};

contextBridge.exposeInMainWorld('electronIpc', electronIpc);
contextBridge.exposeInMainWorld('electronShell', electronShell);
