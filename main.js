import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================================================================
//  SETUP
// ================================================================
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
renderer.toneMappingExposure = 1.3;

// ================================================================
//  ATMOSPHERIC FOG
// ================================================================
scene.fog = new THREE.FogExp2(0x040810, 0.015);

// ================================================================
//  LIGHTS
// ================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
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

const bottomLight = new THREE.PointLight(0x0044ff, 0.8);
bottomLight.position.set(0, -5, 2);
scene.add(bottomLight);

// Volumetric "God Ray" spotlight
const godRayLight = new THREE.SpotLight(0x00d4ff, 3, 30, Math.PI * 0.15, 0.8, 1.5);
godRayLight.position.set(2, 15, 4);
godRayLight.target.position.set(-3, -5, 0);
scene.add(godRayLight);
scene.add(godRayLight.target);

// Volumetric cone mesh (fake god ray)
const coneGeo = new THREE.CylinderGeometry(0.5, 4, 20, 16, 1, true);
const coneMat = new THREE.MeshBasicMaterial({
  color: 0x00d4ff,
  transparent: true,
  opacity: 0.015,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const godRayCone = new THREE.Mesh(coneGeo, coneMat);
godRayCone.position.set(2, 5, 4);
godRayCone.rotation.x = Math.PI * 0.05;
godRayCone.rotation.z = -Math.PI * 0.02;
scene.add(godRayCone);

// ================================================================
//  CINEMATIC SHOTS — 8 Sections
// ================================================================
const SHOTS = [
  {
    // Section 0: Hero — Wide establishing shot, silhouette mood
    section: "hero",
    modelRot: 0.25,
    from: { x: 0.0, y: -0.5, z: 11.0, fov: 48 },
    to:   { x: 0.0, y: 2.0, z: 9.0, fov: 44 },
    lookAt: new THREE.Vector3(-1.5, 0.5, 0),
    light: { key: 0x00d4ff, fill: 0xff6a00, ki: 2.0, fi: 1.5 },
  },
  {
    // Section 1: Core Specs — Mid shot, angled right
    section: "specs",
    modelRot: 0.8,
    from: { x: 2.0, y: 0.5, z: 9.5, fov: 46 },
    to:   { x: 1.0, y: 1.5, z: 8.0, fov: 42 },
    lookAt: new THREE.Vector3(-1.0, 1.0, 0),
    light: { key: 0x00aaff, fill: 0x4488ff, ki: 2.8, fi: 1.2 },
  },
  {
    // Section 2: Neural Link — Close-up head/chest area
    section: "neural",
    modelRot: 3.5,
    from: { x: -4.5, y: -1.0, z: 10.0, fov: 44 },
    to:   { x: -2.0, y: 1.5, z: 7.5, fov: 38 },
    lookAt: new THREE.Vector3(-2.0, 1.2, 0),
    light: { key: 0x0088ff, fill: 0x3366ff, ki: 3.5, fi: 1.5 },
  },
  {
    // Section 3: Arsenal — Focus on arms/weapons, dramatic orange
    section: "arsenal",
    modelRot: 0.6,
    from: { x: -3.0, y: 0.0, z: 7.5, fov: 52 },
    to:   { x: -1.5, y: 0.8, z: 5.5, fov: 46 },
    lookAt: new THREE.Vector3(-2.0, 1.5, 0),
    light: { key: 0xff3300, fill: 0xff8800, ki: 1.8, fi: 3.5 },
  },
  {
    // Section 4: Deployment Map — Top-down tactical view
    section: "deployment-map",
    modelRot: 1.2,
    from: { x: 0.0, y: 5.0, z: 8.0, fov: 40 },
    to:   { x: -1.0, y: 3.5, z: 9.0, fov: 44 },
    lookAt: new THREE.Vector3(-2.0, 0.5, 0),
    light: { key: 0x00ffaa, fill: 0x00aaff, ki: 2.0, fi: 1.0 },
  },
  {
    // Section 5: Tech Stack — Side sweep, showing full silhouette
    section: "tech-stack",
    modelRot: -0.8,
    from: { x: 3.5, y: 1.0, z: 8.5, fov: 42 },
    to:   { x: 2.0, y: 0.5, z: 9.5, fov: 46 },
    lookAt: new THREE.Vector3(-1.5, 0.8, 0),
    light: { key: 0x00d4ff, fill: 0x0066ff, ki: 2.5, fi: 1.8 },
  },
  {
    // Section 6: Pilots — Portrait close-up, warm tones
    section: "pilots",
    modelRot: 0.3,
    from: { x: -1.0, y: 0.5, z: 9.0, fov: 44 },
    to:   { x: 0.0, y: 1.5, z: 8.0, fov: 40 },
    lookAt: new THREE.Vector3(-1.5, 1.0, 0),
    light: { key: 0x4488ff, fill: 0xff6600, ki: 2.2, fi: 2.0 },
  },
  {
    // Section 7: CTA / Deploy — Grand pull-back reveal
    section: "cta",
    modelRot: 0.0,
    from: { x: 0.0, y: 4.0, z: 5.5, fov: 36 },
    to:   { x: 0.0, y: 1.5, z: 10.0, fov: 46 },
    lookAt: new THREE.Vector3(-1.5, 0.8, 0),
    light: { key: 0x00ffaa, fill: 0x00aaff, ki: 2.8, fi: 1.4 },
  },
];

// ================================================================
//  EMBER PARTICLE SYSTEM
// ================================================================
const PARTICLE_COUNT = 300;
const smokeGeometry = new THREE.BufferGeometry();
const smokePositions = new Float32Array(PARTICLE_COUNT * 3);
const smokeSizes = new Float32Array(PARTICLE_COUNT);
const smokeOpacities = new Float32Array(PARTICLE_COUNT);
const smokeLifetimes = new Float32Array(PARTICLE_COUNT);
const smokeSpeeds = new Float32Array(PARTICLE_COUNT);
const smokeColors = new Float32Array(PARTICLE_COUNT * 3);

function initParticle(i) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.5 + Math.random() * 12;
  smokePositions[i * 3] = -3 + Math.cos(angle) * radius;
  smokePositions[i * 3 + 1] = -11 + Math.random() * 16 - 4;
  smokePositions[i * 3 + 2] = Math.sin(angle) * radius;

  smokeSizes[i] = 15 + Math.random() * 40;
  smokeOpacities[i] = 0.0;
  smokeLifetimes[i] = Math.random();
  smokeSpeeds[i] = 0.002 + Math.random() * 0.005;

  // Mix between cyan and orange embers
  const colorChoice = Math.random();
  if (colorChoice < 0.4) {
    // Cyan
    smokeColors[i * 3] = 0.3;
    smokeColors[i * 3 + 1] = 0.8;
    smokeColors[i * 3 + 2] = 1.0;
  } else if (colorChoice < 0.7) {
    // Orange ember
    smokeColors[i * 3] = 1.0;
    smokeColors[i * 3 + 1] = 0.45;
    smokeColors[i * 3 + 2] = 0.1;
  } else {
    // White-blue
    smokeColors[i * 3] = 0.6;
    smokeColors[i * 3 + 1] = 0.7;
    smokeColors[i * 3 + 2] = 0.9;
  }
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  initParticle(i);
}

smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
smokeGeometry.setAttribute("aSize", new THREE.BufferAttribute(smokeSizes, 1));
smokeGeometry.setAttribute("aOpacity", new THREE.BufferAttribute(smokeOpacities, 1));
smokeGeometry.setAttribute("aColor", new THREE.BufferAttribute(smokeColors, 3));

const smokeVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const smokeFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
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

// ================================================================
//  THREE STATE
// ================================================================
let model, walkAction, mixer;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

const WALK_DURATION = 3.3;
const TOTAL_SECTIONS = SHOTS.length; // 8

let globalProgress = 0;
let targetProgress = 0;

const camPos = new THREE.Vector3(0.5, -1.5, 16.0);
const camLookAt = new THREE.Vector3(-2.0, 0.5, 0);
let modelRotCurrent = SHOTS[0].modelRot;
let idleTime = 0;
let prevProgress = 0;

// Mouse parallax state
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

// ================================================================
//  MOUSE FOLLOW PARALLAX
// ================================================================
window.addEventListener("mousemove", (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ================================================================
//  LOAD MODEL
// ================================================================
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
      600,
    );

    initSmoothScroll();
    initWeaponHotspots();
    initMagneticButton();
  },
  (xhr) => {
    if (xhr.total) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      console.log(`${pct}%`);
      const fill = document.querySelector(".loader-bar-fill");
      if (fill) fill.style.width = `${pct}%`;
    }
  },
  (err) => {
    console.error(err);
    document.getElementById("loader").classList.add("hidden");
  },
);

