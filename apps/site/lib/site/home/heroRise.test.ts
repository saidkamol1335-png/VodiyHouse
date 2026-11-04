import { describe, expect, it } from "vitest";
import {
  actFrame,
  arcDrop,
  discSize,
  driftRise,
  focusScale,
  heroLayout,
  heroPhase,
  SKYLINE,
  type HeroMeasure,
} from "./heroRise";

// Раскладка, измеренная на копии сайта (motion=full): шапка, заголовок, горизонт, «бесплатно».
const DESKTOP: Record<string, HeroMeasure> = {
  "1440×900": {
    vw: 1440,
    vh: 900,
    header: 68,
    titleTop: 178,
    titleH: 152,
    horizon: 698,
    settle: 40,
    centerRatio: 736 / 1362,
  },
  "1280×720": {
    vw: 1280,
    vh: 720,
    header: 68,
    titleTop: 158,
    titleH: 122,
    horizon: 518,
    settle: 40,
    centerRatio: 736 / 1362,
  },
  "1920×1080": {
    vw: 1920,
    vh: 1080,
    header: 68,
    titleTop: 180,
    titleH: 160,
    horizon: 878,
    settle: 40,
    centerRatio: 736 / 1362,
  },
};

describe("heroRise — раскладка колоннады", () => {
  for (const [name, input] of Object.entries(DESKTOP)) {
    const geom = heroLayout(input);
    const disc = discSize(input.vw);
    it(`${name}: в покое всё за горизонтом, в финале — целиком над ним`, () => {
      for (const box of Object.values(geom.towers)) {
        const restTop = box.top + box.riseY;
        expect(restTop).toBeGreaterThanOrEqual(
          input.horizon + arcDrop(Math.abs(box.x) + box.w / 2, disc) + 29,
        );
        expect(box.top + geom.height).toBeLessThanOrEqual(input.horizon + input.settle - 19);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.left + box.w).toBeLessThanOrEqual(input.vw);
      }
      const { center } = geom;
      const visualTop = (ty: number) =>
        center.top + center.h / 2 + ty - (center.h * center.scale) / 2;
      expect(visualTop(center.tyRest)).toBeGreaterThanOrEqual(input.horizon + 29);
      expect(visualTop(center.tyFinal) + geom.height).toBeCloseTo(geom.bottom, 3);
      expect(visualTop(center.tyFinal)).toBeGreaterThanOrEqual(
        input.header + 20 + 0.58 * input.titleH + 27,
      );
    });

    it(`${name}: центральная шире ближних, высота общая, файл не растянут`, () => {
      const near = geom.towers.l1!;
      const centerWidth = geom.center.w * geom.center.scale;
      expect(centerWidth / near.w).toBeGreaterThan(1.2);
      expect(centerWidth / near.w).toBeLessThan(1.3);
      expect(geom.center.h * geom.center.scale).toBeCloseTo(geom.height, 3);
      // Ширина картинки на «нырке» (кадр ×1/0,85 по высоте) — не больше файла 736.
      const imageWidth = Math.max(geom.center.w, (geom.center.h / 0.85) * input.centerRatio);
      expect(imageWidth).toBeLessThanOrEqual(736.5);
      expect(geom.seam).toBeCloseTo(geom.center.top + geom.center.h / 2, 3);
      expect(geom.height).toBeLessThanOrEqual(560);
    });
  }

  it("крайние — только на широком окне", () => {
    expect(heroLayout(DESKTOP["1440×900"]!).towers.l2).toBeDefined();
    expect(heroLayout(DESKTOP["1280×720"]!).towers.l2).toBeUndefined();
  });
});

describe("heroRise — такты сцены", () => {
  const input = DESKTOP["1440×900"]!;
  const geom = heroLayout(input);
  const frame = (p: number) => actFrame(p, geom, input.settle);

  it("в начале рендеры спрятаны, текст на месте, пластины сомкнуты", () => {
    const start = frame(0);
    expect(start.l1.ty).toBeCloseTo(geom.towers.l1!.riseY, 3);
    expect(start.c.ty).toBeCloseTo(geom.center.tyRest, 3);
    expect(start["out-actions"].o).toBe(1);
    expect(start["plate-top"].ty).toBeCloseTo(0, 6);
    expect(start["plate-bottom"].ty).toBeCloseTo(0, 6);
  });

  it("пауза: всё вышло целиком, видно, центральная — в размере колоннады", () => {
    const hold = frame(0.48);
    for (const slot of ["l1", "r1", "l2", "r2"] as const) {
      expect(hold[slot].ty).toBeCloseTo(0, 3);
      expect(hold[slot].o).toBe(1);
    }
    expect(hold.c.s).toBeCloseTo(geom.center.scale, 4);
    expect(hold.c.ty).toBeCloseTo(geom.center.tyFinal, 3);
    expect(hold["out-actions"].o).toBe(0);
    expect(hold.title.s).toBeCloseTo(0.58, 3);
  });

  it("«нырок»: центральная растёт до своего размера, боковые уходят", () => {
    const dived = frame(0.848);
    expect(dived.c.s).toBeCloseTo(1, 3);
    expect(dived.c.ty).toBeCloseTo(0, 3);
    expect(dived.l1.o).toBe(0);
    expect(dived.ledger.o).toBe(0);
  });

  it("раскол: пластины и половины уходят за края окна", () => {
    const end = frame(0.985);
    expect(end["plate-top"].ty).toBeLessThanOrEqual(-geom.seam);
    expect(end["plate-bottom"].ty).toBeGreaterThanOrEqual(input.vh - geom.seam);
    expect(end["half-top"].ty).toBe(end["plate-top"].ty);
  });

  it("без рывков на границах тактов", () => {
    let previous = frame(0);
    for (let step = 1; step <= 1000; step += 1) {
      const next = frame(step / 1000);
      expect(Math.abs(next.c.ty - previous.c.ty)).toBeLessThan(8);
      expect(Math.abs(next.c.s - previous.c.s)).toBeLessThan(0.01);
      expect(Math.abs(next["plate-top"].ty - previous["plate-top"].ty)).toBeLessThan(20);
      previous = next;
    }
  });

  it("стадии по доле пути", () => {
    expect(heroPhase(0)).toBe("rest");
    expect(heroPhase(0.2)).toBe("rise");
    expect(heroPhase(0.48)).toBe("hold");
    expect(heroPhase(0.6)).toBe("dive");
    expect(heroPhase(0.9)).toBe("split");
    expect(heroPhase(0.995)).toBe("through");
  });

  it("«фото фокусируется» и подъём без липкой сцены", () => {
    expect(focusScale(0, 0)).toBeCloseTo(1.06, 5);
    expect(focusScale(1, 0)).toBe(1);
    expect(driftRise(0, 0)).toBe(1);
    expect(driftRise(1, 1)).toBe(0);
  });

  it("пять рендеров, центр — первый (LCP-картинка больше не нужна, но порядок — бренд)", () => {
    expect(SKYLINE).toHaveLength(5);
    expect(SKYLINE[0]).toMatchObject({ slot: "c", render: 0, rank: 0 });
  });
});
