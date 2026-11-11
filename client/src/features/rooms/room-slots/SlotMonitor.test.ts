import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { TimeslotResponse } from "@football/shared";
import SlotMonitor from "./SlotMonitor.vue";

vi.mock("primevue/useconfirm", () => ({ useConfirm: () => ({}) }));

vi.mock("../composables/useNow", async () => {
  const { ref } = await import("vue");
  return { useNow: () => ref(new Date(2026, 9, 26, 12, 0)) };
});

vi.mock("../composables/queries", () => {
  const mutation = () => ({ mutate: () => {}, isPending: { value: false } });
  return {
    useRedistributeTimeslot: mutation,
    useApproveJoinRequest: mutation,
    useDenyJoinRequest: mutation,
    useAcknowledgeJoinRequest: mutation,
  };
});

vi.mock("../composables/useRedistributionNotices", () => ({
  useRedistributionNotices: () => ({
    isRecentlyRedistributed: () => false,
    noticesForTimeslot: () => [],
    dismissNotice: () => {},
  }),
}));

const timeslot: TimeslotResponse = {
  id: 2,
  name: "Evening",
  message: null,
  price: null,
  label: "20:00",
  features: [],
  players: [
    { id: 1, name: "Ana Petrova" },
    { id: 2, name: "" },
  ],
  pendingRequests: [],
  min_players: 4,
  max_players: 10,
  day: "mo",
  enabled: true,
  status: "scheduled",
  start_time: 20 * 60,
};

const card = () => document.body.querySelector("[data-player-details-card]");

let wrapper: VueWrapper | undefined;

const mountMonitor = () => {
  wrapper = mount(SlotMonitor, {
    props: { timeslot, enabled: true },
    attachTo: document.body,
    global: { stubs: { SlotChat: true } },
  });
  return wrapper;
};

const entry = (w: VueWrapper, name: string) =>
  w.findAll("button").find((b) => b.text() === name)!;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("SlotMonitor player list", () => {
  it("PROF-01: each player entry is a button named after the player", () => {
    const w = mountMonitor();
    expect(entry(w, "Ana Petrova").attributes("type")).toBe("button");
    expect(entry(w, "Player #2").exists()).toBe(true);
  });

  it("PROF-01: hovering a player entry opens the details card", async () => {
    const w = mountMonitor();
    await entry(w, "Ana Petrova").trigger("mouseenter");
    expect(card()?.textContent).toContain("Ana Petrova");
  });

  it("PROF-02: focus opens the card and blur closes it", async () => {
    const w = mountMonitor();
    const ana = entry(w, "Ana Petrova");
    await ana.trigger("focus");
    expect(card()).not.toBeNull();
    await ana.trigger("blur");
    expect(card()).toBeNull();
  });

  it("PROF-05: tapping a player entry opens the card, tapping outside closes it", async () => {
    const w = mountMonitor();
    await entry(w, "Player #2").trigger("click");
    expect(card()?.textContent).toContain("Player #2");

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await w.vm.$nextTick();
    expect(card()).toBeNull();
  });
});
