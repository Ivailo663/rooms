import { describe, expect, it } from "vitest";
import {
  MIN_TILE_HEIGHT,
  PICKER_FLOOR,
  PICKER_NOTE,
  STRIP_PADDING_Y,
  avatarCap,
  tileSizeFor,
} from "./tileSize";

describe("tileSizeFor", () => {
  it("CARD-17: a big tile is roomy, and so is an unmeasured one", () => {
    expect(tileSizeFor(300)).toBe("roomy");
    expect(tileSizeFor(210)).toBe("roomy");
    expect(tileSizeFor(0)).toBe("roomy");
  });

  it("CARD-17: a little smaller is compact", () => {
    expect(tileSizeFor(209)).toBe("compact");
    expect(tileSizeFor(180)).toBe("compact");
  });

  it("CARD-17: the smallest is tight, and only tight caps the avatars at 3", () => {
    expect(tileSizeFor(179)).toBe("tight");
    expect(tileSizeFor(MIN_TILE_HEIGHT)).toBe("tight");
    expect(avatarCap("tight")).toBe(3);
    expect(avatarCap("compact")).toBeUndefined();
    expect(avatarCap("roomy")).toBeUndefined();
  });

  it("CARD-06: the picker never reserves less than the shortest tile plus the strip's padding", () => {
    expect(PICKER_FLOOR).toBe(MIN_TILE_HEIGHT + STRIP_PADDING_Y);
    expect(PICKER_NOTE).toBeGreaterThan(0);
  });
});
