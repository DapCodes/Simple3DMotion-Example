import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ========== SETUP ==========
const canvas = document.querySelector("#canvas3d");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ========== LIGHTS ==========
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0x00d4ff, 2.5);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xff6a00, 2);
fillLight.position.set(-6, 0, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x00ccff, 1.5);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

const bottomLight = new THREE.PointLight(0x0044ff, 1);
bottomLight.position.set(0, -5, 2);
scene.add(bottomLight);

// ========== CINEMATIC SHOTS ==========
// 4 shots, each with FROM → TO camera dolly move
const SHOTS = [
  {
    section: "hero",
    modelRot: 0.25,
    from: { x: 0.0, y: -0.5, z: 10.5, fov: 48 },
    to: { x: 0.0, y: 2.0, z: 9.0, fov: 44 },
    lookAt: new THREE.Vector3(-1.5, 0.5, 0),
    light: { key: 0x00d4ff, fill: 0xff6a00, ki: 2.5, fi: 2.0 },
  },
  {
    section: "neural",
    modelRot: -0.6,
    from: { x: 3.5, y: 1.2, z: 7.0, fov: 42 },
    to: { x: 2.0, y: 1.5, z: 5.5, fov: 38 },
    lookAt: new THREE.Vector3(-1.0, 1.0, 0),
    light: { key: 0x0088ff, fill: 0x3366ff, ki: 3.2, fi: 1.2 },
  },
  {
    section: "vortex",
    modelRot: 0.6,
    from: { x: -3.0, y: 0.0, z: 7.5, fov: 52 },
    to: { x: -1.5, y: 0.8, z: 5.5, fov: 46 },
    lookAt: new THREE.Vector3(-2.0, 1.5, 0),
    light: { key: 0xff3300, fill: 0xff8800, ki: 1.8, fi: 3.5 },
  },
  {
    section: "deploy",
    modelRot: 0.0,
    from: { x: 0.0, y: 4.0, z: 5.5, fov: 36 },
    to: { x: 0.0, y: 1.5, z: 9.5, fov: 44 },
    lookAt: new THREE.Vector3(-1.5, 0.8, 0),
    light: { key: 0x00ffaa, fill: 0x00aaff, ki: 2.8, fi: 1.4 },
  },
];

// ========== THREE STATE ==========
let model, walkAction, mixer;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

const WALK_DURATION = 3.3;
const TOTAL_SECTIONS = SHOTS.length; // 4

// globalProgress: 0 → 1 over the whole page, driven by smooth scroll system
let globalProgress = 0; // what render reads (smoothed)
let targetProgress = 0; // what scroll system writes

const camPos = new THREE.Vector3(0, -0.5, 10.5);
const camLookAt = new THREE.Vector3(-1.5, 0.5, 0);
let modelRotCurrent = SHOTS[0].modelRot;
let idleTime = 0;

// ========== LOAD MODEL ==========
loader.load(
  "model/gipsy_danger_animated.glb",
  (gltf) => {
    model = gltf.scene;
    scene.add(model);
    model.scale.set(0.2, 0.2, 0.2);
    model.position.set(-3, -11, 0);
    model.rotation.y = SHOTS[0].modelRot;

    mixer = new THREE.AnimationMixer(model);
    walkAction = mixer.clipAction(gltf.animations[17]); // Gipsy.Walk
    walkAction.play();
    walkAction.paused = true;
    walkAction.setEffectiveWeight(1);
    walkAction.time = 0;
    mixer.update(0);

    setTimeout(
      () => document.getElementById("loader").classList.add("hidden"),
      500,
    );

    initSmoothScroll();
  },
  (xhr) => {
    if (xhr.total)
      console.log(`${Math.round((xhr.loaded / xhr.total) * 100)}%`);
  },
  (err) => {
    console.error(err);
    document.getElementById("loader").classList.add("hidden");
  },
);

