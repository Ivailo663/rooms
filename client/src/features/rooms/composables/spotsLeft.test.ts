import { describe, expect, it } from "vitest";
import { spotsLeftLabel } from "./spotsLeft";

describe("spotsLeftLabel", () => {
  it("CARD-21: counts the open spots", () => {
    expect(spotsLeftLabel(19, 22)).toBe("3 spots left");
    expect(spotsLeftLabel(0, 10)).toBe("10 spots left");
  });

  it("CARD-21: one open spot is singular", () => {
    expect(spotsLeftLabel(9, 10)).toBe("1 spot left");
  });

  it("CARD-21: a full slot reads Full squad", () => {
    expect(spotsLeftLabel(10, 10)).toBe("Full squad");
  });

  it("CARD-21: an over-full roster still reads Full squad, never negative", () => {
    expect(spotsLeftLabel(12, 10)).toBe("Full squad");
  });
});
