import { describe, expect, it } from "vitest";
import { headerSizeFor } from "./headerSize";

describe("headerSizeFor", () => {
  it("CARD-05: a tall card is roomy, and so is an unmeasured one", () => {
    expect(headerSizeFor(560)).toBe("roomy");
    expect(headerSizeFor(388)).toBe("roomy");
    expect(headerSizeFor(0)).toBe("roomy");
  });

  it("CARD-05: a little less is compact", () => {
    expect(headerSizeFor(387)).toBe("compact");
    expect(headerSizeFor(368)).toBe("compact");
  });

  it("CARD-05: the least is tight", () => {
    expect(headerSizeFor(367)).toBe("tight");
    expect(headerSizeFor(340)).toBe("tight");
  });
});
