import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// =========================================
// PRODUCTS
// =========================================
const products = [
  {
    name: "Pepperoni Pizza",
    price: "$14",
    description: "Pepperoni, mozzarella cheese, olives and mushroom.",
    model: "./models/pizza.glb",
    orderLink: "https://yourcafe.com/order/pizza1",
  },
  {
    name: "Mushroom Pizza",
    price: "$16",
    description: "Double cheese, mushroom, onion and black olives.",
    model: "./models/pizza2.glb",
    orderLink: "https://yourcafe.com/order/pizza2",
  },
  {
    name: "Margherita Pizza",
    price: "$12",
    description: "Fresh tomato sauce, buffalo mozzarella and basil.",
    model: "./models/pizza3.glb",
    orderLink: "https://yourcafe.com/order/pizza3",
  },
];

// =========================================
// DOM REFS — پنل سایت
// =========================================
const nameEl = document.getElementById("name");
const priceEl = document.getElementById("price");
const descEl = document.getElementById("description");
const orderBtn = document.getElementById("orderBtn");
const dotsEl = document.getElementById("indexDots");
const loadingEl = document.getElementById("loadingIndicator");
const bottomPanel = document.getElementById("bottom-panel");
const arHint = document.getElementById("ar-hint");

// =========================================
// DOM REFS — پنل AR
// =========================================
const arPanel = document.getElementById("ar-panel");
const arNameEl = document.getElementById("ar-name");
const arPriceEl = document.getElementById("ar-price");
const arDescEl = document.getElementById("ar-desc");
const arOrderBtn = document.getElementById("ar-orderBtn");
const arDotsEl = document.getElementById("ar-dots");
const arToggleBtn = document.getElementById("ar-toggle-btn");
const arToggleIcon = document.getElementById("ar-toggle-icon");
const arToggleLabel = document.getElementById("ar-toggle-label");
const arPrevBtn = document.getElementById("ar-prevBtn");
const arNextBtn = document.getElementById("ar-nextBtn");

// =========================================
// RENDERER
// =========================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

/* ── ToneMappingExposure ──────────────────────────────────────────────
   مقدار پیش‌فرض: 1.0
   بیشتر از 1 (مثلاً 1.3): مدل روشن‌تر، رنگ‌ها saturated‌تر
   کمتر از 1 (مثلاً 0.8): تیره‌تر، واقع‌گرایانه‌تر برای AR در فضای باز
   در AR اگه محیط روشن هست، 0.9 بهتره
   ─────────────────────────────────────────────────────────────────── */
renderer.toneMappingExposure = 1.0;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// =========================================
// SCENE & CAMERA
// =========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  /* ── FOV ─────────────────────────────────
     70: زاویه دید دوربین در حالت غیر-AR
     بزرگتر (مثلاً 80): مدل کوچیک‌تر دیده می‌شه
     کوچیک‌تر (مثلاً 55): مدل بزرگتر/فشرده‌تر
     ─────────────────────────────────────── */
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  20,
);

/* ── موقعیت دوربین غیر-AR ─────────────────
   camera.position.set(x, y, z)
   z = 0.8: فاصله دوربین از مدل
     کمتر (0.5): نزدیک‌تر → مدل بزرگتر
     بیشتر (1.2): دورتر → مدل کوچیک‌تر
   y = -0.05: دوربین کمی پایین‌تر از مرکز → مدل بالاتر دیده می‌شه
   ─────────────────────────────────────── */
camera.position.set(0, -0.05, 0.8);

// =========================================
// ENVIRONMENT
// =========================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const roomEnv = new RoomEnvironment(renderer);
scene.environment = pmremGenerator.fromScene(roomEnv).texture;
roomEnv.dispose();
pmremGenerator.dispose();

// =========================================
// LIGHTS
// =========================================

/* ── AmbientLight intensity ───────────────
   0.5: نور محیطی پایه
   بیشتر (0.8): سایه‌ها کمتر → مدل یکنواخت‌تر
   کمتر (0.2): کنتراست بیشتر، سایه‌های تندتر
   ─────────────────────────────────────── */
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

/* ── keyLight (نور اصلی) ─────────────────
   intensity: 2.0 → بیشتر: روشن‌تر، سایه‌های تندتر
   position.set(3, 6, 4) → موقعیت: بالا-راست-جلو
   ─────────────────────────────────────── */
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

