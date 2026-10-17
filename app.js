/* Pour elle. — déverrouillage, déchiffrement (AES-GCM) et animations */
(() => {
  'use strict';
  const CFG = window.__CFG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const enc = new TextEncoder();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------- étoiles ---------------- */
  function sprinkle(box, n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      if (Math.random() < .55) s.className = 's';
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.top = (Math.random() * 100).toFixed(2) + '%';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      s.style.animationDuration = (3 + Math.random() * 4).toFixed(2) + 's';
      box.appendChild(s);
    }
  }
  sprinkle($('.stars'), 70);
  let mistFx = null; try { if (window.GL && GL.supported) mistFx = GL.mist($('#mist')); } catch (e) {}
  const shooter = document.createElement('i'); shooter.className = 'shoot'; $('#lock').appendChild(shooter);
  const shootTimer = setInterval(() => {
    if (!document.body.classList.contains('locked')) return clearInterval(shootTimer);
    shooter.style.top = (8 + Math.random() * 22) + '%';
    shooter.classList.remove('go'); void shooter.offsetWidth; shooter.classList.add('go');
  }, 5200);

  /* ---------------- clé du lien ---------------- */
  const frag = new URLSearchParams(location.hash.slice(1)).get('k');
  const lock = $('#lock'), slots = $('#slots'), hint = $('#hint');
  if (!frag || !window.crypto || !crypto.subtle) {
    $('.lock-mid').innerHTML = '<p class="broken">' + (!frag
      ? 'Ce lien n’est pas complet.<br>Ouvre-le directement depuis mon message ♡'
      : 'Ouvre ce lien dans Safari ♡') + '</p>';
    $('#pad').style.visibility = 'hidden';
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

  /* ---------------- clavier ---------------- */
  let digits = '', busy = false, fails = 0;
  const hints = [
    'entre la date du jour où tout a commencé',
    'presque… le jour où on a commencé à se parler ♡',
    'un jour de novembre 2025, réfléchis bien',
    'le tout premier jour de novembre 2025, allez'
  ];
  const dots = $$('i', slots);
  const paint = () => dots.forEach((d, i) => { d.classList.toggle('f', i < digits.length); d.textContent = digits[i] || ''; });

  async function submit() {
    busy = true;
    slots.classList.add('wait');
    const [res] = await Promise.all([tryCode(digits), sleep(450)]);
    slots.classList.remove('wait');
    if (!res) {
      fails++;
      slots.classList.remove('shake'); void slots.offsetWidth; slots.classList.add('shake');
      if (navigator.vibrate) navigator.vibrate(120);
      await sleep(520);
      digits = ''; paint();
      hint.textContent = hints[Math.min(fails, hints.length - 1)];
      busy = false;
      return;
    }
    try { sessionStorage.setItem('c', digits); } catch (e) {}
    open(res);
  }

  $('#pad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || busy) return;
    const k = b.dataset.k;
    if (k === 'del') digits = digits.slice(0, -1);
    else if (digits.length < 8) digits += k;
    paint();
    if (digits.length === 8) submit();
  });
  // clavier physique (test sur ordinateur)
  addEventListener('keydown', e => {
    if (busy || !document.body.classList.contains('locked')) return;
    if (/^\d$/.test(e.key) && digits.length < 8) { digits += e.key; paint(); if (digits.length === 8) submit(); }
    else if (e.key === 'Backspace') { digits = digits.slice(0, -1); paint(); }
  });

  /* ---------------- ouverture ---------------- */
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

  async function open({ key, data }) {
    KEY = key; ASSETS = data.assets;
    const story = $('#story');
    story.innerHTML = data.html;
    const els = $$('[data-a]', story);
    // le héros d'abord
    const first = els.slice(0, 2).map(loadEl);
    lock.classList.add('ok');
    await Promise.race([Promise.all(first), sleep(4000)]);
    await sleep(500);
    document.body.classList.remove('locked');
    scrollTo(0, 0);
    lock.classList.add('gone');
    setTimeout(() => { if (mistFx) mistFx.stop(); lock.remove(); }, 1700);
    init(els);
  }

  /* ---------------- histoire ---------------- */
  function init(els) {
    // images : chargement à l'approche + préchargement doux de tout le reste
    const ioLoad = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { loadEl(e.target); ioLoad.unobserve(e.target); }
    }), { rootMargin: '250% 0px' });
    els.forEach(el => ioLoad.observe(el));
    (async () => { for (const el of els) { try { await loadEl(el); } catch (e) {} } })();

    // apparitions
    const ioRv = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); ioRv.unobserve(e.target); onIn(e.target); }
    }), { rootMargin: '0px 0px -9% 0px', threshold: .08 });
    $$('.rv, .debate, [data-count]').forEach(el => ioRv.observe(el));
    // le héros apparaît tout de suite
    requestAnimationFrame(() => $$('.hero .rv').forEach(el => el.classList.add('in')));

    // conversations
    const ioChat = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { ioChat.unobserve(e.target); playChat(e.target); }
    }), { rootMargin: '0px 0px -18% 0px', threshold: .01 });
    $$('[data-chat]').forEach(c => ioChat.observe(c));

    // couleur de la barre Safari
    const meta = $('meta[name="theme-color"]');
    const ioTheme = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) meta.setAttribute('content', e.target.dataset.theme);
    }), { rootMargin: '-50% 0px -50% 0px' });
    $$('[data-theme]').forEach(s => ioTheme.observe(s));
    const hud = $('[data-hud-ch]');
    const ioCh = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && hud) hud.textContent = e.target.dataset.ch; }), { rootMargin: '-40% 0px -55% 0px' });
    $$('[data-ch]').forEach(s => ioCh.observe(s));

    glfx();
    since(); setInterval(since, 1000);
    clocks(); setInterval(clocks, 10000);
    march();
    guards();
    cards();
    finale();
    panos();
  }

  function onIn(el) {
    if (el.dataset.count && !el.closest('.bar')) countUp(el);
    if (el.classList.contains('debate')) $$('[data-count]', el).forEach(countUp);
    if (el.classList.contains('march')) march(true);
  }

  const fmt = n => n.toLocaleString('fr-FR').replace(/\s/g, '\u202f');
  function countUp(el) {
    if (el._c) return; el._c = 1;
    const to = +el.dataset.count, t0 = performance.now(), dur = reduce ? 1 : 1700;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = fmt(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function playChat(c) {
    const kids = [...c.children];
    for (const k of kids) {
      if (!k.classList.contains('b')) { continue; }
      const len = k.textContent.length;
      if (k.classList.contains('him') && !reduce) {
        const t = document.createElement('div');
        t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>';
        c.insertBefore(t, k); k.style.display = 'none';
        requestAnimationFrame(() => t.classList.add('show'));
        await sleep(Math.min(1500, 520 + len * 11));
        t.remove(); k.style.display = '';
        requestAnimationFrame(() => k.classList.add('show'));
        await sleep(380);
      } else {
        await sleep(reduce ? 0 : 420);
        k.classList.add('show');
        await sleep(reduce ? 0 : 260 + Math.min(500, len * 6));
      }
    }
  }

  // compteur « depuis que tout a commencé » (1er nov. 2025, minuit à Paris)
  const START = Date.UTC(2025, 9, 31, 23, 0, 0);
  function since() {
    const el = $('[data-since]'); if (!el) return;
    let s = Math.max(0, Math.floor((Date.now() - START) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const p = n => String(n).padStart(2, '0');
    el.textContent = `${d} j · ${p(h)}:${p(m)}:${p(s)}`;
  }

  function clocks() {
    $$('[data-clock]').forEach(el => {
      el.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock }).format(new Date());
    });
  }

  // 6 sept. 2026 → début mars 2027
  function march(animate) {
    const a = Date.UTC(2026, 8, 6, 3), b = Date.UTC(2027, 2, 1), now = Date.now();
    const days = Math.max(0, Math.floor((now - a) / 864e5));
    const pct = Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100));
    const ap = $('[data-apart]'); if (ap) ap.textContent = days;
    const pp = $('[data-march-pct]'); if (pp) pp.textContent = Math.round(pct) + '\u202f%';
    if (animate) {
      const bar = $('[data-march-bar]'), pl = $('.plane');
      setTimeout(() => { bar.style.width = pct + '%'; if (pl) pl.style.left = pct + '%'; }, 250);
    }
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
      for (const g of gs) { if (!g.classList.contains('open')) { g.classList.add('open'); check(); await sleep(260); } }
    });
  }

  function cards() {
    $$('.card').forEach(c => c.addEventListener('click', () => c.classList.toggle('flip')));
  }

  function finale() {
    const fin = $('.finale'); if (!fin) return;
    const v = $('video', fin);
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { loadEl(v).then(() => { v.muted = true; const p = v.play(); if (p) p.catch(() => {}); }); }
      else v.pause();
    }), { threshold: .2 }).observe(fin);
    $$('[data-yes]', fin).forEach(b => b.addEventListener('click', () => {
      fin.classList.add('said'); petals(46);
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }));
  }

  function petals(n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'petal';
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.setProperty('--dx', ((Math.random() - .5) * 140).toFixed(0) + 'px');
      p.style.setProperty('--r', ((Math.random() - .5) * 720).toFixed(0) + 'deg');
      p.style.animationDuration = (3.8 + Math.random() * 3.4).toFixed(2) + 's';
      p.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
      const s = .7 + Math.random() * .8; p.style.width = 14 * s + 'px'; p.style.height = 12 * s + 'px';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 9500);
    }
  }

  // panoramiques qui défilent latéralement + légère parallaxe des pleines pages
  function panos() {
    const ps = $$('[data-pano]');
    const bleeds = $$('.bleed .full .ph-i, .hero .full .ph-i');
    let ticking = false;
    const prog = document.getElementById('prog');
    const run = () => {
      ticking = false;
      const vh = innerHeight, vw = document.documentElement.clientWidth;
      if (prog) prog.style.transform = `scaleX(${Math.min(1, scrollY / (document.documentElement.scrollHeight - vh))})`;
      for (const p of ps) {
        const r = p.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) continue;
        const prog = Math.min(1, Math.max(0, -r.top / (r.height - vh)));
        const fig = $('.pano-img', p);
        const w = fig.offsetWidth, sw = Math.min(vw, p.offsetWidth);
        fig.style.transform = `translate3d(${(-(w - sw) * prog).toFixed(1)}px,0,0)`;
        p.classList.toggle('txt-on', prog > .04 && prog < .97);
      }
      if (!reduce) for (const b of bleeds) {
        const r = b.parentElement.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const k = (r.top + r.height / 2 - vh / 2) / vh;
        b.style.transform = `translate3d(0,${(k * -38).toFixed(1)}px,0) scale(1.08)`;
      }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run);
    run();
  }

  function glfx() {
    if (!window.GL || !GL.supported) return;
    // hero liquide
    const hero = $('.hero'), hc = $('.glh', hero), hi = $('img[data-a]', hero);
    if (hc && hi) loadEl(hi).then(() => { try { if (GL.liquid(hc, hi)) hero.classList.add('gl-on'); } catch (e) {} });
    // pleines pages : dissolution au scroll
    $$('.bleed').forEach(bl => {
      const fig = $('.gld', bl), im = fig && $('img[data-a]', fig); if (!im) return;
      const c = document.createElement('canvas'); c.className = 'gld-c'; fig.after(c);
      let fx = null;
      loadEl(im).then(() => { try { fx = GL.dissolve(c, im); if (fx) bl.classList.add('gl-on'); } catch (e) {} });
      new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const go = () => { if (fx) { fx.reveal(); setTimeout(() => bl.classList.add('gl-done'), 1400); } else setTimeout(go, 200); }; go(); } }), { threshold: .25 }).observe(bl);
    });
    // étoiles
    const sc = $('.glstars'); if (sc) { try { GL.stars(sc); } catch (e) {} }
  }

  // relecture (rechargement de la page) : on garde le code pour la session
  const qp = new URLSearchParams(location.hash.slice(1));
  if (qp.get('c') && qp.get('c').length === 8) { digits = qp.get('c'); paint(); submit().then(() => { const y = +qp.get('y') || 0; setTimeout(() => scrollTo(0, y), 2600); if (qp.get('yes')) setTimeout(() => $('[data-yes]')?.click(), 4200); }); }
  try {
    const c = sessionStorage.getItem('c');
    if (c && c.length === 8) { digits = c; paint(); submit(); }
  } catch (e) {}
})();
