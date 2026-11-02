import { describe, expect, it } from "vitest";
import { photoFrameVars, type SitePhotoData } from "./photo";

const wide: SitePhotoData = { path: "complexes/a/b.jpg", width: 2400, height: 1200, blur: null, focus: { x: 0.8, y: 0.5 } };

describe("photoFrameVars", () => {
  it("кадр карточки 4:3 по точке фокуса справа", () => {
    expect(photoFrameVars(wide, "card")).toEqual({ "--photo-ratio": String(4 / 3), "--photo-position": "100% 50%" });
  });

  it("на телефоне другой кадр — своя пара переменных", () => {
    const vars = photoFrameVars(wide, "cover", "phone");
    expect(vars["--photo-ratio"]).toBe(String(16 / 9));
    expect(vars["--photo-ratio-phone"]).toBe(String(4 / 5));
    expect(vars["--photo-position-phone"]).toBe("100% 50%");
  });

  it("тот же кадр на телефоне — без лишних переменных", () => {
    expect(Object.keys(photoFrameVars(wide, "card", "card"))).toEqual(["--photo-ratio", "--photo-position"]);
  });
});