/* ── fillLight (نور پرکننده) ─────────────
   intensity: 0.8 → سایه‌های تاریک رو روشن می‌کنه
   کمتر (0.3): سایه‌های عمیق‌تر → dramatic
   ─────────────────────────────────────── */
const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.8);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

/* ── rimLight (نور لبه) ──────────────────
   intensity: 1.2 → جدا کردن مدل از پس‌زمینه
   بیشتر: لبه‌های مدل روشن‌تر → دیده شدن بهتر در AR
   ─────────────────────────────────────── */
const rimLight = new THREE.DirectionalLight(0xffd699, 1.2);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

// =========================================
// ROOT GROUP
// =========================================
const rootGroup = new THREE.Group();
rootGroup.matrixAutoUpdate = true;
scene.add(rootGroup);
rootGroup.visible = true;

// =========================================
// 3-D FLOATING LABEL
// =========================================
let currentIndex = 0;

function makeTextCanvas(product) {
  /* ── اندازه canvas لیبل ──────────────────
     W=512, H=230: عرض و ارتفاع texture لیبل
     بزرگتر: وضوح بیشتر، حجم بیشتر
     ─────────────────────────────────────── */
  const W = 512,
    H = 230;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, W, H);
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  /* ── پس‌زمینه لیبل ────────────────────────
     rgba(10, 10, 18, 0.88): عدد آخر opacity
     0.88 = 88% مات → برای خوانایی بهتره
     در AR: اگه محیط شلوغه 0.95 بزن
     ─────────────────────────────────────── */
  ctx.fillStyle = "rgba(10, 10, 18, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 200, 80, 0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FFD86E";
  ctx.font = "bold 46px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(product.name, W / 2, 58);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(product.price, W / 2, 104);

  /* نقاط ناوبری در لیبل ۳D */
  const dotY = 142,
    dotR = 7,
    spacing = 24;
  const startX = W / 2 - ((products.length - 1) * spacing) / 2;
  products.forEach((_, i) => {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === currentIndex ? "#FFD86E" : "rgba(255,255,255,0.3)";
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "21px 'Segoe UI', Arial, sans-serif";
  const words = product.description.split(" ");
  let line = "",
    lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > W - 40 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 178 + i * 28));

  return canvas;
}

let labelSprite = null;

function createOrUpdateLabel(product) {
  const canvas = makeTextCanvas(product);
  const tex = new THREE.CanvasTexture(canvas);
  if (!labelSprite) {
    labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      }),
    );
    rootGroup.add(labelSprite);
  } else {
    labelSprite.material.map.dispose();
    labelSprite.material.map = tex;
    labelSprite.material.needsUpdate = true;
  }

  /* ── اندازه لیبل ۳D ──────────────────────
     h = 0.2: ارتفاع لیبل به متر در فضای AR
       0.2 = 20 سانتی‌متر
       بزرگتر (0.28): لیبل بزرگتر، بیشتر توجه می‌گیره
       کوچیک‌تر (0.14): ظریف‌تر، کمتر محیط رو می‌پوشونه
     ─────────────────────────────────────── */
  const aspect = 512 / 230;
  const h = 0.2;
  labelSprite.scale.set(h * aspect, h, 1);
}

function positionLabel() {
  if (!labelSprite || !currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);

  /* ── فاصله لیبل از بالای مدل ─────────────
     box.max.y + 0.16:
       0.16 = 16 سانتی‌متر فاصله از بالای مدل
       بیشتر: لیبل بالاتر (فضای بیشتر برای دیدن مدل)
       کمتر: لیبل چسبیده‌تر به مدل
       پیشنهاد: 0.14 تا 0.22 بسته به اندازه مدل
     ─────────────────────────────────────── */
  labelSprite.position.set(0, box.max.y + 0.16, 0);
}

// =========================================
// AR NAV ARROWS (فقط به عنوان visual hint — ناوبری اصلی با دکمه‌های 2D)
// =========================================
function makeArrowCanvas(dir) {
  const S = 160;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = S;
  const ctx = cvs.getContext("2d");
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15,15,20,0.80)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,200,80,0.75)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 80px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    dir === "prev" ? "‹" : "›",
    S / 2 + (dir === "prev" ? -3 : 3),
    S / 2 + 3,
  );
  return cvs;
}