// ================================================================
//  SMOOTH SCROLL SYSTEM
// ================================================================
function initSmoothScroll() {
  const LOCK_DURATION = 450;
  const SCROLL_SPEED = 0.002;
  const LERP_NORMAL = 0.10;
  const LERP_LOCKED = 0.16;
  const LOCK_THRESHOLD = 0.06;

  let rawY = 0;
  let displayY = 0;
  let isLocked = false;
  let lockTarget = 0;
  let lockTimer = null;
  let touchStartY = 0;

  const snapPoints = Array.from({ length: TOTAL_SECTIONS + 1 }, (_, i) => i);

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

  // Wheel
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      addDelta(e.deltaY * SCROLL_SPEED);
    },
    { passive: false },
  );

  // Touch
  window.addEventListener(
    "touchstart",
    (e) => { touchStartY = e.touches[0].clientY; },
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

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown") addDelta(0.25);
    if (e.key === "ArrowUp" || e.key === "PageUp") addDelta(-0.25);
  });

  // Navigate to section
  window.gotoSection = function (idx) {
    isLocked = false;
    clearTimeout(lockTimer);
    rawY = Math.max(0, Math.min(TOTAL_SECTIONS, idx));
  };

  // Dot & nav-link clicks
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.gotoSection(parseInt(el.dataset.goto));
    });
  });

  // GSAP ticker
  const countersDone = new Set();
  const progressBarsDone = new Set();

  gsap.ticker.add(() => {
    const lerpF = isLocked ? LERP_LOCKED : LERP_NORMAL;
    displayY = lerp(displayY, rawY, lerpF);

    const clamped = Math.max(0, Math.min(TOTAL_SECTIONS, displayY));
    targetProgress = clamped / TOTAL_SECTIONS;

    // Progress bar
    const bar = document.getElementById("scroll-progress");
    if (bar) bar.style.width = `${(clamped / TOTAL_SECTIONS) * 100}%`;

    // Active dot
    const activeIdx = Math.round(Math.min(clamped, TOTAL_SECTIONS - 1));
    document.querySelectorAll("#section-dots .dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === activeIdx);
    });

    updateSectionVisibility(clamped, countersDone, progressBarsDone);
  });

  // Show hero immediately
  setTimeout(() => {
    document.getElementById("hero-content")?.classList.add("visible");
    triggerScramble(document.querySelector("#hero-content .scramble-text"));
  }, 800);
}

