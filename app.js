import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// =========================================
// CONFIGURATION & GLOBAL STATE (DYNAMIC)
// =========================================
let categories = {};
let products = [];
let filteredProducts = [];
let currentCategory = "pizza";
let currentIndex = 0;

// =========================================
// UI DOM REFERENCES
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

// Drawer Elements
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");
const drawerCategoriesList = document.getElementById("drawerCategoriesList");
const quickCategoryBar = document.getElementById("quickCategoryBar");

// AR Nav Buttons
const arPrevBtn = document.getElementById("ar-prevBtn");
const arNextBtn = document.getElementById("ar-nextBtn");

// =========================================
// UTILS & HELPER FUNCTIONS
// =========================================
function toPersianNumber(num) {
  const pwa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return num.toString().replace(/[0-9]/g, (w) => pwa[+w]);
}

// =========================================
// CATEGORY NAVIGATION & DRAWER RENDERER
// =========================================
function initCategoryUI() {
  // 1. Render Top Quick Horizontal Bar
  quickCategoryBar.innerHTML = "";
  Object.keys(categories).forEach((catKey) => {
    const cat = categories[catKey];
    const activeClass = catKey === currentCategory ? "active" : "";
    const item = document.createElement("div");
    item.className = `quick-cat-item ${activeClass}`;
    item.setAttribute("data-cat", catKey);
    item.innerHTML = `<i class="ti ${cat.icon}"></i><span>${cat.name}</span>`;
    item.addEventListener("click", () => selectCategory(catKey));
    quickCategoryBar.appendChild(item);
  });

  // 2. Render Accordions in Side Drawer Menu
  drawerCategoriesList.innerHTML = "";
  Object.keys(categories).forEach((catKey) => {
    const cat = categories[catKey];
    const isExpanded = catKey === currentCategory ? "expanded" : "";
    const catGroupProducts = products.filter((p) => p.category === catKey);

    const groupDiv = document.createElement("div");
    groupDiv.className = `drawer-cat-group ${isExpanded}`;
    groupDiv.id = `drawer-group-${catKey}`;

    let productsHTML = `<div class="drawer-products-list">`;
    catGroupProducts.forEach((prod) => {
      const isItemActive =
        prod.id === filteredProducts[currentIndex]?.id ? "active" : "";
      productsHTML += `
            <div class="drawer-product-item ${isItemActive}" data-prod-id="${prod.id}">
              <span class="p-name">${prod.name}</span>
              <span class="p-price">${prod.price} تومان</span>
            </div>`;
    });
    productsHTML += `</div>`;

    groupDiv.innerHTML = `
          <div class="drawer-cat-header">
            <div class="drawer-cat-title">
              <i class="ti ${cat.icon}"></i>
              <span>${cat.name}</span>
            </div>
            <i class="ti ti-chevron-down drawer-cat-chevron"></i>
          </div>
          ${productsHTML}
        `;

    // Click Accordion Header Event
    groupDiv
      .querySelector(".drawer-cat-header")
      .addEventListener("click", () => {
        const currentlyExpanded = drawerCategoriesList.querySelector(
          ".drawer-cat-group.expanded"
        );
        if (currentlyExpanded && currentlyExpanded !== groupDiv) {
          currentlyExpanded.classList.remove("expanded");
        }
        groupDiv.classList.toggle("expanded");
      });

    // Click Product Child Item Event
    groupDiv.querySelectorAll(".drawer-product-item").forEach((itemEl) => {
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const prodId = parseInt(itemEl.getAttribute("data-prod-id"));
        switchProductById(prodId, catKey);
        closeDrawerMenu();
      });
    });

    drawerCategoriesList.appendChild(groupDiv);
  });
}

function selectCategory(catKey) {
  currentCategory = catKey;
  filteredProducts = products.filter((p) => p.category === currentCategory);
  currentIndex = 0;

  // Update top bar visuals instantly
  document.querySelectorAll(".quick-cat-item").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-cat") === catKey);
  });

  initCategoryUI();
  buildDotsIndicator();
  loadProduct(currentIndex);
}

function switchProductById(prodId, catKey) {
  currentCategory = catKey;
  filteredProducts = products.filter((p) => p.category === currentCategory);
  currentIndex = filteredProducts.findIndex((p) => p.id === prodId);
  if (currentIndex === -1) currentIndex = 0;

  initCategoryUI();
  buildDotsIndicator();
  loadProduct(currentIndex);
}

// Drawer Animations Open/Close
function openDrawerMenu() {
  drawerOverlay.style.display = "block";
  setTimeout(() => {
    drawerOverlay.style.opacity = "1";
    drawer.style.transform = "translateX(0)";
  }, 10);
}

