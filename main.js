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

// ========== ATMOSPHERIC FOG ==========
scene.fog = new THREE.FogExp2(0x040810, 0.018);

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

// ========== CINEMATIC SHOTS (CLOCKWISE ORBIT) ==========
// Kamera bergerak searah jarum jam: Depan → Kanan → Belakang-Kanan → Kiri-Depan
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
    modelRot: 3.5, // Rotate model to show back
    from: { x: -4.5, y: -1.0, z: 10.0, fov: 44 }, // Cinematic sweep from the side-back
    to: { x: -2.0, y: 1.5, z: 7.5, fov: 38 },     // Close up on the back reactor/shoulder area
    lookAt: new THREE.Vector3(-2.0, 1.2, 0),      // Look at the upper back/shoulder
    light: { key: 0x0088ff, fill: 0x3366ff, ki: 3.5, fi: 1.5 },
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

// ========== SMOKE PARTICLE SYSTEM ==========
const PARTICLE_COUNT = 250;
const smokeGeometry = new THREE.BufferGeometry();
const smokePositions = new Float32Array(PARTICLE_COUNT * 3);
const smokeSizes = new Float32Array(PARTICLE_COUNT);
const smokeOpacities = new Float32Array(PARTICLE_COUNT);
const smokeLifetimes = new Float32Array(PARTICLE_COUNT); // 0→1 lifecycle
const smokeSpeeds = new Float32Array(PARTICLE_COUNT);

function initParticle(i) {
  // Spread around model center (-3, -11, 0) in a wide cylinder
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.5 + Math.random() * 10;
  smokePositions[i * 3] = -3 + Math.cos(angle) * radius;
  smokePositions[i * 3 + 1] = -11 + Math.random() * 14 - 3; // -14 to +0
  smokePositions[i * 3 + 2] = Math.sin(angle) * radius;

  smokeSizes[i] = 20 + Math.random() * 50;
  smokeOpacities[i] = 0.0;
  smokeLifetimes[i] = Math.random(); // random start phase
  smokeSpeeds[i] = 0.002 + Math.random() * 0.006;
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  initParticle(i);
}

smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
smokeGeometry.setAttribute("aSize", new THREE.BufferAttribute(smokeSizes, 1));
smokeGeometry.setAttribute("aOpacity", new THREE.BufferAttribute(smokeOpacities, 1));

const smokeVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const smokeFragmentShader = `
  varying float vOpacity;
  void main() {
    // Soft circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    // Soft edge falloff (gaussian-like)
    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity;
    gl_FragColor = vec4(0.6, 0.7, 0.8, alpha);
  }
`;

