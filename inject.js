// FasahatHub Extensions v1.0
// Adds: Search w/ Filters, Continue Watching, Theme Colors (in Settings),
//       Activity Feed (from DM contacts), Watch History, Profile navigation,
//       Feature Suggestions (Admin)
(function () {
  'use strict';

  /* =========================================================
     UTILITIES
  ========================================================= */
  const K = {
    accent: 'fas_accent_color',
    watching: 'fas_continue_watching',
    history: 'fas_watch_history',
    suggestions: 'fas_my_suggestions',
  };

  function gs(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  }
  function ss(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function waitForFB(cb, n = 0) {
    if (window.db && window.fsCollection && window.fsGetDocs) { cb(); }
    else if (n < 40) { setTimeout(() => waitForFB(cb, n + 1), 500); }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* =========================================================
     1.  THEME / ACCENT COLOR  (feature 9 – injected into Settings)
  ========================================================= */
  const SWATCHES = [
    { name: 'Crimson',  val: '#ef4444' },
    { name: 'Rose',     val: '#f43f5e' },
    { name: 'Orange',   val: '#f97316' },
    { name: 'Amber',    val: '#f59e0b' },
    { name: 'Emerald',  val: '#10b981' },
    { name: 'Cyan',     val: '#06b6d4' },
    { name: 'Azure',    val: '#3b82f6' },
    { name: 'Indigo',   val: '#6366f1' },
    { name: 'Violet',   val: '#8b5cf6' },
    { name: 'Pink',     val: '#ec4899' },
  ];

  let curAccent = gs(K.accent, '#ef4444');

  function applyAccent(hex) {
    curAccent = hex;
    ss(K.accent, hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    let el = document.getElementById('fas-accent-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'fas-accent-style';
      document.head.appendChild(el);
    }
    el.textContent = `
      :root { --mk-accent-red: ${hex} !important; --fas-accent: ${hex} !important; }
      .bg-\\[var\\(--mk-accent-red\\)\\] { background-color: ${hex} !important; }
      .bg-red-400,.bg-red-500,.bg-red-600 { background-color: ${hex} !important; }
      .text-red-400,.text-red-500,.text-red-600 { color: ${hex} !important; }
      .border-red-400,.border-red-500,.border-red-600 { border-color: ${hex} !important; }
      .hover\\:bg-red-600:hover { background-color: color-mix(in srgb,${hex} 80%,#000) !important; }
      .shadow-red-500\\/20 { box-shadow: 0 4px 20px rgba(${r},${g},${b},0.25) !important; }
      #fas-ext-fab { background: ${hex} !important; }
      #fas-suggestion-submit { background: ${hex} !important; }
    `;
    // Update any open swatches
    document.querySelectorAll('.fas-swatch').forEach(sw => {
      sw.style.outline = sw.dataset.val === hex ? '2px solid white' : '2px solid transparent';
    });
    const hexLabel = document.getElementById('fas-hex-label');
    if (hexLabel) hexLabel.textContent = hex;
    const picker = document.getElementById('fas-custom-picker');
    if (picker) picker.value = hex;
  }

  applyAccent(curAccent);

  // Inject color section into the existing settings modal
  function tryInjectSettings(root) {
    if (!root.querySelectorAll) return;
    const spans = root.querySelectorAll('span, div');
    for (const el of spans) {
      if (el.childElementCount === 0 && el.textContent.trim() === 'Knight Presets') {
        const scrollContainer = el.closest('[class*="overflow-y"]') || el.closest('.p-6');
        if (scrollContainer && !scrollContainer.querySelector('#fas-color-section')) {
          buildColorSection(scrollContainer);
        }
        break;
      }
    }
  }

  function buildColorSection(container) {
    const sec = document.createElement('div');
    sec.id = 'fas-color-section';
    sec.style.cssText = 'margin-top:28px;';
    sec.innerHTML = `
      <div style="font-size:11px;color:var(--mk-eye-glow,#ff6b6b);text-transform:uppercase;margin-bottom:14px;font-weight:700;display:flex;align-items:center;gap:7px;letter-spacing:.06em;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
        Accent Color
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,215,0,.07);border-radius:14px;padding:14px;">
        <div style="font-size:11px;opacity:.55;color:var(--mk-silver,#ccc);margin-bottom:10px;">Choose your accent</div>
        <div id="fas-swatch-row" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          ${SWATCHES.map(s => `
            <button class="fas-swatch" data-val="${s.val}" title="${s.name}"
              style="width:26px;height:26px;border-radius:50%;background:${s.val};border:none;cursor:pointer;outline:${s.val === curAccent ? '2px solid white' : '2px solid transparent'};outline-offset:2px;transition:transform .15s,outline .15s;"
              onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">
            </button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="color" id="fas-custom-picker" value="${curAccent}"
            style="width:36px;height:30px;border:none;background:none;cursor:pointer;border-radius:6px;padding:0;">
          <span style="font-size:11px;opacity:.6;color:var(--mk-silver,#ccc);">Custom</span>
          <code id="fas-hex-label" style="font-size:11px;color:var(--mk-gold,#f5c518);font-family:monospace;">${curAccent}</code>
        </div>
      </div>`;
    container.appendChild(sec);

    sec.querySelectorAll('.fas-swatch').forEach(btn => {
      btn.addEventListener('click', () => applyAccent(btn.dataset.val));
    });
    sec.querySelector('#fas-custom-picker').addEventListener('input', e => applyAccent(e.target.value));
  }

  /* =========================================================
     2.  CONTENT TRACKING  (Continue Watching + History)
  ========================================================= */
  function recordView(item) {
    const hist = gs(K.history, []);
    const watch = gs(K.watching, []);
    const newH = [item, ...hist.filter(h => h.id !== item.id)].slice(0, 60);
    const newW = [item, ...watch.filter(h => h.id !== item.id)].slice(0, 15);
    ss(K.history, newH);
    ss(K.watching, newW);
  }

  // Detect content type from visible h1
  function detectType() {
    const h = (document.querySelector('h1')?.textContent || '').toLowerCase();
    if (h.includes('m0v') || h.includes('movie')) return 'movie';
    if (h.includes('an1m') || h.includes('anim')) return 'anime';
    if (h.includes('show') || h.includes('tv')) return 'tv';
    if (h.includes('manga')) return 'manga';
    if (h.includes('game') || h.includes('g4m3')) return 'game';
    return 'content';
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('.rounded-2xl');
    if (!card) return;
    const img = card.querySelector('img[src^="http"]');
    const titleEl = card.querySelector('h3') || card.querySelector('h2');
    if (!img || !titleEl) return;
    const title = titleEl.textContent.trim();
    if (title.length < 2) return;
    recordView({
      id: title.toLowerCase().replace(/\W+/g, '-'),
      title,
      imageUrl: img.src,
      type: detectType(),
      timestamp: Date.now(),
    });
  }, true);

  /* =========================================================
     3.  SEARCH OVERLAY  (feature 1)
  ========================================================= */
  function buildSearchOverlay() {
    const ov = document.createElement('div');
    ov.id = 'fas-search-overlay';
    ov.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);display:none;flex-direction:column;align-items:center;padding:72px 20px 40px;font-family:Inter,sans-serif;`;
    ov.innerHTML = `
      <div style="width:100%;max-width:680px;">
        <div style="position:relative;margin-bottom:16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.7)" stroke-width="2.5" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="fas-s-input" type="text" placeholder="Search titles, posts, people…"
            style="width:100%;padding:16px 50px 16px 46px;background:rgba(8,8,18,.97);border:2px solid rgba(255,215,0,.35);border-radius:14px;color:#fff;font-size:15px;outline:none;box-sizing:border-box;font-family:inherit;">
          <kbd style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;color:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 7px;pointer-events:none;">ESC</kbd>
        </div>
        <div id="fas-filters" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
          ${['All','Movies','Anime','TV','Manga','Games','Posts'].map((f,i)=>`
            <button class="fas-fb" data-f="${f.toLowerCase()}"
              style="padding:5px 13px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid ${i===0?'rgba(255,215,0,.5)':'rgba(255,255,255,.12)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.45)'};outline:none;transition:all .15s;">${f}</button>`).join('')}
        </div>
        <div id="fas-s-results" style="color:rgba(255,255,255,.35);font-size:13px;text-align:center;padding:36px 0;">Start typing to search…</div>
      </div>`;
    document.body.appendChild(ov);

    let activeFilter = 'all';
    ov.querySelectorAll('.fas-fb').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.f;
        ov.querySelectorAll('.fas-fb').forEach(b => {
          const on = b.dataset.f === activeFilter;
          b.style.borderColor = on ? 'rgba(255,215,0,.5)' : 'rgba(255,255,255,.12)';
          b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
          b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.45)';
        });
        doSearch(ov.querySelector('#fas-s-input').value.trim(), activeFilter);
      });
    });

    const input = ov.querySelector('#fas-s-input');
    let debounce;
    input.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doSearch(e.target.value.trim(), activeFilter), 250);
    });

    ov.addEventListener('click', e => { if (e.target === ov) closeSearch(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    function doSearch(q, filter) {
      const res = ov.querySelector('#fas-s-results');
      if (!q || q.length < 2) {
        res.innerHTML = '<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);">Start typing to search…</div>';
        return;
      }
      const ql = q.toLowerCase();
      // Search tracked items first
      const pool = [...new Map([
        ...gs(K.watching, []), ...gs(K.history, [])
      ].map(i => [i.id, i])).values()];

      let hits = pool.filter(item => {
        if (filter !== 'all' && !item.type.startsWith(filter.replace(' ', ''))) return false;
        return item.title.toLowerCase().includes(ql);
      });

      if (hits.length) { renderHits(hits, res, q); return; }

      // Fallback: Firebase posts
      res.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:12px;">Searching…</div>';
      waitForFB(async () => {
        try {
          const snap = await window.fsGetDocs(window.fsCollection(window.db, 'posts'));
          const results = [];
          snap.forEach(doc => {
            const d = doc.data() || {};
            const content = (d.content || '').toLowerCase();
            const name = (d.authorName || '').toLowerCase();
            if ((filter === 'all' || filter === 'posts') && (content.includes(ql) || name.includes(ql))) {
              results.push({ id: doc.id, title: `${d.authorName}: ${(d.content||'').slice(0,55)}…`, imageUrl: d.authorPhoto||null, type: 'post' });
            }
          });
          renderHits(results, res, q);
        } catch { renderHits([], res, q); }
      });
    }

    function renderHits(hits, el, q) {
      if (!hits.length) {
        el.innerHTML = `<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);"><div style="font-size:28px;margin-bottom:10px;">🔍</div>No results for <strong style="color:rgba(255,255,255,.5);">"${esc(q)}"</strong><div style="font-size:11px;margin-top:6px;opacity:.6;">Browse a hub first to populate your history.</div></div>`;
        return;
      }
      el.innerHTML = `
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:12px;">${hits.length} result${hits.length!==1?'s':''}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;">
          ${hits.map(item => `
            <div style="border-radius:10px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);">
              ${item.imageUrl
                ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" style="width:100%;aspect-ratio:2/3;object-fit:cover;">`
                : `<div style="width:100%;aspect-ratio:2/3;background:rgba(255,215,0,.05);display:flex;align-items:center;justify-content:center;font-size:26px;">🎬</div>`}
              <div style="padding:7px;">
                <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,.8);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;">${esc(item.title)}</div>
                <div style="font-size:9px;color:rgba(255,215,0,.55);margin-top:3px;text-transform:uppercase;">${esc(item.type)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }
  }

  function openSearch() {
    const ov = document.getElementById('fas-search-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    setTimeout(() => ov.querySelector('#fas-s-input')?.focus(), 50);
  }
  function closeSearch() {
    const ov = document.getElementById('fas-search-overlay');
    if (!ov) return;
    ov.style.display = 'none';
    const inp = ov.querySelector('#fas-s-input');
    if (inp) inp.value = '';
  }

  /* =========================================================
     4.  EXTENSIONS PANEL  (Continue Watching / History / Activity / Suggest)
  ========================================================= */
  function buildPanel() {
    // FAB button
    const fab = document.createElement('button');
    fab.id = 'fas-ext-fab';
    fab.title = 'Extensions';
    fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    fab.style.cssText = `position:fixed;bottom:80px;right:16px;z-index:9990;width:44px;height:44px;border-radius:50%;background:${curAccent};border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 22px rgba(0,0,0,.45);transition:transform .2s;`;
    fab.addEventListener('mouseenter', () => fab.style.transform = 'scale(1.12)');
    fab.addEventListener('mouseleave', () => fab.style.transform = '');

    // Panel
    const panel = document.createElement('div');
    panel.id = 'fas-ext-panel';
    panel.style.cssText = `position:fixed;bottom:136px;right:16px;z-index:9989;width:370px;max-height:78vh;background:#09091a;border:1px solid rgba(255,215,0,.13);border-radius:18px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.65);font-family:Inter,sans-serif;`;

    panel.innerHTML = `
      <div style="padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,.06);">
        <div style="font-size:13px;font-weight:700;color:var(--mk-gold,#f5c518);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">⚡ Extensions</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${[['watching','▶ Watching'],['history','📜 History'],['search','🔍 Search'],['suggest','💡 Suggest']].map(([id,label],i) => `
            <button class="fas-ptab" data-tab="${id}"
              style="font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid ${i===0?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.4)'};cursor:pointer;white-space:nowrap;transition:all .15s;outline:none;">${label}</button>`).join('')}
        </div>
      </div>
      <div id="fas-pbody" style="overflow-y:auto;flex:1;padding:14px;"></div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    let activeTab = 'watching';
    function setTab(tab) {
      activeTab = tab;
      panel.querySelectorAll('.fas-ptab').forEach(b => {
        const on = b.dataset.tab === tab;
        b.style.borderColor = on ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.1)';
        b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
        b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.4)';
      });
      renderTab(tab);
    }

    panel.querySelectorAll('.fas-ptab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    function renderTab(tab) {
      const body = panel.querySelector('#fas-pbody');
      if (tab === 'watching') renderWatching(body);
      else if (tab === 'history') renderHistory(body);
      else if (tab === 'search') renderSearchTab(body);
      else if (tab === 'suggest') renderSuggest(body);
    }

    fab.addEventListener('click', () => {
      const open = panel.style.display === 'flex';
      panel.style.display = open ? 'none' : 'flex';
      if (!open) renderTab(activeTab);
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== fab) panel.style.display = 'none';
    });
  }

  /* ---- Watching ---- */
  function renderWatching(el) {
    const items = gs(K.watching, []);
    if (!items.length) {
      el.innerHTML = emptyState('🎬', 'Click on any movie, anime, or show card to track it here.');
      return;
    }
    el.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Continue Watching</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;">
        ${items.slice(0,9).map(item => `
          <div style="position:relative;aspect-ratio:2/3;border-radius:9px;overflow:hidden;cursor:pointer;border:1px solid rgba(255,215,0,.08);" title="${esc(item.title)}">
            <img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.88));padding:16px 5px 5px;font-size:9px;color:#fff;font-weight:600;line-height:1.3;">${esc(item.title)}</div>
            <div style="position:absolute;top:3px;right:3px;font-size:7px;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,.7);color:rgba(255,215,0,.8);text-transform:uppercase;">${esc(item.type)}</div>
          </div>`).join('')}
      </div>
      ${items.length > 9 ? `<div style="text-align:center;margin-top:8px;font-size:10px;color:rgba(255,255,255,.25);">+${items.length-9} more in History</div>` : ''}`;
  }

  /* ---- History ---- */
  function renderHistory(el) {
    const items = gs(K.history, []);
    if (!items.length) { el.innerHTML = emptyState('📜', 'No history yet.'); return; }
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;">Watch History (${items.length})</div>
        <button id="fas-clear-hist" style="font-size:10px;color:rgba(255,80,80,.65);background:none;border:none;cursor:pointer;text-decoration:underline;">Clear</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${items.map(item => `
          <div style="display:flex;gap:10px;align-items:center;padding:8px;background:rgba(255,255,255,.03);border-radius:9px;border:1px solid rgba(255,255,255,.05);">
            <img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" style="width:32px;height:48px;object-fit:cover;border-radius:5px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.title)}</div>
              <div style="font-size:9px;color:rgba(255,215,0,.55);text-transform:uppercase;margin-top:2px;">${esc(item.type)}</div>
              <div style="font-size:9px;color:rgba(255,255,255,.22);margin-top:1px;">${new Date(item.timestamp).toLocaleDateString()}</div>
            </div>
          </div>`).join('')}
      </div>`;
    el.querySelector('#fas-clear-hist').addEventListener('click', () => {
      ss(K.history, []); ss(K.watching, []); renderHistory(el);
    });
  }

  /* ---- Activity Feed (from DM contacts) ---- */
  function renderActivity(el) {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (!user) {
      el.innerHTML = emptyState('🔐', 'Sign in to see activity from your DM contacts.');
      return;
    }
    el.innerHTML = `<div style="text-align:center;padding:32px 0;color:rgba(255,255,255,.35);font-size:12px;">Loading…</div>`;

    waitForFB(async () => {
      const { db, fsCollection, fsGetDocs, fsQuery, fsOrderBy } = window;
      try {
        // Step 1: find DM contacts
        const convSnap = await fsGetDocs(fsCollection(db, 'conversations'));
        const contacts = new Set();
        convSnap.forEach(doc => {
          const parts = (doc.data()?.participants) || [];
          if (parts.includes(user.uid)) parts.forEach(uid => { if (uid !== user.uid) contacts.add(uid); });
        });

        if (!contacts.size) {
          el.innerHTML = emptyState('💬', "No DM contacts yet — start a conversation first!");
          return;
        }

        // Step 2: get their recent posts
        const postsSnap = await fsGetDocs(fsQuery(fsCollection(db, 'posts'), fsOrderBy('createdAt', 'desc')));
        const feed = [];
        postsSnap.forEach(doc => {
          const d = doc.data() || {};
          if (contacts.has(d.authorUid) && feed.length < 25) {
            feed.push({
              id: doc.id,
              content: d.content || '',
              author: d.authorName || 'Anonymous',
              authorUid: d.authorUid,
              authorPhoto: d.authorPhoto || null,
              image: d.imageUrl || null,
              time: d.createdAt?.toDate?.()?.getTime() || Date.now(),
            });
          }
        });

        if (!feed.length) {
          el.innerHTML = emptyState('📭', 'None of your DM contacts have posted recently.');
          return;
        }

        el.innerHTML = `
          <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Posts from DM Contacts</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${feed.map(post => `
              <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  ${post.authorPhoto
                    ? `<img src="${esc(post.authorPhoto)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,215,0,.2);">`
                    : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,215,0,.1);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:rgba(255,215,0,.7);">${esc(post.author[0])}</div>`}
                  <div>
                    <div style="font-size:11px;font-weight:600;color:rgba(255,215,0,.8);">${esc(post.author)}</div>
                    <div style="font-size:9px;color:rgba(255,255,255,.25);">${new Date(post.time).toLocaleDateString()}</div>
                  </div>
                </div>
                ${post.content ? `<div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${esc(post.content)}</div>` : ''}
                ${post.image ? `<img src="${esc(post.image)}" style="width:100%;border-radius:8px;margin-top:8px;max-height:120px;object-fit:cover;">` : ''}
              </div>`).join('')}
          </div>`;
      } catch (err) {
        el.innerHTML = `<div style="text-align:center;padding:24px;color:rgba(255,100,100,.55);font-size:12px;">Could not load feed.<br><span style="font-size:10px;opacity:.6;">${esc(err.message)}</span></div>`;
      }
    });
  }

  /* ---- Search shortcut tab ---- */
  function renderSearchTab(el) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px 0;">
        <div style="font-size:32px;margin-bottom:12px;">🔍</div>
        <div style="font-size:13px;color:rgba(255,255,255,.65);margin-bottom:16px;">Global search across all your content history</div>
        <button id="fas-open-search-btn"
          style="padding:10px 24px;background:var(--mk-accent-red,#ef4444);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:.04em;">
          Open Search
        </button>
        <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.3);">Or press <kbd style="border:1px solid rgba(255,255,255,.2);border-radius:3px;padding:1px 5px;">Ctrl+K</kbd></div>
      </div>`;
    el.querySelector('#fas-open-search-btn').addEventListener('click', () => {
      document.getElementById('fas-ext-panel').style.display = 'none';
      openSearch();
    });
  }

  /* ---- Feature Suggestions ---- */
  function renderSuggest(el) {
    const saved = gs(K.suggestions, []);
    el.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Suggest a Feature to Admin</div>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,215,0,.1);border-radius:12px;padding:14px;margin-bottom:14px;">
        <textarea id="fas-sug-text" placeholder="Describe your idea…"
          style="width:100%;min-height:72px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.8);font-size:12px;padding:8px;resize:vertical;outline:none;font-family:inherit;box-sizing:border-box;line-height:1.5;"></textarea>
        <input id="fas-sug-cat" type="text" placeholder="Category (Movies, Social, Design…)"
          style="width:100%;margin-top:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.8);font-size:12px;padding:8px;outline:none;font-family:inherit;box-sizing:border-box;">
        <button id="fas-sug-submit"
          style="margin-top:10px;width:100%;padding:10px;background:var(--mk-accent-red,#ef4444);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;transition:opacity .2s;">
          Submit Suggestion
        </button>
      </div>
      ${saved.length ? `
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:8px;text-transform:uppercase;">Your Suggestions (${saved.length})</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${saved.slice(0,8).map(s => `
            <div style="padding:8px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:8px;">
              <div style="font-size:11px;color:rgba(255,255,255,.6);">${esc(s.text)}</div>
              ${s.category ? `<div style="font-size:9px;color:rgba(255,215,0,.4);margin-top:3px;">${esc(s.category)}</div>` : ''}
              <div style="font-size:9px;color:rgba(255,255,255,.2);margin-top:2px;">${new Date(s.timestamp).toLocaleDateString()}</div>
            </div>`).join('')}
        </div>` : ''}`;

    el.querySelector('#fas-sug-submit').addEventListener('click', async () => {
      const text = el.querySelector('#fas-sug-text').value.trim();
      const category = el.querySelector('#fas-sug-cat').value.trim() || 'General';
      if (!text) return;
      const btn = el.querySelector('#fas-sug-submit');
      btn.textContent = 'Submitting…'; btn.style.opacity = '.6';

      const sug = {
        text, category, timestamp: Date.now(),
        userId: (window.__FIREBASE_USER__ || window.__USER__)?.uid || 'anonymous',
        userName: (window.__FIREBASE_USER__ || window.__USER__)?.displayName || 'Anonymous',
      };
      const prev = gs(K.suggestions, []);
      ss(K.suggestions, [sug, ...prev].slice(0, 30));

      try {
        if (window.db && window.fsCollection && window.fsAddDoc)
          await window.fsAddDoc(window.fsCollection(window.db, 'feature_suggestions'), sug);
      } catch {}

      btn.textContent = '✓ Submitted!'; btn.style.background = '#10b981'; btn.style.opacity = '1';
      setTimeout(() => renderSuggest(el), 2000);
    });
  }

  /* =========================================================
     5.  PROFILE CLICK → DM / POSTS NAV  (feature 15)
         Injects buttons into UserProfileModal when it opens
  ========================================================= */
  function tryInjectProfileModal(node) {
    if (!node.querySelectorAll) return;
    // The profile modal has a user-plus or user-minus button and an achievements section
    const followBtn = [...node.querySelectorAll('button')].find(b =>
      b.textContent.includes('Follow') || b.textContent.includes('Unfollow') || b.textContent.includes('Message')
    );
    if (!followBtn) return;
    const modalRoot = followBtn.closest('[class*="fixed"]') || followBtn.closest('[class*="modal"]') || followBtn.closest('[class*="z-50"]');
    if (!modalRoot || modalRoot.querySelector('#fas-profile-nav')) return;

    // Find the UID — look for data in parent or from displayed text
    const navRow = document.createElement('div');
    navRow.id = 'fas-profile-nav';
    navRow.style.cssText = 'display:flex;gap:8px;margin:10px 16px;';
    navRow.innerHTML = `
      <button id="fas-goto-posts"
        style="flex:1;padding:8px;border-radius:10px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);color:rgba(255,215,0,.85);font-size:11px;cursor:pointer;font-weight:600;transition:all .15s;">
        📝 View Posts
      </button>
      <button id="fas-goto-dms"
        style="flex:1;padding:8px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7);font-size:11px;cursor:pointer;font-weight:600;transition:all .15s;">
        💬 Send DM
      </button>`;

    followBtn.parentElement?.insertAdjacentElement('afterend', navRow) ||
      modalRoot.querySelector('[class*="overflow-y"]')?.prepend(navRow);

    // Clicking "View Posts" — close modal and navigate to posts tab
    navRow.querySelector('#fas-goto-posts').addEventListener('click', () => {
      // Click close button in modal
      const closeBtn = modalRoot.querySelector('button[class*="close"], button svg[class*="X"]')
        ?.closest('button') || [...modalRoot.querySelectorAll('button')].find(b => b.title === 'Close' || b.getAttribute('aria-label') === 'Close');
      closeBtn?.click();
      // Navigate to posts via nav link
      setTimeout(() => {
        const postsLink = [...document.querySelectorAll('a, button')].find(b =>
          b.textContent.trim().toLowerCase().includes('post') && !b.closest('#fas-ext-panel') && !b.closest('#fas-profile-nav'));
        postsLink?.click();
      }, 300);
    });

    // Clicking "Send DM" — close modal and navigate to DMs
    navRow.querySelector('#fas-goto-dms').addEventListener('click', () => {
      const closeBtn = [...modalRoot.querySelectorAll('button')].find(b =>
        b.title === 'Close' || b.getAttribute('aria-label') === 'Close' || (b.children[0]?.tagName === 'svg' && b.parentElement === modalRoot));
      closeBtn?.click();
      setTimeout(() => {
        const dmsLink = [...document.querySelectorAll('a, button')].find(b =>
          b.textContent.trim().toLowerCase().includes('dm') && !b.closest('#fas-ext-panel') && !b.closest('#fas-profile-nav'));
        dmsLink?.click();
      }, 300);
    });
  }

  /* =========================================================
     HELPERS
  ========================================================= */
  function emptyState(icon, msg) {
    return `<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);"><div style="font-size:30px;margin-bottom:10px;">${icon}</div><div style="font-size:12px;line-height:1.5;">${esc(msg)}</div></div>`;
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(typeof ts === 'object' && ts.toDate ? ts.toDate() : ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff/86400000) + 'd ago';
    return d.toLocaleDateString();
  }

  // Returns current authed user uid (checks both possible globals)
  function getUid() {
    return (window.__FIREBASE_USER__ || window.__USER__)?.uid || null;
  }

  // Waits for Firebase globals + authenticated user (checks both possible globals)
  function waitForFBAuth(cb, n = 0) {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (window.db && window.fsCollection && window.fsGetDocs && user) { cb(); }
    else if (n < 80) { setTimeout(() => waitForFBAuth(cb, n + 1), 500); }
  }

  function waitForFBPromise() {
    return new Promise(res => waitForFBAuth(res));
  }

  /* =========================================================
     5.  ADMIN — BAN DIALOG  (Feature 11)
  ========================================================= */
  let _banIntercepting = false;

  function buildBanDialog() {
    if (document.getElementById('fas-ban-dialog')) return;
    const ov = document.createElement('div');
    ov.id = 'fas-ban-dialog';
    ov.style.cssText = `display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.82);backdrop-filter:blur(10px);align-items:center;justify-content:center;font-family:Inter,sans-serif;`;
    ov.innerHTML = `
      <div style="background:#0d0d20;border:1.5px solid rgba(239,68,68,.4);border-radius:20px;padding:28px;width:360px;max-width:92vw;box-shadow:0 32px 80px rgba(0,0,0,.7);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93 19.07 19.07"/></svg>
          <span style="font-size:17px;font-weight:800;color:#ef4444;text-transform:uppercase;letter-spacing:.05em;">Ban User</span>
        </div>
        <div id="fas-ban-uname" style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:22px;padding-left:32px;"></div>
        <div style="display:grid;gap:10px;margin-bottom:18px;">
          <button id="fas-ban-perm" style="padding:14px 16px;background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.35);border-radius:13px;color:#ef4444;font-weight:700;font-size:13px;cursor:pointer;text-align:left;transition:all .15s;">
            🔒 Permanent Ban
            <div style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35);margin-top:4px;">User is banned indefinitely with no expiry</div>
          </button>
          <button id="fas-ban-temp" style="padding:14px 16px;background:rgba(251,191,36,.07);border:1.5px solid rgba(251,191,36,.25);border-radius:13px;color:#fbbf24;font-weight:700;font-size:13px;cursor:pointer;text-align:left;transition:all .15s;">
            ⏳ Temporary Ban
            <div style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35);margin-top:4px;">Ban expires after a set number of days</div>
          </button>
        </div>
        <div id="fas-ban-tempopts" style="display:none;margin-bottom:18px;padding:14px;background:rgba(255,255,255,.03);border-radius:12px;border:1px solid rgba(255,255,255,.07);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Duration (days)</label>
              <input id="fas-ban-days" type="number" min="1" max="365" value="7"
                style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:13px;outline:none;">
            </div>
            <div>
              <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Presets</label>
              <select id="fas-ban-preset"
                style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:12px;outline:none;cursor:pointer;">
                <option value="">Custom</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Reason (optional)</label>
          <input id="fas-ban-reason" type="text" placeholder="e.g. Spam, harassment, rule violation..."
            style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:12px;outline:none;">
        </div>
        <div style="display:flex;gap:10px;">
          <button id="fas-ban-cancel" style="flex:1;padding:10px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:rgba(255,255,255,.5);font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;">Cancel</button>
          <button id="fas-ban-confirm" style="display:none;flex:1;padding:10px 14px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(239,68,68,.3);transition:opacity .15s;">⛔ Confirm Ban</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    let _pendingBtn = null;
    let _banMode = null;

    const permBtn = ov.querySelector('#fas-ban-perm');
    const tempBtn = ov.querySelector('#fas-ban-temp');
    const tempOpts = ov.querySelector('#fas-ban-tempopts');
    const confirmBtn = ov.querySelector('#fas-ban-confirm');
    const preset = ov.querySelector('#fas-ban-preset');
    const daysInput = ov.querySelector('#fas-ban-days');

    permBtn.addEventListener('mouseenter', () => permBtn.style.background = 'rgba(239,68,68,.22)');
    permBtn.addEventListener('mouseleave', () => { if (_banMode !== 'permanent') permBtn.style.background = 'rgba(239,68,68,.12)'; });
    tempBtn.addEventListener('mouseenter', () => tempBtn.style.background = 'rgba(251,191,36,.14)');
    tempBtn.addEventListener('mouseleave', () => { if (_banMode !== 'temporary') tempBtn.style.background = 'rgba(251,191,36,.07)'; });

    permBtn.addEventListener('click', () => {
      _banMode = 'permanent';
      tempOpts.style.display = 'none';
      confirmBtn.style.display = 'block';
      permBtn.style.borderColor = 'rgba(239,68,68,.9)';
      permBtn.style.background = 'rgba(239,68,68,.22)';
      tempBtn.style.borderColor = 'rgba(251,191,36,.25)';
      tempBtn.style.background = 'rgba(251,191,36,.07)';
    });

    tempBtn.addEventListener('click', () => {
      _banMode = 'temporary';
      tempOpts.style.display = 'block';
      confirmBtn.style.display = 'block';
      tempBtn.style.borderColor = 'rgba(251,191,36,.9)';
      tempBtn.style.background = 'rgba(251,191,36,.14)';
      permBtn.style.borderColor = 'rgba(239,68,68,.35)';
      permBtn.style.background = 'rgba(239,68,68,.12)';
    });

    preset.addEventListener('change', () => {
      if (preset.value) daysInput.value = preset.value;
    });

    ov.querySelector('#fas-ban-cancel').addEventListener('click', closeBanDialog);
    ov.addEventListener('click', e => { if (e.target === ov) closeBanDialog(); });

    confirmBtn.addEventListener('click', async () => {
      if (!_pendingBtn) { closeBanDialog(); return; }
      if (_banMode === 'temporary') {
        const days = parseInt(daysInput.value) || 7;
        const reason = ov.querySelector('#fas-ban-reason').value.trim();
        const expiry = Date.now() + days * 86400000;
        const uid = _pendingBtn.dataset.fasUid;
        if (uid) {
          const bans = JSON.parse(localStorage.getItem('fh_ban_details') || '{}');
          bans[uid] = { type: 'temporary', expiry, reason, days };
          localStorage.setItem('fh_ban_details', JSON.stringify(bans));
          if (window.db && window.fsSetDoc && window.fsDoc) {
            try {
              await window.fsSetDoc(window.fsDoc(window.db, 'players', uid),
                { banned: true, banType: 'temporary', banExpiry: expiry, banReason: reason },
                { merge: true });
            } catch {}
          }
        }
      } else if (_banMode === 'permanent') {
        const uid = _pendingBtn.dataset.fasUid;
        if (uid && window.db && window.fsSetDoc && window.fsDoc) {
          try {
            await window.fsSetDoc(window.fsDoc(window.db, 'players', uid),
              { banned: true, banType: 'permanent', banReason: '' },
              { merge: true });
          } catch {}
        }
      }
      _banIntercepting = true;
      _pendingBtn.click();
      setTimeout(() => { _banIntercepting = false; }, 300);
      closeBanDialog();
    });

    window.__fas_openBanDialog = (btn, displayName) => {
      _pendingBtn = btn;
      _banMode = null;
      ov.querySelector('#fas-ban-uname').textContent = `Banning: ${displayName}`;
      confirmBtn.style.display = 'none';
      tempOpts.style.display = 'none';
      permBtn.style.borderColor = 'rgba(239,68,68,.35)';
      permBtn.style.background = 'rgba(239,68,68,.12)';
      tempBtn.style.borderColor = 'rgba(251,191,36,.25)';
      tempBtn.style.background = 'rgba(251,191,36,.07)';
      ov.querySelector('#fas-ban-reason').value = '';
      daysInput.value = '7';
      preset.value = '';
      ov.style.display = 'flex';
    };
  }

  function closeBanDialog() {
    const d = document.getElementById('fas-ban-dialog');
    if (d) d.style.display = 'none';
  }

  // Intercept "Ban" clicks inside admin panel before React handles them
  document.addEventListener('click', e => {
    if (_banIntercepting) return;
    const btn = e.target.closest('button');
    if (!btn) return;
    const txt = btn.textContent.trim();
    if (txt !== 'Ban') return;
    const adminPanel = document.querySelector('[data-fas-admin="1"]') || btn.closest('[class*="max-w-5xl"]');
    if (!adminPanel) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const row = btn.closest('[class*="flex items-center justify-between"]') || btn.parentElement?.parentElement;
    const nameSpan = row ? (row.querySelector('span[class*="truncate"]') || row.querySelector('span')) : null;
    const displayName = nameSpan?.textContent?.trim() || 'Unknown user';
    if (!btn.dataset.fasUid) {
      const cache = window.__fas_usersCache || {};
      const match = Object.values(cache).find(u => u.displayName === displayName || u.email === displayName);
      if (match) btn.dataset.fasUid = match.uid;
    }
    if (window.__fas_openBanDialog) window.__fas_openBanDialog(btn, displayName);
  }, true);

  /* =========================================================
     6.  ADMIN TOOLS PANEL  (Features 3 · 4 · 16)
         Activity Timeline · DM Inspector · Contact Network
  ========================================================= */
  async function loadUsersCache() {
    if (window.__fas_usersCache) return window.__fas_usersCache;
    window.__fas_usersCache = {};
    await waitForFBPromise();
    try {
      const snap = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
      snap.forEach(doc => {
        const d = doc.data() || {};
        window.__fas_usersCache[doc.id] = { uid: doc.id, displayName: d.displayName || doc.id, photoURL: d.photoURL || '', email: d.email || '' };
      });
    } catch {}
    return window.__fas_usersCache;
  }

  function tryInjectAdmin(root) {
    if (!root.querySelectorAll) return;
    const h1s = root.querySelectorAll ? root.querySelectorAll('h1') : [];
    let found = null;
    for (const h of h1s) {
      if (h.textContent.includes('Admin Panel')) { found = h; break; }
    }
    if (!found) {
      if (root.textContent?.includes('Admin Panel') && root.tagName === 'H1') found = root;
    }
    if (!found) return;
    const container = found.closest('[class*="space-y"]') || found.closest('[class*="max-w"]') || found.parentElement?.parentElement;
    if (!container) return;
    container.setAttribute('data-fas-admin', '1');
    if (container.querySelector('#fas-admin-tools')) return;
    buildAdminToolsPanel(container, found);
    tryInjectAdminCards(container);
  }

  function buildAdminToolsPanel(container, headingEl) {
    const card = document.createElement('div');
    card.id = 'fas-admin-tools';
    card.style.cssText = `background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.15);border-radius:18px;padding:20px;margin-bottom:8px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.8)" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07"/><path d="M14 2.46A10 10 0 0 1 21.54 10"/></svg>
        <span style="font-size:13px;font-weight:800;color:rgba(255,215,0,.85);text-transform:uppercase;letter-spacing:.07em;">Admin Intelligence</span>
        <span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,.2);background:rgba(255,215,0,.07);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,215,0,.1);">ADMIN ONLY</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;" id="fas-atabs">
        ${[['activity','👤 Activity'],['dm-inspector','💬 DM Inspector'],['network','🕸 Contact Network']].map(([id,lbl],i)=>`
          <button class="fas-atab" data-tab="${id}"
            style="font-size:11px;padding:5px 12px;border-radius:20px;cursor:pointer;border:1px solid ${i===0?'rgba(255,215,0,.5)':'rgba(255,255,255,.1)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.4)'};outline:none;transition:all .15s;">${lbl}</button>`).join('')}
      </div>
      <div id="fas-atbody" style="min-height:80px;"></div>`;

    const firstChild = headingEl?.closest('[class*="p-6"]') || headingEl?.closest('[class*="backdrop"]') || headingEl?.parentElement;
    if (firstChild && firstChild !== container) {
      firstChild.parentElement?.insertBefore(card, firstChild);
    } else {
      container.prepend(card);
    }

    let activeAtab = 'activity';
    card.querySelectorAll('.fas-atab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeAtab = btn.dataset.tab;
        card.querySelectorAll('.fas-atab').forEach(b => {
          const on = b.dataset.tab === activeAtab;
          b.style.borderColor = on ? 'rgba(255,215,0,.5)' : 'rgba(255,255,255,.1)';
          b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
          b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.4)';
        });
        renderAdminTab(activeAtab, card.querySelector('#fas-atbody'));
      });
    });

    renderAdminTab('activity', card.querySelector('#fas-atbody'));
  }

  /* --- Feature 3: Activity Timeline --- */
  function renderAdminTab(tab, body) {
    if (tab === 'activity') renderActivityTimeline(body);
    else if (tab === 'dm-inspector') renderDMInspector(body);
    else if (tab === 'network') renderContactNetwork(body);
  }

  function renderActivityTimeline(body) {
    body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="fas-act-search" type="text" placeholder="Search user by name or UID…"
          style="flex:1;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:12px;outline:none;">
        <button id="fas-act-go" style="padding:8px 14px;background:rgba(255,215,0,.15);border:1px solid rgba(255,215,0,.3);border-radius:10px;color:rgba(255,215,0,.85);font-size:12px;font-weight:600;cursor:pointer;">Search</button>
      </div>
      <div id="fas-act-results" style="color:rgba(255,255,255,.25);font-size:12px;text-align:center;padding:20px 0;">Search a user to see their activity timeline.</div>`;

    const go = () => {
      const q = body.querySelector('#fas-act-search').value.trim().toLowerCase();
      if (!q) return;
      body.querySelector('#fas-act-results').innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading…</div>`;
      waitForFB(async () => {
        const adminUid = getUid();
        if (!adminUid) {
          body.querySelector('#fas-act-results').innerHTML = emptyState('🔐', 'Sign in first to use Admin Intelligence.');
          return;
        }
        try {
          const cache = await loadUsersCache();
          const matched = Object.values(cache).filter(u =>
            (u.displayName||'').toLowerCase().includes(q) ||
            (u.uid||'').toLowerCase().includes(q) ||
            (u.email||'').toLowerCase().includes(q)
          );

          if (!matched.length) {
            body.querySelector('#fas-act-results').innerHTML = emptyState('🔍', 'No users found matching "' + esc(q) + '"');
            return;
          }

          const uid = matched[0].uid;
          const uname = matched[0].displayName;

          // Get posts by this user (no fsOrderBy — sort in JS to avoid index requirement)
          const postsSnap = await window.fsGetDocs(window.fsCollection(window.db, 'posts'));
          const posts = [];
          postsSnap.forEach(doc => {
            const d = doc.data() || {};
            if (d.authorUid === uid) posts.push({ id: doc.id, ...d, _type: 'post' });
          });
          posts.sort((a,b) => ((b.createdAt?.toDate?.()?.getTime()||b.createdAt||0) - (a.createdAt?.toDate?.()?.getTime()||a.createdAt||0)));

          // Get conversations involving searched user — filter via array-contains on adminUid,
          // then also try the target uid to maximise coverage without needing full-collection read
          const convs = [];
          const convSnaps = await Promise.allSettled([
            window.fsGetDocs(window.fsQuery(window.fsCollection(window.db,'conversations'), window.fsWhere('participants','array-contains',adminUid))),
            window.fsGetDocs(window.fsQuery(window.fsCollection(window.db,'conversations'), window.fsWhere('participants','array-contains',uid))),
          ]);
          const seenConvIds = new Set();
          for (const result of convSnaps) {
            if (result.status !== 'fulfilled') continue;
            result.value.forEach(doc => {
              if (seenConvIds.has(doc.id)) return;
              seenConvIds.add(doc.id);
              const d = doc.data() || {};
              if ((d.participants || []).includes(uid)) {
                const otherId = (d.participants || []).find(p => p !== uid);
                const otherName = d[`name_${otherId}`] || otherId || 'Unknown';
                convs.push({ id: doc.id, otherName, lastMessage: d.lastMessage || '', lastTime: d.lastTime });
              }
            });
          }

          const timelineItems = [
            ...posts.map(p => ({
              ts: p.createdAt?.toDate?.()?.getTime() || p.createdAt || 0,
              type: 'post',
              text: (p.content || '').slice(0, 80),
              extra: p.imageUrl ? '📷 image attached' : '',
            })),
            ...convs.map(c => ({
              ts: c.lastTime?.toDate?.()?.getTime() || c.lastTime || 0,
              type: 'dm',
              text: `DM with ${esc(c.otherName)}: "${esc((c.lastMessage||'').slice(0,55))}"`,
              extra: '',
            })),
          ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 30);

          if (!timelineItems.length) {
            body.querySelector('#fas-act-results').innerHTML = emptyState('📭', `No activity found for ${esc(uname)}`);
            return;
          }

          body.querySelector('#fas-act-results').innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:10px;">
              <div style="width:30px;height:30px;border-radius:50%;background:rgba(255,215,0,.12);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:rgba(255,215,0,.8);">${esc(uname[0]?.toUpperCase()||'?')}</div>
              <div>
                <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.8);">${esc(uname)}</div>
                <div style="font-size:10px;color:rgba(255,255,255,.3);">${posts.length} posts · ${convs.length} DM threads</div>
              </div>
            </div>
            <div style="position:relative;padding-left:20px;">
              <div style="position:absolute;left:7px;top:0;bottom:0;width:1px;background:rgba(255,215,0,.12);"></div>
              ${timelineItems.map(item => `
                <div style="position:relative;margin-bottom:10px;padding:9px 12px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.05);">
                  <div style="position:absolute;left:-16px;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:${item.type==='post'?'rgba(99,102,241,.8)':'rgba(16,185,129,.8)'};"></div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div>
                      <div style="font-size:10px;font-weight:600;color:${item.type==='post'?'rgba(165,180,252,.8)':'rgba(52,211,153,.8)'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">${item.type==='post'?'📝 Post':'💬 DM'}</div>
                      <div style="font-size:11px;color:rgba(255,255,255,.65);line-height:1.4;">${item.text||'—'}</div>
                      ${item.extra ? `<div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;">${item.extra}</div>` : ''}
                    </div>
                    <div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;flex-shrink:0;">${fmtTime(item.ts)}</div>
                  </div>
                </div>`).join('')}
            </div>`;
        } catch (err) {
          body.querySelector('#fas-act-results').innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
        }
      });
    };

    body.querySelector('#fas-act-go').addEventListener('click', go);
    body.querySelector('#fas-act-search').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  /* --- Feature 4: DM Conversation Inspector (newest first) --- */
  function renderDMInspector(body) {
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading conversations…</div>`;
    waitForFB(async () => {
      const adminUid = getUid();
      if (!adminUid) { body.innerHTML = emptyState('🔐', 'Sign in to use DM Inspector.'); return; }
      try {
        // Use array-contains to respect Firestore rules — gets all convs involving admin
        const snap = await window.fsGetDocs(
          window.fsQuery(window.fsCollection(window.db, 'conversations'), window.fsWhere('participants','array-contains',adminUid))
        );
        const convs = [];
        snap.forEach(doc => {
          const d = doc.data() || {};
          const participants = d.participants || [];
          const names = participants.map(uid => d[`name_${uid}`] || uid).join(' ↔ ');
          const photos = participants.map(uid => d[`photo_${uid}`] || '');
          const lastTs = d.lastTime?.toDate?.()?.getTime() || d.lastTime || 0;
          convs.push({ id: doc.id, participants, names, photos, lastMessage: d.lastMessage || '', lastTs });
        });

        // Sort newest first
        convs.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

        if (!convs.length) {
          body.innerHTML = emptyState('💬', 'No DM conversations found.');
          return;
        }

        body.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;">${convs.length} conversations total</div>
            <div style="font-size:10px;color:rgba(255,215,0,.5);">Newest first</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;padding-right:4px;" id="fas-dm-list">
            ${convs.map((c, i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:11px;cursor:pointer;transition:background .15s;" class="fas-dm-row" data-idx="${i}">
                <div style="display:flex;flex-shrink:0;">
                  ${c.photos.slice(0,2).map((ph,pi) => ph
                    ? `<img src="${esc(ph)}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;margin-left:${pi>0?'-8px':'0'};border:1.5px solid rgba(0,0,0,.6);">`
                    : `<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,215,0,.1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:rgba(255,215,0,.7);margin-left:${pi>0?'-8px':'0'};border:1.5px solid rgba(0,0,0,.6);">${esc(c.names[pi*4]||'?')}</div>`).join('')}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.names)}</div>
                  <div style="font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">${esc(c.lastMessage.slice(0,60) || 'No messages')}</div>
                </div>
                <div style="font-size:9px;color:rgba(255,255,255,.2);white-space:nowrap;flex-shrink:0;">${fmtTime(c.lastTs)}</div>
              </div>`).join('')}
          </div>`;

        // Click a conversation to load its messages
        body.querySelectorAll('.fas-dm-row').forEach(row => {
          row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,.06)');
          row.addEventListener('mouseleave', () => row.style.background = 'rgba(255,255,255,.03)');
          row.addEventListener('click', () => {
            const conv = convs[parseInt(row.dataset.idx)];
            expandDMConversation(body, conv, convs);
          });
        });
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
      }
    });
  }

  function expandDMConversation(body, conv, allConvs) {
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <button id="fas-dm-back" style="padding:5px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.5);font-size:11px;cursor:pointer;">← Back</button>
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.7);">${esc(conv.names)}</div>
      </div>
      <div id="fas-dm-msgs" style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading messages…</div>`;

    body.querySelector('#fas-dm-back').addEventListener('click', () => renderDMInspector(body));

    waitForFB(async () => {
      try {
        const snap = await window.fsGetDocs(
          window.fsQuery(
            window.fsCollection(window.db, 'conversations', conv.id, 'messages'),
            window.fsOrderBy('createdAt', 'desc')
          )
        );
        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

        const msgsEl = body.querySelector('#fas-dm-msgs');
        if (!msgs.length) {
          msgsEl.innerHTML = emptyState('📭', 'No messages in this conversation.');
          return;
        }
        msgsEl.innerHTML = `
          <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:10px;text-align:right;">${msgs.length} messages (newest first)</div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;padding-right:4px;">
            ${msgs.map(msg => `
              <div style="padding:8px 12px;background:rgba(255,255,255,.03);border-radius:9px;border:1px solid rgba(255,255,255,.05);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                  <span style="font-size:10px;font-weight:600;color:rgba(255,215,0,.65);">${esc(msg.senderName||'System')}</span>
                  <span style="font-size:9px;color:rgba(255,255,255,.2);">${fmtTime(msg.createdAt?.toDate?.()?.getTime() || msg.createdAt)}</span>
                </div>
                <div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.4;">${esc(msg.text||'[media]')}</div>
              </div>`).join('')}
          </div>`;
      } catch (err) {
        body.querySelector('#fas-dm-msgs').innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error loading messages: ${esc(err.message)}</div>`;
      }
    });
  }

  /* --- Feature 16: DM Contact Network --- */
  function renderContactNetwork(body) {
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Building contact network…</div>`;
    waitForFB(async () => {
      const adminUid = getUid();
      if (!adminUid) { body.innerHTML = emptyState('🔐', 'Sign in to use Contact Network.'); return; }
      try {
        const [convSnap, cache] = await Promise.all([
          window.fsGetDocs(window.fsQuery(window.fsCollection(window.db, 'conversations'), window.fsWhere('participants','array-contains',adminUid))),
          loadUsersCache(),
        ]);

        const edges = [];
        const nodeSet = new Set();
        const nodeConvCount = {};

        convSnap.forEach(doc => {
          const d = doc.data() || {};
          const [a, b] = d.participants || [];
          if (!a || !b) return;
          const nameA = cache[a]?.displayName || d[`name_${a}`] || a.slice(0,8);
          const nameB = cache[b]?.displayName || d[`name_${b}`] || b.slice(0,8);
          nodeSet.add(a);
          nodeSet.add(b);
          nodeConvCount[a] = (nodeConvCount[a] || 0) + 1;
          nodeConvCount[b] = (nodeConvCount[b] || 0) + 1;
          edges.push({ a, b, nameA, nameB, lastTs: d.lastTime?.toDate?.()?.getTime() || d.lastTime || 0, lastMsg: d.lastMessage || '' });
        });

        // Sort by most recent
        edges.sort((x, y) => (y.lastTs || 0) - (x.lastTs || 0));

        // Top connected users
        const topUsers = [...nodeSet]
          .map(uid => ({ uid, name: cache[uid]?.displayName || uid.slice(0,8), count: nodeConvCount[uid] || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        if (!edges.length) {
          body.innerHTML = emptyState('🕸', 'No DM connections found.');
          return;
        }

        body.innerHTML = `
          <div style="margin-bottom:14px;">
            <div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Most Connected Users</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${topUsers.map(u => `
                <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.12);border-radius:20px;">
                  <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,215,0,.15);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:rgba(255,215,0,.7);">${esc(u.name[0]?.toUpperCase()||'?')}</div>
                  <span style="font-size:10px;color:rgba(255,255,255,.65);">${esc(u.name)}</span>
                  <span style="font-size:9px;color:rgba(255,215,0,.5);background:rgba(255,215,0,.08);padding:1px 5px;border-radius:8px;">${u.count}</span>
                </div>`).join('')}
            </div>
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${edges.length} connections (recent first)</div>
          <div style="display:flex;flex-direction:column;gap:5px;max-height:260px;overflow-y:auto;padding-right:4px;">
            ${edges.map(edge => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);border-radius:9px;">
                <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0;">
                  <span style="font-size:11px;color:rgba(255,255,255,.65);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${esc(edge.nameA)}</span>
                  <span style="font-size:12px;color:rgba(255,215,0,.4);">↔</span>
                  <span style="font-size:11px;color:rgba(255,255,255,.65);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${esc(edge.nameB)}</span>
                </div>
                <div style="flex-shrink:0;text-align:right;">
                  <div style="font-size:9px;color:rgba(255,255,255,.2);">${fmtTime(edge.lastTs)}</div>
                  ${edge.lastMsg ? `<div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;">"${esc(edge.lastMsg.slice(0,30))}"</div>` : ''}
                </div>
              </div>`).join('')}
          </div>`;
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
      }
    });
  }

  /* =========================================================
     7.  HOMEPAGE — TOP ACTIVE USERS  (Feature 15)
  ========================================================= */
  let _homepageInjected = false;

  function tryInjectHomepage() {
    if (_homepageInjected) return;
    if (document.getElementById('fas-top-users')) return;
    // Detect homepage: URL is / and page has content carousels (multiple h2 headings)
    const path = window.location.pathname;
    if (path !== '/' && !path.endsWith('/index.html') && path !== '') return;
    const h2s = document.querySelectorAll('h2');
    if (h2s.length < 2) return;
    // Find a good insertion point — after the first shelf/section
    const mainContent = document.querySelector('[class*="max-w-7xl"]') || document.querySelector('[class*="max-w-6xl"]') || document.querySelector('main');
    if (!mainContent) return;
    // Find first inner section to insert after
    const firstSection = mainContent.querySelector('[class*="mb-"], [class*="space-y"]');
    if (!firstSection) return;
    _homepageInjected = true;
    buildTopActiveUsers(firstSection);
  }

  function buildTopActiveUsers(afterEl) {
    const section = document.createElement('div');
    section.id = 'fas-top-users';
    section.style.cssText = `margin:0 0 32px;font-family:Inter,sans-serif;`;
    section.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.8)" stroke-width="2.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style="font-size:13px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:.02em;">Top Active This Week</span>
        </div>
        <span style="font-size:10px;color:rgba(255,255,255,.2);">by posts</span>
      </div>
      <div id="fas-tu-list" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;">
        <div style="padding:16px;color:rgba(255,255,255,.25);font-size:12px;">Loading…</div>
      </div>`;

    afterEl.parentElement?.insertBefore(section, afterEl.nextSibling) || afterEl.parentElement?.appendChild(section);

    waitForFBAuth(async () => {
      try {
        const oneWeekAgo = Date.now() - 7 * 86400000;
        const snap = await window.fsGetDocs(
          window.fsQuery(window.fsCollection(window.db, 'posts'), window.fsOrderBy('createdAt', 'desc'))
        );

        const counts = {};
        const info = {};
        snap.forEach(doc => {
          const d = doc.data() || {};
          const ts = d.createdAt?.toDate?.()?.getTime() || d.createdAt || 0;
          if (ts < oneWeekAgo) return;
          const uid = d.authorUid;
          if (!uid) return;
          counts[uid] = (counts[uid] || 0) + 1;
          if (!info[uid]) info[uid] = { name: d.authorName || 'Unknown', photo: d.authorPhoto || '' };
        });

        const ranked = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([uid, count]) => ({ uid, count, ...info[uid] }));

        const list = document.getElementById('fas-tu-list');
        if (!list) return;

        if (!ranked.length) {
          list.innerHTML = `<div style="padding:16px;color:rgba(255,255,255,.25);font-size:12px;">No posts this week yet.</div>`;
          return;
        }

        list.innerHTML = ranked.map((u, i) => `
          <div style="flex-shrink:0;width:100px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 10px;text-align:center;position:relative;transition:border-color .2s;cursor:default;"
            onmouseenter="this.style.borderColor='rgba(255,215,0,.2)'" onmouseleave="this.style.borderColor='rgba(255,255,255,.07)'">
            ${i === 0 ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-size:14px;">👑</div>` : ''}
            ${u.photo
              ? `<img src="${esc(u.photo)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin:4px auto 8px;border:2px solid ${i===0?'rgba(255,215,0,.5)':i===1?'rgba(192,192,192,.4)':i===2?'rgba(205,127,50,.4)':'rgba(255,255,255,.1)'};display:block;">`
              : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,215,0,.1);margin:4px auto 8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:rgba(255,215,0,.7);border:2px solid rgba(255,215,0,.15);">${esc(u.name[0]?.toUpperCase()||'?')}</div>`}
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.name)}</div>
            <div style="font-size:10px;color:rgba(255,215,0,.6);margin-top:3px;font-weight:700;">${u.count} post${u.count!==1?'s':''}</div>
            <div style="font-size:9px;color:rgba(255,255,255,.2);margin-top:2px;">#${i+1}</div>
          </div>`).join('');
      } catch {
        const list = document.getElementById('fas-tu-list');
        if (list) list.innerHTML = `<div style="padding:16px;color:rgba(255,100,100,.3);font-size:11px;">Could not load.</div>`;
      }
    });
  }

  /* =========================================================
     9.  ADMIN — MAINTENANCE MODE  (Feature 7)
  ========================================================= */
  let _maintenanceOn = false;

  function buildMaintenanceToggle(container) {
    if (container.querySelector('#fas-maint-card')) return;
    const card = document.createElement('div');
    card.id = 'fas-maint-card';
    card.style.cssText = `background:rgba(255,255,255,.03);border:1px solid rgba(255,100,50,.2);border-radius:18px;padding:20px;margin-top:10px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,60,.8)" stroke-width="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <div>
            <div style="font-size:13px;font-weight:800;color:rgba(255,120,60,.85);text-transform:uppercase;letter-spacing:.06em;">Maintenance Mode</div>
            <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;">Shows a maintenance page to all non-admin visitors</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span id="fas-maint-status" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.35);">OFF</span>
          <button id="fas-maint-toggle" style="padding:8px 18px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid rgba(255,120,60,.4);background:rgba(255,120,60,.12);color:rgba(255,120,60,.85);transition:all .15s;">Enable</button>
          <span id="fas-maint-msg" style="font-size:11px;color:rgba(255,255,255,.3);"></span>
        </div>
      </div>
      <div id="fas-maint-msg-section" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);">
        <label style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Custom message (optional)</label>
        <div style="display:flex;gap:8px;">
          <input id="fas-maint-custom" type="text" placeholder="e.g. Back online at 3PM — upgrading servers"
            style="flex:1;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:12px;outline:none;">
          <button id="fas-maint-save-msg" style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;cursor:pointer;">Save</button>
        </div>
      </div>`;

    container.appendChild(card);

    // Load current state
    waitForFBAuth(async () => {
      try {
        const doc = await window.fsGetDoc(window.fsDoc(window.db, 'settings', 'site'));
        if (doc.exists()) {
          const data = doc.data() || {};
          _maintenanceOn = !!data.maintenanceMode;
          updateMaintenanceUI(card);
          if (_maintenanceOn && data.maintenanceMsg) {
            card.querySelector('#fas-maint-custom').value = data.maintenanceMsg;
          }
        }
      } catch {}
    });

    card.querySelector('#fas-maint-toggle').addEventListener('click', async () => {
      _maintenanceOn = !_maintenanceOn;
      updateMaintenanceUI(card);
      await waitForFBPromise();
      try {
        await window.fsSetDoc(window.fsDoc(window.db, 'settings', 'site'),
          { maintenanceMode: _maintenanceOn },
          { merge: true }
        );
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = _maintenanceOn ? '✓ Maintenance enabled' : '✓ Site back online';
        msg.style.color = _maintenanceOn ? 'rgba(255,120,60,.8)' : 'rgba(100,220,100,.8)';
        setTimeout(() => { msg.textContent = ''; }, 3000);
      } catch (e) {
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = '✗ ' + (e.message || 'Failed');
        msg.style.color = 'rgba(255,100,100,.7)';
      }
    });

    card.querySelector('#fas-maint-save-msg').addEventListener('click', async () => {
      const customMsg = card.querySelector('#fas-maint-custom').value.trim();
      await waitForFBPromise();
      try {
        await window.fsSetDoc(window.fsDoc(window.db, 'settings', 'site'), { maintenanceMsg: customMsg }, { merge: true });
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = '✓ Message saved';
        msg.style.color = 'rgba(100,220,100,.8)';
        setTimeout(() => { msg.textContent = ''; }, 2500);
      } catch {}
    });
  }

  function updateMaintenanceUI(card) {
    const statusEl = card.querySelector('#fas-maint-status');
    const toggleBtn = card.querySelector('#fas-maint-toggle');
    const msgSection = card.querySelector('#fas-maint-msg-section');
    if (_maintenanceOn) {
      statusEl.textContent = 'ON';
      statusEl.style.background = 'rgba(255,120,60,.2)';
      statusEl.style.color = 'rgba(255,120,60,.9)';
      card.style.borderColor = 'rgba(255,120,60,.5)';
      toggleBtn.textContent = 'Disable';
      toggleBtn.style.background = 'rgba(255,120,60,.25)';
      toggleBtn.style.borderColor = 'rgba(255,120,60,.6)';
      toggleBtn.style.color = 'rgba(255,120,60,.95)';
      msgSection.style.display = 'block';
    } else {
      statusEl.textContent = 'OFF';
      statusEl.style.background = 'rgba(255,255,255,.07)';
      statusEl.style.color = 'rgba(255,255,255,.35)';
      card.style.borderColor = 'rgba(255,100,50,.2)';
      toggleBtn.textContent = 'Enable';
      toggleBtn.style.background = 'rgba(255,120,60,.12)';
      toggleBtn.style.borderColor = 'rgba(255,120,60,.4)';
      toggleBtn.style.color = 'rgba(255,120,60,.85)';
      msgSection.style.display = 'none';
    }
  }

  // Show maintenance overlay to non-admin visitors
  function checkMaintenanceMode() {
    waitForFB(async () => {
      try {
        const doc = await window.fsGetDoc(window.fsDoc(window.db, 'settings', 'site'));
        if (!doc.exists()) return;
        const data = doc.data() || {};
        if (!data.maintenanceMode) return;
        // Check if current user is admin
        const uid = window.__FIREBASE_USER__?.uid;
        const roles = JSON.parse(localStorage.getItem('fh_user_roles') || '{}');
        if (uid && roles[uid] === 'admin') return; // admin can see site
        // Show maintenance overlay
        const ov = document.createElement('div');
        ov.id = 'fas-maint-overlay';
        ov.style.cssText = `position:fixed;inset:0;z-index:999998;background:#050510;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,sans-serif;text-align:center;padding:40px;`;
        ov.innerHTML = `
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,60,.6)" stroke-width="1.5" style="margin-bottom:28px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <div style="font-size:32px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">Under Maintenance</div>
          <div style="font-size:15px;color:rgba(255,255,255,.45);max-width:420px;line-height:1.6;margin-bottom:28px;">${data.maintenanceMsg ? esc(data.maintenanceMsg) : 'FasahatHub is currently undergoing maintenance. We\'ll be back shortly!'}</div>
          <div style="font-size:12px;color:rgba(255,120,60,.5);border:1px solid rgba(255,120,60,.2);padding:8px 20px;border-radius:20px;">🔧 Maintenance in progress</div>`;
        document.body.appendChild(ov);
      } catch {}
    });
  }

  /* =========================================================
     10.  ADMIN — FEEDBACK / FEATURE SUGGESTIONS VIEWER
  ========================================================= */
  function buildFeedbackViewer(container) {
    if (container.querySelector('#fas-feedback-card')) return;
    const card = document.createElement('div');
    card.id = 'fas-feedback-card';
    card.style.cssText = `background:rgba(255,255,255,.03);border:1px solid rgba(99,102,241,.25);border-radius:18px;padding:20px;margin-top:10px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,.8)" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style="font-size:13px;font-weight:800;color:rgba(165,180,252,.85);text-transform:uppercase;letter-spacing:.06em;">User Feedback</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <select id="fas-fb-filter" style="padding:5px 10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.6);font-size:11px;outline:none;cursor:pointer;">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button id="fas-fb-reload" style="padding:5px 12px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:rgba(165,180,252,.8);font-size:11px;font-weight:600;cursor:pointer;">↺ Refresh</button>
        </div>
      </div>
      <div id="fas-fb-body" style="min-height:60px;">
        <div style="text-align:center;padding:20px;color:rgba(255,255,255,.2);font-size:12px;">Loading feedback…</div>
      </div>`;
    container.appendChild(card);
    loadFeedback(card);
    card.querySelector('#fas-fb-reload').addEventListener('click', () => loadFeedback(card));
    card.querySelector('#fas-fb-filter').addEventListener('change', () => renderFeedbackItems(card, _fbCache, card.querySelector('#fas-fb-filter').value));
  }

  let _fbCache = [];

  function loadFeedback(card) {
    const body = card.querySelector('#fas-fb-body');
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.2);font-size:12px;">Loading…</div>`;
    waitForFB(async () => {
      const uid = getUid();
      if (!uid) { body.innerHTML = emptyState('🔐', 'Sign in to view feedback.'); return; }
      try {
        const snap = await window.fsGetDocs(window.fsCollection(window.db, 'feature_suggestions'));
        _fbCache = [];
        snap.forEach(doc => _fbCache.push({ id: doc.id, ...doc.data() }));
        _fbCache.sort((a,b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
          const tb = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
          return tb - ta;
        });
        const filter = card.querySelector('#fas-fb-filter').value;
        renderFeedbackItems(card, _fbCache, filter);
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
      }
    });
  }

  function renderFeedbackItems(card, items, filter) {
    const body = card.querySelector('#fas-fb-body');
    const filtered = filter === 'all' ? items : items.filter(i => (i.status || 'pending') === filter);
    if (!filtered.length) {
      body.innerHTML = emptyState('💬', filter === 'all' ? 'No feedback submitted yet.' : `No ${filter} feedback.`);
      return;
    }
    body.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.25);margin-bottom:8px;">${filtered.length} item${filtered.length!==1?'s':''}</div>
      <div style="display:flex;flex-direction:column;gap:7px;max-height:400px;overflow-y:auto;padding-right:4px;">
        ${filtered.map(item => {
          const status = item.status || 'pending';
          const statusColor = status === 'done' ? 'rgba(52,211,153,.8)' : status === 'dismissed' ? 'rgba(255,100,100,.6)' : 'rgba(251,191,36,.7)';
          const statusBg = status === 'done' ? 'rgba(52,211,153,.1)' : status === 'dismissed' ? 'rgba(255,100,100,.08)' : 'rgba(251,191,36,.08)';
          const ts = item.createdAt?.toDate?.()?.getTime() || item.createdAt || 0;
          return `
            <div style="padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;" data-fbid="${esc(item.id)}">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
                <div style="font-size:12px;color:rgba(255,255,255,.75);line-height:1.45;flex:1;">${esc(item.text || item.suggestion || item.content || '(no text)')}</div>
                <span style="font-size:9px;padding:2px 8px;border-radius:10px;background:${statusBg};color:${statusColor};white-space:nowrap;border:1px solid ${statusColor};flex-shrink:0;">${status}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  ${item.authorPhoto ? `<img src="${esc(item.authorPhoto)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;">` : `<div style="width:18px;height:18px;border-radius:50%;background:rgba(165,180,252,.15);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:rgba(165,180,252,.7);">${esc((item.authorName||'?')[0].toUpperCase())}</div>`}
                  <span style="font-size:10px;color:rgba(255,255,255,.35);">${esc(item.authorName || 'Anonymous')}</span>
                  <span style="font-size:9px;color:rgba(255,255,255,.2);">· ${fmtTime(ts)}</span>
                </div>
                <div style="display:flex;gap:5px;">
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="done" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.08);color:rgba(52,211,153,.75);font-weight:600;">✓ Done</button>
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="dismissed" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,100,100,.3);background:rgba(255,100,100,.06);color:rgba(255,100,100,.65);font-weight:600;">✗ Dismiss</button>
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="pending" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.35);">↺ Reset</button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('.fas-fb-act').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const newStatus = btn.dataset.status;
        btn.style.opacity = '0.5';
        try {
          await window.fsSetDoc(window.fsDoc(window.db, 'feature_suggestions', id), { status: newStatus }, { merge: true });
          const item = _fbCache.find(i => i.id === id);
          if (item) item.status = newStatus;
          const filter = card.querySelector('#fas-fb-filter').value;
          renderFeedbackItems(card, _fbCache, filter);
        } catch (e) {
          btn.style.opacity = '1';
          console.warn('Feedback update failed:', e.message);
        }
      });
    });
  }

  // Wire admin-only cards into the admin panel
  function tryInjectAdminCards(container) {
    buildMaintenanceToggle(container);
    buildFeedbackViewer(container);
  }

  /* =========================================================
     MUTATION OBSERVER  (Settings + Profile Modal injection)
  ========================================================= */
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        tryInjectSettings(n);
        tryInjectProfileModal(n);
        tryInjectAdmin(n);
      }
      // Also check for homepage carousels being added
      if (m.type === 'childList') tryInjectHomepage();
    }
  });

  /* =========================================================
     INIT
  ========================================================= */
  function init() {
    buildSearchOverlay();
    buildPanel();
    buildBanDialog();
    checkMaintenanceMode();
    mo.observe(document.body, { childList: true, subtree: true });
    // Also try injecting admin/homepage after short delay (if already rendered)
    setTimeout(() => {
      tryInjectAdmin(document.body);
      tryInjectHomepage();
    }, 1500);
    console.log('[FasahatHub Extensions] ✓ Loaded v3');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 150);
})();