function closeDrawerMenu() {
  drawerOverlay.style.opacity = "0";
  drawer.style.transform = "translateX(100%)";
  setTimeout(() => {
    drawerOverlay.style.display = "none";
  }, 300);
}

menuToggleBtn.addEventListener("click", openDrawerMenu);
drawerCloseBtn.addEventListener("click", closeDrawerMenu);
drawerOverlay.addEventListener("click", closeDrawerMenu);

// =========================================
// THREE.JS GRAPHICS SETUP
// =========================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const container = document.getElementById("canvas-container");
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  container.clientWidth / container.clientHeight,
  0.01,
  20
);

const rootGroup = new THREE.Group();
rootGroup.matrixAutoUpdate = true;
scene.add(rootGroup);

function resetSceneLayout() {
  if (renderer.xr.isPresenting) return;

  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  const isMobile = containerW < 768;

  if (isMobile) {
    camera.position.set(0, 0.85, 0.8);
    camera.lookAt(0, 0.15, 0);
  } else {
    camera.position.set(0, 0.4, 0.85);
    camera.lookAt(0, 0, 0);
  }
  camera.updateProjectionMatrix();

  // اجرای محاسبه داینامیک ابعاد مدل در صورت وجود
  if (currentModel) {
    updateModelLayout();
  }
}

function updateModelLayout() {
  if (!currentModel || renderer.xr.isPresenting) return;

  // ۱. محاسبه ارتفاع بخش‌های بالا و پایین صفحه
  const topBar = document.querySelector(".topnav");
  const quickBar = document.querySelector(".category-quick-bar");
  const bottomPanel = document.getElementById("bottom-panel");

  const topHeight =
    (topBar ? topBar.offsetHeight : 0) + (quickBar ? quickBar.offsetHeight : 0);
  const bottomHeight = bottomPanel
    ? window.innerHeight - bottomPanel.getBoundingClientRect().top
    : 0;

  // کلید حل مشکل: خنثی کردن موقت چرخش و جابجایی برای محاسبه دقیق ابعاد و مرکز
  const prevYaw = rootGroup.rotation.y;
  rootGroup.rotation.y = 0;
  rootGroup.position.set(0, 0, 0);
  currentModel.position.set(0, 0, 0);
  currentModel.scale.setScalar(1);
  rootGroup.updateMatrixWorld(true);

  // ۲. استخراج ابعاد واقعی دید دوربین
  const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const vHeight = 2 * Math.tan(vFOV / 2) * dist;
  const vWidth = vHeight * camera.aspect;

  // ۳. محاسبه مقیاس بر اساس مدل خام و بدون چرخش
  const box = new THREE.Box3().setFromObject(currentModel);
  const size = box.getSize(new THREE.Vector3());

  const modelWidth = Math.max(size.x, size.z, 0.01);
  let targetScale = (vWidth * 0.6) / modelWidth;

  const safeHeightWorld =
    ((window.innerHeight - topHeight - bottomHeight) / window.innerHeight) *
    vHeight;
  const maxAllowedHeight = safeHeightWorld * 0.75;
  if (size.y * targetScale > maxAllowedHeight) {
    targetScale = maxAllowedHeight / Math.max(size.y, 0.01);
  }

  currentModel.scale.setScalar(targetScale);

  // ۴. محوریت مجدد (Center) مدل روی استیج در حالت کاملاً صاف
  currentModel.updateMatrixWorld(true);
  const freshBox = new THREE.Box3().setFromObject(currentModel);
  const center = freshBox.getCenter(new THREE.Vector3());

  currentModel.position.set(-center.x, -freshBox.min.y, -center.z);

  // ۵. برگرداندن چرخش و اعمال جابجایی استیج در فضای خالی صفحه
  const safeCenterPixel =
    topHeight + (window.innerHeight - topHeight - bottomHeight) / 2;
  const pixelOffsetY = window.innerHeight / 2 - safeCenterPixel;
  const worldOffsetY = pixelOffsetY * (vHeight / window.innerHeight);
  const isMobile = container.clientWidth < 768;
  const baseY = isMobile ? 0.05 : -0.05;

  rootGroup.position.set(0, baseY + worldOffsetY, 0);
  rootGroup.rotation.y = prevYaw; // چرخش به حالت انیمیشن برمی‌گردد
}
// Environments & Lighting Mapping
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const roomEnv = new RoomEnvironment(renderer);
scene.environment = pmremGenerator.fromScene(roomEnv).texture;
roomEnv.dispose();
pmremGenerator.dispose();

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.8);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

