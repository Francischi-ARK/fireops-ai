import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const enterprisePoints = [
  { id: "ent-001", x: 3.2, z: -1.8 },
  { id: "ent-005", x: -3.7, z: -2.7 },
  { id: "ent-002", x: -1.2, z: 2.9 },
  { id: "ent-003", x: 4.7, z: 3.1 },
  { id: "ent-004", x: 0.8, z: 0.5 },
];

const colors = { high: 0xf04444, medium: 0xf4a62a, low: 0x2bbd86, unrated: 0x6f8391 };
let disposeScene = () => {};

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
    camera.position.set(10, 11, 13);
    camera.lookAt(0, 0, 0);
  };
  resetView();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = "twin-canvas";
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x8fb7cf, 0x071018, 1.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(8, 14, 9);
  scene.add(keyLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 20),
    new THREE.MeshStandardMaterial({ color: 0x0a1821, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(22, 22, 0x31505f, 0x172b36);
  grid.position.y = 0.012;
  scene.add(grid);

  const buildings = [
    [-6.4, -4.1, 1.4, 1.8, 1.0], [-4.5, -4.0, 1.1, 1.3, 1.8], [-2.8, -4.2, 1.6, 1.2, 0.8],
    [0.0, -4.0, 1.3, 1.6, 1.2], [2.0, -4.1, 1.1, 1.4, 2.0], [5.2, -4.0, 1.8, 1.2, 1.1],
    [-6.2, -1.4, 1.6, 1.2, 1.5], [-3.2, -1.0, 1.2, 1.8, 1.0], [-0.7, -1.8, 1.8, 1.0, 1.4],
    [2.3, -1.0, 1.4, 1.7, 1.8], [5.8, -1.1, 1.1, 1.5, 0.9], [-5.1, 1.6, 1.4, 1.4, 1.0],
    [-2.8, 2.0, 1.0, 1.8, 1.6], [0.2, 2.1, 1.6, 1.1, 0.9], [2.7, 1.9, 1.3, 1.7, 1.3],
    [5.5, 2.0, 1.5, 1.1, 1.7], [-5.9, 4.3, 1.4, 1.2, 0.9], [-3.5, 4.4, 1.8, 1.1, 1.2],
    [-0.8, 4.2, 1.2, 1.5, 1.8], [2.0, 4.1, 1.6, 1.3, 1.0], [4.9, 4.2, 1.3, 1.6, 1.4],
  ];
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x18303d, roughness: 0.72, metalness: 0.28 });
  buildings.forEach(([x, z, w, d, h]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
  });

  const interactive = [];
  const selectedId = host.dataset.selectedCompany;
  const riskLevels = Object.fromEntries((host.dataset.riskLevels || "").split(",").filter(Boolean).map((item) => item.split(":")));
  let selectedRing;
  enterprisePoints.forEach((point) => {
    const level = colors[riskLevels[point.id]] ? riskLevels[point.id] : "unrated";
    const color = colors[level];
    const selected = point.id === selectedId;
    const height = level === "high" ? 2.6 : level === "medium" ? 2.0 : 1.55;
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: selected ? 0.8 : 0.28, roughness: 0.38 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, height, 18), material);
    tower.position.set(point.x, height / 2 + 0.08, point.z);
    tower.userData.enterpriseId = point.id;
    scene.add(tower);
    interactive.push(tower);

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
    if (selectedRing && !reduceMotion) selectedRing.scale.setScalar(1 + Math.sin(time * 0.003) * 0.08);
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
