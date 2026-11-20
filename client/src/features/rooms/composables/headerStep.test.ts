import { describe, expect, it } from "vitest";
import { headerStep } from "./headerStep";

describe("headerStep", () => {
  it("CARD-05: a tall card is roomy, and so is an unmeasured one", () => {
    expect(headerStep(560)).toBe("roomy");
    expect(headerStep(388)).toBe("roomy");
    expect(headerStep(0)).toBe("roomy");
  });

  it("CARD-05: a little less is compact", () => {
    expect(headerStep(387)).toBe("compact");
    expect(headerStep(368)).toBe("compact");
  });

  it("CARD-05: the least is tight", () => {
    expect(headerStep(367)).toBe("tight");
    expect(headerStep(340)).toBe("tight");
  });
});