// ========== SMOOTH SCROLL SYSTEM =============================================
//
//  Strategy: hijack native scroll entirely.
//  - Listen to wheel / touch / keyboard events
//  - Accumulate "scroll intent" into a raw virtual scroll position (rawY)
//  - Each section has a "lock zone" — when rawY enters a lock zone we pause
//    and hold there for LOCK_DURATION ms before releasing
//  - A GSAP ticker smoothly lerps the displayed progress toward rawY
//
//  This gives: buttery smooth inertia + per-section pause + no layout jank
// =============================================================================
function initSmoothScroll() {
  // Virtual scroll: 0 = top, TOTAL_SECTIONS = bottom (one unit per section)
  const LOCK_DURATION = 900; // ms to hold at each section snap point
  const SCROLL_SPEED = 0.0014; // how much one wheel tick moves (tune this)
  const LERP_NORMAL = 0.07; // smooth factor while scrolling
  const LERP_LOCKED = 0.12; // slightly faster snap INTO lock position
  const LOCK_THRESHOLD = 0.06; // how close to a snap point before locking

  let rawY = 0; // raw accumulated scroll (0 → TOTAL_SECTIONS)
  let displayY = 0; // smoothed display value (drives render)
  let isLocked = false; // currently in a lock hold?
  let lockTarget = 0; // which integer snap point we're locked to
  let lockTimer = null; // setTimeout handle
  let touchStartY = 0;

  // Snap points: section boundaries (0, 1, 2, 3) + end (4)
  const snapPoints = [0, 1, 2, 3, 4];

  function tryLock(newRaw) {
    if (isLocked) return newRaw;

    for (const snap of snapPoints) {
      const dist = Math.abs(newRaw - snap);
      if (dist < LOCK_THRESHOLD) {
        // Snap!
        isLocked = true;
        lockTarget = snap;
        rawY = snap;

        clearTimeout(lockTimer);
        lockTimer = setTimeout(() => {
          isLocked = false;
        }, LOCK_DURATION);

        return snap;
      }
    }
    return newRaw;
  }

  function addDelta(delta) {
    if (isLocked) return; // swallow input while locked

    rawY = Math.max(0, Math.min(TOTAL_SECTIONS, rawY + delta));
    rawY = tryLock(rawY);
  }

  // --- Wheel ---
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY * SCROLL_SPEED;
      addDelta(delta);
    },
    { passive: false },
  );

  // --- Touch ---
  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const delta = (touchStartY - e.touches[0].clientY) * SCROLL_SPEED * 2;
      touchStartY = e.touches[0].clientY;
      addDelta(delta);
    },
    { passive: false },
  );

  // --- Keyboard ---
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown") addDelta(0.25);
    if (e.key === "ArrowUp" || e.key === "PageUp") addDelta(-0.25);
  });

  // --- Navigate to a section (from dots or nav links) ---
  window.gotoSection = function (idx) {
    isLocked = false;
    clearTimeout(lockTimer);
    rawY = Math.max(0, Math.min(TOTAL_SECTIONS, idx));
  };

  // Dot clicks
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.gotoSection(parseInt(el.dataset.goto));
    });
  });

  // --- GSAP ticker: smooth display toward rawY ---
  gsap.ticker.add(() => {
    const lerpF = isLocked ? LERP_LOCKED : LERP_NORMAL;
    displayY = lerp(displayY, rawY, lerpF);

    // Clamp and push to render system
    const clamped = Math.max(0, Math.min(TOTAL_SECTIONS, displayY));
    targetProgress = clamped / TOTAL_SECTIONS;

    // Update scroll progress bar
    const bar = document.getElementById("scroll-progress");
    if (bar) bar.style.width = `${(clamped / TOTAL_SECTIONS) * 100}%`;

    // Update section dots
    const activeIdx = Math.round(Math.min(clamped, TOTAL_SECTIONS - 1));
    document.querySelectorAll("#section-dots .dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === activeIdx);
    });

    // Section content visibility
    updateSectionVisibility(clamped);
  });

  // Show hero immediately
  setTimeout(() => {
    document.getElementById("hero-content")?.classList.add("visible");
  }, 800);

  // Stat counters — trigger once when section becomes visible
  const countersDone = new Set();
  function updateSectionVisibility(y) {
    // Active section index: whichever integer bucket y falls in
    const activeSection = Math.min(Math.floor(y + 0.15), TOTAL_SECTIONS - 1);

    document.querySelectorAll("section").forEach((sec, i) => {
      const content = sec.querySelector(".content");
      if (!content) return;
      if (i === activeSection) {
        content.classList.add("visible");
      } else {
        content.classList.remove("visible");
      }
    });

    // Counters — fire once per section when it becomes active
    document.querySelectorAll(".stat-value[data-count]").forEach((el) => {
      const secIdx = parseInt(
        el.closest("section")?.dataset?.sectionIndex ?? "-1",
      );
      if (secIdx === activeSection && !countersDone.has(el)) {
        countersDone.add(el);
        animateCounter(el, parseFloat(el.dataset.count));
      }
    });
  }
}

