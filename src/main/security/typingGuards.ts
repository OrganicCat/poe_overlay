import { stringToHotkey } from '../utils/uiohookHotkeyUtils.js';
import type { CustomHotkey } from '../services/settingsService.js';

/**
 * Guards for features that paste text and press keys in whatever window has
 * focus (custom chat-command hotkeys, the gem regex stash search).
 */

const MAX_TYPED_TEXT = 500;
const MAX_CUSTOM_HOTKEYS = 50;

/**
 * Text that gets pasted with simulated Ctrl+V. Newlines and other control
 * characters are removed, so a paste can never be more than one line; the
 * only Enter press is the explicit one the feature adds.
 */
export function sanitizeTypedText(text: unknown): string {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .trim()
    .slice(0, MAX_TYPED_TEXT);
}

/**
 * A hotkey that types text must not be a key you'd press while typing.
 * Allowed: anything with Ctrl or Alt, F-keys, and numpad/navigation keys.
 * Refused: bare (or Shift+) letters, digits, space, punctuation, Enter, etc.
 */
export function isSafeTypingHotkey(hotkey: unknown): boolean {
  if (typeof hotkey !== 'string' || hotkey.length > 40) return false;
  const parsed = stringToHotkey(hotkey);
  if (!parsed) return false;
  if (parsed.ctrl || parsed.alt) return true;
  return /^(F([1-9]|1[0-9]|2[0-4])|Numpad[A-Za-z0-9]+|Insert|Home|End|PageUp|PageDown)$/.test(parsed.keyName);
}

/** Validate a custom hotkey list coming from a renderer or from settings.json. */
export function sanitizeCustomHotkeys(list: unknown): CustomHotkey[] {
  if (!Array.isArray(list)) return [];
  const out: CustomHotkey[] = [];
  for (const raw of list.slice(0, MAX_CUSTOM_HOTKEYS)) {
    if (!raw || typeof raw !== 'object') continue;
    const h = raw as Record<string, unknown>;
    const hotkey = typeof h.hotkey === 'string' ? h.hotkey.slice(0, 40) : '';
    out.push({
      id: String(h.id ?? '').slice(0, 64),
      name: sanitizeTypedText(h.name).slice(0, 100),
      command: sanitizeTypedText(h.command),
      // Keep unsafe bindings visible in settings (so the user can fix them)
      // but never register them; see isSafeTypingHotkey at registration.
      hotkey,
      pressEnter: h.pressEnter === true
    });
  }
  return out;
}