// ================================================================
//  SECTION VISIBILITY & COUNTER TRIGGERS
// ================================================================
function updateSectionVisibility(y, countersDone, progressBarsDone) {
  const activeSection = Math.min(Math.floor(y + 0.15), TOTAL_SECTIONS - 1);

  document.querySelectorAll("section").forEach((sec, i) => {
    const content = sec.querySelector(".content");
    if (!content) return;
    if (i === activeSection) {
      if (!content.classList.contains("visible")) {
        content.classList.add("visible");
        // Trigger scramble text
        content.querySelectorAll(".scramble-text").forEach((el) => {
          triggerScramble(el);
        });
      }
    } else {
      content.classList.remove("visible");
    }
  });

  // Animate counters
  document.querySelectorAll("[data-count]").forEach((el) => {
    const secIdx = parseInt(el.closest("section")?.dataset?.sectionIndex ?? "-1");
    if (secIdx === activeSection && !countersDone.has(el)) {
      countersDone.add(el);
      animateCounter(el, parseFloat(el.dataset.count));
    }
  });

  // Animate progress bars
  document.querySelectorAll(".progress-fill[data-width]").forEach((el) => {
    const secIdx = parseInt(el.closest("section")?.dataset?.sectionIndex ?? "-1");
    if (secIdx === activeSection && !progressBarsDone.has(el)) {
      progressBarsDone.add(el);
      el.style.setProperty("--fill-width", `${el.dataset.width}%`);
      // Force reflow then apply
      requestAnimationFrame(() => {
        el.style.width = `${el.dataset.width}%`;
      });
    }
  });
}

// ================================================================
//  TEXT SCRAMBLE ANIMATION
// ================================================================
const scrambleChars = "!@#$%^&*()_+-={}[]|;:,.<>?/~`01234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const scrambleDone = new Set();

function triggerScramble(el) {
  if (!el || scrambleDone.has(el)) return;
  scrambleDone.add(el);

  const finalText = el.dataset.final || el.textContent;
  const duration = 800;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const revealCount = Math.floor(progress * finalText.length);

    let display = "";
    for (let i = 0; i < finalText.length; i++) {
      if (i < revealCount) {
        display += finalText[i];
      } else if (finalText[i] === " " || finalText[i] === "\n") {
        display += finalText[i];
      } else {
        display += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
    }

    el.textContent = display;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = finalText;
    }
  }

  requestAnimationFrame(tick);
}

