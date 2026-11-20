import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useHoldPress } from "./useHoldPress";

// jsdom has no PointerEvent, and test-utils can't set `button` on the
// MouseEvent it falls back to, so build the event by hand.
const pointer = async (el: Element, type: string, button = 0) => {
  el.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
  await nextTick();
};
const key = async (el: Element, type: string, k: string, repeat = false) => {
  el.dispatchEvent(
    new KeyboardEvent(type, { key: k, repeat, bubbles: true, cancelable: true })
  );
  await nextTick();
};

const scroller = () => {
  const el = document.createElement("div");
  let left = 0;
  Object.defineProperty(el, "scrollLeft", {
    get: () => left,
    set: (v: number) => (left = v),
  });
  return el;
};

// v-on="handlers" in a template; in a render function the keys need on-prefixes.
const listeners = (handlers: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(handlers).map(([name, fn]) => [
      `on${name[0]!.toUpperCase()}${name.slice(1)}`,
      fn,
    ])
  );

const setup = (opts: { enabled?: boolean; withScroll?: boolean } = {}) => {
  const onHold = vi.fn();
  const enabled = ref(opts.enabled ?? true);
  const scrollEl = ref<HTMLElement | null>(opts.withScroll ? scroller() : null);
  let api!: ReturnType<typeof useHoldPress>;
  const w = mount(
    defineComponent({
      setup() {
        api = useHoldPress({ onHold, enabled, scrollEl });
        return () =>
          h("div", { id: "root", class: "root" }, [
            h("button", { id: "target", ...listeners(api.handlers) }),
          ]);
      },
    }),
    { attachTo: document.body }
  );
  const target = w.element.querySelector("#target")!;
  return { w, api, onHold, enabled, scrollEl, target };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useHoldPress", () => {
  it("CARD-33: fires after one second of pointer hold, not before", async () => {
    const { target, api, onHold } = setup();
    await pointer(target, "pointerdown");
    expect(api.holding.value).toBe(true);
    vi.advanceTimersByTime(999);
    expect(onHold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(api.holding.value).toBe(false);
  });

  it("CARD-33: letting go early cancels with nothing sent and shows the hint, which fades", async () => {
    const { target, api, onHold } = setup();
    await pointer(target, "pointerdown");
    vi.advanceTimersByTime(400);
    await pointer(target, "pointerup");
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
    expect(api.holding.value).toBe(false);
    expect(api.hint.value).toBe(false);

    await pointer(target, "pointerdown");
    await pointer(target, "pointerup");
    expect(api.hint.value).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(api.hint.value).toBe(false);
  });

  it("CARD-33: pointercancel and pointerleave cancel without the hint", async () => {
    const { target, api, onHold } = setup();
    for (const type of ["pointercancel", "pointerleave"]) {
      await pointer(target, "pointerdown");
      await pointer(target, type);
      vi.advanceTimersByTime(2000);
    }
    expect(onHold).not.toHaveBeenCalled();
    expect(api.hint.value).toBe(false);
  });

  it("CARD-33: a sideways scroll over 8px cancels, a smaller shift doesn't", async () => {
    const { target, api, onHold, scrollEl } = setup({ withScroll: true });
    const el = scrollEl.value!;
    await pointer(target, "pointerdown");
    el.scrollLeft = 8;
    el.dispatchEvent(new Event("scroll"));
    expect(api.holding.value).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(onHold).toHaveBeenCalledTimes(1);

    await pointer(target, "pointerdown");
    el.scrollLeft = 17;
    el.dispatchEvent(new Event("scroll"));
    expect(api.holding.value).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("CARD-33: only the primary button starts a hold", async () => {
    const { target, onHold } = setup();
    await pointer(target, "pointerdown", 2);
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
  });

  it("CARD-12: a press that starts on a nested control doesn't start a hold", async () => {
    const { target, api } = setup();
    const inner = document.createElement("button");
    target.appendChild(inner);
    await pointer(inner, "pointerdown");
    expect(api.holding.value).toBe(false);
  });

  it("CARD-34: holding Enter fires after 1s and key repeat doesn't restart it", async () => {
    const { target, onHold } = setup();
    await key(target, "keydown", "Enter");
    vi.advanceTimersByTime(600);
    await key(target, "keydown", "Enter", true);
    vi.advanceTimersByTime(400);
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("CARD-34: Space works, an early keyup cancels, and both edges are default-prevented", async () => {
    const { target, onHold, api } = setup();
    const down = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(300);
    const up = new KeyboardEvent("keyup", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(api.hint.value).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
  });

  it("CARD-34: other keys, and keys from a nested control, are ignored", async () => {
    const { target, onHold } = setup();
    await key(target, "keydown", "a");
    const inner = document.createElement("button");
    target.appendChild(inner);
    await key(inner, "keydown", "Enter");
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
  });

  it("CARD-34: losing focus mid-hold cancels without the hint", async () => {
    const { target, api, onHold } = setup();
    await key(target, "keydown", "Enter");
    target.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
    expect(api.hint.value).toBe(false);
  });

  it("CARD-34: the context menu is suppressed only while enabled", () => {
    const { target, enabled } = setup();
    const on = new Event("contextmenu", { cancelable: true, bubbles: true });
    target.dispatchEvent(on);
    expect(on.defaultPrevented).toBe(true);
    enabled.value = false;
    const off = new Event("contextmenu", { cancelable: true, bubbles: true });
    target.dispatchEvent(off);
    expect(off.defaultPrevented).toBe(false);
  });

  it("CARD-33: disabled ignores presses, and disabling mid-hold drops it", async () => {
    const { target, enabled, onHold, api } = setup({ enabled: false });
    await pointer(target, "pointerdown");
    expect(api.holding.value).toBe(false);

    enabled.value = true;
    await pointer(target, "pointerdown");
    enabled.value = false;
    await nextTick();
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
  });

  it("CARD-33: unmounting mid-hold sends nothing", async () => {
    const { w, target, onHold } = setup();
    await pointer(target, "pointerdown");
    w.unmount();
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
  });
});
