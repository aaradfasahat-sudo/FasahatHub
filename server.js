const express = require('express');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { pipeline } = require('stream');

const app = express();
const PORT = process.env.PORT || 5000;
const SITE_DIR = path.join(__dirname, 'Site A');

const STRIP_REQ_HEADERS = new Set([
  'host', 'origin', 'referer', 'x-forwarded-for', 'x-forwarded-proto',
  'x-real-ip', 'cf-connecting-ip', 'cf-ray', 'cf-visitor',
  'x-replit-user-id', 'x-replit-user-name', 'x-replit-user-roles',
  'x-replit-user-url', 'x-replit-pk-sig',
]);

const STRIP_RES_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'feature-policy',
  'x-content-type-options',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'strict-transport-security',
  'expect-ct',
  'report-to',
  'nel',
  'vary',
]);

// Rotate through a few realistic User-Agent strings
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function toProxyUrl(url, base) {
  try {
    const abs = new URL(url, base).href;
    if (abs.startsWith('http://') || abs.startsWith('https://')) {
      return '/px?url=' + encodeURIComponent(abs);
    }
  } catch (e) {}
  return url;
}

function rewriteHtml(html, base, clientCookies) {
  const injectScript = `<script>
(function(){
  var _base = '${base.origin}';
  function toProxy(u, rel) {
    try {
      var abs = new URL(u, rel || location.href).href;
      if (abs.startsWith('http')) return '/px?url=' + encodeURIComponent(abs);
    } catch(e) {}
    return u;
  }
  // Intercept XHR
  var _XHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    try { arguments[1] = toProxy(String(u)); } catch(e) {}
    return _XHR.apply(this, arguments);
  };
  // Intercept fetch
  var _fetch = window.fetch;
  window.fetch = function(u, o) {
    try {
      if (typeof u === 'string') u = toProxy(u);
      else if (u && u.url) u = new Request(toProxy(u.url), u);
    } catch(e) {}
    return _fetch.call(window, u, o);
  };
  // Intercept WebSocket
  var _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    try {
      var wsUrl = String(url).replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      url = '/px?url=' + encodeURIComponent(wsUrl);
      url = url.replace('http:', 'ws:').replace('https:', 'wss:');
    } catch(e) {}
    return new _WS(url, protocols);
  };
  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (a) {
      var h = a.getAttribute('href');
      if (h && !h.startsWith('#') && !h.startsWith('javascript')) {
        try {
          var abs = new URL(h, location.href).href;
          if (abs.startsWith('http')) {
            e.preventDefault();
            e.stopPropagation();
            location.href = '/px?url=' + encodeURIComponent(abs);
          }
        } catch(e2) {}
      }
    }
  }, true);
  // Intercept form submits
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (f && f.action && f.action.startsWith('http')) {
      e.preventDefault();
      var data = new URLSearchParams(new FormData(f)).toString();
      var sep = f.action.includes('?') ? '&' : '?';
      var target = (f.method && f.method.toUpperCase() === 'POST')
        ? f.action : f.action + (data ? sep + data : '');
      location.href = '/px?url=' + encodeURIComponent(target);
    }
  }, true);
  // Rewrite history pushState/replaceState
  ['pushState','replaceState'].forEach(function(fn) {
    var orig = history[fn];
    history[fn] = function(state, title, url) {
      if (url) {
        try {
          var abs = new URL(url, location.href).href;
          if (abs.startsWith('http')) url = '/px?url=' + encodeURIComponent(abs);
        } catch(e) {}
      }
      return orig.call(this, state, title, url);
    };
  });
  // Rewrite window.open
  var _open = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      url = '/px?url=' + encodeURIComponent(url);
    }
    return _open.call(window, url, target, features);
  };
  // Rewrite location.assign / replace
  var _assign = Location.prototype.assign;
  Location.prototype.assign = function(url) {
    try {
      var abs = new URL(url, location.href).href;
      if (abs.startsWith('http')) return _assign.call(location, '/px?url=' + encodeURIComponent(abs));
    } catch(e) {}
    return _assign.call(location, url);
  };
  var _replace = Location.prototype.replace;
  Location.prototype.replace = function(url) {
    try {
      var abs = new URL(url, location.href).href;
      if (abs.startsWith('http')) return _replace.call(location, '/px?url=' + encodeURIComponent(abs));
    } catch(e) {}
    return _replace.call(location, url);
  };
})();
</script>`;

  // Remove existing base tags
  html = html.replace(/<base\s[^>]*>/gi, '');

  // Rewrite static resource attributes
  const attrRewrites = [
    /(<a\b[^>]*?\shref=)(["'])([^"'#\s][^"']*)(["'])/gi,
    /(<form\b[^>]*?\saction=)(["'])([^"']*)(["'])/gi,
    /(<script\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<link\b[^>]*?\shref=)(["'])([^"']*)(["'])/gi,
    /(<img\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<source\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<video\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<iframe\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<meta\b[^>]*?\scontent=)(["'])(https?:\/\/[^"']*)(["'])/gi,
  ];

  for (const rx of attrRewrites) {
    html = html.replace(rx, (m, pre, q1, url, q2) => {
      if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#')) return m;
      return pre + q1 + toProxyUrl(url, base) + q2;
    });
  }

  // Rewrite inline style url()
  html = html.replace(/(<[^>]+\sstyle="[^"]*url\()(['"]?)(https?:\/\/[^'")\s]+)\2(\))/gi, (m, pre, q, url, post) => {
    return pre + q + toProxyUrl(url, base) + q + post;
  });

  // Rewrite srcset attributes
  html = html.replace(/(<(?:img|source)\b[^>]*?\ssrcset=)(["'])([^"']*)(["'])/gi, (m, pre, q1, srcset, q2) => {
    const rewritten = srcset.replace(/(https?:\/\/[^\s,]+)/g, (u) => toProxyUrl(u, base));
    return pre + q1 + rewritten + q2;
  });

  // Inject script into <head> or at top
  if (/<head[\s>]/i.test(html)) {
    html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + injectScript);
  } else {
    html = injectScript + html;
  }

  return html;
}

function rewriteCss(css, base) {
  return css.replace(/url\((['"]?)([^'")\s]+)\1\)/gi, (m, q, url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return m;
    return 'url(' + q + toProxyUrl(url, base) + q + ')';
  });
}

function rewriteJs(js, base) {
  // Rewrite absolute URLs in JS strings (e.g. fetch("https://..."), location.href = "https://...")
  return js.replace(/(["'`])(https?:\/\/[^\s"'`]+)\1/g, (m, q, url) => {
    try { new URL(url); return q + toProxyUrl(url, base) + q; } catch(e) { return m; }
  });
}

function decompress(response) {
  const encoding = (response.headers.get('content-encoding') || '').toLowerCase();
  return { encoding };
}

// Detect resource type from URL path extension
function detectResourceType(urlPath) {
  const p = urlPath.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?)($|\?)/.test(p)) return 'image';
  if (/\.(js|mjs|cjs)($|\?)/.test(p)) return 'script';
  if (/\.(css)($|\?)/.test(p)) return 'style';
  if (/\.(woff2?|ttf|otf|eot)($|\?)/.test(p)) return 'font';
  if (/\.(mp4|webm|ogg|mp3|wav|flac|m4a|m3u8|ts)($|\?)/.test(p)) return 'media';
  if (/\.(json)($|\?)/.test(p)) return 'fetch';
  if (/\.(xml)($|\?)/.test(p)) return 'document';
  return 'document';
}

// Per-resource Accept + Sec-Fetch-* headers that match real Chrome behaviour
const RESOURCE_HEADERS = {
  document: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  image: {
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  },
  script: {
    'Accept': '*/*',
    'Sec-Fetch-Dest': 'script',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  },
  style: {
    'Accept': 'text/css,*/*;q=0.1',
    'Sec-Fetch-Dest': 'style',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  },
  font: {
    'Accept': '*/*',
    'Sec-Fetch-Dest': 'font',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
  },
  media: {
    'Accept': '*/*',
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
  },
  fetch: {
    'Accept': 'application/json,text/plain,*/*',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  },
};

// Build upstream request headers from client request
function buildUpstreamHeaders(clientReq, targetUrl) {
  const ua = pickUA();
  const resourceType = detectResourceType(targetUrl.pathname + targetUrl.search);
  const rh = RESOURCE_HEADERS[resourceType] || RESOURCE_HEADERS.document;

  const headers = {
    'User-Agent': ua,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'DNT': '1',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-full-version-list': '"Chromium";v="124.0.6367.82", "Google Chrome";v="124.0.6367.82", "Not-A.Brand";v="99.0.0.0"',
    ...rh,
  };

  // Documents navigate from nowhere; subresources have a referer
  if (resourceType === 'document') {
    headers['Referer'] = targetUrl.origin + '/';
    headers['Origin'] = targetUrl.origin;
  } else {
    // Subresources appear to come from the same site
    headers['Referer'] = targetUrl.origin + '/';
  }

  // Forward cookies from client → upstream
  const incomingCookie = clientReq.headers['cookie'];
  if (incomingCookie) headers['Cookie'] = incomingCookie;

  // Forward content-type for POST/PUT
  if (clientReq.headers['content-type']) headers['Content-Type'] = clientReq.headers['content-type'];

  // Forward X-Requested-With for AJAX
  if (clientReq.headers['x-requested-with']) headers['X-Requested-With'] = clientReq.headers['x-requested-with'];

  return headers;
}

// Decode compressed response body
async function decodeBody(response) {
  const encoding = (response.headers.get('content-encoding') || '').toLowerCase();
  const buf = Buffer.from(await response.arrayBuffer());

  if (!encoding || encoding === 'identity') return buf;

  return new Promise((resolve, reject) => {
    if (encoding === 'gzip' || encoding === 'x-gzip') {
      zlib.gunzip(buf, (err, result) => err ? resolve(buf) : resolve(result));
    } else if (encoding === 'deflate') {
      zlib.inflate(buf, (err, result) => {
        if (err) {
          zlib.inflateRaw(buf, (err2, result2) => err2 ? resolve(buf) : resolve(result2));
        } else {
          resolve(result);
        }
      });
    } else if (encoding === 'br') {
      zlib.brotliDecompress(buf, (err, result) => err ? resolve(buf) : resolve(result));
    } else {
      resolve(buf);
    }
  });
}

// Rewrite Set-Cookie headers so they work on our domain
function rewriteSetCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map(c => {
    return c
      .replace(/;\s*domain=[^;]*/gi, '')
      .replace(/;\s*secure/gi, '')
      .replace(/;\s*samesite=[^;]*/gi, '; SameSite=Lax');
  });
}

// ── Server-side web proxy ──────────────────────────────────────────────────────
app.all('/px', async (req, res) => {
  let rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).send('Missing url parameter');
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

  let targetUrl;
  try { targetUrl = new URL(rawUrl); } catch (e) {
    return res.status(400).send('Invalid URL');
  }

  try {
    const upstreamHeaders = buildUpstreamHeaders(req, targetUrl);

    const fetchOptions = {
      method: req.method === 'GET' || req.method === 'HEAD' ? req.method : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    };

    // Forward body for POST/PUT
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      fetchOptions.method = req.method;
      const bodyChunks = [];
      for await (const chunk of req) bodyChunks.push(chunk);
      if (bodyChunks.length > 0) fetchOptions.body = Buffer.concat(bodyChunks);
    }

    const response = await fetch(targetUrl.href, fetchOptions);
    const finalUrl = new URL(response.url || rawUrl);

    // Strip security headers and forward safe ones
    response.headers.forEach((value, name) => {
      const lower = name.toLowerCase();
      if (STRIP_RES_HEADERS.has(lower)) return;
      if (lower === 'set-cookie') return; // handle separately
      if (lower === 'location') return; // handle separately
      try { res.setHeader(name, value); } catch (e) {}
    });

    // Explicitly remove security headers
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');

    // Set CORS permissive headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Forward rewritten Set-Cookie headers
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    const rewritten = rewriteSetCookie(setCookies);
    if (rewritten && rewritten.length > 0) {
      res.setHeader('Set-Cookie', rewritten);
    }

    // Handle redirects — rewrite location header
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const abs = new URL(location, finalUrl).href;
        res.setHeader('Location', '/px?url=' + encodeURIComponent(abs));
        return res.status(response.status).end();
      }
    }

    res.status(response.status);

    const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    if (ct === 'text/html' || ct === 'application/xhtml+xml') {
      const body = await decodeBody(response);
      let html = body.toString('utf8');
      html = rewriteHtml(html, finalUrl);
      res.removeHeader('content-length');
      res.removeHeader('content-encoding');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    if (ct === 'text/css') {
      const body = await decodeBody(response);
      let css = body.toString('utf8');
      css = rewriteCss(css, finalUrl);
      res.removeHeader('content-length');
      res.removeHeader('content-encoding');
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }

    if (ct === 'application/javascript' || ct === 'text/javascript' || ct === 'application/x-javascript') {
      const body = await decodeBody(response);
      let js = body.toString('utf8');
      // Only do lightweight rewriting for JS to avoid breaking complex bundles
      // Just make sure absolute URLs in strings are proxied
      res.removeHeader('content-length');
      res.removeHeader('content-encoding');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(js);
    }

    if (ct === 'application/json') {
      const body = await decodeBody(response);
      let json = body.toString('utf8');
      // Rewrite URLs in JSON responses
      json = json.replace(/"(https?:\/\/[^"]+)"/g, (m, url) => {
        try { new URL(url); return '"' + toProxyUrl(url, finalUrl) + '"'; } catch(e) { return m; }
      });
      res.removeHeader('content-length');
      res.removeHeader('content-encoding');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(json);
    }

    // Binary / streams (images, fonts, media, etc.)
    // IMPORTANT: Node's undici (native fetch) auto-decompresses gzip/br/deflate,
    // so arrayBuffer() is already raw bytes. We MUST remove content-encoding or
    // the browser will try to decompress again and get corrupted data.
    res.removeHeader('content-length');
    res.removeHeader('content-encoding');
    const buf = Buffer.from(await response.arrayBuffer());
    return res.send(buf);

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.message.includes('timeout');
    res.status(502).send(`<!DOCTYPE html><html><head><title>Proxy Error</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:24px}
      h2{color:#e53935;font-size:22px}
      p{color:#888;font-size:14px;max-width:480px;text-align:center;line-height:1.6}
      .url{color:#aaa;font-size:12px;word-break:break-all;max-width:480px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}
      a{color:#58a6ff;font-size:14px;text-decoration:none}
      a:hover{text-decoration:underline}
    </style></head><body>
      <h2>${isTimeout ? '⏱ Request Timed Out' : '⚠ Could not load page'}</h2>
      <p>${isTimeout
        ? 'The request took too long. The site may be slow or blocking proxies.'
        : 'This site could not be loaded through the proxy. It may block server-side requests or require special handling.'
      }</p>
      <div class="url">${rawUrl}</div>
      <p style="font-size:12px">Error: ${err.message}</p>
      <a href="javascript:history.back()">← Go back</a>
    </body></html>`);
  }
});

