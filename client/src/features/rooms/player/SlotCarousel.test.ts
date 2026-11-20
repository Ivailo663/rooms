import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

// jsdom does no layout, so the strip's size is whatever the test says.
const stripWidth = ref(0);
const stripHeight = ref(0);
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useElementSize: () => ({ width: stripWidth, height: stripHeight }),
}));
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));

import SlotCarousel from "./SlotCarousel.vue";

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}` }));

const slot = (
  id: number,
  taken: number,
  max: number,
  features: unknown = []
) => ({
  id,
  label: `${10 + id}:00`,
  max_players: max,
  players: players(taken),
  features,
});

type Props = InstanceType<typeof SlotCarousel>["$props"];

let wrapper: VueWrapper | undefined;
const mountCarousel = (timeslots: unknown[], props: Partial<Props> = {}) => {
  wrapper = mount(SlotCarousel, {
    props: { timeslots, ...props } as Props,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
  return wrapper;
};

const tiles = (w: VueWrapper) => w.findAll(".slot-tile");

// A wide strip, so the height decides the square; its side is the strip's
// height less the 24px of vertical padding.
const setSide = (side: number) => {
  stripWidth.value = 1000;
  stripHeight.value = side + 24;
};

beforeEach(() => {
  stripWidth.value = 0;
  stripHeight.value = 0;
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("SlotCarousel seat bar", () => {
  it("CARD-15: one segment per seat, filled for each taken seat", () => {
    const [tile] = tiles(mountCarousel([slot(1, 3, 10)]));
    const seats = tile!.findAll("[data-filled]");
    expect(seats).toHaveLength(10);
    expect(
      seats.filter((s) => s.attributes("data-filled") === "true")
    ).toHaveLength(3);
    expect(seats[2]!.classes()).toContain("bg-emerald-500");
    expect(seats[3]!.classes()).not.toContain("bg-emerald-500");
  });

  it("CARD-15: up to 14 seats still get segments, above that the bar is continuous", () => {
    const w = mountCarousel([slot(1, 5, 14), slot(2, 5, 15)]);
    const [fourteen, fifteen] = tiles(w);
    expect(fourteen!.findAll("[data-filled]")).toHaveLength(14);
    expect(fifteen!.findAll("[data-filled]")).toHaveLength(0);
    expect(fifteen!.find("[data-seat-bar]").exists()).toBe(true);
  });

  it("CARD-15: a full slot's bar is grey, not emerald", () => {
    const w = mountCarousel([slot(1, 4, 4), slot(2, 20, 20)]);
    for (const tile of tiles(w)) {
      expect(tile.find("[data-seat-bar] .bg-surface-400").exists()).toBe(true);
      expect(tile.find("[data-seat-bar] .bg-emerald-500").exists()).toBe(false);
    }
  });

  it("CARD-15: the joined and pending dots stay", () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)], {
      markers: { 1: "joined", 2: "pending" },
    });
    const [joined, pending] = tiles(w);
    expect(joined!.find(".bg-emerald-400.absolute").exists()).toBe(true);
    expect(pending!.find(".bg-amber-400.absolute").exists()).toBe(true);
  });

  it("CARD-15: the dot sits in the top-left corner at every step", () => {
    for (const side of [240, 190, 150]) {
      setSide(side);
      const w = mountCarousel([slot(1, 1, 10)], { markers: { 1: "joined" } });
      const dot = tiles(w)[0]!.find(".bg-emerald-400.absolute");
      expect(dot.classes().some((c) => c.startsWith("left-"))).toBe(true);
      expect(dot.classes().some((c) => c.startsWith("right-"))).toBe(false);
      w.unmount();
    }
  });
});

describe("SlotCarousel spots left", () => {
  const labelOf = (w: VueWrapper, index: number) => {
    const tile = tiles(w)[index]!;
    return tile
      .findAll("span")
      .find((s) => /^(\d+ spots? left|Full squad)$/.test(s.text()));
  };

  it("CARD-19: emerald with 3+ left, amber with 1-2, grey when full", () => {
    const w = mountCarousel([
      slot(1, 7, 10),
      slot(2, 8, 10),
      slot(3, 9, 10),
      slot(4, 10, 10),
    ]);
    expect(labelOf(w, 0)!.classes()).toContain("text-emerald-700");
    expect(labelOf(w, 1)!.classes()).toContain("text-amber-700");
    expect(labelOf(w, 2)!.classes()).toContain("text-amber-700");
    expect(labelOf(w, 3)!.classes()).toContain("text-surface-500");
  });
});

describe("SlotCarousel tiles", () => {
  it("CARD-10: the centred tile is a plain white card, neighbours a flatter one with a hairline", () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)]);
    // measure() has no layout to read in jsdom, so tile 0 is the centred one.
    const [current, neighbour] = tiles(w);
    expect(current!.classes()).toContain("slot-tile--current");
    expect(neighbour!.classes()).toContain("slot-tile--side");
    expect(neighbour!.classes()).toContain("border");
    for (const tile of [current!, neighbour!]) {
      expect(tile.element.querySelectorAll("[class*='slot-rim']")).toHaveLength(
        0
      );
    }
  });

  it("CARD-10: every tile is a square, the smaller of 86% of the strip's width and its height", () => {
    // Height-bound: 300 high leaves 276 after the strip's padding.
    stripWidth.value = 400;
    stripHeight.value = 300;
    const tall = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)]);
    for (const tile of tiles(tall)) {
      expect(tile.attributes("style")).toContain("width: 276px");
      expect(tile.attributes("style")).toContain("height: 276px");
    }
    // The free width is split evenly, so the first and last square can centre.
    expect(tall.find(".slot-strip").attributes("style")).toContain(
      "padding-inline: 62px"
    );
    tall.unmount();

    // Width-bound: 86% of 300 is 258, which is less than the height allows.
    stripWidth.value = 300;
    stripHeight.value = 500;
    const narrow = mountCarousel([slot(1, 1, 10)]);
    expect(tiles(narrow)[0]!.attributes("style")).toContain("width: 258px");
    expect(tiles(narrow)[0]!.attributes("style")).toContain("height: 258px");
  });

  it("CARD-10: resizing re-centres the selected tile on the new side", async () => {
    setSide(240);
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)]);
    await nextTick();
    const scrollTo = vi.mocked(Element.prototype.scrollTo);
    scrollTo.mockClear();
    stripWidth.value = 600;
    await nextTick();
    await nextTick();
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" })
    );
    w.unmount();
  });

  it("CARD-18: the strip never scrolls vertically", () => {
    const w = mountCarousel([slot(1, 1, 10)]);
    expect(w.find(".slot-strip").classes()).toContain("overflow-y-hidden");
  });
});

describe("SlotCarousel steps", () => {
  const buttons = (w: VueWrapper) => tiles(w)[0]!.findAll("button");

  it("CARD-17: with room, every avatar shows at full size", () => {
    setSide(240);
    const w = mountCarousel([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-step")).toBe("roomy");
    expect(buttons(w)).toHaveLength(6);
    expect(buttons(w)[0]!.attributes("style")).toContain("width: 32px");
  });

  it("CARD-17: compact shrinks the avatars but keeps them all", () => {
    setSide(190);
    const w = mountCarousel([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-step")).toBe("compact");
    expect(buttons(w)).toHaveLength(6);
    expect(buttons(w)[0]!.attributes("style")).toContain("width: 28px");
  });

  it("CARD-17: tight shows at most 3 avatars, then a +N that isn't a button", () => {
    setSide(175);
    const w = mountCarousel([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-step")).toBe("tight");
    expect(buttons(w)).toHaveLength(3);
    const more = tiles(w)[0]!.find('li[aria-label="3 more players"]');
    expect(more.text()).toBe("+3");
    expect(more.element.querySelector("button")).toBeNull();
  });

  it("CARD-17: tight with 3 or fewer players shows no +N", () => {
    setSide(175);
    const w = mountCarousel([slot(1, 3, 10)]);
    expect(buttons(w)).toHaveLength(3);
    expect(tiles(w)[0]!.find("li[aria-label$='more players']").exists()).toBe(
      false
    );
  });

  it("CARD-17: the step follows the square's side, not the strip's height", () => {
    // Plenty of height, but a narrow strip makes the square small.
    stripWidth.value = 200;
    stripHeight.value = 600;
    const w = mountCarousel([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-step")).toBe("tight");
  });
});

describe("SlotCarousel keyboard", () => {
  it("PROF-02: only the centred tile's avatars are reachable by Tab, so focus never scrolls the strip to another slot", async () => {
    const w = mountCarousel([slot(1, 2, 10), slot(2, 2, 10), slot(3, 2, 10)]);
    const tabindexes = (i: number) => {
      const tile = tiles(w)[i]!;
      return tile.findAll("button").map((b) => b.attributes("tabindex"));
    };
    expect(tabindexes(0)).toEqual([undefined, undefined]);
    expect(tabindexes(1)).toEqual(["-1", "-1"]);
    expect(tabindexes(2)).toEqual(["-1", "-1"]);
  });

  it("CARD-12: a side tile's avatars still take taps while out of the Tab order", async () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)]);
    const side = tiles(w)[1]!.find("button");
    expect(side.attributes("tabindex")).toBe("-1");
    await side.trigger("click");
    expect(document.querySelector("[data-player-details-card]")).not.toBeNull();
  });
});

describe("SlotCarousel features", () => {
  const chipNames = (tile: ReturnType<typeof tiles>[number]) =>
    tile.findAll("[data-features] > span").map((c) => c.text());

  it("CARD-11: each tile shows its own slot's features in a top row, right-aligned, wrapping only on overflow", () => {
    const w = mountCarousel([
      slot(1, 2, 10, ["ball", "showers"]),
      slot(2, 2, 10, ["parking"]),
    ]);
    const [first, second] = tiles(w);
    expect(chipNames(first!)).toEqual(["ball", "showers"]);
    expect(chipNames(second!)).toEqual(["parking"]);
    const group = first!.find("[data-features]");
    // Natural wrapping (no fixed per-row cap), lines left-aligned.
    expect(group.classes()).toEqual(
      expect.arrayContaining(["flex-wrap", "justify-start"])
    );
    expect(group.classes().some((c) => c.startsWith("max-w"))).toBe(false);
    // The row holding it right-aligns a single line in the corner.
    expect(group.element.parentElement!.classList).toContain("justify-end");
    // In the flow before the time, so the time centres in what is left.
    expect(first!.find(".slot-time [data-features]").exists()).toBe(false);
    const html = first!.html();
    expect(html.indexOf("data-features")).toBeLessThan(
      html.indexOf("data-time")
    );
    expect(first!.find("[data-time]").text()).toBe("11:00");
    expect(group.find("i").classes()).toContain("fa-futbol");
  });

  it("CARD-11: no features, null or a non-list shows no chip row and doesn't throw", () => {
    const w = mountCarousel([
      slot(1, 1, 10, []),
      slot(2, 1, 10, null),
      slot(3, 1, 10, "ball"),
    ]);
    for (const tile of tiles(w)) {
      expect(tile.find("[data-features]").exists()).toBe(false);
    }
  });

  it("CARD-04: nothing on the tiles has a dark fill", () => {
    const w = mountCarousel([
      slot(1, 1, 10, ["ball"]),
      slot(2, 1, 10, ["ball"]),
    ]);
    const [current, side] = tiles(w);
    expect(current!.find("[data-features] > span").classes()).toContain(
      "slot-chip"
    );
    expect(side!.find("[data-features] > span").classes()).toContain(
      "bg-surface-900/5"
    );
    expect(w.html()).not.toMatch(/bg-(surface|slate|gray)-(700|800|900)(?!\/)/);
  });

  it("CARD-17: the features are icon-only at every step, each still named for screen readers", () => {
    const features = ["ball", "water"];
    for (const side of [240, 190, 150]) {
      setSide(side);
      const w = mountCarousel([slot(1, 1, 10, features)]);
      const names = w.findAll("[data-features] > span > span");
      expect(names.map((n) => n.text())).toEqual(features);
      for (const n of names) expect(n.classes()).toContain("sr-only");
      for (const icon of w.findAll("[data-features] i")) {
        expect(icon.attributes("aria-hidden")).toBe("true");
      }
      w.unmount();
    }
  });

  it("CARD-11: the tile's accessible name lists its features", () => {
    const w = mountCarousel(
      [slot(1, 3, 10, ["ball", "showers"]), slot(2, 3, 10, [])],
      { markers: { 11: "joined" } as never }
    );
    const [first, second] = tiles(w);
    expect(first!.attributes("aria-label")).toBe(
      "11:00, 3 of 10 players, features: ball, showers"
    );
    expect(second!.attributes("aria-label")).toBe("12:00, 3 of 10 players");
  });
});

describe("SlotCarousel slot action", () => {
  const line = (w: VueWrapper, index = 0) =>
    tiles(w)[index]!.find(".slot-hint");
  const press = (w: VueWrapper) => w.find(".slot-press");
  // jsdom has no PointerEvent, and test-utils can't set `button` on the
  // MouseEvent it falls back to, so build the event by hand.
  const fire = async (el: Element, type: string) => {
    el.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
    await nextTick();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CARD-31: the centred tile's last line says Hold to join, with the price only when there is one", () => {
    const priced = mountCarousel([slot(1, 1, 10)], {
      action: { state: "join" },
      price: "6€",
    });
    expect(line(priced).text()).toBe("Hold to join · 6€");
    priced.unmount();

    const free = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    expect(line(free).text()).toBe("Hold to join");
    expect(line(free).text()).not.toContain("·");
  });

  it("CARD-31: leaving reads Hold to leave in red, and never shows the price", () => {
    const w = mountCarousel([slot(1, 1, 10)], {
      action: { state: "leave" },
      price: "6€",
    });
    expect(line(w).text()).toBe("Hold to leave");
    expect(line(w).attributes("data-tone")).toBe("leave");
  });

  it("CARD-31: only an actionable line shimmers", () => {
    const w = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    expect(line(w).find(".slot-shimmer").exists()).toBe(true);
    const status = mountCarousel([slot(1, 1, 10)], {
      action: { state: "status", label: "Roster locked" },
    });
    expect(line(status).find(".slot-shimmer").exists()).toBe(false);
  });

  it("CARD-31: side tiles keep the line's space but hide it", () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)], {
      action: { state: "join" },
    });
    expect(line(w, 0).classes()).not.toContain("invisible");
    expect(line(w, 1).classes()).toContain("invisible");
  });

  it("CARD-32: awaiting, declined and blocked states are text with an icon, and the tile isn't pressable", () => {
    const cases = [
      [{ state: "awaiting" }, "Awaiting approval", "fa-user-clock"],
      [{ state: "declined" }, "Not accepted", "fa-circle-xmark"],
      [
        { state: "status", label: "Roster locked", icon: "fa-lock" },
        "Roster locked",
        "fa-lock",
      ],
    ] as const;
    for (const [action, text, icon] of cases) {
      const w = mountCarousel([slot(1, 1, 10)], { action });
      expect(line(w).text()).toBe(text);
      expect(line(w).find(`i.${icon}`).exists()).toBe(true);
      expect(press(w).exists()).toBe(false);
      expect(line(w).attributes("aria-hidden")).toBeUndefined();
      w.unmount();
    }
  });

  it("CARD-32: a status line has no price even on a joinable-looking slot", () => {
    const w = mountCarousel([slot(1, 1, 10)], {
      action: { state: "status", label: "Game is full" },
      price: "6€",
    });
    expect(line(w).text()).toBe("Game is full");
  });

  it("CARD-12: the tile stays a plain group; the hold is one button laid over the centred tile only", () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)], {
      action: { state: "join" },
    });
    for (const tile of tiles(w)) {
      expect(tile.attributes("role")).toBe("group");
      expect(tile.attributes("tabindex")).toBeUndefined();
    }
    expect(w.findAll(".slot-press")).toHaveLength(1);
    expect(tiles(w)[0]!.find(".slot-press").exists()).toBe(true);
    // The avatars are not inside it.
    expect(press(w).element.querySelector("button")).toBeNull();
  });

  it("CARD-34: the button says how to join or leave, and the tile's own name doesn't repeat it", () => {
    const join = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    expect(press(join).attributes("aria-label")).toBe(
      "Press and hold for one second to join"
    );
    expect(tiles(join)[0]!.attributes("aria-label")).toBe(
      "11:00, 1 of 10 players"
    );
    join.unmount();
    const leave = mountCarousel([slot(1, 1, 10)], {
      action: { state: "leave" },
    });
    expect(press(leave).attributes("aria-label")).toBe(
      "Press and hold for one second to leave"
    );
  });

  it("CARD-33: holding the tile for 1s emits join once; the visible line is hidden from assistive tech", async () => {
    const w = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    expect(line(w).attributes("aria-hidden")).toBe("true");
    const before = tiles(w)[0]!.attributes("style");
    await fire(press(w).element, "pointerdown");
    expect(tiles(w)[0]!.classes()).toContain("slot-tile--holding");
    // Only the shade rises; the tile itself doesn't move.
    expect(tiles(w)[0]!.attributes("style")).toBe(before);
    expect(w.find(".slot-hold-fill").exists()).toBe(true);
    vi.advanceTimersByTime(999);
    expect(w.emitted("join")).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(w.emitted("join")).toHaveLength(1);
    expect(w.emitted("leave")).toBeUndefined();
  });

  it("CARD-34: holding the tile for 1s emits leave", async () => {
    const w = mountCarousel([slot(1, 1, 10)], { action: { state: "leave" } });
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(1000);
    expect(w.emitted("leave")).toHaveLength(1);
    expect(w.emitted("join")).toBeUndefined();
  });

  it("CARD-33: letting go early cancels, shows Keep holding for a moment, and sends nothing", async () => {
    const w = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(400);
    await fire(press(w).element, "pointerup");
    expect(line(w).text()).toContain("Keep holding…");
    expect(w.get('[role="status"]').text()).toBe("Keep holding…");
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(w.emitted("join")).toBeUndefined();
    expect(line(w).text()).toBe("Hold to join");
  });

  it("CARD-33: while in flight the line is a spinner and Joining…, and the tile can't be held", async () => {
    const w = mountCarousel([slot(1, 1, 10)], {
      action: { state: "join" },
      price: "6€",
      pending: true,
    });
    expect(line(w).text()).toBe("Joining…");
    expect(line(w).find("i.fa-spinner").exists()).toBe(true);
    expect(press(w).attributes("aria-disabled")).toBe("true");
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(2000);
    expect(w.emitted("join")).toBeUndefined();
  });

  it("CARD-34: Leaving… shows while a leave is in flight", () => {
    const w = mountCarousel([slot(1, 1, 10)], {
      action: { state: "leave" },
      pending: true,
    });
    expect(line(w).text()).toBe("Leaving…");
  });

  it("CARD-34: holding Enter on the focused tile works, and no context menu opens", async () => {
    const w = mountCarousel([slot(1, 1, 10)], { action: { state: "join" } });
    await press(w).trigger("keydown", { key: "Enter" });
    vi.advanceTimersByTime(1000);
    expect(w.emitted("join")).toHaveLength(1);

    const menu = new Event("contextmenu", { cancelable: true, bubbles: true });
    press(w).element.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it("CARD-12: a press on an avatar doesn't start a hold", async () => {
    const w = mountCarousel([slot(1, 2, 10)], { action: { state: "join" } });
    const avatar = tiles(w)[0]!.find("ul button");
    await fire(avatar.element, "pointerdown");
    expect(tiles(w)[0]!.classes()).not.toContain("slot-tile--holding");
    vi.advanceTimersByTime(2000);
    expect(w.emitted("join")).toBeUndefined();
  });

  it("CARD-12: a tap on the centred tile does nothing, a tap on a neighbour slides it in", async () => {
    const w = mountCarousel([slot(1, 1, 10), slot(2, 1, 10)], {
      action: { state: "join" },
    });
    await nextTick();
    const scrollTo = vi.mocked(Element.prototype.scrollTo);
    scrollTo.mockClear();
    await tiles(w)[0]!.trigger("click");
    expect(scrollTo).not.toHaveBeenCalled();
    await tiles(w)[1]!.trigger("click");
    expect(scrollTo).toHaveBeenCalled();
    expect(w.emitted("join")).toBeUndefined();
  });
});
