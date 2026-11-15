/**
 * App entry point. It runs before anything else loads so that, on Linux, the
 * app can restart itself with --ozone-platform=x11 before any window or
 * other module exists (see relaunchForX11IfNeeded).
 */
import { relaunchForX11IfNeeded } from './platform/linux.js';

if (!relaunchForX11IfNeeded()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./main.js');
}