// ========== CAMERA MATH =====================================================
function getCameraState(progress) {
  // progress: 0 → 1 over whole page
  // map to shot float: 0 → 4
  const shotFloat = progress * TOTAL_SECTIONS;
  const idxA = Math.min(Math.floor(shotFloat), SHOTS.length - 1);
  const idxB = Math.min(idxA + 1, SHOTS.length - 1);
  const blend = smoothstep(shotFloat - idxA); // 0→1 between shots

  const shotA = SHOTS[idxA];
  const shotB = SHOTS[idxB];

  // Within-shot section progress (0→1), eased
  const sectionT = easeInOut(shotFloat % 1);

  function dolly(shot) {
    return {
      x: lerp(shot.from.x, shot.to.x, sectionT),
      y: lerp(shot.from.y, shot.to.y, sectionT),
      z: lerp(shot.from.z, shot.to.z, sectionT),
      fov: lerp(shot.from.fov, shot.to.fov, sectionT),
    };
  }

  const pA = dolly(shotA);
  const pB = dolly(shotB);
  const t = blend;

  return {
    x: lerp(pA.x, pB.x, t),
    y: lerp(pA.y, pB.y, t),
    z: lerp(pA.z, pB.z, t),
    fov: lerp(pA.fov, pB.fov, t),
    lookAt: new THREE.Vector3(
      lerp(shotA.lookAt.x, shotB.lookAt.x, t),
      lerp(shotA.lookAt.y, shotB.lookAt.y, t),
      lerp(shotA.lookAt.z, shotB.lookAt.z, t),
    ),
    modelRot: lerp(shotA.modelRot, shotB.modelRot, t),
    light: {
      key: lerpColor(shotA.light.key, shotB.light.key, t),
      fill: lerpColor(shotA.light.fill, shotB.light.fill, t),
      ki: lerp(shotA.light.ki, shotB.light.ki, t),
      fi: lerp(shotA.light.fi, shotB.light.fi, t),
    },
  };
}

// ========== COUNTER ANIMATION ==========
function animateCounter(el, target) {
  const isFloat = target % 1 !== 0;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / 1500, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = isFloat ? (e * target).toFixed(1) : Math.round(e * target);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = isFloat ? target.toFixed(1) : target;
  }
  requestAnimationFrame(tick);
}

// ========== RESIZE ==========
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== MATH UTILS ==========
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function lerpColor(hexA, hexB, t) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), t);
}

// ========== RENDER LOOP ==========
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  idleTime += delta;

  // Smooth global progress (extra layer of smoothing on top of GSAP ticker)
  globalProgress = lerp(globalProgress, targetProgress, 0.055);

  // Walk scrub — loop every 3.3s
  if (mixer && walkAction) {
    walkAction.time =
      (globalProgress * TOTAL_SECTIONS * WALK_DURATION) % WALK_DURATION;
    mixer.update(0);
  }

  // Camera
  const cam = getCameraState(globalProgress);
  const CAM_LERP = 0.042;

  camPos.x = lerp(camPos.x, cam.x, CAM_LERP);
  camPos.y = lerp(camPos.y, cam.y, CAM_LERP);
  camPos.z = lerp(camPos.z, cam.z, CAM_LERP);

  camLookAt.lerp(cam.lookAt, CAM_LERP);

  camera.fov = lerp(camera.fov, cam.fov, CAM_LERP * 0.5);
  camera.updateProjectionMatrix();
  camera.position.copy(camPos);
  camera.lookAt(camLookAt);

  // Model rotation
  modelRotCurrent = lerp(modelRotCurrent, cam.modelRot, 0.038);

  if (model) {
    const breathY = Math.sin(idleTime * 1.1) * 0.015;
    const breathRot = Math.sin(idleTime * 0.6) * 0.005;
    model.rotation.y = modelRotCurrent + breathRot;
    model.position.y = -11 + breathY;
    model.position.x = -3;
  }

  // Lights
  const ML = 0.03;
  keyLight.intensity = lerp(keyLight.intensity, cam.light.ki, ML);
  keyLight.color.lerp(cam.light.key, ML);
  fillLight.intensity = lerp(fillLight.intensity, cam.light.fi, ML);
  fillLight.color.lerp(cam.light.fill, ML);

  renderer.render(scene, camera);
}

animate();
