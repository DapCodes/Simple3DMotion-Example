import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ================================================================
   SETUP
   ================================================================ */
const canvas = document.querySelector("#canvas3d");
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

/* ---- FOG ---- */
scene.fog = new THREE.FogExp2(0x040810, 0.014);

/* ---- LIGHTS ---- */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0x00d4ff, 2.5);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xff6a00, 2);
fillLight.position.set(-6, 0, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x00ccff, 1.2);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0x0044ff, 0.6);
bottomLight.position.set(0, -5, 2);
scene.add(bottomLight);

/* God-ray spotlight */
const godRay = new THREE.SpotLight(0x00d4ff, 2.5, 30, Math.PI * 0.15, 0.8, 1.5);
godRay.position.set(2, 15, 4);
godRay.target.position.set(-3, -5, 0);
scene.add(godRay, godRay.target);

/* God-ray cone (fake volumetric) */
const coneGeo = new THREE.CylinderGeometry(0.5, 4, 20, 12, 1, true);
const coneMat = new THREE.MeshBasicMaterial({
  color: 0x00d4ff, transparent: true, opacity: 0.012,
  side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
});
const godRayCone = new THREE.Mesh(coneGeo, coneMat);
godRayCone.position.set(2, 5, 4);
godRayCone.rotation.set(Math.PI * 0.05, 0, -Math.PI * 0.02);
scene.add(godRayCone);

/* ================================================================
   CINEMATIC SHOTS — 8 Sections
   Varied: wide, macro, overhead, orbit, low-angle, sweep
   ================================================================ */
const SHOTS = [
  { // 0: HERO — Wide establishing, low mist feel
    section: "hero", modelRot: 0.3, anim: null, // walk-scrub
    from: { x: 0, y: -1, z: 12, fov: 50 },
    to:   { x: 0, y: 2, z: 9, fov: 44 },
    lookAt: new THREE.Vector3(-1.5, 0.5, 0),
    light: { key: 0x00d4ff, fill: 0xff6a00, ki: 2.0, fi: 1.5 },
  },
  { // 1: SPECS — 3/4 orbit right, mid distance
    section: "specs", modelRot: 1.0, anim: "Gipsy.Combat Idle",
    from: { x: 3, y: 0.5, z: 10, fov: 46 },
    to:   { x: 1.5, y: 1.8, z: 8, fov: 40 },
    lookAt: new THREE.Vector3(-1, 1.2, 0),
    light: { key: 0x00aaff, fill: 0x4488ff, ki: 2.8, fi: 1.2 },
  },
  { // 2: NEURAL — Macro on head/chest, dramatic push-in
    section: "neural", modelRot: 3.6, anim: "Gipsy.Combat Block Idle",
    from: { x: -5, y: -0.5, z: 10, fov: 42 },
    to:   { x: -2, y: 2.0, z: 6, fov: 34 },
    lookAt: new THREE.Vector3(-2, 1.8, 0),
    light: { key: 0x0088ff, fill: 0x3366ff, ki: 3.5, fi: 1.5 },
  },
  { // 3: ARSENAL — Low angle looking up at arms, orange mood
    section: "arsenal", modelRot: 0.5, anim: "Gipsy.Combat Punch1",
    from: { x: -2, y: -2, z: 6, fov: 54 },
    to:   { x: -1, y: 1, z: 5, fov: 48 },
    lookAt: new THREE.Vector3(-2, 2, 0),
    light: { key: 0xff3300, fill: 0xff8800, ki: 2.0, fi: 3.5 },
  },
  { // 4: MAP — High overhead tactical view
    section: "deploy-map", modelRot: 1.5, anim: "Gipsy.Walk",
    from: { x: 0, y: 6, z: 10, fov: 38 },
    to:   { x: -1, y: 4, z: 9, fov: 42 },
    lookAt: new THREE.Vector3(-2, 0, 0),
    light: { key: 0x00ffaa, fill: 0x00aaff, ki: 2.0, fi: 1.0 },
  },
  { // 5: TECH — Side sweep, full silhouette profile
    section: "tech", modelRot: -0.9, anim: "Gipsy.Run",
    from: { x: 4, y: 1, z: 9, fov: 40 },
    to:   { x: 2.5, y: 0, z: 10, fov: 44 },
    lookAt: new THREE.Vector3(-1.5, 0.8, 0),
    light: { key: 0x00d4ff, fill: 0x0066ff, ki: 2.5, fi: 1.8 },
  },
  { // 6: PILOTS — Close portrait angle, warm tones
    section: "pilots", modelRot: 0.15, anim: "Gipsy.Emote1",
    from: { x: -1, y: 0.5, z: 9, fov: 44 },
    to:   { x: 0, y: 1.5, z: 7.5, fov: 38 },
    lookAt: new THREE.Vector3(-1.5, 1.2, 0),
    light: { key: 0x4488ff, fill: 0xff6600, ki: 2.2, fi: 2.0 },
  },
  { // 7: CTA — Grand cinematic pull-back reveal
    section: "cta", modelRot: 0.0, anim: "Gipsy.Combat Idle",
    from: { x: 0, y: 4, z: 5, fov: 34 },
    to:   { x: 0, y: 1, z: 11, fov: 48 },
    lookAt: new THREE.Vector3(-1.5, 0.5, 0),
    light: { key: 0x00ffaa, fill: 0x00aaff, ki: 2.8, fi: 1.4 },
  },
];