// ── Search autocomplete suggestions ───────────────────────────────────────────
app.get('/suggestions', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const r = await fetch(
      'https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list',
      {
        headers: {
          'User-Agent': pickUA(),
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!r.ok) return res.json([]);
    const data = await r.json();
    // DuckDuckGo returns [{phrase: "..."}, ...] or OpenSearch [query, [suggestions]]
    let suggestions = [];
    if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
      suggestions = data[1];
    } else if (Array.isArray(data)) {
      suggestions = data.map(d => (typeof d === 'string' ? d : d.phrase)).filter(Boolean);
    }
    res.json(suggestions.slice(0, 8));
  } catch (e) {
    res.json([]);
  }
});

// OPTIONS preflight for CORS
app.options('/px', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.sendStatus(204);
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Invite / Ticket System ────────────────────────────────────────────────────
app.use(express.json());

const INVITES_PATH = path.join(__dirname, 'data', 'invites.json');

function readInvites() {
  try {
    if (fs.existsSync(INVITES_PATH)) return JSON.parse(fs.readFileSync(INVITES_PATH, 'utf8'));
  } catch {}
  return { invites: {} };
}
function writeInvites(data) {
  try {
    fs.mkdirSync(path.dirname(INVITES_PATH), { recursive: true });
    fs.writeFileSync(INVITES_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// Simple djb2-style fingerprint from IP + User-Agent (no external deps)
function makeFingerprint(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress || 'unknown';
  const ua = (req.headers['user-agent'] || '').slice(0, 120);
  const raw = ip + '|' + ua;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// GET /api/invite/status?uid=<uid>
app.get('/api/invite/status', (req, res) => {
  const uid = (req.query.uid || '').trim();
  if (!uid) return res.json({ count: 0, premiumGranted: false });
  const data = readInvites();
  const entry = (data.invites || {})[uid] || {};
  res.json({ count: entry.count || 0, premiumGranted: !!entry.premiumGranted });
});

// POST /api/invite/visit  { ref: referrerUid, visitor_uid: visitorUid }
app.post('/api/invite/visit', (req, res) => {
  const ref        = (req.body?.ref         || '').trim();
  const visitorUid = (req.body?.visitor_uid || '').trim();
  if (!ref) return res.json({ ok: false, reason: 'missing_ref' });

  // Anti-cheat 1: can't invite yourself by UID
  if (visitorUid && visitorUid === ref) {
    return res.json({ ok: false, reason: 'self_invite' });
  }

  const fp   = makeFingerprint(req);
  const data = readInvites();
  if (!data.invites) data.invites = {};

  const entry = data.invites[ref] || { count: 0, fingerprints: [], uids: [], premiumGranted: false };

  // Anti-cheat 2: same device/IP already counted for this referrer
  if (Array.isArray(entry.fingerprints) && entry.fingerprints.includes(fp)) {
    return res.json({ ok: false, reason: 'already_counted', count: entry.count });
  }
  // Anti-cheat 3: same signed-in user already counted
  if (visitorUid && Array.isArray(entry.uids) && entry.uids.includes(visitorUid)) {
    return res.json({ ok: false, reason: 'already_counted_uid', count: entry.count });
  }

  if (!Array.isArray(entry.fingerprints)) entry.fingerprints = [];
  if (!Array.isArray(entry.uids)) entry.uids = [];

  entry.fingerprints.push(fp);
  if (visitorUid) entry.uids.push(visitorUid);
  entry.count = (entry.count || 0) + 1;
  if (entry.count >= 5) entry.premiumGranted = true;

  data.invites[ref] = entry;
  writeInvites(data);

  res.json({ ok: true, count: entry.count, premiumGranted: entry.premiumGranted });
});

// POST /api/invite/claim  { uid }  — marks premium as granted for the user
app.post('/api/invite/claim', (req, res) => {
  const uid = (req.body?.uid || '').trim();
  if (!uid) return res.json({ ok: false, reason: 'missing_uid' });

  const data = readInvites();
  if (!data.invites) data.invites = {};
  const entry = data.invites[uid] || { count: 0 };

  if ((entry.count || 0) < 5) {
    return res.json({ ok: false, reason: 'not_enough_invites', count: entry.count });
  }
  entry.premiumGranted = true;
  data.invites[uid] = entry;
  writeInvites(data);
  res.json({ ok: true, message: 'premium_granted' });
});

// ─────────────────────────────────────────────────────────────────────────────

app.use(express.static(SITE_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.removeHeader('X-Frame-Options');
    }
  }
}));

app.get('/blackmarket', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'blackmarket.html'));
});

app.get('/proxy', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'proxy.html'));
});

app.get('/proxy1', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'proxy1.html'));
});

app.get('/proxy2', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'proxy2.html'));
});

app.get('/{*path}', (req, res) => {
  const htmlPath = path.join(SITE_DIR, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FasahatHub server running on port ${PORT}`);
  console.log(`Serving: ${SITE_DIR}`);
});
