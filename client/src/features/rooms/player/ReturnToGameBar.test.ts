import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";

const base = {
  timeslotId: 1,
  roomId: 1,
  roomName: "Depot",
  address: "Rail St 1",
  label: "19:00",
  day: "th",
  start_time: 1140,
  status: "scheduled",
  price: null,
  features: [],
  players: [],
  max_players: 12,
  membership: "joined",
  lateJoinCutoff: 120,
};

const joinedSlots = ref<unknown[]>([]);

vi.mock("../composables/queries", () => ({
  useGetJoinedSlots: () => ({ data: joinedSlots }),
}));

import ReturnToGameBar from "./ReturnToGameBar.vue";

let wrapper: VueWrapper | undefined;

// useNow refreshes the clock on mount, so wait a tick for the real render.
const mountBlock = async () => {
  wrapper = mount(ReturnToGameBar);
  await nextTick();
  return wrapper;
};

// Thursday 2026-11-26.
const at = (hour: number, minute = 0) => {
  vi.setSystemTime(new Date(2026, 10, 26, hour, minute));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(12);
  joinedSlots.value = [base];
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});

describe("My games block", () => {
  it("HEAD-05: two stacked lines, My games on top and the game under it", async () => {
    const w = await mountBlock();
    const lines = [...w.get("button").element.children];

    expect(lines).toHaveLength(2);
    expect(lines[0]!.textContent?.trim()).toBe("My games");
    expect(lines[1]!.textContent?.trim()).toBe("Today 19:00");
    expect(w.get("button").classes()).toContain("flex-col");
  });

  it("HEAD-06: an upcoming game reads as day and time, no room, no countdown", async () => {
    const text = (await mountBlock()).text();

    // A game later the same day is "Today", as everywhere else in the app.
    expect(text).toBe("My games Today 19:00");
    expect(text).not.toContain("Depot");
    expect(text).not.toMatch(/\d+\s?(h|m)\b/);
  });

  it("HEAD-07: a game in progress is the live dot and its hour, nothing else", async () => {
    at(19, 20);
    joinedSlots.value = [{ ...base, status: "live" }];
    const w = await mountBlock();
    const underneath = w.get("button").element.children[1]!;

    expect(w.find("[data-live-dot]").exists()).toBe(true);
    expect(underneath.textContent?.trim()).toBe("19:00");
    expect(w.text()).not.toMatch(/live/i);
    expect(w.text()).not.toContain("20'");
    expect(w.text()).not.toContain("Thu");
  });

  it("HEAD-08: names the soonest confirmed game, ignoring pending ones", async () => {
    joinedSlots.value = [
      { ...base, timeslotId: 2, day: "sa", label: "10:00", start_time: 600 },
      { ...base, timeslotId: 3, day: "fr", label: "18:00", start_time: 1080 },
      {
        ...base,
        timeslotId: 4,
        day: "th",
        label: "15:00",
        start_time: 900,
        membership: "pending",
      },
    ];

    expect((await mountBlock()).text()).toBe("My games Tmrw 18:00");
  });

  it("HEAD-09: the whole block is one button", async () => {
    const w = await mountBlock();

    expect(w.findAll("button")).toHaveLength(1);
    expect(w.get("button").text()).toBe("My games Today 19:00");
    expect(w.get("button").attributes("type")).toBe("button");
  });
});