// ================================================================
//  WEAPON HOTSPOT INTERACTION
// ================================================================
const WEAPONS = {
  plasma: {
    name: "I-19 PLASMACASTER",
    class: "CLASS-A",
    damage: 95,
    fireRate: 60,
    range: 82,
  },
  sword: {
    name: "GD-6 CHAIN SWORD",
    class: "CLASS-S",
    damage: 100,
    fireRate: 40,
    range: 30,
  },
  missile: {
    name: "ANTI-KAIJU MISSILES",
    class: "CLASS-B",
    damage: 80,
    fireRate: 75,
    range: 95,
  },
};

function initWeaponHotspots() {
  const buttons = document.querySelectorAll(".hotspot-btn");
  const detailPanel = document.getElementById("weapon-detail");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const weaponKey = btn.dataset.weapon;
      const weapon = WEAPONS[weaponKey];
      if (!weapon || !detailPanel) return;

      // Update panel
      detailPanel.querySelector(".weapon-name").textContent = weapon.name;
      detailPanel.querySelector(".weapon-class").textContent = weapon.class;

      const fills = detailPanel.querySelectorAll(".progress-fill");
      const values = [weapon.damage, weapon.fireRate, weapon.range];
      fills.forEach((fill, i) => {
        fill.style.width = "0%";
        requestAnimationFrame(() => {
          fill.style.width = `${values[i]}%`;
        });
      });

      // GSAP flash
      gsap.fromTo(detailPanel, { opacity: 0.3, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    });
  });
}

// ================================================================
//  MAGNETIC CTA BUTTON
// ================================================================
function initMagneticButton() {
  const btn = document.getElementById("cta-btn");
  if (!btn) return;

  btn.addEventListener("mousemove", (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "translate(0, 0)";
  });
}

// ================================================================
//  CAMERA MATH (CINEMATIC)
// ================================================================
function getCameraState(progress) {
  const shotFloat = progress * TOTAL_SECTIONS;
  const idxA = Math.min(Math.floor(shotFloat), SHOTS.length - 1);
  const idxB = Math.min(idxA + 1, SHOTS.length - 1);
  const blend = quinticSmooth(Math.max(0, Math.min(1, shotFloat - idxA)));

  const shotA = SHOTS[idxA];
  const shotB = SHOTS[idxB];

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

// ================================================================
//  COUNTER ANIMATION
// ================================================================
function animateCounter(el, target) {
  const isFloat = target % 1 !== 0;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / 1500, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = isFloat
      ? (e * target).toFixed(1)
      : Math.round(e * target);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = isFloat ? target.toFixed(1) : target;
  }
  requestAnimationFrame(tick);
}

// ================================================================
//  RESIZE + DYNAMIC FOV
// ================================================================
window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  // Dynamic FOV for mobile vs desktop
  if (aspect < 1) {
    camera.fov = 65;
  } else if (aspect < 1.4) {
    camera.fov = 52;
  } else {
    camera.fov = 45;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Trigger initial FOV
if (window.innerWidth / window.innerHeight < 1) {
  camera.fov = 65;
} else if (window.innerWidth / window.innerHeight < 1.4) {
  camera.fov = 52;
}
camera.updateProjectionMatrix();

// ================================================================
//  MATH UTILITIES
// ================================================================
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quinticSmooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function quinticEaseInOut(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) return 16 * t * t * t * t * t;
  const f = 2 * t - 2;
  return 0.5 * f * f * f * f * f + 1;
}

function lerpColor(hexA, hexB, t) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), t);
}

