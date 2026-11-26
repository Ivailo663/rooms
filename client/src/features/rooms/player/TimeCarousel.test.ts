import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

// jsdom does no layout, so the strip's size is whatever the test says.
const stripWidth = ref(0);
const stripHeight = ref(0);
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useElementSize: () => ({ width: stripWidth, height: stripHeight }),
}));
vi.mock(
  "embla-carousel-vue",
  async () => (await import("./__tests__/fakeEmbla")).module
);
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));
// The server calls a tile makes. A join or leave never settles unless a test
// says so, which is what "in flight" looks like.
const { joinTimeslot, leaveTimeslot, returnToGame } = vi.hoisted(() => ({
  joinTimeslot: vi.fn(),
  leaveTimeslot: vi.fn(),
  returnToGame: vi.fn(),
}));
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  getJoinedSlots: () => Promise.resolve([]),
  joinTimeslot,
  leaveTimeslot,
}));
vi.mock("../composables/useGameMode", () => ({ returnToGame }));

import TimeCarousel from "./TimeCarousel.vue";
import { fakeEmbla } from "./__tests__/fakeEmbla";

// Other players, never the signed-in user (id 1).
const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: 101 + i,
    name: `Player ${i + 1}`,
  }));

const me = { id: 1, name: "Me" };

// A slot nobody has blocked: far from today, so the join gates stay open.
const slot = (
  id: number,
  taken: number,
  max: number,
  features: unknown = [],
  price: number | null = null,
  extra: object = {}
) => ({
  id,
  label: `${10 + id}:00`,
  max_players: max,
  players: players(taken),
  features,
  price,
  day: "never",
  start_time: 600,
  status: "scheduled",
  requestStatusForCurrentUser: null,
  ...extra,
});

type Props = InstanceType<typeof TimeCarousel>["$props"];

