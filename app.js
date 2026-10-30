/* ilona v6 — déverrouillage (AES-GCM) et mise en scène au scroll, sans détourner le scroll */
(() => {
  'use strict';
  const CFG = window.__CFG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const enc = new TextEncoder();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const qp = new URLSearchParams(location.hash.slice(1));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  let mistFx = null;
  try { if (window.GL && GL.supported) mistFx = GL.mist($('#mist'), { tint: [0.05, 0.37, 0.36], dark: [0.047, 0.078, 0.078] }); } catch (e) {}

  /* ---------- clé ---------- */
  const frag = qp.get('k');
  const lock = $('#lock'), slots = $('#slots'), hint = $('#hint');
  if (!frag || !window.crypto || !crypto.subtle) {
    $('.lock-mid').innerHTML = '<p class="broken">' + (!frag ? 'le lien est pas complet, ouvre le direct depuis mon message' : 'ouvre le dans safari') + '</p>';
    $('#pad').style.visibility = 'hidden';
    return;
  }
  const contentP = fetch(CFG.content).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); });
  async function tryCode(code) {
    const base = await crypto.subtle.importKey('raw', enc.encode(code + '|' + frag), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64u(CFG.salt), iterations: CFG.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const buf = await contentP;
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
      return { key, data: JSON.parse(new TextDecoder().decode(pt)) };
    } catch (e) { return null; }
  }

  /* ---------- clavier ---------- */
  let digits = '', busy = false, fails = 0;
  const hints = ['la date où on a commencé à se parler', 'non mdrrr réfléchis', 'ilona sérieux ? c’est en novembre', '01 11 2025 ptdrrr'];
  const dots = $$('i', slots);
  const paint = () => dots.forEach((d, i) => { d.classList.toggle('f', i < digits.length); d.textContent = digits[i] || ''; });
  async function submit() {
    busy = true; slots.classList.add('wait');
    const [res] = await Promise.all([tryCode(digits), sleep(400)]);
    slots.classList.remove('wait');
    if (!res) {
      fails++; slots.classList.remove('shake'); void slots.offsetWidth; slots.classList.add('shake');
      await sleep(500); digits = ''; paint(); hint.textContent = hints[Math.min(fails, hints.length - 1)]; busy = false; return;
    }
    try { sessionStorage.setItem('c', digits); } catch (e) {}
    await open(res);
  }
  $('#pad').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || busy) return;
    if (b.dataset.k === 'del') digits = digits.slice(0, -1); else if (digits.length < 8) digits += b.dataset.k;
    paint(); if (digits.length === 8) submit();
  });
  addEventListener('keydown', e => {
    if (busy || !document.body.classList.contains('locked')) return;
    if (/^\d$/.test(e.key) && digits.length < 8) { digits += e.key; paint(); if (digits.length === 8) submit(); }
    else if (e.key === 'Backspace') { digits = digits.slice(0, -1); paint(); }
  });

  /* ---------- médias ---------- */
  let KEY, ASSETS; const urls = new Map();
  function asset(id) {
    if (urls.has(id)) return urls.get(id);
    const a = ASSETS[id];
    const p = fetch(a.f).then(r => r.arrayBuffer())
      .then(buf => crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12)))
      .then(pt => URL.createObjectURL(new Blob([pt], { type: a.m })));
    urls.set(id, p); return p;
  }
  function loadEl(el) {
    if (el._ld) return el._ld;
    if (el.tagName === 'VIDEO') {
      el._ld = Promise.all([
        el.dataset.poster ? asset(el.dataset.poster).then(u => { el.poster = u; el.classList.add('ok'); }) : 0,
        asset(el.dataset.a).then(u => { el.src = u; el.load(); })
      ]);
    } else el._ld = asset(el.dataset.a).then(u => new Promise(res => { el.onload = () => { el.classList.add('ok'); res(); }; el.onerror = res; el.src = u; }));
    return el._ld;
  }

  /* ---------- ouverture ---------- */
  async function open({ key, data }) {
    KEY = key; ASSETS = data.assets;
    $('#story').innerHTML = data.html;
    const els = $$('[data-a]', $('#story'));
    lock.classList.add('ok');
    await Promise.race([loadEl($('.hero img[data-a]')), sleep(4000)]);
    await sleep(300);
    document.body.classList.remove('locked');
    scrollTo(0, 0);
    lock.classList.add('gone');
    setTimeout(() => { if (mistFx) mistFx.stop(); lock.remove(); }, 1000);
    requestAnimationFrame(() => $('.hero').classList.add('in'));
    (async () => { for (const el of els) { try { await loadEl(el); } catch (e) {} } })();
    prepare();
    init();
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function prepare() {
    $$('.lw').forEach(p => {
      const out = [];
      p.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(t => { if (t) out.push(/^\s+$/.test(t) ? t : `<span class="w">${esc(t)}</span>`); });
        else out.push(n.outerHTML);
      });
      p.innerHTML = out.join(''); p._w = $$('.w', p); p._lit = 0;
    });
  }

  /* ---------- l'histoire ---------- */
  function init() {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; const t = e.target; io.unobserve(t);
      t.classList.add('in');
      if (t.matches('.cb-big')) $$('[data-count]', t).forEach(countUp);
      if (t.matches('.sig')) drawSig(t);
    }), { rootMargin: '0px 0px -10% 0px', threshold: .12 });
    $$('.rv, .sig').forEach(el => io.observe(el));

    clocks(); setInterval(clocks, 15000);
    march(); guards(); winterRows(); finale(); glfx(); engine();
  }
  function countUp(el) {
    const to = +el.dataset.count, t0 = performance.now(), dur = reduce ? 1 : 1400;
    const step = t => { const p = clamp((t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function drawSig(box) {
    const p = $('path', box); if (!p) return;
    p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('in')));
  }
  function clocks() {
    $$('[data-clock]').forEach(el => { el.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock }).format(new Date()); });
    const h = +new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date());
    const say = $('[data-now-say]');
    if (say) say.textContent = h >= 23 || h < 6 ? 'chez toi il fait nuit, j’espère que tu dors bien' : h < 12 ? 'chez toi c’est le matin, bonne journée bb' : h < 18 ? 'chez toi c’est l’après midi' : 'chez toi c’est le soir, moi je dors déjà sûrement';
  }
  function march() {
    const left = Math.max(0, Math.ceil((Date.UTC(2027, 2, 1) - Date.now()) / 864e5));
    const el = $('[data-march-left]'); if (el) el.textContent = left;
  }
  function guards() {
    const sec = $('.riddle'); if (!sec) return;
    const gs = $$('.g', sec), word = $$('.word span', sec);
    const check = () => {
      gs.forEach((g, i) => { if (g.classList.contains('open')) { word[i].textContent = g.dataset.letter; word[i].classList.add('on'); } });
      if (gs.every(g => g.classList.contains('open'))) setTimeout(() => sec.classList.add('solved'), 500);
    };
    gs.forEach(g => g.addEventListener('click', () => { g.classList.add('open'); check(); }));
    $('.reveal-all', sec).addEventListener('click', async () => { for (const g of gs) if (!g.classList.contains('open')) { g.classList.add('open'); check(); await sleep(220); } });
  }
  let rowLock = 0;
  function setRow(i) {
    $$('.w-row').forEach(r => { const on = +r.dataset.w === i; r.classList.toggle('on', on); $('.w-btn', r).setAttribute('aria-expanded', on); });
    $$('.w-img').forEach((im, k) => im.classList.toggle('on', k === i));
  }
  function winterRows() { $$('.w-row').forEach(r => $('.w-btn', r).addEventListener('click', () => { rowLock = performance.now() + 1500; setRow(+r.dataset.w); })); }

  function finale() {
    const fin = $('.finale'); if (!fin) return;
    const v = $('video', fin);
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loadEl(v).then(() => { v.muted = true; const p = v.play(); if (p) p.catch(() => {}); }); else v.pause(); }), { threshold: .2 }).observe(fin);
    const btn = $('[data-hold]', fin);
    let p = 0, dir = 0, last = 0, raf = 0, done = false;
    const tick = t => {
      const dt = last ? t - last : 16; last = t;
      p = clamp(p + dir * dt / (dir > 0 ? 1100 : 350));
      btn.style.setProperty('--hp', p);
      if (p >= 1 && !done) { done = true; said(); return; }
      if ((dir < 0 && p <= 0) || !dir) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', e => { if (done) return; e.preventDefault(); dir = 1; last = 0; btn.classList.add('pressing'); if (!raf) raf = requestAnimationFrame(tick); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, () => { if (done) return; dir = -1; last = 0; btn.classList.remove('pressing'); if (!raf) raf = requestAnimationFrame(tick); }));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    function said() { fin.classList.add('said'); $('.fin-after', fin).hidden = false; if (navigator.vibrate) navigator.vibrate(30); }
    fin._said = said;
  }

  /* ---------- un seul moteur de scroll ---------- */
  function engine() {
    const hero = $('.hero'), hpic = $('.hero-pic'), thr = $('.thread-sec'), stages = $$('.ph-stage'), caps = $$('.th-cap');
    const win = $('.winter'), rows = $$('.w-row'), letters = $$('.lw');
    let tick = false, lastStage = -1, lastRow = -1;
    const run = () => {
      tick = false;
      const vh = innerHeight;
      // hero : la fenêtre s'ouvre jusqu'aux bords
      {
        const r = hero.getBoundingClientRect();
        const p = reduce ? 1 : ease(clamp(-r.top / (r.height - vh) / .85));
        const s = hpic.style;
        s.setProperty('--wt', (34 * (1 - p)).toFixed(2) + '%');
        s.setProperty('--wb', (24 * (1 - p)).toFixed(2) + '%');
        s.setProperty('--wx', (18 * (1 - p)).toFixed(2) + '%');
        s.setProperty('--wr', (28 * (1 - p)).toFixed(1) + 'px');
        s.setProperty('--ws', (1.18 - .18 * p).toFixed(3));
        hero.classList.toggle('open', p > .55);
      }
      // le fil : un cadre, quatre moments
      {
        const r = thr.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          const p = clamp(-r.top / (r.height - vh));
          const i = Math.min(stages.length - 1, Math.floor(p * stages.length * .999));
          if (i !== lastStage) { lastStage = i; stages.forEach((s, k) => s.classList.toggle('on', k === i)); caps.forEach((c, k) => c.classList.toggle('on', k === i)); }
        }
      }
      // l'année : la ligne au niveau du milieu devient active
      if (performance.now() > rowLock) {
        const r = win.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          const probe = vh * .68; let best = 0, bd = 1e9;
          rows.forEach((row, k) => { const b = row.getBoundingClientRect(); const d = Math.abs(b.top + 20 - probe); if (d < bd) { bd = d; best = k; } });
          if (best !== lastRow) { lastRow = best; setRow(best); }
        }
      }
      // lettre : mots qui s'allument
      for (const l of letters) {
        const r = l.getBoundingClientRect(); if (r.top > vh || r.bottom < -vh) continue;
        const f = reduce ? 1 : clamp((vh * .88 - r.top) / (r.height + vh * .3));
        const lit = Math.round(f * l._w.length);
        if (lit !== l._lit) { const [a, b] = lit > l._lit ? [l._lit, lit] : [lit, l._lit]; for (let i = a; i < b; i++) l._w[i].classList.toggle('on', lit > l._lit); l._lit = lit; }
      }
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run);
    run();
  }

  /* ---------- WebGL ---------- */
  function glfx() {
    if (!window.GL || !GL.supported) return;
    const hero = $('.hero'), hc = $('.glh', hero), hi = $('img[data-a]', hero);
    if (hc && hi) loadEl(hi).then(() => { try { if (GL.liquid(hc, hi, { strength: .7 })) hero.classList.add('gl-on'); } catch (e) {} });
    $$('.cur-f').forEach(f => {
      const fig = $('.gld', f), im = fig && $('img[data-a]', fig); if (!im) return;
      const c = document.createElement('canvas'); c.className = 'gld-c'; fig.after(c);
      let fx = null;
      loadEl(im).then(() => { try { fx = GL.focus(c, im); if (fx) f.classList.add('gl-on'); } catch (e) {} });
      new IntersectionObserver((es, o) => es.forEach(e => {
        if (!e.isIntersecting) return; o.disconnect();
        const go = () => fx ? fx.reveal(1.25, () => f.classList.add('gl-done')) : setTimeout(go, 200); go();
      }), { threshold: .35 }).observe(f);
    });
  }

  /* ---------- tests ---------- */
  const auto = c => { digits = c; paint(); submit().then(() => {
    const y = +qp.get('y') || 0;
    if (y) setTimeout(() => scrollTo(0, y === 99999 ? document.documentElement.scrollHeight : y), 900);
    if (qp.get('yes')) setTimeout(() => { const f = $('.finale'); if (f && f._said) f._said(); }, 2600);
  }); };
  if (qp.get('c') && qp.get('c').length === 8) auto(qp.get('c'));
  else try { const c = sessionStorage.getItem('c'); if (c && c.length === 8) auto(c); } catch (e) {}
})();
