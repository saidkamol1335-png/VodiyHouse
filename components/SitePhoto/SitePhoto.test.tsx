import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SitePhoto } from "./SitePhoto";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
afterEach(cleanup);

const photo = {
  path: "complexes/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg",
  width: 2400,
  height: 1600,
  blur: "data:image/jpeg;base64,AAAA",
  focus: { x: 0.5, y: 0.2 },
};

describe("SitePhoto", () => {
  it("фото из бакета media, кадр и место по фокусу — переменными, подпись для диктора", () => {
    render(<SitePhoto photo={photo} alt="ЖК Shodlik" frame="card" phoneFrame="phone" sizes="400px" />);
    const image = screen.getByRole("img", { name: "ЖК Shodlik" });
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(
      "https://demo.supabase.co/storage/v1/object/public/media/complexes/",
    );
    const frame = image.closest(".site-photo") as HTMLElement;
    expect(frame.style.getPropertyValue("--photo-ratio")).toBe(String(4 / 3));
    expect(frame.style.getPropertyValue("--photo-ratio-phone")).toBe(String(4 / 5));
    // Фото шире карточки: кадр по вертикали весь, фокус сверху — место 50% по горизонтали.
    expect(frame.style.getPropertyValue("--photo-position")).toMatch(/^50% /);
  });
});