let prevArrow = null,
  nextArrow = null;

function createARArrows() {
  ["prev", "next"].forEach((dir) => {
    const tex = new THREE.CanvasTexture(makeArrowCanvas(dir));
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      }),
    );

    /* ── اندازه فلش‌های AR ────────────────────
       scale.set(0.08, 0.08, 1):
         0.08 = 8 سانتی‌متر
         بزرگتر: بیشتر دیده می‌شن اما فضا می‌گیرن
         کوچیک‌تر: ظریف‌تر
       این فلش‌ها فقط visual هستن — ناوبری اصلی با دکمه‌های پایین پنل
       ─────────────────────────────────────── */
    sprite.scale.set(0.08, 0.08, 1);
    sprite.userData.navDir = dir;
    rootGroup.add(sprite);
    if (dir === "prev") prevArrow = sprite;
    else nextArrow = sprite;
  });
}

function positionARArrows() {
  if (!prevArrow || !nextArrow || !currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  const labelY = box.max.y + 0.16;
  const hw = (0.2 * 512) / 230 / 2 + 0.07;
  prevArrow.position.set(-hw, labelY, 0);
  nextArrow.position.set(hw, labelY, 0);
}

// =========================================
// RETICLE
// =========================================
const reticleGeo = new THREE.RingGeometry(
  /* ── اندازه reticle (دایره اسکن) ──────────
     0.09: شعاع داخلی
     0.115: شعاع خارجی
     بزرگتر: راحت‌تر دیده می‌شه روی سطح
     ─────────────────────────────────────── */
  0.09,
  0.115,
  48,
);
reticleGeo.rotateX(-Math.PI / 2);
const reticle = new THREE.Mesh(
  reticleGeo,
  new THREE.MeshBasicMaterial({
    color: 0xffd86e,
    opacity: 0.85,
    transparent: true,
  }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// =========================================
// AR BUTTON
// =========================================
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: document.getElementById("ui-overlay") },
  }),
);

// =========================================
// HIT-TEST STATE
// =========================================
let hitTestSource = null;
let hitTestSourceRequested = false;
let modelPlaced = false;

// =========================================
// LOADERS
// =========================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
);
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

let currentModel = null;
let isLoading = false;
let mixer = null;

// =========================================
// LOADING INDICATOR
// =========================================
function showLoading() {
  loadingEl?.classList.add("visible");
}
function hideLoading() {
  loadingEl?.classList.remove("visible");
}

// =========================================
// AR PANEL — نمایش و مخفی‌کردن
// =========================================
function showARPanel() {
  if (!arPanel) return;
  arPanel.style.display = "flex";
  // حالت پیش‌فرض: جزئیات نمایش داده می‌شن
  arPanel.classList.remove("collapsed");
  if (arToggleIcon) arToggleIcon.textContent = "▼";
  if (arToggleLabel) arToggleLabel.textContent = "پنهان";
}

function hideARPanel() {
  if (!arPanel) return;
  arPanel.style.display = "none";
}

// =========================================
// AR PANEL TOGGLE — پنهان/نمایش جزئیات
// =========================================
let arDetailsVisible = true;

function toggleARDetails() {
  arDetailsVisible = !arDetailsVisible;
  if (arDetailsVisible) {
    arPanel.classList.remove("collapsed");
    if (arToggleIcon) arToggleIcon.textContent = "▼";
    if (arToggleLabel) arToggleLabel.textContent = "پنهان";
  } else {
    arPanel.classList.add("collapsed");
    if (arToggleIcon) arToggleIcon.textContent = "▲";
    if (arToggleLabel) arToggleLabel.textContent = "جزئیات";
  }
}

arToggleBtn?.addEventListener("click", toggleARDetails);

// =========================================
// AR NAVIGATION BUTTONS
// دکمه‌های AR داخل dom-overlay هستن و مستقیم کار می‌کنن
// =========================================
arPrevBtn?.addEventListener("click", (e) => {
  e.stopPropagation(); // جلوگیری از trigger شدن select event
  navigate(-1);
});

arNextBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  navigate(1);
});

// =========================================
// AR ORDER BUTTON
// =========================================
arOrderBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const p = products[currentIndex];
  window.open(p.orderLink, "_blank");
});

// =========================================
// GESTURE: single-finger drag → rotate Y
// =========================================
let isDragging = false;
let prevX = 0;
let modelYaw = 0;
let dragMoved = false;

/* ── آستانه تشخیص drag ────────────────────
   DRAG_THRESHOLD = 8 پیکسل:
   کمتر (4): حرکت‌های کوچیک هم drag محسوب می‌شن → ممکنه کلیک‌ها ناخواسته rotate کنن
   بیشتر (15): باید بیشتر بکشی تا rotate شه
   ─────────────────────────────────────── */
const DRAG_THRESHOLD = 8;

function onDragStart(x) {
  isDragging = true;
  prevX = x;
  dragMoved = false;
}
function onDragMove(x) {
  if (!isDragging || !currentModel) return;
  const dx = x - prevX;
  if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;

  /* ── سرعت چرخش با drag ──────────────────
     0.012: هر پیکسل حرکت = 0.012 رادیان چرخش
     بیشتر (0.02): تند می‌چرخه
     کمتر (0.006): آرام می‌چرخه
     ─────────────────────────────────────── */
  modelYaw += dx * 0.012;
  prevX = x;
}
function onDragEnd() {
  isDragging = false;
}

renderer.domElement.addEventListener("mousedown", (e) =>
  onDragStart(e.clientX),
);
renderer.domElement.addEventListener("mousemove", (e) => onDragMove(e.clientX));
renderer.domElement.addEventListener("mouseup", onDragEnd);
renderer.domElement.addEventListener("mouseleave", onDragEnd);

let touchStartX = 0;
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      onDragStart(e.touches[0].clientX);
    }
  },
  { passive: true },
);

renderer.domElement.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length === 1) onDragMove(e.touches[0].clientX);
  },
  { passive: true },
);

renderer.domElement.addEventListener(
  "touchend",
  (e) => {
    onDragEnd();
    // swipe navigation فقط در غیر-AR
    if (!renderer.xr.isPresenting) {
      const dx = e.changedTouches[0].clientX - touchStartX;

      /* ── آستانه swipe ─────────────────────
       55 پیکسل: باید حداقل این مقدار swipe کنی
       کمتر (35): حساس‌تر
       بیشتر (80): نیاز به swipe قوی‌تر
       ─────────────────────────────────────── */
      if (Math.abs(dx) > 55 && !dragMoved) navigate(dx < 0 ? 1 : -1);
    }
  },
  { passive: true },
);

// =========================================
// PLACE MODEL AT RETICLE POSITION
// =========================================
function placeModel() {
  if (!reticle.visible || !currentModel) return;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  reticle.matrix.decompose(pos, quat, scl);

  rootGroup.position.copy(pos);
  rootGroup.quaternion.copy(quat);
  rootGroup.scale.set(1, 1, 1);

  rootGroup.visible = true;
  reticle.visible = false;
  modelPlaced = true;

  if (arHint) arHint.style.display = "none";

  // وقتی مدل گذاشته شد، پنل AR رو نمایش بده
  showARPanel();
}

// =========================================
// AR SELECT EVENT
// =========================================
function onARSelect() {
  if (dragMoved) return;

  if (modelPlaced) {
    // ضربه دوم → re-place
    modelPlaced = false;
    reticle.visible = true;
    rootGroup.visible = false;
    hideARPanel();
    if (arHint) {
      arHint.textContent = "👆 Tap again to re-place";
      arHint.style.display = "flex";
    }
    return;
  }

  placeModel();
}

// =========================================
// NON-AR CLICK: raycast AR arrows
// =========================================
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

renderer.domElement.addEventListener("click", (e) => {
  if (renderer.xr.isPresenting) return;
  if (dragMoved) return;
  _mouse.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    (e.clientY / window.innerHeight) * -2 + 1,
  );
  _raycaster.setFromCamera(_mouse, camera);
  const hits = _raycaster.intersectObjects(
    [prevArrow, nextArrow].filter(Boolean),
  );
  if (hits.length > 0) {
    navigate(hits[0].object.userData.navDir === "next" ? 1 : -1);
  }
});

