import {
  CanvasTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { MARK_RECTS } from "@/components/Logo/markRects";

// Модель 3D-ключа блока «Отзывы» (PLAN §10, п. 47): плоский квартирный ключ (Shape → ExtrudeGeometry
// с фаской, латунь), кольцо (TorusGeometry) и кожаная бирка в цвете бренда с тиснёным знаком
// Vodiy House (рельеф из MARK_RECTS). Свет и камера — keyScene.

/** Контур ключа: головка со скруглением и отверстием, плечико, бородка с вырезами, скошенный кончик. */
function keyShape(): Shape {
  const shape = new Shape();
  shape.moveTo(-0.6, -1);
  shape.lineTo(0.6, -1);
  shape.quadraticCurveTo(1.1, -1, 1.1, -0.5);
  shape.lineTo(1.1, -0.42);
  shape.lineTo(1.45, -0.42);
  shape.lineTo(1.45, -0.34);
  shape.lineTo(5.05, -0.34);
  shape.lineTo(5.6, 0.02);
  shape.lineTo(5.3, 0.34);
  // Вырезы бородки — от кончика к плечику.
  const cuts = [4.9, 4.4, 3.9, 3.35, 2.8, 2.25];
  const depths = [0.12, 0.24, 0.08, 0.2, 0.14, 0.22];
  cuts.forEach((x, index) => {
    shape.lineTo(x + 0.18, 0.34);
    shape.lineTo(x, 0.34 - depths[index]!);
    shape.lineTo(x - 0.18, 0.34);
  });
  shape.lineTo(1.45, 0.34);
  shape.lineTo(1.45, 0.42);
  shape.lineTo(1.1, 0.42);
  shape.lineTo(1.1, 0.5);
  shape.quadraticCurveTo(1.1, 1, 0.6, 1);
  shape.lineTo(-0.6, 1);
  shape.quadraticCurveTo(-1.1, 1, -1.1, 0.5);
  shape.lineTo(-1.1, -0.5);
  shape.quadraticCurveTo(-1.1, -1, -0.6, -1);
  const hole = new Shape();
  hole.absarc(-0.45, 0, 0.3, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function roundedRect(
  width: number,
  height: number,
  radius: number,
  hole?: { x: number; r: number },
): Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  if (hole) {
    const path = new Shape();
    path.absarc(hole.x, 0, hole.r, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  return shape;
}

/** Знак Vodiy House белым на прозрачном — альфа и рельеф тиснения. */
function markTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 592;
  canvas.height = 440;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  for (const [x, y, w, h] of MARK_RECTS) context.fillRect(x * 4, y * 4, w * 4, h * 4);
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/** Зерно кожи — мелкий шум для рельефа. */
function grainTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(128, 128);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 110 + Math.floor(Math.random() * 60);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

export type KeyModel = { pivot: Group; dispose(): void };

function keyMaterials() {
  const grain = grainTexture();
  const mark = markTexture();
  return {
    textures: [grain, mark],
    brass: new MeshPhysicalMaterial({
      color: 0xc9a25e,
      metalness: 1,
      roughness: 0.3,
      clearcoat: 0.25,
      clearcoatRoughness: 0.25,
    }),
    leather: new MeshStandardMaterial({
      color: 0x6a4a2c,
      roughness: 0.78,
      bumpMap: grain,
      bumpScale: 0.6,
    }),
    emboss: new MeshStandardMaterial({
      color: 0x4f3620,
      roughness: 0.9,
      transparent: true,
      alphaMap: mark,
      bumpMap: mark,
      bumpScale: -2,
      depthWrite: false,
    }),
  };
}

/** Ключ (с фаской), бирка, кольцо и плашка знака — по порядку. */
function keyGeometries(): BufferGeometry[] {
  const key = new ExtrudeGeometry(keyShape(), {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3,
    curveSegments: 24,
  });
  key.translate(0, 0, -0.07);
  const tag = new ExtrudeGeometry(roundedRect(2.7, 1.55, 0.32, { x: 1.1, r: 0.13 }), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 18,
  });
  tag.translate(0, 0, -0.035);
  return [key, tag, new TorusGeometry(0.7, 0.055, 18, 72), new PlaneGeometry(1.15, 0.86)];
}

/** Ключ, кольцо и бирка в общей оси (x — вдоль ключа): pivot поворачивает их вместе. */
export function buildKey(): KeyModel {
  const { textures, brass, leather, emboss } = keyMaterials();
  const geometries = keyGeometries();
  const [keyGeometry, tagGeometry, ringGeometry, logoGeometry] = geometries;
  const ring = new Mesh(ringGeometry, brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-1.15, 0, 0);
  const tag = new Mesh(tagGeometry, leather);
  // Отверстие бирки (x = 1,1) — на левой точке кольца (−1,85): кольцо проходит сквозь него.
  tag.position.set(-2.95, 0, 0);
  const logo = new Mesh(logoGeometry, emboss);
  logo.position.set(-3.15, 0, 0.065);
  const model = new Group();
  model.add(new Mesh(keyGeometry, brass), ring, tag, logo);
  // Центр масс левее головки: ключ с биркой — от −4,5 до 5,6 по оси.
  model.position.x = -0.5;
  const pivot = new Group();
  pivot.add(model);
  const materials: Material[] = [brass, leather, emboss];
  const all: Texture[] = textures;
  return {
    pivot,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      all.forEach((texture) => texture.dispose());
    },
  };
}
