import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
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
// UI ELEMENTS
// =========================================
const nameEl = document.getElementById("name");
const priceEl = document.getElementById("price");
const descriptionEl = document.getElementById("description");
const orderBtn = document.getElementById("orderBtn");
const loadingEl = document.getElementById("loadingIndicator");
const dotsContainer = document.getElementById("indexDots");

let currentIndex = 0;

function buildDots() {
  dotsContainer.innerHTML = "";
  products.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === currentIndex ? " active" : "");
    dotsContainer.appendChild(d);
  });
}

function updateDots() {
  [...dotsContainer.children].forEach((d, i) => {
    d.className = "dot" + (i === currentIndex ? " active" : "");
  });
}

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
// ENVIRONMENT MAP — اصلاح شده
// =========================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const roomEnv = new RoomEnvironment(renderer);
const envTexture = pmremGenerator.fromScene(roomEnv).texture;
scene.environment = envTexture;

roomEnv.dispose();
pmremGenerator.dispose();

// =========================================
// LIGHTS
// =========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.8);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffd699, 1.2);
rimLight.position.set(0, 3, -5);
scene.add(rimLight);

const bounceLight = new THREE.DirectionalLight(0xffe8d0, 0.3);
bounceLight.position.set(0, -3, 2);
scene.add(bounceLight);

// =========================================
// AR BUTTON
// =========================================
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
  }),
);

// =========================================
// GLTF / DRACO LOADER
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
// AUTO-FIT
// =========================================
function fitModelToView(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = 0.35;
  const scaleFactor = targetSize / maxDim;

  model.scale.setScalar(scaleFactor);

  model.position.set(
    -center.x * scaleFactor,
    -center.y * scaleFactor - 0.05,
    -1.2,
  );
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

    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
    }
    if (mat.emissiveMap) {
      mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }

    mat.needsUpdate = true;
  });
}

// =========================================
// LOAD PRODUCT
// =========================================
function loadProduct(index) {
  if (isLoading) return;
  isLoading = true;

  const product = products[index];

  nameEl.textContent = product.name;
  priceEl.textContent = product.price;
  descriptionEl.textContent = product.description;
  orderBtn.textContent = `🛒 Order ${product.name}`;
  orderBtn.onclick = () => window.open(product.orderLink, "_blank");

  loadingEl.style.display = "block";
  updateDots();

  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => m.dispose());
        } else {
          node.material?.dispose();
        }
      }
    });
    currentModel = null;
  }

  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }

  loader.load(
    product.model,

    (gltf) => {
      currentModel = gltf.scene;
      fixMaterials(currentModel);
      fitModelToView(currentModel);

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentModel);
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }

      scene.add(currentModel);
      loadingEl.style.display = "none";
      isLoading = false;
    },

    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        if (loadingEl) loadingEl.textContent = `Loading... ${percent}%`;
      }
    },

    (err) => {
      console.warn("❌ Model failed to load:", product.model, err);

      const group = new THREE.Group();

      const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 32);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xe8b84b,
        roughness: 0.7,
        metalness: 0.0,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const crustGeo = new THREE.TorusGeometry(0.18, 0.025, 8, 32);
      const crustMat = new THREE.MeshStandardMaterial({
        color: 0xc47c2b,
        roughness: 0.9,
      });
      const crust = new THREE.Mesh(crustGeo, crustMat);
      crust.rotation.x = Math.PI / 2;
      crust.castShadow = true;
      crust.receiveShadow = true;
      group.add(crust);

      group.position.set(0, -0.5, -1.2);
      currentModel = group;
      scene.add(currentModel);

      loadingEl.style.display = "none";
      isLoading = false;
    },
  );
}

// =========================================
// NAVIGATION
// =========================================
document.getElementById("nextBtn").addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % products.length;
  loadProduct(currentIndex);
});

document.getElementById("prevBtn").addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + products.length) % products.length;
  loadProduct(currentIndex);
});

// =========================================
// ANIMATION LOOP
// =========================================
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  if (currentModel) {
    currentModel.rotation.y += 0.004;
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
buildDots();
loadProduct(currentIndex);
