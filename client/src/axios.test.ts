import { describe, it, expect } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import { errorMessage } from "./axios";

const failed = (data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400,
    data,
  } as AxiosResponse);

describe("errorMessage", () => {
  it("SLOT-18: uses the server's plain-text message", () => {
    expect(errorMessage(failed("max_players must be at least 1"), "x")).toBe(
      "max_players must be at least 1"
    );
  });

  it("SLOT-18: falls back when there's no message to show", () => {
    expect(errorMessage(failed(""), "fallback")).toBe("fallback");
    expect(errorMessage(failed({ message: "json" }), "fallback")).toBe(
      "fallback"
    );
    expect(errorMessage(new Error("network"), "fallback")).toBe("fallback");
  });
});
