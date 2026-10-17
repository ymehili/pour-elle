/* pour elle · couche WebGL (shaders maison, légère, iPhone-friendly) */
window.GL = (() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(2, devicePixelRatio || 1);

  function ctx(canvas, opts = {}) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance', ...opts });
    return gl;
  }
  function sh(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function prog(gl, vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    return p;
  }
  const QUAD_VS = `attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
  function quad(gl, p) {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  }
  function size(gl, canvas, scale = 1) {
    const w = Math.round(canvas.clientWidth * DPR * scale), h = Math.round(canvas.clientHeight * DPR * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }
  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
  vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
  float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
  float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*snoise(p);p*=2.02;a*=.5;}return f;}`;

  /* ---------- 1. Brume vivante (écran du code + fonds) ---------- */
  function mist(canvas, { tint = [0.94, 0.70, 0.76], dark = [0.055, 0.051, 0.047] } = {}) {
    const gl = ctx(canvas); if (!gl) return null;
    const p = prog(gl, QUAD_VS, `precision mediump float;varying vec2 v;uniform float t;uniform vec2 r;uniform vec2 m;uniform vec3 tint;uniform vec3 dark;${NOISE}
    void main(){vec2 uv=v;uv.x*=r.x/r.y;float n=fbm(uv*1.4+vec2(t*.05,-t*.03));float n2=fbm(uv*2.6-vec2(t*.04,t*.02)+n*.6);
    float glow=smoothstep(.15,.95,n2*.5+.5);vec2 mm=m;mm.x*=r.x/r.y;float d=length(uv-mm);float touch=exp(-d*d*6.)*.5;
    float light=glow*.22+touch;vec3 col=mix(dark,tint,light);
    float stars=step(.9975,fract(sin(dot(floor(v*r/2.),vec2(12.9898,78.233)))*43758.5453))*(.4+.6*sin(t*2.+v.x*40.));
    col+=stars*.6;gl_FragColor=vec4(col,1.);}`);
    if (!p) return null; gl.useProgram(p); quad(gl, p);
    const u = n => gl.getUniformLocation(p, n);
    let mx = .5, my = .5, tx = .5, ty = .5, raf, on = true;
    const move = e => { const q = e.touches ? e.touches[0] : e; tx = q.clientX / innerWidth; ty = 1 - q.clientY / innerHeight; };
    addEventListener('pointermove', move, { passive: true }); addEventListener('touchmove', move, { passive: true });
    const t0 = performance.now();
    const loop = () => { if (!on) return; size(gl, canvas, .5); mx += (tx - mx) * .06; my += (ty - my) * .06;
      gl.uniform1f(u('t'), (performance.now() - t0) / 1000); gl.uniform2f(u('r'), canvas.width, canvas.height); gl.uniform2f(u('m'), mx, my);
      gl.uniform3fv(u('tint'), tint); gl.uniform3fv(u('dark'), dark); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); raf = requestAnimationFrame(loop); };
    loop();
    return { stop() { on = false; cancelAnimationFrame(raf); } };
  }

  /* ---------- 2. Image liquide (hero) : distorsion + ondes au doigt ---------- */
  function liquid(canvas, img, { strength = 1 } = {}) {
    const gl = ctx(canvas); if (!gl) return null;
    const p = prog(gl, QUAD_VS, `precision mediump float;varying vec2 v;uniform sampler2D img;uniform float t;uniform vec2 r;uniform vec2 ir;uniform vec2 pt;uniform float pw;uniform float s;uniform float rev;${NOISE}
    void main(){
      float ca=r.x/r.y, ia=ir.x/ir.y; vec2 uv=v-.5; if(ca>ia) uv.y*=ia/ca; else uv.x*=ca/ia; uv+=.5; uv.y=1.-uv.y;
      float n=fbm(uv*2.2+t*.12)*.006*s;
      vec2 d=v-pt; d.x*=r.x/r.y; float dist=length(d); float ring=sin(dist*28.-t*7.)*exp(-dist*5.)*pw*.03;
      vec2 off=vec2(n,n)+normalize(d+1e-4)*ring;
      float z=1.+(1.-rev)*.25; vec2 c=(uv-.5)/z+.5+off;
      vec3 col=texture2D(img,c).rgb;
      vec2 ab=normalize(d+1e-4)*ring*1.5+vec2(n)*.25; float r1=texture2D(img,c+ab).r; float b1=texture2D(img,c-ab).b; col=vec3(r1,col.g,b1);
      float vig=smoothstep(1.2,.35,length(v-.5)); col*=mix(.85,1.,vig);
      gl_FragColor=vec4(col*rev,rev);}`);
    if (!p) return null; gl.useProgram(p); quad(gl, p);
    const u = n => gl.getUniformLocation(p, n);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    let px = .5, py = .5, pw = 0, raf, on = true, rev = 0, visible = true;
    const t0 = performance.now();
    const hit = e => { const q = e.touches ? e.touches[0] : e; const b = canvas.getBoundingClientRect(); px = (q.clientX - b.left) / b.width; py = 1 - (q.clientY - b.top) / b.height; pw = 1; };
    canvas.addEventListener('pointerdown', hit, { passive: true }); canvas.addEventListener('pointermove', e => { if (e.pressure > 0 || e.buttons) hit(e); }, { passive: true });
    canvas.addEventListener('touchmove', hit, { passive: true });
    const loop = () => { if (!on) return; if (visible) { size(gl, canvas, 1); pw *= .965; rev += (1 - rev) * .035;
      gl.uniform1f(u('t'), (performance.now() - t0) / 1000); gl.uniform2f(u('r'), canvas.width, canvas.height); gl.uniform2f(u('ir'), img.naturalWidth, img.naturalHeight);
      gl.uniform2f(u('pt'), px, py); gl.uniform1f(u('pw'), pw); gl.uniform1f(u('s'), reduce ? 0 : strength); gl.uniform1f(u('rev'), rev);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } raf = requestAnimationFrame(loop); };
    loop();
    new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting), { threshold: 0 }).observe(canvas);
    return { stop() { on = false; cancelAnimationFrame(raf); } };
  }

  /* ---------- 3. Ciel d'étoiles 3D (finale) : points, profondeur, dérive, parallaxe gyroscope ---------- */
  function stars(canvas, { n = 900 } = {}) {
    const gl = ctx(canvas); if (!gl) return null;
    const p = prog(gl, `attribute vec3 a;attribute float sz;uniform float t;uniform vec2 r;uniform vec2 tilt;varying float vz;varying float tw;
      void main(){vec3 q=a;q.z=fract(q.z+t*.02);float z=q.z*6.+.4;vec2 xy=(q.xy-.5)*4.+tilt*(1.-q.z)*.6;xy.x*=r.y/r.x;
      gl_Position=vec4(xy/z,0.,1.);gl_PointSize=sz*(2.6/z)*${DPR.toFixed(1)};vz=q.z;tw=sin(t*2.+a.x*90.)*.5+.5;}`,
      `precision mediump float;varying float vz;varying float tw;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.0,d);a*=(.35+.65*tw)*smoothstep(0.,.15,vz)*smoothstep(1.,.75,vz);
      vec3 col=mix(vec3(1.,.9,.95),vec3(.94,.70,.76),tw*.5);gl_FragColor=vec4(col*a,a);}`);
    if (!p) return null; gl.useProgram(p);
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { data[i * 4] = Math.random(); data[i * 4 + 1] = Math.random(); data[i * 4 + 2] = Math.random(); data[i * 4 + 3] = 1 + Math.random() * 2.2; }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const la = gl.getAttribLocation(p, 'a'), ls = gl.getAttribLocation(p, 'sz');
    gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 1, gl.FLOAT, false, 16, 12);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = x => gl.getUniformLocation(p, x);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf, on = true, visible = false;
    const tiltFrom = (gx, gy) => { tx = Math.max(-1, Math.min(1, gx)); ty = Math.max(-1, Math.min(1, gy)); };
    addEventListener('deviceorientation', e => { if (e.gamma != null) tiltFrom(e.gamma / 30, (e.beta - 45) / 30); }, { passive: true });
    const move = e => { const q = e.touches ? e.touches[0] : e; tiltFrom((q.clientX / innerWidth - .5) * 2, (.5 - q.clientY / innerHeight) * 2); };
    addEventListener('pointermove', move, { passive: true }); addEventListener('touchmove', move, { passive: true });
    const t0 = performance.now();
    const loop = () => { if (!on) return; if (visible) { size(gl, canvas, 1); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      cx += (tx - cx) * .05; cy += (ty - cy) * .05;
      gl.uniform1f(u('t'), reduce ? 0 : (performance.now() - t0) / 1000); gl.uniform2f(u('r'), canvas.width, canvas.height); gl.uniform2f(u('tilt'), cx, cy);
      gl.drawArrays(gl.POINTS, 0, n); } raf = requestAnimationFrame(loop); };
    loop();
    new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting), { threshold: 0 }).observe(canvas);
    return { stop() { on = false; cancelAnimationFrame(raf); } };
  }

  /* ---------- 4. Révélation d'image par dissolution (scroll) ---------- */
  function dissolve(canvas, img) {
    const gl = ctx(canvas); if (!gl) return null;
    const p = prog(gl, QUAD_VS, `precision mediump float;varying vec2 v;uniform sampler2D img;uniform float k;uniform vec2 r;uniform vec2 ir;${NOISE}
    void main(){float ca=r.x/r.y,ia=ir.x/ir.y;vec2 uv=v-.5;if(ca>ia)uv.y*=ia/ca;else uv.x*=ca/ia;uv+=.5;uv.y=1.-uv.y;
      float n=fbm(uv*3.)*.5+.5;float e=smoothstep(k-.25,k+.05,1.-v.y*.6-n*.4);
      vec2 c=(uv-.5)*(1.+(1.-k)*.12)+.5; vec3 col=texture2D(img,c+vec2(0.,(1.-e)*.03)).rgb;
      gl_FragColor=vec4(col*e,e);}`);
    if (!p) return null; gl.useProgram(p); quad(gl, p);
    const u = n => gl.getUniformLocation(p, n);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    let k = 0, target = 0, raf, on = true, done = false;
    const loop = () => { if (!on) return; k += (target - k) * .08; size(gl, canvas, 1);
      gl.uniform1f(u('k'), reduce ? 1.2 : k); gl.uniform2f(u('r'), canvas.width, canvas.height); gl.uniform2f(u('ir'), img.naturalWidth, img.naturalHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (Math.abs(target - k) < .002 && target >= 1.2) { done = true; on = false; canvas.classList.add('done'); return; }
      raf = requestAnimationFrame(loop); };
    loop();
    return { reveal() { target = 1.25; }, stop() { on = false; cancelAnimationFrame(raf); } };
  }

  return { mist, liquid, stars, dissolve, supported: !!document.createElement('canvas').getContext('webgl') };
})();
