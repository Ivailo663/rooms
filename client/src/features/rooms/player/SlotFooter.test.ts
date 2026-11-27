import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import SlotFooter from "./SlotFooter.vue";

type Props = InstanceType<typeof SlotFooter>["$props"];

// jsdom has no PointerEvent, and test-utils can't set `button` on the
// MouseEvent it falls back to, so build the event by hand.
const pointer = async (el: { element: Element }, type: string, button = 0) => {
  el.element.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
  await nextTick();
};

const render = (props: Props) => mount(SlotFooter, { props });

// The hold itself is covered in useHoldPress.test.ts; these check the wiring.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CARD-35: the hub footer shows a block reason as text, never a button", () => {
  it("CARD-35: a leave block reason is a text line with its icon", () => {
    const w = render({
      state: "cantLeave",
      label: "Roster locked",
      icon: "fa-lock",
    });
    expect(w.find("button").exists()).toBe(false);
    expect(w.text()).toContain("Roster locked");
    expect(w.find("i.fa-lock").exists()).toBe(true);
  });

  it("CARD-36: the action sits alone and centred, with no slot facts beside it", () => {
    const w = render({ state: "leave" });
    expect(w.classes()).toEqual(
      expect.arrayContaining(["flex-col", "items-center", "text-center"])
    );
    expect(w.findAll("button")).toHaveLength(1);
  });
});

describe("CARD-35: hold to leave", () => {
  const leave = () => render({ state: "leave" });

  it("CARD-35: is red text with the accessible name Leave game", () => {
    const b = leave().get("button");
    expect(b.attributes("aria-label")).toBe("Leave game");
    expect(b.classes()).toContain("text-rose-500");
    expect(b.classes()).toContain("bg-transparent");
  });

  it("CARD-35: leaves after a 1s pointer hold", async () => {
    const w = leave();
    await pointer(w.get("button"), "pointerdown", 0);
    // The hub draws the wash; the footer only says the press is down.
    expect(w.emitted("holding")).toEqual([[true]]);
    vi.advanceTimersByTime(999);
    expect(w.emitted("leave")).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(w.emitted("leave")).toHaveLength(1);
  });

  it("CARD-35: releasing early cancels and sends nothing", async () => {
    const w = leave();
    await pointer(w.get("button"), "pointerdown", 0);
    vi.advanceTimersByTime(500);
    await pointer(w.get("button"), "pointerup");
    vi.advanceTimersByTime(2000);
    expect(w.emitted("leave")).toBeUndefined();
    expect(w.emitted("holding")).toEqual([[true], [false]]);
  });

  it("CARD-35: pointercancel and pointerleave cancel without the hint", async () => {
    const w = leave();
    for (const type of ["pointercancel", "pointerleave"]) {
      await pointer(w.get("button"), "pointerdown", 0);
      await pointer(w.get("button"), type);
      vi.advanceTimersByTime(2000);
    }
    expect(w.emitted("leave")).toBeUndefined();
    expect(w.emitted("holding")).toEqual([[true], [false], [true], [false]]);
    expect(w.get("button").text()).toBe("Hold to leave");
  });

  it("CARD-35: the button always reads Hold to leave, with no icon, and a short tap adds no hint", async () => {
    const w = leave();
    expect(w.get("button").text()).toBe("Hold to leave");
    expect(w.find("button i").exists()).toBe(false);

    await pointer(w.get("button"), "pointerdown", 0);
    await pointer(w.get("button"), "pointerup");
    expect(w.get("button").text()).toBe("Hold to leave");
    expect(w.emitted("leave")).toBeUndefined();
    // Nothing visible and nothing announced changes either.
    expect(w.findAll("[role='status']")).toHaveLength(1);
    expect(w.get("[role='status']").classes()).toContain("sr-only");
    vi.advanceTimersByTime(2000);
    await nextTick();
    expect(w.get("button").text()).toBe("Hold to leave");
  });

  it("CARD-35: holding Enter for 1s leaves; key repeat doesn't restart it", async () => {
    const w = leave();
    await w.get("button").trigger("keydown", { key: "Enter" });
    vi.advanceTimersByTime(600);
    await w.get("button").trigger("keydown", { key: "Enter", repeat: true });
    vi.advanceTimersByTime(400);
    expect(w.emitted("leave")).toHaveLength(1);
  });

  it("CARD-35: holding Space works, and an early keyup cancels", async () => {
    const w = leave();
    await w.get("button").trigger("keydown", { key: " " });
    vi.advanceTimersByTime(300);
    await w.get("button").trigger("keyup", { key: " " });
    vi.advanceTimersByTime(2000);
    expect(w.emitted("leave")).toBeUndefined();

    await w.get("button").trigger("keydown", { key: " " });
    vi.advanceTimersByTime(1000);
    expect(w.emitted("leave")).toHaveLength(1);
  });

  it("CARD-35: losing focus mid-hold cancels", async () => {
    const w = leave();
    await w.get("button").trigger("keydown", { key: "Enter" });
    await w.get("button").trigger("blur");
    vi.advanceTimersByTime(2000);
    expect(w.emitted("leave")).toBeUndefined();
  });

  it("CARD-35: a right-click doesn't start a hold", async () => {
    const w = leave();
    await pointer(w.get("button"), "pointerdown", 2);
    vi.advanceTimersByTime(2000);
    expect(w.emitted("leave")).toBeUndefined();
  });

  it("CARD-35: in flight there is no spinner, the button is disabled and dimmed, and can't be held", async () => {
    const w = render({ state: "leave", pending: true });
    const b = w.get("button");
    expect(b.find("i").exists()).toBe(false);
    expect(b.text()).toBe("Hold to leave");
    expect(b.attributes("disabled")).toBeDefined();
    expect(b.classes()).toContain("disabled:opacity-50");

    await pointer(b, "pointerdown", 0);
    vi.advanceTimersByTime(2000);
    expect(w.emitted("holding")).toBeUndefined();
    expect(w.emitted("leave")).toBeUndefined();
  });

  it("CARD-35: tells assistive tech about the hold", () => {
    const w = leave();
    const id = w.get("button").attributes("aria-describedby")!;
    const status = w.get(`[id="${id}"]`);
    expect(status.text()).toContain("hold for one second");
    expect(status.attributes("role")).toBe("status");
  });
});
