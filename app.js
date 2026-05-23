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
// ROOT GROUP (model + label all move together)
// =========================================
const rootGroup = new THREE.Group();
scene.add(rootGroup);
rootGroup.visible = false; // hidden until placed in AR, or shown in non-AR

// =========================================
// 3D FLOATING LABEL (CSS2DRenderer alternative — pure Three.js Sprite)
// =========================================
function makeTextCanvas(product) {
  const W = 512,
    H = 220;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background rounded rect
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
  ctx.fillStyle = "rgba(15, 15, 20, 0.82)";
  ctx.fill();

  // Border glow
  ctx.strokeStyle = "rgba(255,200,80,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Name
  ctx.fillStyle = "#FFD86E";
  ctx.font = "bold 44px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(product.name, W / 2, 60);

  // Price
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 38px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(product.price, W / 2, 110);

  // Dots (index)
  const dotY = 148;
  const dotR = 7;
  const spacing = 22;
  const totalDots = products.length;
  const startX = W / 2 - ((totalDots - 1) * spacing) / 2;
  products.forEach((_, i) => {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === currentIndex ? "#FFD86E" : "rgba(255,255,255,0.35)";
    ctx.fill();
  });

  // Description
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "22px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(product.description, W / 2, 185);

  return canvas;
}

// Sprite label node
let labelSprite = null;

function createOrUpdateLabel(product) {
  const canvas = makeTextCanvas(product);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  if (!labelSprite) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    labelSprite = new THREE.Sprite(mat);
    rootGroup.add(labelSprite);
  } else {
    labelSprite.material.map.dispose();
    labelSprite.material.map = tex;
    labelSprite.material.needsUpdate = true;
  }

  // Size in world units — canvas aspect 512/220
  const aspect = 512 / 220;
  const spriteH = 0.18;
  labelSprite.scale.set(spriteH * aspect, spriteH, 1);
}

function positionLabel() {
  if (!labelSprite || !currentModel) return;
  // Get bounding box of model to sit label above it
  const box = new THREE.Box3().setFromObject(currentModel);
  const topY = box.max.y;
  labelSprite.position.set(0, topY + 0.14, 0);
}

// =========================================
// AR NAV ARROWS (3D Sprites in scene)
// =========================================
function makeArrowCanvas(direction) {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,20,20,0.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,200,80,0.7)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    direction === "prev" ? "‹" : "›",
    S / 2 + (direction === "prev" ? -2 : 2),
    S / 2 + 2,
  );
  return canvas;
}

let prevArrow = null;
let nextArrow = null;

function createARArrows() {
  ["prev", "next"].forEach((dir) => {
    const canvas = makeArrowCanvas(dir);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.09, 0.09, 1);
    sprite.userData.navDir = dir;
    rootGroup.add(sprite);
    if (dir === "prev") prevArrow = sprite;
    else nextArrow = sprite;
  });
}

function positionARArrows() {
  if (!prevArrow || !nextArrow || !currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  const topY = box.max.y;
  const labelY = topY + 0.14;
  const hw = (0.18 * 512) / 220 / 2 + 0.06; // half label width + gap
  prevArrow.position.set(-hw, labelY, 0);
  nextArrow.position.set(hw, labelY, 0);
}

// =========================================
// RETICLE
// =========================================
const reticleGeo = new THREE.RingGeometry(0.08, 0.105, 40);
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
// HIT TEST STATE
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
let currentIndex = 0;
let isLoading = false;
let mixer = null;

// =========================================
// GESTURE: drag to rotate (1 finger / mouse)
// =========================================
let isDragging = false;
let prevX = 0;
let modelYaw = 0;

function onDragStart(x) {
  isDragging = true;
  prevX = x;
}
function onDragMove(x) {
  if (!isDragging || !currentModel) return;
  modelYaw += (x - prevX) * 0.012;
  prevX = x;
}
function onDragEnd() {
  isDragging = false;
}

// Mouse
renderer.domElement.addEventListener("mousedown", (e) =>
  onDragStart(e.clientX),
);
renderer.domElement.addEventListener("mousemove", (e) => onDragMove(e.clientX));
renderer.domElement.addEventListener("mouseup", onDragEnd);
renderer.domElement.addEventListener("mouseleave", onDragEnd);

// Touch — single finger drag; ignore multi-touch
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1) onDragStart(e.touches[0].clientX);
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
renderer.domElement.addEventListener("touchend", onDragEnd, { passive: true });

// =========================================
// TAP TO PLACE (AR) + AR arrow tap detection
// =========================================
renderer.domElement.addEventListener("click", (e) => {
  if (!renderer.xr.isPresenting) return;

  // Check if tapped an AR arrow sprite
  if (prevArrow && nextArrow) {
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([prevArrow, nextArrow]);
    if (hits.length > 0) {
      const dir = hits[0].object.userData.navDir;
      navigate(dir === "next" ? 1 : -1);
      return;
    }
  }

  // Place model
  if (!modelPlaced && reticle.visible) {
    rootGroup.position.setFromMatrixPosition(reticle.matrix);
    rootGroup.visible = true;
    reticle.visible = false;
    modelPlaced = true;
    document.getElementById("ar-hint")?.style &&
      (document.getElementById("ar-hint").style.display = "none");
  }
});

