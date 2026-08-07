import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { GLTFLoader } from "three/addons/GLTFLoader.js";

const enterprisePoints = [
  { id: "ent-001", x: 3.2, z: -1.8 },
  { id: "ent-005", x: -3.7, z: -2.7 },
  { id: "ent-002", x: -1.2, z: 2.9 },
  { id: "ent-003", x: 4.7, z: 3.1 },
  { id: "ent-004", x: 0.8, z: 0.5 },
];

const colors = { high: 0xf04444, medium: 0xf4a62a, low: 0x2bbd86, unrated: 0x6f8391 };
let disposeScene = () => {};

// deterministic pseudo-random so screenshots stay reproducible
const seeded = (seed) => {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const makeFacadeTexture = (baseColor, litRatio, seed) => {
  const rand = seeded(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 7; y < 122; y += 11) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rand() < litRatio;
      ctx.fillStyle = lit ? "rgba(255, 214, 150, 0.92)" : "rgba(126, 176, 205, 0.22)";
      ctx.fillRect(x, y, 6, 7);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const makeGlowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

function buildScene() {
  disposeScene();
  const host = document.querySelector("#monitoring-3d");
  if (!host) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    host.classList.add("no-webgl");
    host.querySelector(".twin-loading").textContent = "当前设备无法启动 WebGL，业务数据仍可在右侧查看";
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071018);
  scene.fog = new THREE.FogExp2(0x071018, 0.042);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const resetView = () => {
    camera.position.set(8.6, 8.2, 10.8);
    camera.lookAt(0, 0, 0);
  };
  resetView();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = "twin-canvas";
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x9cc3d9, 0x0a141c, 1.9));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(8, 14, 9);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.camera.far = 45;
  keyLight.shadow.bias = -0.0004;
  scene.add(keyLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 20),
    new THREE.MeshStandardMaterial({ color: 0x0a1821, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(22, 22, 0x31505f, 0x172b36);
  grid.position.y = 0.012;
  scene.add(grid);

  // [x, z, archetype 0=厂房 1=办公楼 2=仓库, scale, quarterTurns]
  // 围绕三类 Blender 资产的真实比例手工排布的园区布局，
  // 并避开 enterprisePoints 的风险塔位置
  const buildings = [
    [-7.2, -5.6, 2, 0.108, 0], [-2.6, -5.6, 0, 0.082, 0], [2.4, -5.6, 2, 0.100, 0], [7.0, -5.6, 0, 0.088, 0],
    [-7.4, -2.0, 0, 0.078, 0], [-3.0, -1.9, 1, 0.058, 0], [0.9, -2.0, 2, 0.092, 0], [6.6, -1.9, 1, 0.054, 1],
    [-7.0, 1.6, 1, 0.060, 1], [-2.4, 1.7, 2, 0.104, 0], [2.2, 1.6, 0, 0.084, 0], [7.0, 1.7, 2, 0.096, 1],
    [-6.4, 5.2, 0, 0.086, 0], [-1.4, 5.3, 2, 0.110, 0], [3.2, 5.2, 1, 0.062, 0], [7.6, 5.2, 0, 0.080, 1],
  ];
  const facadeVariants = [
    { base: "#22404f", lit: 0.34 },
    { base: "#1a3040", lit: 0.24 },
    { base: "#29495a", lit: 0.44 },
  ].map(({ base, lit }, index) => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: makeFacadeTexture(base, lit, 97 + index * 13),
    roughness: 0.68,
    metalness: 0.24,
  }));
  const placeFallbackBoxes = () => {
    const fallbackSize = [[2.9, 1.6, 1.2], [1.4, 1.0, 2.2], [3.8, 1.5, 0.85]];
    buildings.forEach(([x, z, which, , quarter], index) => {
      const [w, d, h] = fallbackSize[which];
      const swap = quarter % 2 === 1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(swap ? d : w, h, swap ? w : d),
        facadeVariants[index % facadeVariants.length],
      );
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });
  };

  // Blender 生成的建筑资产（assets/buildings/generate_buildings.py 可复现）；
  // 加载失败时退化为程序化方块，保证演示不空场
  const archetypes = ["factory", "office", "warehouse"];
  const loader = new GLTFLoader();
  const loadModel = (name) => new Promise((resolve) =>
    loader.load(`./assets/buildings/${name}.glb?v=1`, resolve, undefined, () => resolve(null)));
  Promise.all(archetypes.map(loadModel)).then((gltfs) => {
    if (gltfs.some((gltf) => !gltf)) {
      placeFallbackBoxes();
      return;
    }
    buildings.forEach(([x, z, which, scale, quarter]) => {
      const instance = gltfs[which].scene.clone(true);
      instance.scale.setScalar(scale);
      instance.rotation.y = quarter * Math.PI / 2;
      instance.position.set(x, 0, z);
      instance.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(instance);
    });
  });

  const interactive = [];
  const selectedId = host.dataset.selectedCompany;
  const riskLevels = Object.fromEntries((host.dataset.riskLevels || "").split(",").filter(Boolean).map((item) => item.split(":")));
  let selectedRing;
  const glowTexture = makeGlowTexture();
  const towerPulses = [];
  enterprisePoints.forEach((point) => {
    const level = colors[riskLevels[point.id]] ? riskLevels[point.id] : "unrated";
    const color = colors[level];
    const selected = point.id === selectedId;
    const height = level === "high" ? 2.6 : level === "medium" ? 2.0 : 1.55;
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: selected ? 0.8 : 0.28, roughness: 0.38 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, height, 18), material);
    tower.position.set(point.x, height / 2 + 0.08, point.z);
    tower.castShadow = true;
    tower.userData.enterpriseId = point.id;
    scene.add(tower);
    interactive.push(tower);
    towerPulses.push({ material, base: selected ? 0.8 : 0.28, selected });

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity: selected ? 0.75 : 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(selected ? 1.7 : 1.15);
    glow.position.set(point.x, height + 0.3, point.z);
    scene.add(glow);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(selected ? 0.72 : 0.48, selected ? 0.045 : 0.025, 8, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: selected ? 0.95 : 0.48 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, 0.08, point.z);
    scene.add(ring);
    if (selected) selectedRing = ring;
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 7;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.48;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart = null;
  const selectAt = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (hit) window.dispatchEvent(new CustomEvent("fireguard:enterprise-selected", { detail: { id: hit.object.userData.enterpriseId } }));
  };
  const pointerDown = (event) => { pointerStart = [event.clientX, event.clientY]; };
  const pointerUp = (event) => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) < 5) selectAt(event);
    pointerStart = null;
  };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointerup", pointerUp);

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const viewHandlers = [...document.querySelectorAll("[data-3d-view]")].map((button) => {
    const handler = () => {
      if (button.getAttribute("data-3d-view") === "top") camera.position.set(0, 18, 0.01);
      else resetView();
      controls.target.set(0, 0.7, 0);
      controls.update();
    };
    button.addEventListener("click", handler);
    return [button, handler];
  });

  host.querySelector(".twin-loading")?.remove();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setAnimationLoop((time) => {
    if (!reduceMotion) {
      if (selectedRing) selectedRing.scale.setScalar(1 + Math.sin(time * 0.003) * 0.08);
      towerPulses.forEach(({ material, base, selected }, index) => {
        const wave = Math.sin(time * 0.002 + index * 1.3) * (selected ? 0.25 : 0.1);
        material.emissiveIntensity = base + wave;
      });
    }
    controls.update();
    renderer.render(scene, camera);
  });

  disposeScene = () => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener("pointerdown", pointerDown);
    renderer.domElement.removeEventListener("pointerup", pointerUp);
    viewHandlers.forEach(([button, handler]) => button.removeEventListener("click", handler));
    controls.dispose();
    renderer.dispose();
  };
}

console.assert(enterprisePoints.length === 5, "3D monitoring scene must include five demo enterprises");
window.addEventListener("fireguard:route-rendered", buildScene);
buildScene();