/* ================================================================
   EMBER / SMOKE PARTICLES (lightweight)
   ================================================================ */
const PC = 200; // particle count — lower for mobile perf
const pGeo  = new THREE.BufferGeometry();
const pPos  = new Float32Array(PC * 3);
const pSize = new Float32Array(PC);
const pOpa  = new Float32Array(PC);
const pLife = new Float32Array(PC);
const pSpd  = new Float32Array(PC);
const pCol  = new Float32Array(PC * 3);

function initP(i) {
  const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 10;
  pPos[i*3]   = -3 + Math.cos(a) * r;
  pPos[i*3+1] = -11 + Math.random() * 14 - 2;
  pPos[i*3+2] = Math.sin(a) * r;
  pSize[i] = 12 + Math.random() * 30;
  pOpa[i]  = 0; pLife[i] = Math.random(); pSpd[i] = .002 + Math.random() * .004;
  const c = Math.random();
  if (c < .4) { pCol[i*3]=.3; pCol[i*3+1]=.8; pCol[i*3+2]=1; }
  else if (c < .7) { pCol[i*3]=1; pCol[i*3+1]=.45; pCol[i*3+2]=.1; }
  else { pCol[i*3]=.6; pCol[i*3+1]=.7; pCol[i*3+2]=.9; }
}
for (let i = 0; i < PC; i++) initP(i);

pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("aSize",    new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute("aOpacity", new THREE.BufferAttribute(pOpa, 1));
pGeo.setAttribute("aColor",   new THREE.BufferAttribute(pCol, 3));

const pMat = new THREE.ShaderMaterial({
  vertexShader: `
    attribute float aSize; attribute float aOpacity; attribute vec3 aColor;
    varying float vO; varying vec3 vC;
    void main(){
      vO=aOpacity; vC=aColor;
      vec4 mv=modelViewMatrix*vec4(position,1.);
      gl_PointSize=aSize*(250./-mv.z);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: `
    varying float vO; varying vec3 vC;
    void main(){
      float d=length(gl_PointCoord-vec2(.5));
      if(d>.5)discard;
      gl_FragColor=vec4(vC,smoothstep(.5,.05,d)*vO);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
scene.add(new THREE.Points(pGeo, pMat));

/* ================================================================
   STATE
   ================================================================ */
let model, mixer;
const animActions = {};   // name -> AnimationAction
let activeAction  = null; // currently playing AnimationAction
let walkAction    = null; // special: walk for scrubbing
const clock = new THREE.Clock();

const WALK_DUR = 3.3;
const TOTAL    = SHOTS.length; // 8
let globalP = 0, targetP = 0;
const camPos    = new THREE.Vector3(0, -1, 16);
const camLookAt = new THREE.Vector3(-2, 0.5, 0);
let modelRotCur = SHOTS[0].modelRot;
let idleTime = 0, prevP = 0;

// Mouse parallax
let mX = 0, mY = 0, tmX = 0, tmY = 0;
addEventListener("mousemove", e => {
  tmX = (e.clientX / innerWidth  - .5) * 2;
  tmY = (e.clientY / innerHeight - .5) * 2;
});

/* Track which section is currently active for pose switching */
let currentSection = -1;

/* ================================================================
   ANIMATION HELPER — crossfade between actions
   ================================================================ */
function playAnim(name, { loop = THREE.LoopRepeat, timeScale = 1, fadeDur = 0.5 } = {}) {
  const action = animActions[name];
  if (!action || action === activeAction) return;

  action.reset();
  action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
  action.timeScale = timeScale;
  action.setEffectiveWeight(1);
  action.clampWhenFinished = loop === THREE.LoopOnce;

  if (activeAction) {
    activeAction.fadeOut(fadeDur);
  }
  action.fadeIn(fadeDur);
  action.play();
  activeAction = action;
}

function scrubWalk(progress) {
  if (!walkAction) return;
  // Pause any active non-walk action gently
  if (activeAction && activeAction !== walkAction) {
    activeAction.fadeOut(0.3);
  }
  walkAction.paused = false;
  walkAction.setEffectiveWeight(1);
  walkAction.play();
  walkAction.paused = true;
  walkAction.time = (progress * TOTAL * WALK_DUR) % WALK_DUR;
  activeAction = walkAction;
}

/* ================================================================
   LOAD MODEL
   ================================================================ */
const loader = new GLTFLoader();
loader.load(
  "model/gipsy_danger_animated.glb",
  gltf => {
    model = gltf.scene;
    scene.add(model);
    model.scale.set(0.2, 0.2, 0.2);
    model.position.set(-3, -11, 0);
    model.rotation.y = SHOTS[0].modelRot;

    mixer = new THREE.AnimationMixer(model);

    // Cache ALL animation actions by name
    gltf.animations.forEach(clip => {
      const action = mixer.clipAction(clip);
      animActions[clip.name] = action;
    });

    // Walk action for scroll-scrub
    walkAction = animActions["Gipsy.Walk"] || null;
    if (walkAction) {
      walkAction.play();
      walkAction.paused = true;
      walkAction.setEffectiveWeight(1);
      walkAction.time = 0;
    }
    mixer.update(0);

    // Start with idle
    if (animActions["Gipsy.Combat Idle"]) {
      // don't play yet, let section logic handle it
    }

    setTimeout(() => document.getElementById("loader").classList.add("hidden"), 500);

    initScroll();
    initWeapons();
    initCTA();
  },
  xhr => {
    if (xhr.total) console.log(`${Math.round(xhr.loaded / xhr.total * 100)}%`);
  },
  err => {
    console.error(err);
    document.getElementById("loader").classList.add("hidden");
  }
);

/* ================================================================
   SMOOTH SCROLL
   ================================================================ */
function initScroll() {
  const LOCK_DUR = 400, SPEED = 0.0018, LERP_N = 0.09, LERP_L = 0.14, LOCK_TH = 0.06;
  let rawY = 0, dispY = 0, locked = false, lockT = 0, lockTmr = null, touchY = 0;
  const snaps = Array.from({ length: TOTAL + 1 }, (_, i) => i);

  function tryLock(v) {
    if (locked) return v;
    for (const s of snaps) {
      if (Math.abs(v - s) < LOCK_TH) {
        locked = true; lockT = s; rawY = s;
        clearTimeout(lockTmr);
        lockTmr = setTimeout(() => locked = false, LOCK_DUR);
        return s;
      }
    }
    return v;
  }
  function add(d) { if (locked) return; rawY = Math.max(0, Math.min(TOTAL, rawY + d)); rawY = tryLock(rawY); }

  addEventListener("wheel", e => { e.preventDefault(); add(e.deltaY * SPEED); }, { passive: false });
  addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => { e.preventDefault(); const d = (touchY - e.touches[0].clientY) * SPEED * 2.2; touchY = e.touches[0].clientY; add(d); }, { passive: false });
  addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "PageDown") add(.25); if (e.key === "ArrowUp" || e.key === "PageUp") add(-.25); });

  window.gotoSection = idx => { locked = false; clearTimeout(lockTmr); rawY = Math.max(0, Math.min(TOTAL, idx)); };
  document.querySelectorAll("[data-goto]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); gotoSection(+el.dataset.goto); }));

  const cDone = new Set(), bDone = new Set();

  gsap.ticker.add(() => {
    dispY = lerp(dispY, rawY, locked ? LERP_L : LERP_N);
    const y = Math.max(0, Math.min(TOTAL, dispY));
    targetP = y / TOTAL;

    const bar = document.getElementById("scroll-progress");
    if (bar) bar.style.width = `${(y / TOTAL) * 100}%`;

    const ai = Math.round(Math.min(y, TOTAL - 1));
    document.querySelectorAll("#dots .dot").forEach((d, i) => d.classList.toggle("active", i === ai));

    updateVis(y, cDone, bDone);
  });

  setTimeout(() => {
    const h = document.getElementById("hero-content");
    if (h) h.classList.add("visible");
  }, 700);
}

/* ================================================================
   SECTION VISIBILITY + POSE SWITCHING
   ================================================================ */
function updateVis(y, cDone, bDone) {
  const active = Math.min(Math.floor(y + 0.15), TOTAL - 1);

  document.querySelectorAll("section").forEach((sec, i) => {
    const c = sec.querySelector(".content");
    if (!c) return;
    if (i === active) {
      if (!c.classList.contains("visible")) c.classList.add("visible");
    } else {
      c.classList.remove("visible");
    }
  });

  // === POSE SWITCHING per section ===
  if (active !== currentSection && mixer) {
    currentSection = active;
    const shot = SHOTS[active];

    if (shot.anim === null) {
      // Scrub walk — handled in render loop
    } else if (shot.anim === "Gipsy.Walk") {
      // Also scrub walk but with different camera
    } else if (animActions[shot.anim]) {
      playAnim(shot.anim, {
        loop: shot.anim.includes("Idle") || shot.anim.includes("Block") || shot.anim === "Gipsy.Walk" || shot.anim === "Gipsy.Run"
          ? THREE.LoopRepeat : THREE.LoopOnce,
        fadeDur: 0.6
      });
    }
  }

  // Counters
  document.querySelectorAll("[data-count]").forEach(el => {
    const si = +(el.closest("section")?.dataset?.sectionIndex ?? -1);
    if (si === active && !cDone.has(el)) { cDone.add(el); animateCounter(el, parseFloat(el.dataset.count)); }
  });

  // Progress bars
  document.querySelectorAll(".bar-fill[data-w]").forEach(el => {
    const si = +(el.closest("section")?.dataset?.sectionIndex ?? -1);
    if (si === active && !bDone.has(el)) {
      bDone.add(el);
      el.style.setProperty("--fw", el.dataset.w + "%");
      requestAnimationFrame(() => el.style.width = el.dataset.w + "%");
    }
  });
}

/* ================================================================
   WEAPON BUTTONS — Click to change pose + update info
   ================================================================ */
const WEAPONS = {
  plasma:  { name: "I-19 PLASMACASTER", cls: "CLASS-A", dmg: 95, rate: 60, rng: 82 },
  sword:   { name: "GD-6 CHAIN SWORD",  cls: "CLASS-S", dmg: 100, rate: 40, rng: 30 },
  missile: { name: "ANTI-KAIJU MISSILES", cls: "CLASS-B", dmg: 80, rate: 75, rng: 95 },
};

function initWeapons() {
  document.querySelectorAll(".weapon-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Active state
      document.querySelectorAll(".weapon-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Play the pose animation
      const animName = btn.dataset.anim;
      if (animName && animActions[animName]) {
        playAnim(animName, { loop: THREE.LoopOnce, timeScale: 1, fadeDur: 0.3 });
      }

      // Update weapon info panel
      const w = WEAPONS[btn.dataset.weapon];
      if (!w) return;
      const nEl = document.getElementById("w-name");
      const cEl = document.getElementById("w-class");
      const dEl = document.getElementById("w-dmg");
      const rEl = document.getElementById("w-rate");
      const gEl = document.getElementById("w-rng");
      if (nEl) nEl.textContent = w.name;
      if (cEl) cEl.textContent = w.cls;

      // Animate bars
      [dEl, rEl, gEl].forEach(el => { if (el) el.style.width = "0%"; });
      requestAnimationFrame(() => {
        if (dEl) dEl.style.width = w.dmg + "%";
        if (rEl) rEl.style.width = w.rate + "%";
        if (gEl) gEl.style.width = w.rng + "%";
      });

      // Flash effect
      const panel = document.getElementById("weapon-info");
      if (panel) gsap.fromTo(panel, { opacity: .3, y: 6 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out" });
    });
  });
}

/* ================================================================
   CTA BUTTON — Play emote + magnetic hover
   ================================================================ */
function initCTA() {
  const btn = document.getElementById("cta-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const animName = btn.dataset.anim;
    if (animName && animActions[animName]) {
      playAnim(animName, { loop: THREE.LoopOnce, fadeDur: 0.3 });
    }
    // Visual feedback
    gsap.fromTo(btn, { scale: .95 }, { scale: 1, duration: .4, ease: "elastic.out(1, 0.4)" });
  });

  // Magnetic hover
  btn.addEventListener("mousemove", e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * .12}px, ${y * .12}px)`;
  });
  btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
}

/* ================================================================
   COUNTER ANIMATION
   ================================================================ */
function animateCounter(el, target) {
  const isF = target % 1 !== 0;
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / 1400, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = isF ? (e * target).toFixed(1) : Math.round(e * target);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = isF ? target.toFixed(1) : target;
  })(t0);
}

/* ================================================================
   CAMERA MATH
   ================================================================ */
function getCam(progress) {
  const sf = progress * TOTAL;
  const iA = Math.min(Math.floor(sf), SHOTS.length - 1);
  const iB = Math.min(iA + 1, SHOTS.length - 1);
  const blend = qSmooth(clamp01(sf - iA));
  const sA = SHOTS[iA], sB = SHOTS[iB];
  const st = qEase(sf % 1);

  const dA = dolly(sA, st), dB = dolly(sB, st);
  return {
    x: lerp(dA.x, dB.x, blend), y: lerp(dA.y, dB.y, blend),
    z: lerp(dA.z, dB.z, blend), fov: lerp(dA.fov, dB.fov, blend),
    lookAt: new THREE.Vector3(
      lerp(sA.lookAt.x, sB.lookAt.x, blend),
      lerp(sA.lookAt.y, sB.lookAt.y, blend),
      lerp(sA.lookAt.z, sB.lookAt.z, blend)
    ),
    modelRot: lerp(sA.modelRot, sB.modelRot, blend),
    light: {
      key: lerpC(sA.light.key, sB.light.key, blend),
      fill: lerpC(sA.light.fill, sB.light.fill, blend),
      ki: lerp(sA.light.ki, sB.light.ki, blend),
      fi: lerp(sA.light.fi, sB.light.fi, blend),
    },
  };
}

function dolly(s, t) {
  return {
    x: lerp(s.from.x, s.to.x, t), y: lerp(s.from.y, s.to.y, t),
    z: lerp(s.from.z, s.to.z, t), fov: lerp(s.from.fov, s.to.fov, t),
  };
}

/* ================================================================
   RESIZE + DYNAMIC FOV
   ================================================================ */
function handleResize() {
  const a = innerWidth / innerHeight;
  camera.aspect = a;
  // Dynamic base FOV
  if (a < 0.7) camera.fov = 68;       // phone portrait
  else if (a < 1) camera.fov = 60;    // tablet portrait
  else if (a < 1.4) camera.fov = 52;  // tablet landscape
  else camera.fov = 45;               // desktop
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", handleResize);
handleResize(); // initial

/* ================================================================
   MATH
   ================================================================ */
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }
function qSmooth(t) { t = clamp01(t); return t*t*t*(t*(t*6-15)+10); }
function qEase(t) { t = clamp01(t); return t<.5 ? 16*t*t*t*t*t : .5*(2*t-2)**5+1; }
function lerpC(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }

/* ================================================================
   PARTICLE UPDATE
   ================================================================ */
function updateParticles(dt, vel) {
  const pos = pGeo.attributes.position.array;
  const opa = pGeo.attributes.aOpacity.array;
  const siz = pGeo.attributes.aSize.array;
  const boost = Math.min(Math.abs(vel) * 10, 1);
  const dir = Math.sign(vel);

  for (let i = 0; i < PC; i++) {
    pLife[i] += pSpd[i];
    if (pLife[i] > 1) { initP(i); pLife[i] = 0; }
    const l = pLife[i];
    let o = l < .15 ? qSmooth(l/.15) : l < .7 ? 1 : 1 - qSmooth((l-.7)/.3);
    opa[i] = o * (.04 + boost * .1);
    pos[i*3+1] += dt * (.1 + pSpd[i] * 10) + dir * boost * dt * 2.5;
    pos[i*3]   += Math.sin(idleTime * .3 + i * .5) * dt * .05;
    pos[i*3+2] += Math.cos(idleTime * .2 + i * .7) * dt * .04;
    siz[i] = pSize[i] * (.5 + l * .6);
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.aOpacity.needsUpdate = true;
  pGeo.attributes.aSize.needsUpdate = true;
}

/* ================================================================
   RENDER LOOP
   ================================================================ */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  idleTime += dt;

  globalP = lerp(globalP, targetP, .055);
  const vel = globalP - prevP;
  prevP = globalP;

  // Mixer update (for crossfading actions, emotes, etc.)
  if (mixer) mixer.update(dt);

  // If we're on a walk-scrub section (hero or map), overwrite walk action time
  const activeIdx = Math.min(Math.floor(globalP * TOTAL + 0.15), TOTAL - 1);
  const currentShot = SHOTS[activeIdx];
  if (currentShot && (currentShot.anim === null || currentShot.anim === "Gipsy.Walk") && walkAction) {
    walkAction.paused = false;
    walkAction.setEffectiveWeight(1);
    walkAction.play();
    walkAction.paused = true;
    walkAction.time = (globalP * TOTAL * WALK_DUR) % WALK_DUR;
  }

  // Mouse smoothing
  mX = lerp(mX, tmX, .04);
  mY = lerp(mY, tmY, .04);

  // Camera
  const cam = getCam(globalP);
  const CL = .04;
  const shake = 1 + Math.min(Math.abs(vel) * 60, 2);
  const sx = (Math.sin(idleTime * .45) * .02 + Math.sin(idleTime * .75) * .01) * shake;
  const sy = (Math.cos(idleTime * .35) * .018 + Math.sin(idleTime * .6) * .007) * shake;

  camPos.x = lerp(camPos.x, cam.x + sx + mX * .12, CL);
  camPos.y = lerp(camPos.y, cam.y + sy - mY * .06, CL);
  camPos.z = lerp(camPos.z, cam.z, CL);
  camLookAt.lerp(cam.lookAt, CL * .8);

  const fovB = Math.sin(idleTime * .25) * .3;
  camera.fov = lerp(camera.fov, cam.fov + fovB, CL * .4);
  camera.updateProjectionMatrix();
  camera.position.copy(camPos);
  camera.lookAt(camLookAt);

  // Model
  modelRotCur = lerp(modelRotCur, cam.modelRot, .03);
  if (model) {
    const bY = Math.sin(idleTime * 1.1) * .012;
    const bR = Math.sin(idleTime * .6) * .004;
    model.rotation.y = modelRotCur + bR + mX * .03;
    model.position.y = -11 + bY;
    model.position.x = -3;
  }

  // Lights
  keyLight.intensity  = lerp(keyLight.intensity,  cam.light.ki, .03);
  keyLight.color.lerp(cam.light.key, .03);
  fillLight.intensity = lerp(fillLight.intensity, cam.light.fi, .03);
  fillLight.color.lerp(cam.light.fill, .03);

  // God ray breathing
  coneMat.opacity = lerp(coneMat.opacity, .008 + Math.sin(idleTime * .5) * .004, .02);

  updateParticles(dt, vel);
  renderer.render(scene, camera);
}

animate();