// =========================================
// 3D FLOATING AR TEXT LABELS GENERATION
// =========================================
let labelSprite = null;

function makeTextCanvas(product) {
  const W = 512,
    H = 240;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, W, H);
  const r = 24;
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
  ctx.fillStyle = "rgba(26, 26, 26, 0.94)";
  ctx.fill();
  ctx.strokeStyle = "#febf05";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#febf05";
  ctx.font = "bold 44px 'Vazirmatn', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(product.name, W / 2, 65);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 34px 'Vazirmatn', Arial, sans-serif";
  ctx.fillText(`${product.price} تومان`, W / 2, 115);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "300 20px 'Vazirmatn', Arial, sans-serif";

  const words = product.description.split(" ");
  let line = "",
    lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > W - 50 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 170 + i * 28));

  return canvas;
}

function createOrUpdateLabel(product) {
  const canvas = makeTextCanvas(product);
  const tex = new THREE.CanvasTexture(canvas);
  if (!labelSprite) {
    labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      })
    );
    rootGroup.add(labelSprite);
  } else {
    labelSprite.material.map.dispose();
    labelSprite.material.map = tex;
    labelSprite.material.needsUpdate = true;
  }
  const aspect = 512 / 240;
  const h = 0.22;
  labelSprite.scale.set(h * aspect, h, 1);
}

function positionLabel() {
  if (!labelSprite || !currentModel) return;
  currentModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(currentModel);
  const localMaxY = box.max.y - rootGroup.position.y;
  labelSprite.position.set(0, localMaxY + 0.35, 0);
}

// =========================================
// AR SURFACE HIT-TEST TRACKING DETECTORS
// =========================================
const reticleGeo = new THREE.RingGeometry(0.08, 0.11, 32).rotateX(-Math.PI / 2);
const reticle = new THREE.Mesh(
  reticleGeo,
  new THREE.MeshBasicMaterial({
    color: 0xfebf05,
    opacity: 0.8,
    transparent: true,
  })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let hitTestSource = null;
let hitTestSourceRequested = false;
let modelPlaced = false;

// WebXR Interactive Overlay Configuration Customization
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: document.getElementById("ui-overlay") },
  })
);

// =========================================
// MODEL LOADERS HANDLERS & ANIMATIONS
// =========================================
const dracoLoader = new DRACOLoader().setDecoderPath(
  "./assets/libs/three/draco/"
);
const loader = new GLTFLoader().setDRACOLoader(dracoLoader);

let currentModel = null;
let isLoading = false;
let mixer = null;

function loadProduct(index) {
  if (isLoading || filteredProducts.length === 0) return;
  isLoading = true;

  const isAR = renderer.xr.isPresenting;
  const product = filteredProducts[index];

  // Update 2D Text Node Trees Elements
  nameEl.textContent = product.name;
  priceEl.textContent = `${product.price} تومان`;
  descEl.textContent = product.description;
  orderBtn.querySelector("span").textContent = `سفارش ${product.name}`;
  orderBtn.onclick = () => window.open(product.orderLink, "_blank");

  // Set active status styling inside list nodes elements dynamically
  document.querySelectorAll(".drawer-product-item").forEach((itemEl) => {
    const pId = parseInt(itemEl.getAttribute("data-prod-id"));
    itemEl.classList.toggle("active", pId === product.id);
  });

  // Synchronize slider dots active state indicators
  document.querySelectorAll("#indexDots .dot").forEach((d, i) => {
    d.className = "dot" + (i === index ? " active" : "");
  });

  loadingEl.classList.add("visible");

  // Memory cleanup for old instances references
  if (currentModel) {
    rootGroup.remove(currentModel);
    currentModel.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose();
        (Array.isArray(node.material)
          ? node.material
          : [node.material]
        ).forEach((m) => m?.dispose());
      }
    });
    currentModel = null;
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
  }

  modelYaw = 0;

  const onModelSetupReady = (loadedScene) => {
    currentModel = loadedScene;

    // Material Normalizers
    currentModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = node.receiveShadow = true;
        if (node.material) {
          if (node.material.map)
            node.material.map.colorSpace = THREE.SRGBColorSpace;
          node.material.needsUpdate = true;
        }
      }
    });

    rootGroup.add(currentModel);

    if (isAR) {
      // در حالت AR هم چرخش را موقتاً خنثی می‌کنیم
      const prevYaw = rootGroup.rotation.y;
      rootGroup.rotation.y = 0;
      currentModel.position.set(0, 0, 0);
      currentModel.scale.setScalar(1);
      rootGroup.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      currentModel.scale.setScalar(maxDim > 0 ? 0.3 / maxDim : 1);

      currentModel.updateMatrixWorld(true);
      const freshBox = new THREE.Box3().setFromObject(currentModel);
      const center = freshBox.getCenter(new THREE.Vector3());
      currentModel.position.set(-center.x, -freshBox.min.y + 0.005, -center.z);

      rootGroup.rotation.y = prevYaw;
    } else {
      // محاسبه کاملاً هوشمند ابعاد برای نمای دسکتاپ/موبایل
      updateModelLayout();
    }

    createOrUpdateLabel(product);
    positionLabel();
    if (labelSprite) labelSprite.visible = isAR;

    loadingEl.classList.remove("visible");
    isLoading = false;

    if (isAR && reticle.visible && !modelPlaced) placeModelAtReticle();
  };

  // Execution Loader Block
  loader.load(
    product.model,
    (gltf) => {
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((anim) => mixer.clipAction(anim).play());
      }
      onModelSetupReady(gltf.scene);
    },
    undefined,
    () => {
      // Robust elegant visual placeholder fallback geometry primitive mesh
      const fallbackGroup = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32),
        new THREE.MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.4 })
      );
      plate.castShadow = plate.receiveShadow = true;
      fallbackGroup.add(plate);

      const foodMock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.05, 32),
        new THREE.MeshStandardMaterial({ color: 0xfebf05, roughness: 0.8 })
      );
      foodMock.position.y = 0.04;
      foodMock.castShadow = true;
      fallbackGroup.add(foodMock);

      onModelSetupReady(fallbackGroup);
    }
  );
}

