import { describe, expect, it } from "vitest";
import { parseProfileUpdate } from "./profile.js";

const rejects = (body: unknown) => {
  try {
    parseProfileUpdate(body);
  } catch (error) {
    return error as { status: number; message: string };
  }
  throw new Error("expected a 400");
};

describe("parseProfileUpdate", () => {
  it("PROF-23: a name that's sent can't be empty", () => {
    expect(rejects({ name: "   " })).toMatchObject({ status: 400 });
    expect(rejects({ name: 7 })).toMatchObject({ status: 400 });
  });

  it("PROF-23: leaving name out keeps it unchanged", () => {
    expect(parseProfileUpdate({ city: null })).toEqual({ city: null });
    expect(parseProfileUpdate({})).toEqual({});
    expect(parseProfileUpdate(null)).toEqual({});
  });

  it("PROF-23: name is up to 50 characters", () => {
    expect(parseProfileUpdate({ name: "a".repeat(50) }).name).toHaveLength(50);
    expect(rejects({ name: "a".repeat(51) })).toMatchObject({
      status: 400,
      message: "Name must be at most 50 characters",
    });
  });

  it("PROF-23: bio is optional and up to 300 characters", () => {
    expect(parseProfileUpdate({ name: "A" })).toEqual({ name: "A" });
    expect(
      parseProfileUpdate({ name: "A", bio: "б".repeat(300) }).bio,
    ).toHaveLength(300);
    expect(rejects({ name: "A", bio: "б".repeat(301) })).toMatchObject({
      status: 400,
    });
  });

  it("PROF-23: limits count characters, as the column does", () => {
    // 50 emoji are 100 UTF-16 units but 50 characters in Postgres.
    expect(() => parseProfileUpdate({ name: "⚽".repeat(50) })).not.toThrow();
    expect(() => parseProfileUpdate({ name: "😀".repeat(50) })).not.toThrow();
  });

  it("PROF-22: position is one of the four, or cleared", () => {
    for (const position of [
      "goalkeeper",
      "defender",
      "midfielder",
      "forward",
    ]) {
      expect(parseProfileUpdate({ name: "A", position }).position).toBe(
        position,
      );
    }
    expect(
      parseProfileUpdate({ name: "A", position: null }).position,
    ).toBeNull();
    expect(parseProfileUpdate({ name: "A", position: "" }).position).toBeNull();
    expect(rejects({ name: "A", position: "striker" })).toMatchObject({
      status: 400,
    });
    expect(rejects({ name: "A", position: "toString" })).toMatchObject({
      status: 400,
    });
  });

  it("PROF-24: city must be from the list", () => {
    expect(parseProfileUpdate({ name: "A", city: "Varna" }).city).toBe("Varna");
    expect(parseProfileUpdate({ name: "A", city: null }).city).toBeNull();
    expect(rejects({ name: "A", city: "Bucharest" })).toMatchObject({
      status: 400,
    });
    expect(rejects({ name: "A", city: "Other" })).toMatchObject({
      status: 400,
    });
  });

  it("PROF-21: unknown fields are ignored", () => {
    expect(
      parseProfileUpdate({ name: "A", role: "superAdmin", email: "x@y.z" }),
    ).toEqual({ name: "A" });
  });
});
