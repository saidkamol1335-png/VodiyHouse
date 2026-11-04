import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildKey } from "./keyModel";

/**
 * Сцена 3D-ключа блока «Отзывы» (PLAN §10, п. 47; Motion Kit №16): модель — keyModel; тёплый
 * ключевой свет сверху и контровой сзади (ребро светится), отражения — RoomEnvironment через PMREM,
 * без HDR; DPR ≤ 1,75. Грузится динамическим импортом только в full и у блока.
 */
export type KeyScene = {
  /** Указатель −1…1: отклик ±4°. */
  setPointer(x: number, y: number): void;
  resize(width: number, height: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

/**
 * progress — прогресс секции 0…1: поворот вокруг оси ключа (анфас → ребро → обратная сторона);
 * lock — финал 0…1: поворот на 90°, как в замке. Сцена читает их сама каждый кадр (их пишет GSAP).
 */
export type KeyPose = { progress: number; lock: number };

const MAX_DPR = 1.75;
const TILT = -0.14;
const POINTER = (4 * Math.PI) / 180;
const LERP = 0.05;

function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.95;
  const keyLight = new DirectionalLight(0xffe2b8, 2.4);
  keyLight.position.set(2, 6, 5);
  const rim = new DirectionalLight(0xfff0d8, 3.2);
  rim.position.set(-4, 1.5, -6);
  scene.add(keyLight, rim, new HemisphereLight(0xfff6ea, 0x3a2a1c, 0.35));
  const dispose = () => {
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
  return { renderer, scene, dispose };
}

/** Цикл rAF; data-running — метка для e2e (рендер стоит вне экрана). */
function renderLoop(render: () => void, canvas: HTMLCanvasElement) {
  let frame = 0;
  let running = false;
  const tick = () => {
    if (!running) return;
    render();
    frame = requestAnimationFrame(tick);
  };
  return {
    start() {
      if (running) return;
      running = true;
      canvas.dataset.running = "1";
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      canvas.dataset.running = "0";
      cancelAnimationFrame(frame);
    },
  };
}

/** Ключ (≈10,5 по ширине) — в ширину колонки с полями, но не крупнее, чем по высоте. */
function fitCamera(camera: PerspectiveCamera, width: number, height: number) {
  camera.aspect = width / Math.max(1, height);
  const fit = 12.5 / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
  camera.position.z = Math.max(fit, 15);
  camera.updateProjectionMatrix();
}

export function createKeyScene(canvas: HTMLCanvasElement, read: () => KeyPose): KeyScene {
  const { renderer, scene, dispose } = createRenderer(canvas);
  const model = buildKey();
  scene.add(model.pivot);
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 24);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const started = performance.now();

  const pose = () => {
    pointer.x += (pointer.tx - pointer.x) * LERP;
    pointer.y += (pointer.ty - pointer.y) * LERP;
    const sway = Math.sin((performance.now() - started) * 0.0008) * 0.035;
    const { progress, lock } = read();
    const turn = progress * Math.PI + lock * (Math.PI / 2);
    model.pivot.rotation.set(
      turn + pointer.y * POINTER,
      pointer.x * POINTER + sway * 0.6,
      TILT + sway,
    );
    renderer.render(scene, camera);
    // Поворот — метка для e2e (CSS её не читает); пишется, только когда заметно изменился.
    const label = turn.toFixed(2);
    if (canvas.dataset.turn !== label) canvas.dataset.turn = label;
  };
  const loop = renderLoop(pose, canvas);

  return {
    setPointer(x, y) {
      pointer.tx = x;
      pointer.ty = y;
    },
    resize(width, height) {
      // Канвас скрыт или ещё не размечен — нулевой размер не рисуем (камера ушла бы в бесконечность).
      if (width === 0 || height === 0) return;
      fitCamera(camera, width, height);
      renderer.setSize(width, height, false);
      pose();
    },
    start: loop.start,
    stop: loop.stop,
    dispose() {
      loop.stop();
      model.dispose();
      dispose();
    },
  };
}
