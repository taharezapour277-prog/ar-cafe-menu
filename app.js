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
    name: "پیتزا بیکن",
    price: "680.000",
    description: "بیکن 98%، قارچ، پنیر پیتزا و...",
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
// DOM REFS
// =========================================
const nameEl = document.getElementById("name");
const priceEl = document.getElementById("price");
const descEl = document.getElementById("description");
const orderBtn = document.getElementById("orderBtn");
const dotsEl = document.getElementById("indexDots");
const loadingEl = document.getElementById("loadingIndicator");
const bottomPanel = document.getElementById("bottom-panel");
const arHint = document.getElementById("ar-hint");
const arNav = document.getElementById("ar-nav");

// =========================================
// AR NAV BUTTONS LISTENERS (FIXED FOR WEBXR)
// =========================================
const arPrevBtn = document.getElementById("ar-prevBtn");
const arNextBtn = document.getElementById("ar-nextBtn");

let lastNavTime = 0;
function safeNavigate(dir) {
  const now = Date.now();
  if (now - lastNavTime < 300) return; // جلوگیری از دبل‌کلیک ناخواسته در AR
  lastNavTime = now;
  navigate(dir);
}

// رویداد beforexrselect حیاتی‌ترین بخش برای کارکرد دکمه‌ها روی لایه AR است
arPrevBtn?.addEventListener("beforexrselect", (e) => {
  e.preventDefault(); // جلوگیری از شلیک شدن select در WebXR (مانع ریست شدن مکان مدل می‌شود)
  safeNavigate(-1);
});
arNextBtn?.addEventListener("beforexrselect", (e) => {
  e.preventDefault(); // جلوگیری از شلیک شدن select در WebXR
  safeNavigate(1);
});

// بک‌آپ برای اطمینان از کارکرد در شبیه‌سازها و تاچ‌های استاندارد
arPrevBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  safeNavigate(-1);
});
arNextBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  safeNavigate(1);
});

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
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  20,
);

// ── تابع جدید و هوشمند برای تنظیم پوزیشن بی نقص محصول در دسکتاپ و موبایل ──
function resetSceneLayout() {
  if (renderer.xr.isPresenting) return; // در فضای AR تنظیمات دستکاری نشود

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    // تنظیمات اختصاصی موبایل: دوربین بالاتر می‌رود و به زاویه بالاتری نگاه می‌کند تا محصول بالای کارت بیفتد
    camera.position.set(0, 0.9, 0.75);
    camera.lookAt(0, 0.12, 0);
    rootGroup.position.set(0, 0.45, 0); // مدل یک مقدار مشخص به سمت بالا شیفت پیدا می‌کند
  } else {
    // تنظیمات استاندارد دسکتاپ
    camera.position.set(0, 0.3, 0.8);
    camera.lookAt(0, 0, 0);
    rootGroup.position.set(0, 0, 0);
  }
  camera.updateProjectionMatrix();
}

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
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.8);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffd699, 1.2);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

// =========================================
// ROOT GROUP
// =========================================
const rootGroup = new THREE.Group();
rootGroup.matrixAutoUpdate = true;
scene.add(rootGroup);

// =========================================
// 3-D FLOATING LABEL
// =========================================
let currentIndex = 0;

