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
camera.position.set(0, 0.3, 0.8);
camera.lookAt(0, 0, 0);
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
rootGroup.matrixAutoUpdate = true; // use position/quaternion/scale, NOT raw matrix
scene.add(rootGroup);
rootGroup.visible = true;

// =========================================
// 3-D FLOATING LABEL
// =========================================
let currentIndex = 0;

function makeTextCanvas(product) {
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
  const aspect = 512 / 230;
  const h = 0.2;
  labelSprite.scale.set(h * aspect, h, 1);
}

function positionLabel() {
  if (!labelSprite || !currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  labelSprite.position.set(0, box.max.y + 1, 0);
}

// =========================================
// AR NAV ARROWS
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
    sprite.scale.set(0.1, 0.1, 1);
    sprite.userData.navDir = dir;
    rootGroup.add(sprite);
    if (dir === "prev") prevArrow = sprite;
    else nextArrow = sprite;
  });
}

function positionARArrows() {
  if (!prevArrow || !nextArrow || !currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  const labelY = box.max.y + 1;
  const hw = (0.2 * 512) / 230 / 2 + 0.07;
  prevArrow.position.set(-hw, labelY, 0);
  nextArrow.position.set(hw, labelY, 0);
}

// ── CHANGE ───────────────────────────────
// این تابع جدید اضافه شده تا المان‌های سه بعدی (لیبل و فلش‌ها) رو مخفی یا آشکار کنه
function update3DUIVisibility(isAR) {
  if (labelSprite) labelSprite.visible = isAR;
  if (prevArrow) prevArrow.visible = isAR;
  if (nextArrow) nextArrow.visible = isAR;
}
// ─────────────────────────────────────────

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
const DRAG_THRESHOLD = 8; // px

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
    // Swipe navigation — non-AR only
    if (!renderer.xr.isPresenting) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 55 && !dragMoved) navigate(dx < 0 ? 1 : -1);
    }
  },
  { passive: true },
);

// =========================================
// PLACE MODEL AT RETICLE POSITION
// This is called both from auto-placement and manual select.
// =========================================
function placeModel() {
  if (!reticle.visible || !currentModel) return;

  // Decompose the reticle's world matrix into rootGroup's
  // position / quaternion / scale — safe with matrixAutoUpdate = true
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  reticle.matrix.decompose(pos, quat, scl);

  rootGroup.position.copy(pos);
  rootGroup.quaternion.copy(quat);
  rootGroup.scale.set(1, 1, 1); // scale is handled by fitModel, not reticle

  rootGroup.visible = true;
  reticle.visible = false;
  modelPlaced = true;

  if (arHint) arHint.style.display = "none";
}

// =========================================
// AR SELECT EVENT  (WebXR tap)
// =========================================
function onARSelect() {
  if (dragMoved) return;

  // ── بخش جدید: بررسی کلیک روی فلش‌های سه‌بعدی در حالت AR ──
  const controller = renderer.xr.getController(0);
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  
  _raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  
  const hits = _raycaster.intersectObjects([prevArrow, nextArrow].filter(Boolean));
  
  if (hits.length > 0) {
    // اگر کاربر روی یکی از فلش‌ها کلیک کرد، محصول را تغییر بده و از تابع خارج شو
    navigate(hits[0].object.userData.navDir === "next" ? 1 : -1);
    return;
  }
  // ─────────────────────────────────────────────────────────

  // اگر روی فلش‌ها کلیک نشده بود، منطق قبلی جاگذاری مدل را اجرا کن
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
// NON-AR CLICK: raycast AR arrows (desktop/non-AR fallback)
// =========================================
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

renderer.domElement.addEventListener("click", (e) => {
  // In AR, we use the XR select event above — skip click handling
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

  const targetSize = isAR ? 0.32 : 0.38;
  const scale = maxDim > 0 ? targetSize / maxDim : 1;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const boxAfter = new THREE.Box3().setFromObject(model);
  const centerAfter = boxAfter.getCenter(new THREE.Vector3());

  model.position.x = -centerAfter.x;
  model.position.z = -centerAfter.z;
  // Bottom of model sits on y = 0
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
    positionARArrows();

    // ── CHANGE ───────────────────────────────
    // بلافاصله بعد از ساخته شدن یا آپدیت لیبل، بر اساس وضعیت وب/واقعیت‌مجازی مخفی یا نمایش داده بشه
    update3DUIVisibility(isAR);
    // ─────────────────────────────────────────

    hideLoading();
    isLoading = false;

    // ── KEY FIX ──────────────────────────────────────────────
    if (isAR && reticle.visible && !modelPlaced) {
      placeModel();
    }
    // ─────────────────────────────────────────────────────────
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

  rootGroup.visible = false;
  reticle.visible = false;

  if (arHint) {
    arHint.textContent = "🔍 در حال اسکن سطح…";
    arHint.style.display = "flex";
  }
  if (bottomPanel) bottomPanel.style.display = "none";

  // ── CHANGE ───────────────────────────────
  // موقع ورود به دوربین AR، لیبل سه بعدی و دکمه‌ها فعال بشن
  update3DUIVisibility(true);
  // ─────────────────────────────────────────

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
  if (bottomPanel) bottomPanel.style.display = "flex";

  // ── CHANGE ───────────────────────────────
  // موقع خارج شدن از دوربین AR، المان‌های سه بعدی مخفی بشن
  update3DUIVisibility(false);
  // ─────────────────────────────────────────

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

createARArrows();

// ── CHANGE ───────────────────────────────
// در ابتدای اجرای سایت که هنوز کاربر وارد دوربین نشده، المان‌های سه بعدی مخفی بشن
update3DUIVisibility(false);
// ─────────────────────────────────────────

loadProduct(0);

