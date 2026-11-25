import { describe, expect, it } from "vitest";
import { tileBottomText } from "./tileBottomText";

const idle = { pending: false, releasedEarly: false };

describe("tileBottomText", () => {
  it("CARD-31: join and leave say what holding does", () => {
    expect(tileBottomText({ state: "join" }, idle).text).toBe("Hold to join");
    expect(tileBottomText({ state: "leave" }, idle).text).toBe("Hold to leave");
  });

  it("CARD-33: letting go early says Keep holding, and only for join and leave", () => {
    const early = { pending: false, releasedEarly: true };
    expect(tileBottomText({ state: "join" }, early).text).toBe("Keep holding…");
    expect(tileBottomText({ state: "leave" }, early).text).toBe(
      "Keep holding…"
    );
    expect(tileBottomText({ state: "awaiting" }, early).text).toBe(
      "Awaiting approval"
    );
  });

  it("CARD-33: while in flight it reads Joining… or Leaving…, whatever else is set", () => {
    const busy = { pending: true, releasedEarly: true };
    expect(tileBottomText({ state: "join" }, busy).text).toBe("Joining…");
    expect(tileBottomText({ state: "leave" }, busy).text).toBe("Leaving…");
  });

  it("CARD-32: awaiting and declined have fixed words and icons", () => {
    expect(tileBottomText({ state: "awaiting" }, idle)).toEqual({
      text: "Awaiting approval",
      icon: "fa-user-clock",
    });
    expect(tileBottomText({ state: "declined" }, idle)).toEqual({
      text: "Not accepted",
      icon: "fa-circle-xmark",
    });
  });

  it("CARD-32: a status line carries its own label and icon, join and leave have none", () => {
    expect(
      tileBottomText(
        { state: "cantLeave", label: "Roster locked", icon: "fa-lock" },
        idle
      )
    ).toEqual({ text: "Roster locked", icon: "fa-lock" });
    expect(tileBottomText({ state: "cantJoin" }, idle).text).toBe("");
    expect(tileBottomText({ state: "join" }, idle).icon).toBeUndefined();
  });
});