function buildDotsIndicator() {
  dotsEl.innerHTML = "";
  filteredProducts.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(d);
  });
}

function navigate(dir) {
  if (filteredProducts.length === 0) return;
  currentIndex =
    (currentIndex + dir + filteredProducts.length) % filteredProducts.length;
  loadProduct(currentIndex);
}

let lastNavTime = 0;
function safeNavigate(dir) {
  const now = Date.now();
  if (now - lastNavTime < 320) return;
  lastNavTime = now;
  navigate(dir);
}

document
  .getElementById("nextBtn")
  .addEventListener("click", () => safeNavigate(1));
document
  .getElementById("prevBtn")
  .addEventListener("click", () => safeNavigate(-1));

// =========================================
// TOUCH EVENTS GESTURE CONTROLS (ROTATION)
// =========================================
let isDragging = false,
  prevTouchX = 0,
  modelYaw = 0,
  dragDeltaMoved = false;

function onDragStart(x) {
  isDragging = true;
  prevTouchX = x;
  dragDeltaMoved = false;
}
function onDragMove(x) {
  if (!isDragging || !currentModel) return;
  const dx = x - prevTouchX;
  if (Math.abs(dx) > 5) dragDeltaMoved = true;
  modelYaw += dx * 0.012;
  prevTouchX = x;
}
function onDragEnd() {
  isDragging = false;
}

container.addEventListener("mousedown", (e) => onDragStart(e.clientX));
window.addEventListener("mousemove", (e) => onDragMove(e.clientX));
window.addEventListener("mouseup", onDragEnd);

container.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1) onDragStart(e.touches[0].clientX);
  },
  { passive: true }
);
container.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length === 1) onDragMove(e.touches[0].clientX);
  },
  { passive: true }
);
container.addEventListener(
  "touchend",
  (e) => {
    onDragEnd();
    if (
      !renderer.xr.isPresenting &&
      !dragDeltaMoved &&
      e.changedTouches.length > 0
    ) {
      // Fallback Swipe Navigation Detection logic
    }
  },
  { passive: true }
);

// =========================================
// WEBXR INTERACTIVE EVENTS & HIT COORDS
// =========================================
function placeModelAtReticle() {
  if (!reticle.visible || !currentModel) return;
  const pos = new THREE.Vector3(),
    quat = new THREE.Quaternion(),
    scl = new THREE.Vector3();
  reticle.matrix.decompose(pos, quat, scl);

  rootGroup.position.copy(pos);
  rootGroup.quaternion.copy(quat);
  rootGroup.scale.set(1, 1, 1);
  rootGroup.visible = true;
  reticle.visible = false;
  modelPlaced = true;
  if (arHint) arHint.style.display = "none";
}

function onARSelect(e) {
  if (dragDeltaMoved) return;
  if (e.inputSource.targetRayMode === "tracked-pointer") return;
  if (modelPlaced) {
    modelPlaced = false;
    reticle.visible = true;
    rootGroup.visible = false;
    if (arHint) {
      arHint.querySelector("span").textContent =
        "👆 لمس مجدد جهت تثبیت جانمایی";
      arHint.style.display = "flex";
    }
    return;
  }
  placeModelAtReticle();
}