// =========================================
// FIT MODEL
// =========================================
function fitModel(model, isAR) {
  model.position.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  /* ── اندازه هدف مدل ──────────────────────
     isAR: targetSize = 0.32 متر (32 سانتی‌متر)
       بزرگتر (0.45): مدل AR بزرگتر، جزئیات بیشتر دیده می‌شه
       کوچیک‌تر (0.22): مدل AR کوچیک‌تر، واقع‌بینانه‌تر
     !isAR: targetSize = 0.38 متر (در صفحه نمایش)
       بزرگتر (0.50): مدل بیشتر صفحه رو می‌گیره
       کوچیک‌تر (0.28): فضای بیشتر دور مدل
     ─────────────────────────────────────── */
  const targetSize = isAR ? 0.32 : 0.38;
  const scale = maxDim > 0 ? targetSize / maxDim : 1;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const boxAfter = new THREE.Box3().setFromObject(model);
  const centerAfter = boxAfter.getCenter(new THREE.Vector3());
  model.position.x = -centerAfter.x;
  model.position.z = -centerAfter.z;

  /* ── ارتفاع مدل روی سطح ──────────────────
     isAR ? 0.008 : 0
       0.008 = 8 میلی‌متر بالاتر از سطح در AR
       این جلوگیری می‌کنه مدل داخل سطح بره (z-fighting)
       بیشتر (0.02): مدل شناورتر
       صفر: دقیقاً روی سطح
     ─────────────────────────────────────── */
  model.position.y = -boxAfter.min.y + (isAR ? 0.008 : 0);
}

// =========================================
// FIX MATERIALS
// =========================================
function fixMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true;
    const mat = node.material;
    if (!mat) return;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
  });
}

// =========================================
// CLEAR CURRENT MODEL
// =========================================
function clearModel() {
  if (!currentModel) return;
  rootGroup.remove(currentModel);
  currentModel.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(
      (m) => m?.dispose(),
    );
  });
  currentModel = null;
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
}

// =========================================
// UPDATE 2-D UI — هر دو پنل با هم آپدیت می‌شن
// =========================================
function updateUI(index) {
  const p = products[index];

  // --- پنل سایت ---
  if (nameEl) nameEl.textContent = p.name;
  if (priceEl) priceEl.textContent = p.price;
  if (descEl) descEl.textContent = p.description;
  if (orderBtn) {
    orderBtn.textContent = `🛒 Order ${p.name}`;
    orderBtn.onclick = () => window.open(p.orderLink, "_blank");
  }
  if (dotsEl) {
    [...dotsEl.children].forEach((d, i) => {
      d.className = "dot" + (i === index ? " active" : "");
    });
  }

  // --- پنل AR ---
  if (arNameEl) arNameEl.textContent = p.name;
  if (arPriceEl) arPriceEl.textContent = p.price;
  if (arDescEl) arDescEl.textContent = p.description;
  if (arOrderBtn) {
    arOrderBtn.textContent = `🛒 Order ${p.name}`;
  }
  if (arDotsEl) {
    [...arDotsEl.children].forEach((d, i) => {
      d.className = "ar-dot" + (i === index ? " active" : "");
    });
  }
}

// =========================================
// LOAD PRODUCT
// =========================================
function loadProduct(index) {
  if (isLoading) return;
  isLoading = true;

  const isAR = renderer.xr.isPresenting;
  const product = products[index];

  updateUI(index);
  showLoading();
  clearModel();
  modelYaw = 0;

  const onLoaded = (model) => {
    currentModel = model;
    fixMaterials(currentModel);
    fitModel(currentModel, isAR);
    rootGroup.add(currentModel);

    createOrUpdateLabel(product);
    positionLabel();
    positionARArrows();

    hideLoading();
    isLoading = false;

    if (isAR && reticle.visible && !modelPlaced) {
      placeModel();
    }
  };

  loader.load(
    product.model,

    (gltf) => {
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((c) => mixer.clipAction(c).play());
      }
      onLoaded(gltf.scene);
    },

    undefined,

    () => {
      // fallback geometry وقتی .glb نیست
      const g = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.03, 40),
        new THREE.MeshStandardMaterial({ color: 0xe8b84b, roughness: 0.6 }),
      );
      base.castShadow = base.receiveShadow = true;
      g.add(base);
      const crust = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.026, 10, 40),
        new THREE.MeshStandardMaterial({ color: 0xc47c2b, roughness: 0.9 }),
      );
      crust.rotation.x = Math.PI / 2;
      crust.castShadow = true;
      g.add(crust);
      onLoaded(g);
    },
  );
}

