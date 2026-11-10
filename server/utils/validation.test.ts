import { describe, expect, it } from "vitest";
import { assertPlayerLimits } from "./validation.js";

const rejects = (min: unknown, max: unknown) =>
  expect(() => assertPlayerLimits(min, max)).toThrow(
    expect.objectContaining({ status: 400 })
  );

describe("assertPlayerLimits", () => {
  it("SLOT-17: accepts 1 ≤ min ≤ max, and an empty min", () => {
    expect(() => assertPlayerLimits(1, 1)).not.toThrow();
    expect(() => assertPlayerLimits(6, 10)).not.toThrow();
    expect(() => assertPlayerLimits(null, 10)).not.toThrow();
    expect(() => assertPlayerLimits(undefined, 10)).not.toThrow();
  });

  it("SLOT-17: rejects a max below 1 or not a whole number", () => {
    rejects(null, 0);
    rejects(null, undefined);
    rejects(null, 2.5);
    rejects(null, "10");
  });

  it("SLOT-17: rejects a min below 1, above max, or not a whole number", () => {
    rejects(0, 10);
    rejects(11, 10);
    rejects(1.5, 10);
  });
});
