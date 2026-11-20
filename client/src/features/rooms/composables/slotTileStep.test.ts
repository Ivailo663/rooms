import { describe, expect, it } from "vitest";
import {
  MIN_SIDE,
  PICKER_FLOOR,
  PICKER_NOTE,
  STRIP_PADDING_Y,
  avatarCap,
  tileStep,
} from "./slotTileStep";

describe("tileStep", () => {
  it("CARD-17: a big square is roomy, and so is an unmeasured one", () => {
    expect(tileStep(300)).toBe("roomy");
    expect(tileStep(210)).toBe("roomy");
    expect(tileStep(0)).toBe("roomy");
  });

  it("CARD-17: a little smaller is compact", () => {
    expect(tileStep(209)).toBe("compact");
    expect(tileStep(180)).toBe("compact");
  });

  it("CARD-17: the smallest is tight, and only tight caps the avatars at 3", () => {
    expect(tileStep(179)).toBe("tight");
    expect(tileStep(MIN_SIDE)).toBe("tight");
    expect(avatarCap("tight")).toBe(3);
    expect(avatarCap("compact")).toBeUndefined();
    expect(avatarCap("roomy")).toBeUndefined();
  });

  it("CARD-06: the picker never reserves less than the smallest square plus the strip's padding", () => {
    expect(PICKER_FLOOR).toBe(MIN_SIDE + STRIP_PADDING_Y);
    expect(PICKER_NOTE).toBeGreaterThan(0);
  });
});