function makeTextCanvas(product) {
  const W = 512, H = 230;
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
  ctx.fillStyle = "rgba(10, 10, 18, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 200, 80, 0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FFD86E";
  ctx.font = "bold 46px 'Vazirmatn', 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(product.name, W / 2, 58);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px 'Vazirmatn', 'Segoe UI', Arial, sans-serif";
  ctx.fillText(product.price, W / 2, 104);

  const dotY = 142, dotR = 7, spacing = 24;
  const startX = W / 2 - ((products.length - 1) * spacing) / 2;
  products.forEach((_, i) => {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === currentIndex ? "#FFD86E" : "rgba(255,255,255,0.3)";
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "21px 'Vazirmatn', 'Segoe UI', Arial, sans-serif";
  const words = product.description.split(" ");
  let line = "", lines = [];
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
  const aspect = 512 / 230;
  const h = 0.2;
  labelSprite.scale.set(h * aspect, h, 1);
}

// ── رفع باگ خراب شدن لیبل در AR (تبدیل پوزیشن جهانی به محلی) ──
function positionLabel() {
  if (!labelSprite || !currentModel) return;
  
  currentModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(currentModel);
  
  // کسر کردن پوزیشن جهانی rootGroup برای به دست آوردن ارتفاع خالص محلی مدل روی زمین AR
  const localMaxY = box.max.y - rootGroup.position.y;
  
  // تنظیم پوزیشن دقیق لیبل بدون توجه به اینکه مدل در کجای اتاق قرار دارد
  labelSprite.position.set(0, localMaxY + 0.15, 0);
}

function setARNav(visible) {
  if (!arNav) return;
  arNav.classList.toggle("visible", visible);
}

function update3DUIVisibility(isAR) {
  if (labelSprite) labelSprite.visible = isAR;
}

// =========================================
// RETICLE
// =========================================
const reticleGeo = new THREE.RingGeometry(0.09, 0.115, 48);
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
// GESTURE: single-finger drag → rotate Y
// =========================================
let isDragging = false;
let prevX = 0;
let modelYaw = 0;
let dragMoved = false;
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
  modelYaw += dx * 0.012;
  prevX = x;
}
function onDragEnd() {
  isDragging = false;
}

renderer.domElement.addEventListener("mousedown", (e) => onDragStart(e.clientX));
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
    if (!renderer.xr.isPresenting) {
      const dx = e.changedTouches[0].clientX - touchStartX;
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
}

// =========================================
// AR SELECT EVENT
// =========================================
function onARSelect(e) {
  if (dragMoved) return;
  if (e.inputSource.targetRayMode === "tracked-pointer") return;

  if (modelPlaced) {
    modelPlaced = false;
    reticle.visible = true;
    rootGroup.visible = false;
    if (arHint) {
      arHint.textContent = "👆 Tap again to re-place";
      arHint.style.display = "flex";
    }
    return;
  }

  placeModel();
}

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

  const targetSize = isAR ? 0.32 : 0.38;
  const scale = maxDim > 0 ? targetSize / maxDim : 1;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const boxAfter = new THREE.Box3().setFromObject(model);
  const centerAfter = boxAfter.getCenter(new THREE.Vector3());

  model.position.x = -centerAfter.x;
  model.position.z = -centerAfter.z;
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
// UPDATE 2-D UI
// =========================================
function updateUI(index) {
  const p = products[index];
  if (nameEl) nameEl.textContent = p.name;
  if (priceEl) priceEl.textContent = p.price;
  if (descEl) descEl.textContent = p.description;
  if (orderBtn) {
    orderBtn.textContent = `🛒 سفارش ${p.name}`;
    orderBtn.onclick = () => window.open(p.orderLink, "_blank");
  }
  if (dotsEl) {
    [...dotsEl.children].forEach((d, i) => {
      d.className = "dot" + (i === index ? " active" : "");
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

    update3DUIVisibility(isAR);

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

document.getElementById("nextBtn")?.addEventListener("click", () => navigate(1));
document.getElementById("prevBtn")?.addEventListener("click", () => navigate(-1));

// =========================================
// XR SESSION EVENTS
// =========================================
renderer.xr.addEventListener("sessionstart", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;

  rootGroup.visible = false;
  reticle.visible = false;

  if (arHint) {
    arHint.textContent = "🔍 Scanning for a surface…";
    arHint.style.display = "flex";
  }
  if (bottomPanel) bottomPanel.style.display = "none";

  setARNav(true); 
  update3DUIVisibility(true);

  clearModel();
  loadProduct(currentIndex);

  const session = renderer.xr.getSession();
  session.addEventListener("select", onARSelect);
});

// ── رفع کامل باگ بهم ریختگی صفحه بعد از خروج از AR ──
renderer.xr.addEventListener("sessionend", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;
  modelYaw = 0;

  // ۱. فورس ریست ابعاد رندرر به اندازه اصلی مرورگر (بسیار حیاتی)
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // ۲. بازنشانی مجدد لی‌اوت دوربین و مدل متناسب با دستگاه فعلی
  resetSceneLayout();

  reticle.visible = false;
  rootGroup.quaternion.identity();
  rootGroup.visible = true;

  if (arHint) arHint.style.display = "none";
  
  // ۳. نمایش مجدد و اصولی کامپوننت‌های صفحه اول
  if (bottomPanel) {
    bottomPanel.style.display = "flex";
  }

  setARNav(false); 
  update3DUIVisibility(false);

  // ۴. لود مجدد مدل دسکتاپ/موبایل با مقیاس صحیح
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

  if (!renderer.xr.isPresenting && !isDragging) {
    modelYaw += delta * 0.3;
  }
  if (currentModel) rootGroup.rotation.y = modelYaw;

  if (labelSprite) labelSprite.quaternion.copy(camera.quaternion);

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
  resetSceneLayout(); // آپدیت چیدمان با تغییر سایز مانیتور یا چرخش گوشی
});

// =========================================
// INIT
// =========================================
if (dotsEl) {
  products.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(d);
  });
}

rootGroup.visible = true;
resetSceneLayout(); // اجرای چیدمان بهینه در لود اولیه
update3DUIVisibility(false);
loadProduct(0);