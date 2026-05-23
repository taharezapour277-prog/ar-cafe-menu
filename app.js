// ✅ حالا با importmap بالا، این import‌ها درست کار می‌کنن
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// =========================================
// PRODUCTS
// =========================================
const products = [
  {
    name: "Pepperoni Pizza",
    price: "$14",
    description: "Pepperoni, mozzarella cheese, olives and mushroom.",
    model: "./pizza.glb",
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

// Build index dots
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
// THREE.JS SETUP
// =========================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  20,
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// =========================================
// LIGHTS
// =========================================
const hemiLight = new THREE.HemisphereLight(0xfff4e0, 0x443322, 2.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffaa44, 0.8);
fillLight.position.set(-5, 2, -5);
scene.add(fillLight);

// =========================================
// AR BUTTON
// =========================================
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
  }),
);

// =========================================
// MODEL LOADER
// =========================================
const loader = new GLTFLoader();
let currentModel = null;
let currentIndex = 0;
let isLoading = false;

function loadProduct(index) {
  if (isLoading) return;
  isLoading = true;

  const product = products[index];

  // Update UI text
  nameEl.textContent = product.name;
  priceEl.textContent = product.price;
  descriptionEl.textContent = product.description;
  orderBtn.textContent = `🛒 Order ${product.name}`;
  orderBtn.onclick = () => window.open(product.orderLink, "_blank");

  loadingEl.style.display = "block";
  updateDots();

  // Remove old model with fade-out feel (instant for now)
  if (currentModel) {
    scene.remove(currentModel);
    currentModel = null;
  }

  loader.load(
    product.model,
    (gltf) => {
      currentModel = gltf.scene;
      currentModel.scale.set(0.25, 0.25, 0.25);
      currentModel.position.set(0, -0.5, -1.5);
      currentModel.rotation.y = Math.PI / 4;
      scene.add(currentModel);
      loadingEl.style.display = "none";
      isLoading = false;
    },
    undefined,
    (err) => {
      // Graceful error: show a placeholder box instead of crashing
      console.warn("Model failed to load:", product.model, err);
      const geo = new THREE.TorusGeometry(0.18, 0.06, 16, 60);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff8c00,
        roughness: 0.4,
      });
      currentModel = new THREE.Mesh(geo, mat);
      currentModel.position.set(0, -0.5, -1.5);
      currentModel.rotation.x = Math.PI / 2;
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
renderer.setAnimationLoop(() => {
  if (currentModel) {
    currentModel.rotation.y += 0.005;
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
});

// =========================================
// INIT
// =========================================
buildDots();
loadProduct(currentIndex);