let wrapper: VueWrapper | undefined;
const mountStrip = (
  timeslots: unknown[],
  props: Partial<Props> = {},
  queryClient = new QueryClient()
) => {
  wrapper = mount(TimeCarousel, {
    props: {
      timeslots,
      rules: { lateJoinCutoff: 0, allowJoinOnLive: false },
      ...props,
    } as Props,
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return wrapper;
};

const tiles = (w: VueWrapper) => w.findAll(".slot-tile");

// A wide strip, so the height decides the tile size: the tile is the strip's
// height less the 24px of vertical padding.
const setSide = (side: number) => {
  stripWidth.value = 1000;
  stripHeight.value = side + 24;
};

beforeEach(() => {
  stripWidth.value = 0;
  stripHeight.value = 0;
  fakeEmbla.reset();
  joinTimeslot.mockReset().mockReturnValue(new Promise(() => {}));
  leaveTimeslot.mockReset().mockReturnValue(new Promise(() => {}));
  returnToGame.mockReset();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("TimeCarousel seat bar", () => {
  it("CARD-15: one segment per seat, filled for each taken seat", () => {
    const [tile] = tiles(mountStrip([slot(1, 3, 10)]));
    const seats = tile!.findAll("[data-filled]");
    expect(seats).toHaveLength(10);
    expect(
      seats.filter((s) => s.attributes("data-filled") === "true")
    ).toHaveLength(3);
    expect(seats[2]!.classes()).toContain("bg-emerald-500");
    expect(seats[3]!.classes()).not.toContain("bg-emerald-500");
  });

  it("CARD-15: up to 14 seats still get segments, above that the bar is continuous", () => {
    const w = mountStrip([slot(1, 5, 14), slot(2, 5, 15)]);
    const [fourteen, fifteen] = tiles(w);
    expect(fourteen!.findAll("[data-filled]")).toHaveLength(14);
    expect(fifteen!.findAll("[data-filled]")).toHaveLength(0);
    expect(fifteen!.find("[data-seat-bar]").exists()).toBe(true);
  });

  it("CARD-15: a full slot's bar is grey, not emerald", () => {
    const w = mountStrip([slot(1, 4, 4), slot(2, 20, 20)]);
    for (const tile of tiles(w)) {
      expect(tile.find("[data-seat-bar] .bg-surface-400").exists()).toBe(true);
      expect(tile.find("[data-seat-bar] .bg-emerald-500").exists()).toBe(false);
    }
  });

  it("CARD-15: the joined and pending dots stay", () => {
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)], {
      markers: { 1: "joined", 2: "pending" },
    });
    const [joined, pending] = tiles(w);
    expect(joined!.find(".bg-emerald-400.absolute").exists()).toBe(true);
    expect(pending!.find(".bg-amber-400.absolute").exists()).toBe(true);
  });

  it("CARD-15: the dot sits in the top-left corner at every tile size", () => {
    for (const side of [240, 190, 150]) {
      setSide(side);
      const w = mountStrip([slot(1, 1, 10)], { markers: { 1: "joined" } });
      const dot = tiles(w)[0]!.find(".bg-emerald-400.absolute");
      expect(dot.classes().some((c) => c.startsWith("left-"))).toBe(true);
      expect(dot.classes().some((c) => c.startsWith("right-"))).toBe(false);
      w.unmount();
    }
  });
});

describe("TimeCarousel spots left", () => {
  const labelOf = (w: VueWrapper, index: number) => {
    const tile = tiles(w)[index]!;
    return tile
      .findAll("span")
      .find((s) => /^(\d+ spots? left|Full squad)$/.test(s.text()));
  };

  it("CARD-19: emerald with 3+ left, amber with 1-2, grey when full", () => {
    const w = mountStrip([
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

describe("TimeCarousel tiles", () => {
  it("CARD-10: the centred tile is a plain white card, neighbours a flatter one with a hairline", () => {
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
    // The fake carousel starts on slide 0, so tile 0 is the centred one.
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

  it("CARD-10: a tile is 86% of the carousel wide and fills its height, set by CSS and not measured", () => {
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
    const slides = w.findAll(".slot-strip > div > div");
    expect(slides).toHaveLength(2);
    for (const slide of slides) {
      expect(slide.attributes("style")).toContain("flex-basis: 86%");
    }
    for (const tile of tiles(w)) {
      expect(tile.attributes("style") ?? "").not.toMatch(/width|height/);
    }
    // Carousel padding alone, so tiles stretch to the full height.
    expect(w.find(".slot-strip").classes()).toContain("!py-3");
  });

  it("CARD-10: the first and last tile centre, so Embla keeps its edge containment off", () => {
    mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
    expect(fakeEmbla.options).toMatchObject({
      align: "center",
      containScroll: false,
      loop: false,
      skipSnaps: false,
    });
  });

  it("CARD-18: the strip never scrolls vertically", () => {
    const w = mountStrip([slot(1, 1, 10)]);
    expect(w.find(".slot-strip").classes()).toContain("overflow-hidden");
  });
});

describe("TimeCarousel tile sizes", () => {
  const buttons = (w: VueWrapper) => tiles(w)[0]!.findAll("ul button");

  it("CARD-17: with room, every avatar shows at full size", () => {
    setSide(240);
    const w = mountStrip([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-tile-size")).toBe("roomy");
    expect(buttons(w)).toHaveLength(6);
    expect(buttons(w)[0]!.attributes("style")).toContain("width: 32px");
  });

  it("CARD-17: compact shrinks the avatars but keeps them all", () => {
    setSide(190);
    const w = mountStrip([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-tile-size")).toBe("compact");
    expect(buttons(w)).toHaveLength(6);
    expect(buttons(w)[0]!.attributes("style")).toContain("width: 28px");
  });

  it("CARD-17: tight shows at most 3 avatars, then a +N that isn't a button", () => {
    setSide(175);
    const w = mountStrip([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-tile-size")).toBe("tight");
    expect(buttons(w)).toHaveLength(3);
    const more = tiles(w)[0]!.find('li[aria-label="3 more players"]');
    expect(more.text()).toBe("+3");
    expect(more.element.querySelector("button")).toBeNull();
  });

  it("CARD-17: tight with 3 or fewer players shows no +N", () => {
    setSide(175);
    const w = mountStrip([slot(1, 3, 10)]);
    expect(buttons(w)).toHaveLength(3);
    expect(tiles(w)[0]!.find("li[aria-label$='more players']").exists()).toBe(
      false
    );
  });

  it("CARD-17: the tile size follows the smaller of the tile's width and height", () => {
    // Plenty of height, but a narrow strip makes the tile narrow.
    stripWidth.value = 200;
    stripHeight.value = 600;
    const w = mountStrip([slot(1, 6, 10)]);
    expect(w.find(".slot-strip").attributes("data-tile-size")).toBe("tight");
  });
});

describe("TimeCarousel keyboard", () => {
  it("PROF-02: only the centred tile's avatars are reachable by Tab, so focus never scrolls the strip to another slot", async () => {
    const w = mountStrip([slot(1, 2, 10), slot(2, 2, 10), slot(3, 2, 10)]);
    const tabindexes = (i: number) => {
      const tile = tiles(w)[i]!;
      return tile.findAll("ul button").map((b) => b.attributes("tabindex"));
    };
    expect(tabindexes(0)).toEqual([undefined, undefined]);
    expect(tabindexes(1)).toEqual(["-1", "-1"]);
    expect(tabindexes(2)).toEqual(["-1", "-1"]);
  });

  it("CARD-12: a side tile's avatars still take taps while out of the Tab order", async () => {
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
    const side = tiles(w)[1]!.find("button");
    expect(side.attributes("tabindex")).toBe("-1");
    await side.trigger("click");
    expect(document.querySelector("[data-player-details-card]")).not.toBeNull();
  });
});

describe("TimeCarousel features", () => {
  const chipNames = (tile: ReturnType<typeof tiles>[number]) =>
    tile.findAll("[data-features] > span").map((c) => c.text());

  it("CARD-11: each tile shows its own slot's features in a top row, right-aligned, wrapping only on overflow", () => {
    const w = mountStrip([
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
    const w = mountStrip([
      slot(1, 1, 10, []),
      slot(2, 1, 10, null),
      slot(3, 1, 10, "ball"),
    ]);
    for (const tile of tiles(w)) {
      expect(tile.find("[data-features]").exists()).toBe(false);
    }
  });

  it("CARD-04: nothing on the tiles has a dark fill", () => {
    const w = mountStrip([slot(1, 1, 10, ["ball"]), slot(2, 1, 10, ["ball"])]);
    const [current, side] = tiles(w);
    expect(current!.find("[data-features] > span").classes()).toContain(
      "slot-chip"
    );
    expect(side!.find("[data-features] > span").classes()).toContain(
      "bg-surface-900/5"
    );
    expect(w.html()).not.toMatch(/bg-(surface|slate|gray)-(700|800|900)(?!\/)/);
  });

  it("CARD-17: the features are icon-only at every tile size, each still named for screen readers", () => {
    const features = ["ball", "water"];
    for (const side of [240, 190, 150]) {
      setSide(side);
      const w = mountStrip([slot(1, 1, 10, features)]);
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
    const w = mountStrip(
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

describe("TimeCarousel slot action", () => {
  const line = (w: VueWrapper, index = 0) =>
    tiles(w)[index]!.find(".slot-hint");
  const press = (w: VueWrapper) => w.find(".slot-press");
  // jsdom has no PointerEvent, and test-utils can't set `button` on the
  // MouseEvent it falls back to, so build the event by hand.
  const fire = async (el: Element, type: string) => {
    el.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
    await nextTick();
  };
  // Query state settles on a timer, which these tests have faked.
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
  };
  const hold = async (w: VueWrapper) => {
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(1000);
    await settle();
  };

  // Slots whose action is join, leave and "full" for the signed-in user.
  const joinable = (price: number | null = null) => slot(1, 1, 10, [], price);
  const mine = () => slot(1, 1, 10, [], null, { players: [me] });
  const full = () => slot(1, 10, 10);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CARD-31: the centred tile's last line says Hold to join, never with the price", () => {
    const w = mountStrip([joinable(6)]);
    expect(line(w).text()).toBe("Hold to join");
  });

  it("CARD-11: a priced slot shows its price under the time on every tile, a free one shows none", () => {
    const priced = mountStrip([joinable(6), { ...mine(), id: 2, price: 6 }]);
    for (const tile of tiles(priced)) {
      expect(tile.find(".slot-price").text()).toBe("6€");
    }
    priced.unmount();

    const free = mountStrip([joinable()]);
    expect(tiles(free)[0]!.find(".slot-price").exists()).toBe(false);
  });

  it("CARD-31: leaving reads Hold to leave in red, and never shows the price", () => {
    const w = mountStrip([{ ...mine(), price: 6 }]);
    expect(line(w).text()).toBe("Hold to leave");
    expect(line(w).attributes("data-tone")).toBe("leave");
  });

  it("CARD-31: only an actionable line shimmers", () => {
    const w = mountStrip([joinable()]);
    expect(line(w).find(".slot-shimmer").exists()).toBe(true);
    const status = mountStrip([full()]);
    expect(line(status).find(".slot-shimmer").exists()).toBe(false);
  });

  it("CARD-31: side tiles keep the line's space but hide it", () => {
    const w = mountStrip([joinable(), { ...joinable(), id: 2 }]);
    expect(line(w, 0).classes()).not.toContain("invisible");
    expect(line(w, 1).classes()).toContain("invisible");
  });

  it("CARD-32: awaiting, declined and blocked states are text with an icon, and the tile isn't pressable", () => {
    const cases = [
      [
        slot(1, 1, 10, [], null, { requestStatusForCurrentUser: "pending" }),
        "Awaiting approval",
        "fa-user-clock",
      ],
      [
        slot(1, 1, 10, [], null, { requestStatusForCurrentUser: "denied" }),
        "Not accepted",
        "fa-circle-xmark",
      ],
      [full(), "Game is full", "fa-users-slash"],
    ] as const;
    for (const [timeslot, text, icon] of cases) {
      const w = mountStrip([timeslot]);
      expect(line(w).text()).toBe(text);
      expect(line(w).find(`i.${icon}`).exists()).toBe(true);
      expect(press(w).exists()).toBe(false);
      expect(line(w).attributes("aria-hidden")).toBeUndefined();
      w.unmount();
    }
  });

  it("CARD-32: a status line has no price even on a priced slot", () => {
    const w = mountStrip([{ ...full(), price: 6 }]);
    expect(line(w).text()).toBe("Game is full");
  });

  it("CARD-12: the tile stays a plain group; the hold is one button laid over the centred tile only", () => {
    const w = mountStrip([joinable(), { ...joinable(), id: 2 }]);
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
    const join = mountStrip([joinable()]);
    expect(press(join).attributes("aria-label")).toBe(
      "Press and hold for one second to join"
    );
    expect(tiles(join)[0]!.attributes("aria-label")).toBe(
      "11:00, 1 of 10 players"
    );
    join.unmount();
    const leave = mountStrip([mine()]);
    expect(press(leave).attributes("aria-label")).toBe(
      "Press and hold for one second to leave"
    );
  });

  it("CARD-33: holding the tile for 1s joins its slot once; the visible line is hidden from assistive tech", async () => {
    const w = mountStrip([joinable()]);
    expect(line(w).attributes("aria-hidden")).toBe("true");
    const before = tiles(w)[0]!.attributes("style");
    await fire(press(w).element, "pointerdown");
    expect(tiles(w)[0]!.classes()).toContain("slot-tile--holding");
    // Only the shade rises; the tile itself doesn't move.
    expect(tiles(w)[0]!.attributes("style")).toBe(before);
    expect(w.find(".slot-hold-fill").exists()).toBe(true);
    vi.advanceTimersByTime(999);
    expect(joinTimeslot).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await settle();
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
    expect(joinTimeslot.mock.calls[0]![0]).toBe(1);
    expect(leaveTimeslot).not.toHaveBeenCalled();
  });

  it("CARD-34: holding the tile for 1s leaves its slot", async () => {
    const w = mountStrip([mine()]);
    await hold(w);
    expect(leaveTimeslot).toHaveBeenCalledTimes(1);
    expect(leaveTimeslot.mock.calls[0]![0]).toBe(1);
    expect(joinTimeslot).not.toHaveBeenCalled();
  });

  it("CARD-33: a confirmed join returns to the match hub, a request waiting for approval stays", async () => {
    joinTimeslot.mockResolvedValueOnce({ status: "pending" });
    const asked = mountStrip([joinable()]);
    await hold(asked);
    await flushPromises();
    await settle();
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
    expect(returnToGame).not.toHaveBeenCalled();
    asked.unmount();

    joinTimeslot.mockResolvedValueOnce({ status: "joined" });
    const joined = mountStrip([joinable()]);
    await hold(joined);
    await flushPromises();
    await settle();
    expect(returnToGame).toHaveBeenCalledTimes(1);
  });

  it("CARD-33: letting go early cancels, shows Keep holding for a moment, and sends nothing", async () => {
    const w = mountStrip([joinable()]);
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(400);
    await fire(press(w).element, "pointerup");
    expect(line(w).text()).toContain("Keep holding…");
    expect(w.get('[role="status"]').text()).toBe("Keep holding…");
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(joinTimeslot).not.toHaveBeenCalled();
    expect(line(w).text()).toBe("Hold to join");
  });

  it("CARD-33: while in flight the line is a spinner and Joining…, and the tile can't be held again", async () => {
    const w = mountStrip([joinable(6)]);
    await hold(w);
    expect(line(w).text()).toBe("Joining…");
    expect(line(w).find("i.fa-spinner").exists()).toBe(true);
    expect(press(w).attributes("aria-disabled")).toBe("true");
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(2000);
    await settle();
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
  });

  it("CARD-34: Leaving… shows while a leave is in flight", async () => {
    const w = mountStrip([mine()]);
    await hold(w);
    expect(line(w).text()).toBe("Leaving…");
  });

  it("CARD-34: holding Enter on the focused tile works, and no context menu opens", async () => {
    const w = mountStrip([joinable()]);
    const menu = new Event("contextmenu", { cancelable: true, bubbles: true });
    press(w).element.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);

    await press(w).trigger("keydown", { key: "Enter" });
    vi.advanceTimersByTime(1000);
    await settle();
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
  });

  it("CARD-12: a press on an avatar doesn't start a hold", async () => {
    const w = mountStrip([slot(1, 2, 10)]);
    const avatar = tiles(w)[0]!.find("ul button");
    await fire(avatar.element, "pointerdown");
    expect(tiles(w)[0]!.classes()).not.toContain("slot-tile--holding");
    vi.advanceTimersByTime(2000);
    expect(joinTimeslot).not.toHaveBeenCalled();
  });

  it("CARD-12: a tap on the centred tile does nothing, a tap on a neighbour slides it in", async () => {
    const w = mountStrip([joinable(), { ...joinable(), id: 2 }]);
    await nextTick();
    const { scrollTo } = fakeEmbla.api;
    await tiles(w)[0]!.trigger("click");
    expect(scrollTo).not.toHaveBeenCalled();
    await tiles(w)[1]!.trigger("click");
    expect(scrollTo).toHaveBeenCalledWith(1, false);
    expect(joinTimeslot).not.toHaveBeenCalled();
  });
});

describe("TimeCarousel keyboard slide", () => {
  it("CARD-12: arrow keys on the strip slide to the next or previous tile, and stop at the ends", async () => {
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10), slot(3, 1, 10)]);
    await nextTick();
    const strip = w.get(".slot-strip");
    const { scrollTo } = fakeEmbla.api;
    await strip.trigger("keydown", { key: "ArrowLeft" });
    expect(scrollTo).toHaveBeenLastCalledWith(0, false);
    await strip.trigger("keydown", { key: "ArrowRight" });
    expect(scrollTo).toHaveBeenLastCalledWith(1, false);
    fakeEmbla.swipeTo(2);
    await nextTick();
    await strip.trigger("keydown", { key: "ArrowRight" });
    expect(scrollTo).toHaveBeenLastCalledWith(2, false);
  });

  it("CARD-12: a key pressed on a control inside a tile isn't taken by the strip", async () => {
    const w = mountStrip([slot(1, 2, 10), slot(2, 2, 10)]);
    await nextTick();
    await tiles(w)[0]!.find("button").trigger("keydown", { key: "ArrowRight" });
    expect(fakeEmbla.api.scrollTo).not.toHaveBeenCalled();
  });

  it("CARD-12: with reduced motion a tap jumps instead of gliding", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
      await nextTick();
      await tiles(w)[1]!.trigger("click");
      expect(fakeEmbla.api.scrollTo).toHaveBeenCalledWith(1, true);
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});

describe("TimeCarousel swipe", () => {
  const line = (w: VueWrapper, index: number) =>
    tiles(w)[index]!.find(".slot-hint");
  const press = (w: VueWrapper) => w.find(".slot-press");
  const fire = async (el: Element, type: string) => {
    el.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
    await nextTick();
  };
  // The strip moves to a slide mid-swipe: its position changes, nothing settles.
  const swipeTo = async (index: number) => {
    fakeEmbla.swipeTo(index);
    await nextTick();
  };

  // Join, leave and "Game is full", in that order.
  const three = [
    slot(1, 1, 10),
    slot(2, 1, 10, [], null, { players: [me] }),
    slot(3, 10, 10),
  ];

  it("CARD-14: the strip starts on the initial slot, which is both chosen and centred", async () => {
    const w = mountStrip(three, { initialIndex: 2 });
    await nextTick();
    expect(fakeEmbla.options).toMatchObject({ startIndex: 2 });
    expect(w.emitted("chooseSlot")).toEqual([[2]]);
    expect(w.emitted("centerSlot")).toEqual([[2]]);
    expect(tiles(w)[2]!.attributes("aria-current")).toBe("true");
    expect(line(w, 2).classes()).not.toContain("invisible");
  });

  it("CARD-14: an initial slot past the end lands on the last one", () => {
    mountStrip(three, { initialIndex: 9 });
    expect(fakeEmbla.options).toMatchObject({ startIndex: 2 });
  });

  it("CARD-10: neighbours shrink and fade in step with the scroll position, the centred tile doesn't", async () => {
    const w = mountStrip(three);
    await nextTick();
    const scaleOf = (i: number) =>
      parseFloat(
        /scale\(([\d.]+)\)/.exec(tiles(w)[i]!.attributes("style")!)![1]!
      );
    expect(scaleOf(0)).toBe(1);
    expect(scaleOf(1)).toBeCloseTo(0.86);
    // A quarter of the way from slide 0 to slide 1.
    fakeEmbla.swipeTo(0.25);
    await nextTick();
    expect(scaleOf(0)).toBeCloseTo(1 - 0.14 * 0.25);
    expect(scaleOf(1)).toBeCloseTo(1 - 0.14 * 0.75);
    // Each shrinks towards the edge facing the centre.
    expect(tiles(w)[0]!.attributes("style")).toContain(
      "transform-origin: right center"
    );
    expect(tiles(w)[1]!.attributes("style")).toContain(
      "transform-origin: left center"
    );
  });

  it("CARD-38: the tile that becomes centred shows its own line at once, before the strip settles", async () => {
    const w = mountStrip(three);
    await nextTick();
    expect(line(w, 0).classes()).not.toContain("invisible");
    expect(line(w, 0).text()).toBe("Hold to join");

    await swipeTo(1);
    // Nothing has settled: the choice is still the first slot.
    expect(w.emitted("chooseSlot")).toHaveLength(1);
    expect(line(w, 1).classes()).not.toContain("invisible");
    expect(line(w, 1).text()).toBe("Hold to leave");
    expect(press(w).attributes("aria-label")).toContain("to leave");

    await swipeTo(2);
    expect(line(w, 2).text()).toBe("Game is full");
    expect(press(w).exists()).toBe(false);
  });

  it("CARD-38: the strip reports the centred slot as it moves, apart from the settled one", async () => {
    const w = mountStrip(three);
    await nextTick();
    await swipeTo(2);
    expect(w.emitted("centerSlot")?.at(-1)).toEqual([2]);
    expect(w.emitted("chooseSlot")).toHaveLength(1);
    fakeEmbla.settleOn(2);
    expect(w.emitted("chooseSlot")?.at(-1)).toEqual([2]);
  });

  it("CARD-38: settling on the slot already chosen announces nothing", async () => {
    const w = mountStrip(three);
    await nextTick();
    await swipeTo(1);
    fakeEmbla.settleOn(0);
    expect(w.emitted("chooseSlot")).toHaveLength(1);
  });

  it("CARD-39: only the slot in flight shows the spinner; another centred tile shows its own line and can't be held", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const w = mountStrip([slot(1, 1, 10), slot(2, 1, 10)]);
    await nextTick();
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(line(w, 0).text()).toBe("Joining…");

    await swipeTo(1);
    expect(line(w, 1).text()).toBe("Hold to join");
    expect(line(w, 1).find("i.fa-spinner").exists()).toBe(false);
    expect(line(w, 1).find(".slot-shimmer").exists()).toBe(false);
    expect(press(w).attributes("aria-disabled")).toBe("true");
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(2000);
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("CARD-39: a join in flight on one card blocks holding on another", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const queryClient = new QueryClient();
    const first = mountStrip([slot(1, 1, 10)], {}, queryClient);
    const second = mount(TimeCarousel, {
      props: {
        timeslots: [slot(2, 1, 10)],
        rules: { lateJoinCutoff: 0, allowJoinOnLive: false },
      } as Props,
      attachTo: document.body,
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await nextTick();
    expect(
      second.find(".slot-press").attributes("aria-disabled")
    ).toBeUndefined();

    await fire(first.find(".slot-press").element, "pointerdown");
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();

    // The other card shows its own line and no spinner, but can't be held.
    expect(line(second, 0).text()).toBe("Hold to join");
    expect(line(second, 0).find("i.fa-spinner").exists()).toBe(false);
    expect(second.find(".slot-press").attributes("aria-disabled")).toBe("true");
    await fire(second.find(".slot-press").element, "pointerdown");
    vi.advanceTimersByTime(2000);
    expect(joinTimeslot).toHaveBeenCalledTimes(1);
    second.unmount();
    vi.useRealTimers();
  });

  it("CARD-39: a hold acts on the slot's own id", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const w = mountStrip(three);
    await nextTick();
    await swipeTo(1);
    await fire(press(w).element, "pointerdown");
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(leaveTimeslot.mock.calls[0]![0]).toBe(2);
    vi.useRealTimers();
  });

  it("CARD-33: a sideways drag of more than 8px on the tile cancels the hold", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const w = mountStrip(three);
    await nextTick();
    const el = press(w).element;
    const fire = async (type: string, clientX: number) => {
      el.dispatchEvent(
        new MouseEvent(type, { button: 0, clientX, bubbles: true })
      );
      await nextTick();
    };
    await fire("pointerdown", 100);
    await fire("pointermove", 80);
    vi.advanceTimersByTime(2000);
    expect(joinTimeslot).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("TimeCarousel leaving for My games", () => {
  it.todo(
    "CARD-40: tiles don't flicker, resize or slide while the deck makes way for the hub"
  );
});