const smokeMaterial = new THREE.ShaderMaterial({
  vertexShader: smokeVertexShader,
  fragmentShader: smokeFragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const smokeParticles = new THREE.Points(smokeGeometry, smokeMaterial);
scene.add(smokeParticles);

// ========== THREE STATE ==========
let model, walkAction, mixer;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

const WALK_DURATION = 3.3;
const TOTAL_SECTIONS = SHOTS.length; // 4

// globalProgress: 0 → 1 over the whole page, driven by smooth scroll system
let globalProgress = 0; // what render reads (smoothed)
let targetProgress = 0; // what scroll system writes

const camPos = new THREE.Vector3(0.5, -1.5, 16.0);
const camLookAt = new THREE.Vector3(-2.0, 0.5, 0);
let modelRotCurrent = SHOTS[0].modelRot;
let idleTime = 0;
let prevProgress = 0; // for detecting scroll velocity

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
function initSmoothScroll() {
  const LOCK_DURATION = 500;
  const SCROLL_SPEED = 0.0025;
  const LERP_NORMAL = 0.12;
  const LERP_LOCKED = 0.18;
  const LOCK_THRESHOLD = 0.06;

  let rawY = 0;
  let displayY = 0;
  let isLocked = false;
  let lockTarget = 0;
  let lockTimer = null;
  let touchStartY = 0;

  const snapPoints = [0, 1, 2, 3, 4];

  function tryLock(newRaw) {
    if (isLocked) return newRaw;

    for (const snap of snapPoints) {
      const dist = Math.abs(newRaw - snap);
      if (dist < LOCK_THRESHOLD) {
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
    if (isLocked) return;

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

  // --- Navigate to a section ---
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

  // --- GSAP ticker ---
  gsap.ticker.add(() => {
    const lerpF = isLocked ? LERP_LOCKED : LERP_NORMAL;
    displayY = lerp(displayY, rawY, lerpF);

    const clamped = Math.max(0, Math.min(TOTAL_SECTIONS, displayY));
    targetProgress = clamped / TOTAL_SECTIONS;

    const bar = document.getElementById("scroll-progress");
    if (bar) bar.style.width = `${(clamped / TOTAL_SECTIONS) * 100}%`;

    const activeIdx = Math.round(Math.min(clamped, TOTAL_SECTIONS - 1));
    document.querySelectorAll("#section-dots .dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === activeIdx);
    });

    updateSectionVisibility(clamped);
  });

  // Show hero immediately
  setTimeout(() => {
    document.getElementById("hero-content")?.classList.add("visible");
  }, 800);

  // Stat counters
  const countersDone = new Set();
  function updateSectionVisibility(y) {
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

// ========== CAMERA MATH (CINEMATIC) =========================================
function getCameraState(progress) {
  const shotFloat = progress * TOTAL_SECTIONS;
  const idxA = Math.min(Math.floor(shotFloat), SHOTS.length - 1);
  const idxB = Math.min(idxA + 1, SHOTS.length - 1);
  const blend = quinticSmooth(Math.max(0, Math.min(1, shotFloat - idxA)));

  const shotA = SHOTS[idxA];
  const shotB = SHOTS[idxB];

  // Within-shot eased progress
  const sectionT = quinticEaseInOut(shotFloat % 1);

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

// ========== MATH UTILS (CINEMATIC EASING) ==========
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Quintic smoothstep — much smoother than cubic
function quinticSmooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Quintic ease-in-out — ultra smooth transitions
function quinticEaseInOut(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    return 16 * t * t * t * t * t;
  }
  const f = 2 * t - 2;
  return 0.5 * f * f * f * f * f + 1;
}

function lerpColor(hexA, hexB, t) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), t);
}

// ========== SMOKE PARTICLE UPDATE ==========
function updateSmokeParticles(delta, scrollVelocity) {
  const positions = smokeGeometry.attributes.position.array;
  const opacities = smokeGeometry.attributes.aOpacity.array;
  const sizes = smokeGeometry.attributes.aSize.array;

  // Boost particle visibility during transitions
  const velocityBoost = Math.min(Math.abs(scrollVelocity) * 8, 1.0);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Advance lifetime
    smokeLifetimes[i] += smokeSpeeds[i];

    if (smokeLifetimes[i] > 1.0) {
      // Reset particle
      initParticle(i);
      smokeLifetimes[i] = 0;
    }

    const life = smokeLifetimes[i];

    // Fade in (0→0.15), sustain (0.15→0.7), fade out (0.7→1.0)
    let opacity;
    if (life < 0.15) {
      opacity = quinticSmooth(life / 0.15);
    } else if (life < 0.7) {
      opacity = 1.0;
    } else {
      opacity = 1.0 - quinticSmooth((life - 0.7) / 0.3);
    }

    // Thicker smoke for cinematic feel + extra boost during scroll
    const baseOpacity = 0.06 + velocityBoost * 0.1;
    opacities[i] = opacity * baseOpacity;

    // Slow drift upward + subtle horizontal sway
    positions[i * 3 + 1] += delta * (0.15 + smokeSpeeds[i] * 15); // up
    positions[i * 3] += Math.sin(idleTime * 0.3 + i * 0.5) * delta * 0.08; // sway X
    positions[i * 3 + 2] += Math.cos(idleTime * 0.2 + i * 0.7) * delta * 0.06; // sway Z

    // Grow slightly over lifetime
    sizes[i] = smokeSizes[i] * (0.6 + life * 0.6);
  }

  smokeGeometry.attributes.position.needsUpdate = true;
  smokeGeometry.attributes.aOpacity.needsUpdate = true;
  smokeGeometry.attributes.aSize.needsUpdate = true;
}

// ========== RENDER LOOP ==========
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  idleTime += delta;

  // Smooth global progress — lower lerp for ultra-smooth cinematic feel
  globalProgress = lerp(globalProgress, targetProgress, 0.065);

  // Calculate scroll velocity for particle boost
  const scrollVelocity = globalProgress - prevProgress;
  prevProgress = globalProgress;

  // Walk scrub
  if (mixer && walkAction) {
    walkAction.time =
      (globalProgress * TOTAL_SECTIONS * WALK_DURATION) % WALK_DURATION;
    mixer.update(0);
  }

  // Camera — cinematic smooth
  const cam = getCameraState(globalProgress);
  const CAM_LERP = 0.045; // slower = smoother

  // Cinematic camera sway (handheld feel)
  const swayX = Math.sin(idleTime * 0.4) * 0.03 + Math.sin(idleTime * 0.7) * 0.015;
  const swayY = Math.cos(idleTime * 0.3) * 0.025 + Math.sin(idleTime * 0.55) * 0.01;

  camPos.x = lerp(camPos.x, cam.x + swayX, CAM_LERP);
  camPos.y = lerp(camPos.y, cam.y + swayY, CAM_LERP);
  camPos.z = lerp(camPos.z, cam.z, CAM_LERP);

  camLookAt.lerp(cam.lookAt, CAM_LERP * 0.8);

  // FOV breathing — subtle pulsing for cinematic depth
  const fovBreath = Math.sin(idleTime * 0.25) * 0.3;
  camera.fov = lerp(camera.fov, cam.fov + fovBreath, CAM_LERP * 0.4);
  camera.updateProjectionMatrix();
  camera.position.copy(camPos);
  camera.lookAt(camLookAt);

  // Model rotation — smooth clockwise
  modelRotCurrent = lerp(modelRotCurrent, cam.modelRot, 0.03);

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

  // Update smoke particles
  updateSmokeParticles(delta, scrollVelocity);

  renderer.render(scene, camera);
}

animate();