// =========================================
// NAVIGATION
// =========================================
function navigate(dir) {
  currentIndex = (currentIndex + dir + products.length) % products.length;
  loadProduct(currentIndex);
}

document
  .getElementById("nextBtn")
  ?.addEventListener("click", () => navigate(1));
document
  .getElementById("prevBtn")
  ?.addEventListener("click", () => navigate(-1));

// =========================================
// XR SESSION EVENTS
// =========================================
renderer.xr.addEventListener("sessionstart", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;
  arDetailsVisible = true;

  rootGroup.visible = false;
  reticle.visible = false;

  if (arHint) {
    arHint.textContent = "🔍 Scanning for a surface…";
    arHint.style.display = "flex";
  }

  // پنل سایت رو مخفی کن
  if (bottomPanel) bottomPanel.style.display = "none";

  // پنل AR هنوز مخفیه — بعد از placement نمایش داده می‌شه
  hideARPanel();

  clearModel();
  loadProduct(currentIndex);

  const session = renderer.xr.getSession();
  session.addEventListener("select", onARSelect);
});

renderer.xr.addEventListener("sessionend", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;

  reticle.visible = false;
  rootGroup.position.set(0, 0, 0);
  rootGroup.quaternion.identity();
  rootGroup.scale.set(1, 1, 1);
  rootGroup.visible = true;

  if (arHint) arHint.style.display = "none";

  // پنل AR رو مخفی، پنل سایت رو نمایش بده
  hideARPanel();
  if (bottomPanel) bottomPanel.style.display = "flex";

  clearModel();
  loadProduct(currentIndex);
});

// =========================================
// ANIMATION LOOP
// =========================================
const clock = new THREE.Clock();

renderer.setAnimationLoop((_, frame) => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  /* ── سرعت چرخش خودکار غیر-AR ─────────────
     delta * 0.3 = 0.3 رادیان در ثانیه
     بیشتر (0.6): چرخش سریع‌تر
     کمتر (0.1): چرخش آهسته‌تر
     صفر (0): متوقف می‌شه
     ─────────────────────────────────────── */
  if (!renderer.xr.isPresenting && !isDragging) {
    modelYaw += delta * 0.3;
  }
  if (currentModel) rootGroup.rotation.y = modelYaw;

  if (labelSprite) labelSprite.quaternion.copy(camera.quaternion);

  // ── HIT-TEST ──────────────────────────────────────────────
  if (frame && renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSourceRequested) {
      hitTestSourceRequested = true;

      session.requestReferenceSpace("viewer").then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((src) => {
          hitTestSource = src;
        });
      });

      session.addEventListener(
        "end",
        () => {
          hitTestSource = null;
          hitTestSourceRequested = false;
        },
        { once: true },
      );
    }

    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);

      if (results.length > 0) {
        reticle.matrix.fromArray(results[0].getPose(refSpace).transform.matrix);

        if (!modelPlaced) {
          reticle.visible = true;

          if (arHint && arHint.textContent.includes("Scanning")) {
            arHint.textContent = "👆 Tap to place";
            arHint.style.display = "flex";
          }

          if (currentModel && !isLoading) {
            placeModel();
          }
        } else {
          reticle.visible = false;
        }
      } else {
        if (!modelPlaced) reticle.visible = false;
      }
    }
  }
  // ──────────────────────────────────────────────────────────

  renderer.render(scene, camera);
});

// =========================================
// RESPONSIVE
// =========================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// =========================================
// INIT — ساخت نقاط ناوبری
// =========================================
if (dotsEl) {
  products.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(d);
  });
}

// نقاط ناوبری پنل AR
if (arDotsEl) {
  products.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "ar-dot" + (i === 0 ? " active" : "");
    arDotsEl.appendChild(d);
  });
}

createARArrows();
loadProduct(0);
