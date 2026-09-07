import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import path from 'node:path';

import {
  fetchHealth,
  normalizeHealthServerInfo,
  readServerInfo,
} from '../scripts/utils/serverInfo.mjs';

/**
 * In dev mode the Vite dev server (the prototype runtime origin, e.g. :51720)
 * and the Axhub Make admin host (e.g. :53817) run on split origins.
 *
 * The management runtime injects the admin's `dev-template-bootstrap.js` into
 * the prototype iframe. That bundle uses Vite's `__vitePreload` helper
 * (`preload-helper.js`), which appends `<link rel="modulepreload">` tags with
 * ROOT-ABSOLUTE paths (`"/" + dep`) to `document.head`. Because the link lives
 * in the iframe document, `/assets/chunks/...` resolves against the dev server
 * origin instead of the admin origin, producing 404s for assets that only
 * exist on the admin host.
 *
 * This plugin proxies admin-only static asset paths (`/assets/...`,
 * `/runtime/...`) from the dev server to the Make admin host, so the split
 * dev origin behaves like the same origin those preload links expect.
 */

const PROXY_PATH_PREFIXES = ['/assets/', '/runtime/'];
const DEFAULT_ADMIN_ORIGIN = 'http://localhost:53817';
const ADMIN_HEALTH_TIMEOUT_MS = 1200;
const ADMIN_ORIGIN_CACHE_TTL_MS = 10000;

function matchesProxyPath(pathname: string): boolean {
  return PROXY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function adminAssetProxyPlugin(): Plugin {
  return {
    name: 'admin-asset-proxy',
    apply: 'serve',
    configureServer(server: any) {
      const projectRoot = path.resolve(process.cwd());
      let cachedOrigin: string | null = null;
      let cachedAt = 0;
      let loggedOnce = false;

      async function resolveAdminOrigin(): Promise<string | null> {
        const now = Date.now();
        if (cachedOrigin && now - cachedAt < ADMIN_ORIGIN_CACHE_TTL_MS) {
          return cachedOrigin;
        }
        const candidates = [
          readServerInfo(projectRoot, 'admin')?.origin,
          DEFAULT_ADMIN_ORIGIN,
        ].filter((origin, index, all): origin is string => Boolean(origin) && all.indexOf(origin) === index);
        for (const origin of candidates) {
          const health = await fetchHealth(origin, ADMIN_HEALTH_TIMEOUT_MS);
          if (normalizeHealthServerInfo(health)?.origin) {
            cachedOrigin = origin;
            cachedAt = now;
            return origin;
          }
        }
        return null;
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        try {
          if (req.method && req.method !== 'GET') {
            next();
            return;
          }
          const requestUrl = req.url || '/';
          const url = new URL(requestUrl, 'http://localhost');
          if (!matchesProxyPath(url.pathname)) {
            next();
            return;
          }

          const adminOrigin = await resolveAdminOrigin();
          if (!adminOrigin) {
            next();
            return;
          }

          const target = new URL(url.pathname + url.search, adminOrigin);
          const response = await fetch(target.toString(), {
            method: 'GET',
            headers: {
              accept: getHeaderValue(req.headers.accept) || '*/*',
            },
          });

          if (!response.ok) {
            next();
            return;
          }

          if (!loggedOnce) {
            loggedOnce = true;
            server.config?.logger?.info?.(
              `[admin-asset-proxy] Proxying ${PROXY_PATH_PREFIXES.join(', ')} → ${adminOrigin}`,
            );
          }

          res.statusCode = response.status;
          const contentType = response.headers.get('content-type');
          if (contentType) res.setHeader('Content-Type', contentType);
          const cacheControl = response.headers.get('cache-control');
          if (cacheControl) res.setHeader('Cache-Control', cacheControl);
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (response.body) {
            Readable.fromWeb(response.body as any).pipe(res);
          } else {
            const buf = await response.arrayBuffer();
            res.end(Buffer.from(buf));
          }
        } catch {
          next();
        }
      });
    },
  };
}

export default adminAssetProxyPlugin;
