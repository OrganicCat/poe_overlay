import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createHash } from 'crypto';

const ALLOWED_IMAGE_HOSTS = ['poecdn.com', 'poecdn.net', 'pathofexile.com', 'poewiki.net'];
const IMAGE_EXTS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ImageCacheState {
  map: Record<string,string>;
  indexPath: string | null;
}

export class ImageCacheService {
  state: ImageCacheState = { map: {}, indexPath: null };

  init(): void {
    try {
      const dir = path.join(app.getPath('userData'), 'image-cache');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.state.indexPath = path.join(app.getPath('userData'), 'image-cache-index.json');
      if (fs.existsSync(this.state.indexPath)) {
        try { const raw = JSON.parse(fs.readFileSync(this.state.indexPath, 'utf8')); if (raw && typeof raw === 'object') this.state.map = raw; } catch {}
      }
    } catch {}
  }

  persist(): void {
    try { if (this.state.indexPath) fs.writeFileSync(this.state.indexPath, JSON.stringify(this.state.map)); } catch {}
  }

  async download(url: string): Promise<string | null> {
    return new Promise(resolve => {
      try {
        if (!this.state.indexPath) this.init();
        // Renderers can ask for any URL, so only fetch images from the game's
        // own CDNs and the wiki, store them with an image extension, and cap
        // the size.
        let parsed: URL;
        try { parsed = new URL(url); } catch { resolve(null); return; }
        if (parsed.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
          resolve(null); return;
        }
        const ext = path.extname(parsed.pathname).toLowerCase();
        const safeExt = IMAGE_EXTS.has(ext) ? ext : '.img';
        const cacheDir = path.join(app.getPath('userData'), 'image-cache');
        const fname = createHash('sha256').update(url).digest('hex').slice(0, 40) + safeExt;
        const target = path.join(cacheDir, fname);
        if (fs.existsSync(target) && fs.statSync(target).size > 0) { resolve(target); return; }
        const file = fs.createWriteStream(target);
        const fail = () => { try { file.close(); fs.unlinkSync(target); } catch {}; resolve(null); };
        const req = https.get(parsed, (res) => {
          const type = String(res.headers['content-type'] || '');
          if (res.statusCode !== 200 || !/^image\//i.test(type)) { res.resume(); fail(); return; }
          let received = 0;
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > MAX_IMAGE_BYTES) { req.destroy(); fail(); }
          });
          res.pipe(file);
          file.on('finish', () => { file.close(); if (received <= MAX_IMAGE_BYTES) resolve(target); });
        });
        req.on('error', fail);
      } catch { resolve(null); }
    });
  }
}
