import { describe, it, expect } from "vitest";
import {
  POSITIONS,
  bioError,
  initials,
  memberSince,
  nameError,
  needsTermsTick,
  positionLabel,
} from "./profileRules";

describe("profile rules", () => {
  it("PROF-23: a name is required and at most 50 characters", () => {
    expect(nameError("")).toBe("Name is required");
    expect(nameError("   ")).toBe("Name is required");
    expect(nameError("a".repeat(50))).toBeNull();
    expect(nameError("a".repeat(51))).toBe(
      "Name must be at most 50 characters"
    );
  });

  it("PROF-23: limits count characters, not UTF-16 units, like the server", () => {
    expect(nameError("⚽".repeat(50))).toBeNull();
    expect(bioError("⚽".repeat(300))).toBeNull();
    expect(bioError("⚽".repeat(301))).toBe(
      "Bio must be at most 300 characters"
    );
  });

  it("PROF-23: a bio is optional and at most 300 characters", () => {
    expect(bioError("")).toBeNull();
    expect(bioError("b".repeat(300))).toBeNull();
    expect(bioError("b".repeat(301))).not.toBeNull();
  });

  it("PROF-22: the four positions, and nothing else has a label", () => {
    expect(POSITIONS.map((p) => p.value)).toEqual([
      "goalkeeper",
      "defender",
      "midfielder",
      "forward",
    ]);
    expect(positionLabel("defender")).toBe("Defender");
    expect(positionLabel(null)).toBeNull();
  });

  it("PROF-25: a player without a picture shows up to two initials", () => {
    expect(initials("Ana Petrova")).toBe("AP");
    expect(initials("boris")).toBe("B");
    expect(initials("Ana Maria Petrova")).toBe("AM");
    expect(initials("  ")).toBe("?");
  });

  it("PROF-20: member since is the month and year", () => {
    expect(memberSince(new Date(2025, 2, 14))).toBe("Mar 2025");
    expect(memberSince(new Date(2025, 2, 14).toISOString())).toBe("Mar 2025");
  });

  it("AUTH-24: no account, or an account without the tick, needs the checkbox", () => {
    expect(needsTermsTick(null)).toBe(true);
    expect(needsTermsTick({ terms_accepted_at: null })).toBe(true);
    expect(
      needsTermsTick({
        terms_accepted_at: "2026-11-13T10:00:00.000Z" as unknown as Date,
      })
    ).toBe(false);
  });
});
