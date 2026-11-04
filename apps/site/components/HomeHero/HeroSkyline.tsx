import type { CSSProperties } from "react";
import { SKYLINE, type HeroTower } from "@/lib/site/home/heroRise";
import { HERO_RENDERS, HERO_SIZES, renderSrc, renderSrcSet } from "@/lib/site/home/heroRenders";

type HeroSkylineProps = {
  /** Имя линии рендеров для диктора; подпись «иллюстративный характер» — под горизонтом. */
  label: string;
  noteId: string;
};

/**
 * Колоннада рендеров: прямоугольные рамки без скруглений, тонкая бронзовая линия по краю, центральная
 * шире. В покое все за горизонтом; прокрутка выводит их целиком, затем камера «ныряет» в центральную,
 * и она раскалывается на две половины (одна картинка — одна загрузка), открывая следующую страницу.
 * Раскладку и движение пишет useHeroScroll; без липкой сцены рамки стоят по CSS.
 */
export function HeroSkyline({ label, noteId }: HeroSkylineProps) {
  return (
    <div className="home-hero__skyline" role="img" aria-label={label} aria-describedby={noteId}>
      {SKYLINE.map((tower) =>
        tower.slot === "c" ? (
          <CenterTower key={tower.slot} tower={tower} />
        ) : (
          <SideTower key={tower.slot} tower={tower} />
        ),
      )}
    </div>
  );
}

function towerClass(tower: HeroTower): string {
  const classes = [
    "home-hero__tower",
    `home-hero__tower--${tower.slot}`,
    `home-hero__tower--rank${tower.rank}`,
  ];
  if (tower.rank === 2) classes.push("home-hero__tower--wide-only");
  return classes.join(" ");
}

function frameStyle(tower: HeroTower): CSSProperties {
  const render = HERO_RENDERS[tower.render]!;
  return {
    "--tint": render.tint,
    "--focus": render.focus,
    "--safe": tower.safeShare,
  } as CSSProperties;
}

function sizesOf(tower: HeroTower): string {
  if (tower.rank === 0) return HERO_SIZES.c;
  return tower.rank === 1 ? HERO_SIZES.side1 : HERO_SIZES.side2;
}

function RenderPicture({ tower }: { tower: HeroTower }) {
  const render = HERO_RENDERS[tower.render]!;
  const sizes = sizesOf(tower);
  return (
    <picture className="home-hero__picture">
      <source type="image/avif" srcSet={renderSrcSet(render.slug, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={renderSrcSet(render.slug, "webp")} sizes={sizes} />
      <img
        className="home-hero__img"
        src={renderSrc(render.slug)}
        width={render.width}
        height={render.height}
        alt=""
        loading={tower.rank === 2 ? "lazy" : "eager"}
        fetchPriority="low"
        decoding="async"
      />
    </picture>
  );
}

function SideTower({ tower }: { tower: HeroTower }) {
  return (
    <div className={towerClass(tower)} style={frameStyle(tower)} aria-hidden="true">
      <div className="home-hero__frame">
        <div className="home-hero__shift">
          <RenderPicture tower={tower} />
        </div>
      </div>
    </div>
  );
}

/** Центральная рамка — две половины одной картинки: по ним идёт раскол. */
function CenterTower({ tower }: { tower: HeroTower }) {
  return (
    <div className={towerClass(tower)} style={frameStyle(tower)} aria-hidden="true">
      {(["top", "bottom"] as const).map((half) => (
        <div key={half} className={`home-hero__half home-hero__half--${half}`}>
          <div className="home-hero__shift">
            <RenderPicture tower={tower} />
          </div>
        </div>
      ))}
      <span className="home-hero__edge" />
    </div>
  );
}
