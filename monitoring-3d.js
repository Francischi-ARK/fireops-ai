import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { GLTFLoader } from "three/addons/GLTFLoader.js";

const enterprisePoints = [
  { id: "ent-001", x: 12.5, z: -6.3 }, // 皓源新能源 · 超级工厂区
  { id: "ent-002", x: 5.5, z: -6.3 }, // 瑞虎机械 · 机械厂房
  { id: "ent-003", x: 18.2, z: -6.6 }, // 安澜仓储 · 物流仓库
  { id: "ent-004", x: 2.5, z: 11.4 }, // 启明电子 · 研发办公
  { id: "ent-005", x: 6, z: 3.2 }, // 恒泽材料 · 储能罐区
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

// 能量光柱纹理：横向柔边 + 纵向顶部渐隐 + 竖向条纹（旋转时产生流动感）
const makeBeamTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const horizontal = ctx.createLinearGradient(0, 0, 64, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.32, "rgba(255,255,255,0.55)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,0.95)");
  horizontal.addColorStop(0.68, "rgba(255,255,255,0.55)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, 64, 128);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (let i = 0; i < 5; i += 1) ctx.fillRect(6 + i * 12, 0, 3, 128);
  ctx.globalCompositeOperation = "destination-in";
  const vertical = ctx.createLinearGradient(0, 0, 0, 128);
  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.35, "rgba(255,255,255,0.6)");
  vertical.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, 64, 128);
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
  scene.fog = new THREE.FogExp2(0x071018, 0.026);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const resetView = () => {
    camera.position.set(13.5, 12.5, 16.5);
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
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -24;
  keyLight.shadow.camera.right = 24;
  keyLight.shadow.camera.top = 24;
  keyLight.shadow.camera.bottom = -24;
  keyLight.shadow.camera.far = 80;
  keyLight.shadow.bias = -0.0004;
  scene.add(keyLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 36),
    new THREE.MeshStandardMaterial({ color: 0x0a1821, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(42, 42, 0x31505f, 0x172b36);
  grid.position.y = 0.012;
  scene.add(grid);

  // 园区主干道（东西向 + 南北向）与中线
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x0d2029, roughness: 0.95 });
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x3a5a68 });
  [[46, 2.6, 0, 0], [2.6, 34, -1.5, 0]].forEach(([w, d, rx, rz]) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(rx, 0.02, rz);
    road.receiveShadow = true;
    scene.add(road);
  });
  [[44, 0.09, 0, 0], [0.09, 32, -1.5, 0]].forEach(([w, d, lx, lz]) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(lx, 0.028, lz);
    scene.add(line);
  });

  // [x, z, archetype 0=厂房 1=办公楼 2=仓库 3=商业综合体 4=地标塔楼 5=储能罐区, scale, quarterTurns]
  // 大版图分区：西侧商业组团、东侧超级工厂组团、南北两翼物流配套；
  // 坐标避开 enterprisePoints 信标点位与主干道
  const buildings = [
    [-13.5, -7.5, 3, 0.095, 0], [-6.5, -8.2, 1, 0.060, 1], [-12.5, 6.8, 4, 0.065, 0],
    [-6.2, 6.5, 1, 0.058, 0], [-17.5, 3.2, 2, 0.080, 1],
    [5.5, -8.5, 0, 0.115, 0], [12.5, -8.5, 0, 0.115, 0], [18.2, -8.2, 2, 0.100, 0],
    [6, 5.5, 5, 0.120, 0], [13.5, 6, 0, 0.100, 0], [18.5, 6, 2, 0.095, 1],
    [-12, -14, 2, 0.100, 0], [-4.8, -14, 0, 0.095, 0], [7, -14, 2, 0.105, 0], [15.5, -14, 0, 0.090, 1],
    [-14, 13, 2, 0.105, 0], [-5.5, 13.5, 0, 0.090, 0], [2.5, 13, 1, 0.055, 1], [11, 13.5, 2, 0.100, 0], [18.5, 13, 5, 0.100, 0],
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
    const fallbackSize = [[2.9, 1.6, 1.2], [1.4, 1.0, 2.2], [3.8, 1.5, 0.85], [4.4, 3.0, 1.3], [1.9, 1.7, 5.0], [3.2, 2.2, 1.0]];
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
  const archetypes = ["factory", "office", "warehouse", "mall", "tower", "tanks"];
  const layoutRand = seeded(20260807);
  const loader = new GLTFLoader();
  const loadModel = (name) => new Promise((resolve) =>
    loader.load(`./assets/buildings/${name}.glb?v=2`, resolve, undefined, () => resolve(null)));
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
          node.material = node.material.clone();
          node.material.color.multiplyScalar(0.88 + layoutRand() * 0.24);
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
  const beamTexture = makeBeamTexture();
  const beacons = [];
  enterprisePoints.forEach((point, pointIndex) => {
    const level = colors[riskLevels[point.id]] ? riskLevels[point.id] : "unrated";
    const color = colors[level];
    const selected = point.id === selectedId;
    const height = (level === "high" ? 3.2 : level === "medium" ? 2.6 : 2.0) + (selected ? 0.5 : 0);
    const beacon = new THREE.Group();
    beacon.position.set(point.x, 0, point.z);

    // 隐形点击代理（透明但可被 raycast 命中）
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, height, 10),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }),
    );
    proxy.position.y = height / 2;
    proxy.userData.enterpriseId = point.id;
    beacon.add(proxy);
    interactive.push(proxy);

    // 地面光晕
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: glowTexture, color, transparent: true, opacity: selected ? 0.7 : 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    disc.scale.setScalar(selected ? 2.4 : 1.6);
    beacon.add(disc);

    // 基座环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(selected ? 0.6 : 0.42, selected ? 0.04 : 0.022, 8, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: selected ? 0.95 : 0.5, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    beacon.add(ring);

    // 扩散冲击环
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.56, 48),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }),
    );
    shock.rotation.x = -Math.PI / 2;
    shock.position.y = 0.04;
    beacon.add(shock);

    // 双层能量光柱（外层旋转流光，内层亮芯）
    const beamMaterial = (opacity) => new THREE.MeshBasicMaterial({
      map: beamTexture, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.52, height, 24, 1, true), beamMaterial(selected ? 0.5 : 0.32));
    outer.position.y = height / 2;
    beacon.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, height, 16, 1, true), beamMaterial(selected ? 0.85 : 0.6));
    inner.position.y = height / 2;
    beacon.add(inner);

    // 上升粒子
    const particleCount = 22;
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    const rand = seeded(9100 + pointIndex * 17);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = rand() * 0.34;
      const theta = rand() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = rand() * height;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
      speeds[i] = 0.25 + rand() * 0.55;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
      map: glowTexture, color, size: 0.075, transparent: true, opacity: selected ? 0.9 : 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    }));
    beacon.add(particles);

    scene.add(beacon);
    beacons.push({ outer, inner, shock, particles, speeds, height, selected, phase: pointIndex * 0.37 });
    if (selected) selectedRing = ring;
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 7;
  controls.maxDistance = 42;
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
      if (button.getAttribute("data-3d-view") === "top") camera.position.set(0, 30, 0.01);
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
      beacons.forEach((beacon) => {
        beacon.outer.rotation.y = time * 0.0006 + beacon.phase * 7;
        beacon.inner.material.opacity = (beacon.selected ? 0.75 : 0.5)
          + Math.sin(time * 0.004 + beacon.phase * 9) * 0.15;
        const cycle = (time * 0.0004 + beacon.phase) % 1;
        beacon.shock.scale.setScalar(0.8 + cycle * 2.4);
        beacon.shock.material.opacity = (1 - cycle) * (beacon.selected ? 0.85 : 0.5);
        const positions = beacon.particles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 1) {
          const y = positions.getY(i) + beacon.speeds[i] * 0.016;
          positions.setY(i, y > beacon.height ? 0 : y);
        }
        positions.needsUpdate = true;
      });
      if (selectedRing) selectedRing.scale.setScalar(1 + Math.sin(time * 0.003) * 0.08);
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
