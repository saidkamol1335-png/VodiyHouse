import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HYDRATED_ATTRIBUTE } from "./hydrated";
import { HydrationMark } from "./HydrationMark";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute(HYDRATED_ATTRIBUTE);
});

describe("HydrationMark", () => {
  it("после первого рендера на <html> появляется data-hydrated", () => {
    expect(document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(false);
    render(<HydrationMark />);
    expect(document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(true);
  });
});