// =========================================
// FIT MODEL
// =========================================
function fitModel(model, isAR) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const target = isAR ? 0.22 : 0.38;
  const scale = target / maxDim;
  model.scale.setScalar(scale);

  // Re-compute after scale
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.x = -center.x * scale;
  model.position.y = -box2.min.y; // sit on floor / pivot base
  model.position.z = isAR ? 0 : -1.1;
}

// =========================================
// FIX MATERIALS
// =========================================
function fixMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mat = node.material;
    if (!mat) return;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
  });
}

// =========================================
// LOAD PRODUCT
// =========================================
const loadingEl = document.getElementById("loadingIndicator");

function loadProduct(index) {
  if (isLoading) return;
  isLoading = true;

  const isAR = renderer.xr.isPresenting;
  const product = products[index];

  // Update 2D UI (non-AR)
  const nameEl = document.getElementById("name");
  const priceEl = document.getElementById("price");
  const descEl = document.getElementById("description");
  const orderBtn = document.getElementById("orderBtn");
  const dotsEl = document.getElementById("indexDots");
  if (nameEl) nameEl.textContent = product.name;
  if (priceEl) priceEl.textContent = product.price;
  if (descEl) descEl.textContent = product.description;
  if (orderBtn) {
    orderBtn.textContent = `🛒 Order ${product.name}`;
    orderBtn.onclick = () => window.open(product.orderLink, "_blank");
  }
  if (dotsEl) {
    [...dotsEl.children].forEach((d, i) => {
      d.className = "dot" + (i === index ? " active" : "");
    });
  }

  if (loadingEl) {
    loadingEl.textContent = "Loading...";
    loadingEl.style.display = "block";
  }

  // Clear old model
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
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
  modelYaw = 0;

  loader.load(
    product.model,
    (gltf) => {
      currentModel = gltf.scene;
      fixMaterials(currentModel);
      fitModel(currentModel, isAR);

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(currentModel);
        gltf.animations.forEach((c) => mixer.clipAction(c).play());
      }

      rootGroup.add(currentModel);

      // Update 3D floating label
      createOrUpdateLabel(product);
      positionLabel();
      positionARArrows();

      if (loadingEl) loadingEl.style.display = "none";
      isLoading = false;
    },
    (xhr) => {
      if (xhr.lengthComputable && loadingEl)
        loadingEl.textContent = `Loading... ${Math.round((xhr.loaded / xhr.total) * 100)}%`;
    },
    () => {
      // Fallback geometry
      const g = new THREE.Group();
      g.add(
        Object.assign(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.03, 32),
            new THREE.MeshStandardMaterial({ color: 0xe8b84b, roughness: 0.7 }),
          ),
          { castShadow: true },
        ),
      );
      const crust = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.025, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0xc47c2b, roughness: 0.9 }),
      );
      crust.rotation.x = Math.PI / 2;
      g.add(crust);
      currentModel = g;
      fitModel(currentModel, isAR);
      rootGroup.add(currentModel);
      createOrUpdateLabel(product);
      positionLabel();
      positionARArrows();
      if (loadingEl) loadingEl.style.display = "none";
      isLoading = false;
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

// Swipe detection on canvas (for non-AR)
let swipeStartX = 0;
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    swipeStartX = e.touches[0].clientX;
  },
  { passive: true },
);
renderer.domElement.addEventListener(
  "touchend",
  (e) => {
    if (renderer.xr.isPresenting) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
  },
  { passive: true },
);

// =========================================
// XR EVENTS
// =========================================
renderer.xr.addEventListener("sessionstart", () => {
  modelPlaced = false;
  rootGroup.visible = false;
  reticle.visible = true;
  document.getElementById("ar-hint") &&
    (document.getElementById("ar-hint").style.display = "flex");
  document.getElementById("bottom-panel") &&
    (document.getElementById("bottom-panel").style.display = "none");
  // Reload so model fits AR scale
  if (currentModel) {
    rootGroup.remove(currentModel);
    currentModel = null;
  }
  loadProduct(currentIndex);
});

renderer.xr.addEventListener("sessionend", () => {
  modelPlaced = false;
  hitTestSource = null;
  hitTestSourceRequested = false;
  reticle.visible = false;
  rootGroup.position.set(0, 0, 0);
  rootGroup.rotation.set(0, 0, 0);
  rootGroup.visible = true;
  document.getElementById("ar-hint") &&
    (document.getElementById("ar-hint").style.display = "none");
  document.getElementById("bottom-panel") &&
    (document.getElementById("bottom-panel").style.display = "flex");
  if (currentModel) {
    rootGroup.remove(currentModel);
    currentModel = null;
  }
  loadProduct(currentIndex);
});

// =========================================
// ANIMATION LOOP
// =========================================
const clock = new THREE.Clock();

renderer.setAnimationLoop((_, frame) => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  // Apply drag rotation
  if (currentModel) {
    rootGroup.rotation.y = modelYaw;
  }

  // Label always faces camera
  if (labelSprite) {
    labelSprite.quaternion.copy(camera.quaternion);
  }

  // HIT TEST
  if (frame && renderer.xr.isPresenting && !modelPlaced) {
    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((vs) => {
        session.requestHitTestSource({ space: vs }).then((src) => {
          hitTestSource = src;
        });
      });
      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        reticle.visible = true;
        reticle.matrix.fromArray(results[0].getPose(refSpace).transform.matrix);
      } else {
        reticle.visible = false;
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
// Build dots
const dotsEl = document.getElementById("indexDots");
if (dotsEl) {
  products.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(d);
  });
}
createARArrows();
rootGroup.visible = true;
loadProduct(0);