// ================================================================
//  EMBER PARTICLE UPDATE
// ================================================================
function updateSmokeParticles(delta, scrollVelocity) {
  const positions = smokeGeometry.attributes.position.array;
  const opacities = smokeGeometry.attributes.aOpacity.array;
  const sizes = smokeGeometry.attributes.aSize.array;

  const velocityBoost = Math.min(Math.abs(scrollVelocity) * 10, 1.0);
  // Scroll direction — positive = scrolling down, negative = up
  const scrollDir = Math.sign(scrollVelocity);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    smokeLifetimes[i] += smokeSpeeds[i];

    if (smokeLifetimes[i] > 1.0) {
      initParticle(i);
      smokeLifetimes[i] = 0;
    }

    const life = smokeLifetimes[i];

    // Opacity lifecycle
    let opacity;
    if (life < 0.15) {
      opacity = quinticSmooth(life / 0.15);
    } else if (life < 0.7) {
      opacity = 1.0;
    } else {
      opacity = 1.0 - quinticSmooth((life - 0.7) / 0.3);
    }

    const baseOpacity = 0.05 + velocityBoost * 0.12;
    opacities[i] = opacity * baseOpacity;

    // Movement — embers drift up, react to scroll direction
    const driftUp = delta * (0.12 + smokeSpeeds[i] * 12);
    const scrollReaction = scrollDir * velocityBoost * delta * 3.0;

    positions[i * 3 + 1] += driftUp + scrollReaction;
    positions[i * 3] += Math.sin(idleTime * 0.3 + i * 0.5) * delta * 0.06;
    positions[i * 3 + 2] += Math.cos(idleTime * 0.2 + i * 0.7) * delta * 0.05;

    // Grow
    sizes[i] = smokeSizes[i] * (0.5 + life * 0.7);
  }

  smokeGeometry.attributes.position.needsUpdate = true;
  smokeGeometry.attributes.aOpacity.needsUpdate = true;
  smokeGeometry.attributes.aSize.needsUpdate = true;
}

// ================================================================
//  RENDER LOOP
// ================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  idleTime += delta;

  // Smooth progress
  globalProgress = lerp(globalProgress, targetProgress, 0.06);

  // Scroll velocity
  const scrollVelocity = globalProgress - prevProgress;
  prevProgress = globalProgress;

  // Walk scrub
  if (mixer && walkAction) {
    walkAction.time =
      (globalProgress * TOTAL_SECTIONS * WALK_DURATION) % WALK_DURATION;
    mixer.update(0);
  }

  // Mouse parallax smoothing
  mouseX = lerp(mouseX, targetMouseX, 0.05);
  mouseY = lerp(mouseY, targetMouseY, 0.05);

  // Camera
  const cam = getCameraState(globalProgress);
  const CAM_LERP = 0.04;

  // Camera shake — enhanced during transitions
  const shakeIntensity = 1.0 + Math.min(Math.abs(scrollVelocity) * 60, 2.0);
  const swayX = (Math.sin(idleTime * 0.4) * 0.025 + Math.sin(idleTime * 0.7) * 0.012) * shakeIntensity;
  const swayY = (Math.cos(idleTime * 0.3) * 0.02 + Math.sin(idleTime * 0.55) * 0.008) * shakeIntensity;

  // Mouse parallax offset on camera
  const mouseOffsetX = mouseX * 0.15;
  const mouseOffsetY = mouseY * 0.08;

  camPos.x = lerp(camPos.x, cam.x + swayX + mouseOffsetX, CAM_LERP);
  camPos.y = lerp(camPos.y, cam.y + swayY - mouseOffsetY, CAM_LERP);
  camPos.z = lerp(camPos.z, cam.z, CAM_LERP);

  camLookAt.lerp(cam.lookAt, CAM_LERP * 0.8);

  // FOV breathing — stronger during section transitions
  const fovBreath = Math.sin(idleTime * 0.25) * 0.3;
  camera.fov = lerp(camera.fov, cam.fov + fovBreath, CAM_LERP * 0.4);
  camera.updateProjectionMatrix();
  camera.position.copy(camPos);
  camera.lookAt(camLookAt);

  // Model rotation — smooth + mouse follow
  modelRotCurrent = lerp(modelRotCurrent, cam.modelRot, 0.03);

  if (model) {
    const breathY = Math.sin(idleTime * 1.1) * 0.015;
    const breathRot = Math.sin(idleTime * 0.6) * 0.005;
    const mouseModelRot = mouseX * 0.04; // Subtle model follow toward cursor
    model.rotation.y = modelRotCurrent + breathRot + mouseModelRot;
    model.position.y = -11 + breathY;
    model.position.x = -3;
  }

  // Lights
  const ML = 0.03;
  keyLight.intensity = lerp(keyLight.intensity, cam.light.ki, ML);
  keyLight.color.lerp(cam.light.key, ML);
  fillLight.intensity = lerp(fillLight.intensity, cam.light.fi, ML);
  fillLight.color.lerp(cam.light.fill, ML);

  // God ray breathing
  const godRayBreath = 0.01 + Math.sin(idleTime * 0.5) * 0.005;
  coneMat.opacity = lerp(coneMat.opacity, godRayBreath, 0.02);

  // Update particles
  updateSmokeParticles(delta, scrollVelocity);

  renderer.render(scene, camera);
}

animate();
