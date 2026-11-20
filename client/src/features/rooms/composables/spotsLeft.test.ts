import { describe, expect, it } from "vitest";
import { spotsLeftLabel, spotsLeftTone } from "./spotsLeft";

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

describe("spotsLeftTone", () => {
  it("CARD-19: three or more spots left is plenty", () => {
    expect(spotsLeftTone(7, 10)).toBe("plenty");
    expect(spotsLeftTone(0, 10)).toBe("plenty");
  });

  it("CARD-19: one or two spots left is few", () => {
    expect(spotsLeftTone(8, 10)).toBe("few");
    expect(spotsLeftTone(9, 10)).toBe("few");
  });

  it("CARD-19: a full or over-full squad is full", () => {
    expect(spotsLeftTone(10, 10)).toBe("full");
    expect(spotsLeftTone(12, 10)).toBe("full");
  });
});