// AR Nav Touch Wrappers
arPrevBtn.addEventListener("beforexrselect", (e) => {
  e.preventDefault();
  safeNavigate(-1);
});
arNextBtn.addEventListener("beforexrselect", (e) => {
  e.preventDefault();
  safeNavigate(1);
});
arPrevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  safeNavigate(-1);
});
arNextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  safeNavigate(1);
});

// XR State Listeners
renderer.xr.addEventListener("sessionstart", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;
  rootGroup.position.set(0, 0, 0);
  rootGroup.quaternion.identity();
  rootGroup.visible = false;
  reticle.visible = false;

  if (arHint) {
    arHint.querySelector("span").textContent =
      "🔍 در حال اسکن محیط پلتفرم سطحی…";
    arHint.style.display = "flex";
  }
  bottomPanel.style.display = "none";
  arNav.classList.add("visible");
  if (labelSprite) labelSprite.visible = true;

  loadProduct(currentIndex);
  renderer.xr.getSession().addEventListener("select", onARSelect);
});

renderer.xr.addEventListener("sessionend", () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  modelPlaced = false;
  modelYaw = 0;

  renderer.setSize(container.clientWidth, container.clientHeight);
  resetSceneLayout();

  reticle.visible = false;
  rootGroup.quaternion.identity();
  rootGroup.visible = true;

  if (arHint) arHint.style.display = "none";
  bottomPanel.style.display = "flex";
  arNav.classList.remove("visible");
  if (labelSprite) labelSprite.visible = false;

  loadProduct(currentIndex);
});

// =========================================
// CORE ANIMATION LOOP RUNNER
// =========================================
const clock = new THREE.Clock();
renderer.setAnimationLoop((_, frame) => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  if (!renderer.xr.isPresenting && !isDragging) {
    modelYaw += delta * 0.25; // Gentle elegant auto idle rot
  }
  if (currentModel) rootGroup.rotation.y = modelYaw;
  if (labelSprite && labelSprite.visible)
    labelSprite.quaternion.copy(camera.quaternion);

  // Hit test processing loop pipeline
  if (frame && renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSourceRequested) {
      hitTestSourceRequested = true;
      session.requestReferenceSpace("viewer").then((vSpace) => {
        session
          .requestHitTestSource({ space: vSpace })
          .then((src) => (hitTestSource = src));
      });
      session.addEventListener(
        "end",
        () => {
          hitTestSource = null;
          hitTestSourceRequested = false;
        },
        { once: true }
      );
    }

    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        reticle.matrix.fromArray(results[0].getPose(refSpace).transform.matrix);
        if (!modelPlaced) {
          reticle.visible = true;
          if (
            arHint &&
            arHint.querySelector("span").textContent.includes("اسکن")
          ) {
            arHint.querySelector("span").textContent =
              "👆 برای قرار دادن روی سطح لمس کنید";
          }
          if (currentModel && !isLoading && !modelPlaced) placeModelAtReticle();
        }
      } else if (!modelPlaced) {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
});

// =========================================
// ENGINE INITIALIZATION ENGINE WINDOW BIND
// =========================================
window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  resetSceneLayout();
});

// Share action simple integration mock
document.getElementById("shareBtn").addEventListener("click", () => {
  if (navigator.share) {
    navigator
      .share({ title: document.title, url: window.location.href })
      .catch(() => {});
  } else {
    alert("لینک کپی شد!");
  }
});

// =========================================
// ASYNC DATA INITIALIZATION BOOTLOADER
// =========================================
async function initApplication() {
  try {
    // خواندن فایل JSON که در کنار همین فایل است
    const response = await fetch("./menu.json");
    if (!response.ok) throw new Error("مشکلی در دریافت فایل منو به وجود آمد.");

    const data = await response.json();

    // تزریق دیتای جی‌سان به متغیرهای سراسری برنامه
    categories = data.categories;
    products = data.products;

    // فیلتر کردن محصولات بر اساس دسته‌بندی پیش‌فرض اولیه
    filteredProducts = products.filter((p) => p.category === currentCategory);

    // اجرا و روشن کردن موتورهای رابط کاربری و گرافیک
    initCategoryUI();
    buildDotsIndicator();
    resetSceneLayout();
    loadProduct(currentIndex);

    console.log("✅ دیتای منو با موفقیت از JSON بارگذاری و برنامه اجرا شد.");
  } catch (error) {
    console.error("❌ خطا در راه‌اندازی اولیه اپلیکیشن:", error);
  }
}

// استارت هوشمند کل سیستم (فقط یک‌بار)
initApplication();
