/* ilona — déverrouillage, déchiffrement (AES-GCM), intro et mise en scène au scroll */
(() => {
  'use strict';
  const CFG = window.__CFG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const enc = new TextEncoder();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const qp = new URLSearchParams(location.hash.slice(1));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  let mistFx = null;

  /* ---------------- clé du lien ---------------- */
  const frag = qp.get('k');
  const lock = $('#lock');
  if (!frag || !window.crypto || !crypto.subtle) {
    $('.lock-mid').innerHTML = '<p class="broken">' + (!frag
      ? 'le lien est pas complet<br>ouvre le direct depuis mon message'
      : 'ouvre le dans safari') + '</p>';
    $('#lock-say').style.display = 'none';
    return;
  }
  const contentP = fetch(CFG.content).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); });

  async function tryCode(code) {
    const base = await crypto.subtle.importKey('raw', enc.encode(code + '|' + frag), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64u(CFG.salt), iterations: CFG.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const buf = await contentP;
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
      return { key, data: JSON.parse(new TextDecoder().decode(pt)) };
    } catch (e) { return null; }
  }

  /* ---------------- ouverture : la bague (ring.js) ---------------- */
  let preShown = 0, opened = null;
  if (qp.get('c')) window.__ringOpen();
  // secours si la 3D ne se lance pas : garder le doigt appuyé sur l'écran
  setTimeout(() => {
    if (window.__ringReady || document.querySelector('#ring.on')) return;
    lock.classList.add('ready', 'flat');
    let t = 0, timer = 0;
    lock.addEventListener('pointerdown', () => { lock.classList.add('pressing'); t = performance.now(); timer = setTimeout(() => { lock.classList.add('done', 'through'); window.__ringOpen(); }, 1300); });
    const up = () => { lock.classList.remove('pressing'); clearTimeout(timer); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }, 3500);
  (async () => {
    const res = await tryCode('01112025');
    if (!res) { $('.lock-mid').innerHTML = '<p class="broken">le lien est pas complet<br>ouvre le direct depuis mon message</p>'; return; }
    KEY = res.key; ASSETS = res.data.assets;
    const P = [['p7783', '2025-11-20', 'une des premières vidéos de toi'], ['p7853', '2025-12-31', 'notre premier nouvel an'],
      ['p8063', '2026-02-14', 'chez moi'], ['p8951', '2026-05-01', 'saint-tropez'], ['p10015', '2026-06-27', 'annecy'],
      ['p11080', '2026-07-27', 't’as dit oui'], ['hero', '2026-10-31', 'santorin']];
    window.__photosSet(await Promise.all(P.map(([id, iso, label]) => asset(id).then(url => ({ url, iso, label })))));
    const staged = stage(res);
    await window.__ringGate;
    opened = staged.then(reveal);
  })();

  /* ---------------- médias chiffrés ---------------- */
  let KEY, ASSETS;
  const urls = new Map();
  function asset(id) {
    if (urls.has(id)) return urls.get(id);
    const a = ASSETS[id];
    const p = fetch(a.f).then(r => r.arrayBuffer())
      .then(buf => crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12)))
      .then(pt => URL.createObjectURL(new Blob([pt], { type: a.m })));
    urls.set(id, p);
    return p;
  }
  function loadEl(el) {
    if (el._ld) return el._ld;
    const id = el.dataset.a;
    if (el.tagName === 'VIDEO') {
      el._ld = Promise.all([
        el.dataset.poster ? asset(el.dataset.poster).then(u => { el.poster = u; el.classList.add('ok'); }) : 0,
        asset(id).then(u => { el.src = u; el.load(); el.addEventListener('loadeddata', () => el.classList.add('ok'), { once: true }); })
      ]);
    } else {
      el._ld = asset(id).then(u => new Promise(res => {
        el.onload = () => { el.classList.add('ok'); res(); };
        el.onerror = res;
        el.src = u;
      }));
    }
    return el._ld;
  }

  /* ---------------- ouverture ---------------- */
  const START = Date.UTC(2025, 9, 31, 23, 0, 0); // 01.11.2025 00:00 Paris
  const DAY = 864e5;
  const daysNow = () => Math.max(0, Math.floor((Date.now() - START) / DAY));

  // le site se prépare derrière la bague, pour que la fin de la plongée tombe pile sur le hero
  async function stage({ key, data }) {
    KEY = key; ASSETS = data.assets;
    const story = $('#story');
    story.innerHTML = data.html;
    const intro = $('#intro'); if (intro) intro.remove();
    const els = $$('[data-a]', story);
    await Promise.race([loadEl($('.hero img[data-a]')), sleep(5000)]);
    await (document.fonts ? document.fonts.ready : sleep(300));
    prepare();
    return els;
  }
  // une seule image du début à la fin : la plongée s'arrête sur la photo, les phrases montent dessus,
  // puis elles s'effacent vers le haut pendant que ILONA monte du bas. Aucune coupe entre deux écrans.
  async function reveal(els) {
    document.body.classList.remove('locked');
    scrollTo(0, 0);
    const hero = $('.hero');
    hero.classList.add('s1');
    lock.classList.add('gone');
    setTimeout(() => lock.remove(), 1600);
    (async () => { for (const el of els) { try { await loadEl(el); } catch (e) {} } })();
    let skip = false;
    const go = () => { skip = true; };
    addEventListener('touchstart', go, { once: true, passive: true });
    addEventListener('wheel', go, { once: true, passive: true });
    const wait = async ms => { const t = performance.now(); while (!skip && performance.now() - t < ms) await sleep(50); };
    const lines = $$('.hl', hero);
    await wait(reduce ? 0 : 150);
    for (const l of lines) { l.classList.add('on'); await wait(reduce ? 0 : 650); }
    await wait(reduce ? 0 : 1900);
    hero.classList.add('in');
    $$('.hero .rv').forEach(el => el.classList.add('in'));
    document.body.classList.add('reading');
    init(els);
  }

  /* ---------------- intro : le compte des jours ---------------- */
  async function intro(img) {
    const box = $('#intro');
    let fx = null;
    try { if (window.GL && GL.supported) fx = GL.focus($('.intro-gl', box), img, { exposure: true }); } catch (e) {}
    box.classList.add(fx ? 'gl' : 'nogl');
    const n = $('[data-intro-n]', box), ring = $('.r1', box);
    const from = Math.round(preShown), to = Math.max(365, Math.min(365, daysNow())), dur = reduce ? 10 : 2400, t0 = performance.now();
    if (fx) fx.reveal(.55);
    await new Promise(res => {
      const step = t => {
        const p = clamp((t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        const v = from + (to - from) * e;
        n.textContent = String(Math.round(v)).padStart(3, '0');
        ring.style.strokeDashoffset = 289 * (1 - Math.min(1, v / 365));
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
    await sleep(700);
    box.classList.add('phase2', 'lit');
    if (fx) fx.reveal(1.25);
    const lines = $$('.il', box);
    for (const l of lines) { await sleep(reduce ? 0 : 700); l.classList.add('on'); }
    await new Promise(res => { setTimeout(res, reduce ? 0 : 2400); box.addEventListener('click', res, { once: true }); });
    box.classList.add('out');
    document.body.classList.remove('intro');
    document.body.classList.add('reading');
    $('.hero').classList.add('in');
    $$('.hero .rv').forEach(el => el.classList.add('in'));
    setTimeout(() => { if (fx) fx.stop(); box.remove(); }, 1500);
  }

  /* ---------------- préparation du DOM (split, mots) ---------------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function splitLines(el) {
    const words = [];
    let sp = false;
    const push = (html) => { words.push({ html, sp }); sp = false; };
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) sp = true; else push(esc(t)); });
      } else if (n.nodeName === 'BR') { words.push({ br: true }); sp = false; }
      else push(n.outerHTML);
    });
    el.innerHTML = words.map((w, i) => w.br ? '<br>' : (w.sp && i ? ' ' : '') + `<span class="wd">${w.html}</span>`).join('');
    const spans = $$('.wd', el);
    const lines = []; let last = null, wi = 0;
    words.forEach(w => {
      if (w.br) { last = null; return; }
      const s = spans[wi++]; const top = s.offsetTop;
      if (last === null || Math.abs(top - last) > 4) { lines.push([]); last = top; }
      const L = lines[lines.length - 1];
      L.push((L.length && w.sp ? ' ' : '') + w.html);
    });
    el.innerHTML = lines.map((l, i) => `<span class="ln"><span style="--i:${i}">${l.join('')}</span></span>`).join('');
  }
  function wrapWords(el, cls) {
    const out = [];
    let i = 0;
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; out.push(/^\s+$/.test(t) ? t : `<span class="w" style="--w:${Math.min(i++, 40)}">${esc(t)}</span>`); });
      else out.push(n.outerHTML);
    });
    el.innerHTML = out.join('');
    if (cls) el.classList.add(cls);
  }
  function prepare() {
    $$('[data-split]').forEach(splitLines);
    $$('.b').forEach(b => wrapWords(b));
    $$('.lw').forEach(p => { wrapWords(p); p._w = $$('.w', p); p._lit = 0; });
    $$('.hero-name span').forEach((s, i) => s.style.setProperty('--i', i));
    const fp = $('.fin-pp');
    if (fp) {
      let i = 0;
      const wrapLetters = node => node.textContent.split('').map(c => c === ' ' ? ' ' : `<span style="--i:${i++}">${esc(c)}</span>`).join('');
      fp.innerHTML = [...fp.childNodes].map(n => n.nodeType === 3 ? wrapLetters(n) : `<em>${wrapLetters(n)}</em>`).join('');
    }
  }

  /* ---------------- l'histoire ---------------- */
  function init(els) {
    const ioLoad = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { loadEl(e.target); ioLoad.unobserve(e.target); }
    }), { rootMargin: '200% 0px' });
    els.forEach(el => ioLoad.observe(el));

    const ioRv = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const t = e.target; ioRv.unobserve(t);
      if (t.matches('[data-split]')) t.classList.add('split-in'); else t.classList.add('in');
      if (t.dataset.count) countUp(t);
      if (t.classList.contains('march')) march(true);
      if (t.classList.contains('sig')) drawSig(t);
    }), { rootMargin: '0px 0px -10% 0px', threshold: .12 });
    $$('.rv, [data-split], [data-count], .sig').forEach(el => ioRv.observe(el));

    const ioB = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('show'); ioB.unobserve(e.target); }
    }), { rootMargin: '0px 0px -14% 0px', threshold: .2 });
    $$('.b').forEach(b => ioB.observe(b));

    clocks(); setInterval(clocks, 10000);
    march();
    guards();
    finale();
    glfx();
    engine();
  }

  const fmt = n => n.toLocaleString('fr-FR').replace(/\s/g, '\u202f');
  function countUp(el) {
    if (el._c) return; el._c = 1;
    const to = +el.dataset.count, t0 = performance.now(), dur = reduce ? 1 : 1600;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = fmt(v);
      if (p < 1) requestAnimationFrame(step); else el.classList.add('counted');
    };
    requestAnimationFrame(step);
  }
  function drawSig(box) {
    const p = $('path', box); if (!p) return;
    const len = Math.ceil(p.getTotalLength());
    p.style.setProperty('--len', len);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));
  }
  function clocks() {
    $$('[data-clock]').forEach(el => {
      el.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock }).format(new Date());
    });
  }
  function march(animate) {
    const a = Date.UTC(2026, 8, 6, 3), b = Date.UTC(2027, 2, 1), now = Date.now();
    const days = Math.max(0, Math.floor((now - a) / DAY));
    const pct = clamp((now - a) / (b - a)) * 100;
    const ap = $('[data-apart]'); if (ap) ap.textContent = days;
    const pp = $('[data-march-pct]'); if (pp) pp.textContent = Math.round(pct) + '\u202f%';
    if (animate) setTimeout(() => { $('[data-march-bar]').style.width = pct + '%'; }, 250);
  }
  function guards() {
    const sec = $('.riddle'); if (!sec) return;
    const gs = $$('.g', sec), word = $$('.word span', sec);
    const check = () => {
      gs.forEach((g, i) => { if (g.classList.contains('open')) { word[i].textContent = g.dataset.letter; word[i].classList.add('on'); } });
      if (gs.every(g => g.classList.contains('open'))) setTimeout(() => sec.classList.add('solved'), 600);
    };
    gs.forEach(g => g.addEventListener('click', () => { g.classList.add('open'); check(); }));
    $('.reveal-all', sec).addEventListener('click', async () => {
      for (const g of gs) { if (!g.classList.contains('open')) { g.classList.add('open'); check(); await sleep(240); } }
    });
  }

  /* ---------------- fin : maintenir « non c'est moi » ---------------- */
  let frozen = false;
  function finale() {
    const fin = $('.finale'); if (!fin) return;
    const v = $('video', fin);
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) loadEl(v).then(() => { v.muted = true; const p = v.play(); if (p) p.catch(() => {}); });
      else v.pause();
    }), { threshold: .2 }).observe(fin);
    const btn = $('[data-hold]', fin), arc = $('.h1', fin);
    let p = 0, dir = 0, last = 0, raf = 0, done = false;
    const tick = t => {
      const dt = last ? (t - last) : 16; last = t;
      p = clamp(p + dir * dt / (dir > 0 ? 1200 : 400));
      arc.style.strokeDashoffset = 289 * (1 - p);
      if (p >= 1 && !done) { done = true; said(); return; }
      if ((dir < 0 && p <= 0) || dir === 0) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    const start = e => { if (done) return; e.preventDefault(); dir = 1; last = 0; btn.classList.add('pressing'); if (!raf) raf = requestAnimationFrame(tick); };
    const stop = () => { if (done) return; dir = -1; last = 0; btn.classList.remove('pressing'); if (!raf) raf = requestAnimationFrame(tick); };
    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    function said() {
      const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f);
      setTimeout(() => f.remove(), 1100);
      setTimeout(() => {
        fin.classList.add('said');
        frozen = true;
        document.body.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--oia');
        $('#hud .l').textContent = 'ilona';
        $('#hud [data-hud-day]').textContent = `jour 365, promis`;
      }, 160);
    }
    fin._said = said;
  }

  /* ---------------- moteur de scroll (un seul rAF) ---------------- */
  function engine() {
    const story = $('#story');
    const top = el => el.getBoundingClientRect().top + scrollY;
    const meta = $('meta[name="theme-color"]');
    const hudDay = $('#hud [data-hud-day]'), hudRing = $('#hud .fg');
    let anchors = [], secs = [], domes = [], grows = [], nums = [], panos = [], letters = [];
    const measure = () => {
      anchors = $$('[data-date]', story).map(el => ({ y: top(el), d: Date.parse(el.dataset.date + 'T12:00:00Z') })).sort((a, b) => a.y - b.y);
      secs = [...story.children].filter(el => el.dataset && el.dataset.bg).map(el => ({ el, y: top(el), h: el.offsetHeight, bg: el.dataset.bg }));
      domes = $$('.dome', story);
      grows = $$('[data-grow]', story).map(el => ({ el, fig: $('.gfig', el) }));
      nums = $$('.numeral', story);
      panos = $$('[data-pano]', story);
      letters = $$('.lw', story);
    };
    measure();
    addEventListener('resize', () => { measure(); run(); });
    setTimeout(measure, 1500); setTimeout(measure, 5000);
    let lastBg = '', ticking = false, hudMode = '';
    const pad = n => String(n).padStart(2, '0');
    const run = () => {
      ticking = false;
      const vh = innerHeight, W = story.clientWidth, y = scrollY;
      // HUD : fil des jours
      if (!frozen && anchors.length) {
        const probe = y + vh * .5;
        let i = 0; while (i < anchors.length - 1 && anchors[i + 1].y <= probe) i++;
        const a = anchors[i], b = anchors[i + 1];
        let d = a.d;
        if (b && b.y > a.y) d = a.d + (b.d - a.d) * clamp((probe - a.y) / (b.y - a.y));
        if (probe < anchors[0].y) d = anchors[0].d;
        const dt = new Date(d), n = Math.min(365, Math.max(0, Math.round((d - START) / DAY)));
        hudDay.textContent = `jour ${n}, le ${pad(dt.getUTCDate())}.${pad(dt.getUTCMonth() + 1)}.${String(dt.getUTCFullYear()).slice(2)}`;
        hudRing.style.strokeDashoffset = 138.2 * (1 - clamp(n / 365));
      }
      // HUD : pastille claire ou sombre selon ce qu'il recouvre
      {
        const under = document.elementFromPoint(W - 60, 26);
        const dk = !!(under && under.closest('.hero,.grow,.bleed,.pano,.finale,.night'));
        if (dk !== hudMode) { hudMode = dk; document.getElementById('hud').classList.toggle('dk', dk); }
      }
      // couleur d'ambiance
      if (!frozen) {
        const probe = y + vh * .12;
        const s = secs.find(s => probe >= s.y && probe < s.y + s.h) || secs[0];
        if (s && s.bg !== lastBg) { lastBg = s.bg; document.body.style.backgroundColor = s.bg; meta.setAttribute('content', s.bg); }
      }
      // dômes
      for (const el of domes) {
        const r = el.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) { if (el._clip) { el.style.clipPath = ''; el._clip = 0; } continue; }
        const t = clamp((vh - r.top) / (vh * .7));
        if (t >= 1 || reduce) { if (el._clip) { el.style.clipPath = 'none'; el.style.webkitClipPath = 'none'; el._clip = 0; } continue; }
        const e = 1 - Math.pow(1 - t, 3), d = (1 - e) * W * .16, H = r.height;
        const p = `path('M0 ${d.toFixed(1)} Q ${W / 2} ${(-d).toFixed(1)} ${W} ${d.toFixed(1)} L ${W} ${H} L 0 ${H} Z')`;
        el.style.clipPath = p; el.style.webkitClipPath = p; el._clip = 1;
      }
      // photos qui grandissent
      for (const g of grows) {
        const r = g.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const p = clamp(-r.top / (r.height - vh));
        const q = clamp(p / .7), e = q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        const s = g.fig.style;
        s.setProperty('--ci', (26 * (1 - e)).toFixed(2) + '%');
        s.setProperty('--cx', (18 * (1 - e)).toFixed(2) + '%');
        s.setProperty('--cr', (14 * (1 - e)).toFixed(1) + 'px');
        s.setProperty('--gs', (1.25 - .25 * e).toFixed(3));
        g.el.classList.toggle('full-on', e > .96);
      }
      // chiffres romains en parallaxe
      if (!reduce) for (const n of nums) {
        const r = n.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        n.style.setProperty('--py', ((r.top + r.height / 2 - vh / 2) * -.25).toFixed(1) + 'px');
      }
      // panoramique
      for (const p of panos) {
        const r = p.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) continue;
        const k = clamp(-r.top / (r.height - vh)), fig = $('.pano-img', p);
        fig.style.transform = `translate3d(${(-(fig.offsetWidth - W) * k).toFixed(1)}px,0,0)`;
      }
      // lettre : mots qui s'allument
      for (const l of letters) {
        const r = l.getBoundingClientRect();
        if (r.top > vh || r.bottom < -vh) continue;
        const f = reduce ? 1 : clamp((vh * .86 - r.top) / (r.height + vh * .32));
        const lit = Math.round(f * l._w.length);
        if (lit !== l._lit) {
          const [a, b] = lit > l._lit ? [l._lit, lit] : [lit, l._lit];
          for (let i = a; i < b; i++) l._w[i].classList.toggle('on', lit > l._lit);
          l._lit = lit;
        }
      }
    };
    let idle; addEventListener('scroll', () => { document.body.classList.add('moving'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.remove('moving'), 700); if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  /* ---------------- WebGL ---------------- */
  function glfx() {
    if (!window.GL || !GL.supported) return;
    const hero = $('.hero'), hc = $('.glh', hero), hi = $('img[data-a]', hero);
    if (hc && hi) loadEl(hi).then(() => setTimeout(() => { try { if (GL.liquid(hc, hi)) requestAnimationFrame(() => hero.classList.add('gl-on')); } catch (e) {} }, 1600));
    $$('.bleed').forEach(bl => {
      const fig = $('.gld', bl), im = fig && $('img[data-a]', fig); if (!im) return;
      const c = document.createElement('canvas'); c.className = 'gld-c'; fig.after(c);
      let fx = null;
      loadEl(im).then(() => { try { fx = GL.focus(c, im); if (fx) bl.classList.add('gl-on'); } catch (e) {} });
      new IntersectionObserver((es, o) => es.forEach(e => {
        if (!e.isIntersecting) return; o.disconnect();
        const go = () => { if (fx) { fx.reveal(1.25, () => bl.classList.add('gl-done')); } else setTimeout(go, 200); };
        go();
      }), { threshold: .3 }).observe(bl);
    });
  }

  /* ---------------- relecture / tests ---------------- */
  (async () => {
    while (!opened) await sleep(100);
    await opened;
    const y = +qp.get('y') || 0;
    if (y) setTimeout(() => scrollTo(0, y === 99999 ? document.documentElement.scrollHeight : y), 900);
    if (qp.get('yes')) setTimeout(() => { const f = $('.finale'); if (f && f._said) f._said(); }, 2600);
  })();
})();
