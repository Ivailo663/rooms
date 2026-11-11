import { describe, it, expect, vi, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import type {
  EnabledDaySummary,
  HostedRoomResponse,
  LiveSlotSummary,
  TimeslotRedistributedPayload,
  TimeslotResponse,
} from "@football/shared";
import HostedRoomCard from "./HostedRoomCard.vue";
import StatusWidget from "./widgets/StatusWidget.vue";
import PlayersWidget from "./widgets/PlayersWidget.vue";
import RedistributionNotice from "../components/RedistributionNotice.vue";
import SlotFailedNotice from "../components/SlotFailedNotice.vue";

// Monday 18:30, so an 18:00 slot is inside its hour and a 20:00 one is ahead.
const NOW = new Date(2026, 9, 26, 18, 30);

const data = vi.hoisted(() => ({
  todaySlots: [] as unknown[],
  enabledDays: [] as unknown[],
  notices: [] as unknown[],
  dismissNotice: (() => {}) as (id: number) => void,
}));

vi.mock("@/socket", () => ({ socket: { on: () => {}, off: () => {} } }));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: null }) }));

vi.mock("../composables/useNow", async () => {
  const { ref } = await import("vue");
  return { useNow: () => ref(NOW) };
});

vi.mock("../composables/queries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useGetTimeslots: () => ({ data: ref(data.todaySlots) }),
  useGetEnabledDays: () => ({ data: ref(data.enabledDays) }),
}));

vi.mock("../composables/useRedistributionNotices", () => ({
  useRedistributionNotices: () => ({
    noticesForTimeslot: (id: number) =>
      (data.notices as TimeslotRedistributedPayload[]).filter(
        (n) => n.timeslotId === id
      ),
    dismissNotice: (id: number) => data.dismissNotice(id),
  }),
}));

const slot = (overrides: Partial<TimeslotResponse> = {}): TimeslotResponse => ({
  id: 2,
  name: "Evening",
  message: null,
  price: null,
  label: "20:00",
  features: [],
  players: [],
  pendingRequests: [],
  min_players: 4,
  max_players: 10,
  day: "mo",
  enabled: true,
  status: "scheduled",
  start_time: 20 * 60,
  ...overrides,
});

const LIVE: LiveSlotSummary = {
  id: 1,
  label: "18:00",
  start_time: 18 * 60,
  players_count: 2,
  players: [
    { id: 11, name: "Lina" },
    { id: 12, name: "Marko" },
  ],
  max_players: 10,
  day: "mo",
};

const FAILED = slot({
  id: 3,
  label: "18:00",
  start_time: 18 * 60,
  status: "failed",
  players: [{ id: 1, name: "Ana" }],
});

const mountCard = (
  setup: {
    liveSlot?: LiveSlotSummary | null;
    todaySlots?: TimeslotResponse[];
    enabledDays?: EnabledDaySummary[];
  } = {}
) => {
  data.todaySlots = setup.todaySlots ?? [];
  data.enabledDays = setup.enabledDays ?? [];
  const room: HostedRoomResponse = {
    id: 9,
    name: "Pitch A",
    description: null,
    price: 10,
    address: "Somewhere",
    liveSlot: setup.liveSlot ?? null,
    pendingRequestCount: 0,
  };
  return mount(HostedRoomCard, {
    props: { room },
    global: { stubs: { ManageSlotsDrawer: true, SlotChat: true } },
  });
};

const panelOf = (wrapper: ReturnType<typeof mountCard>) =>
  wrapper.findComponent(StatusWidget);

afterEach(() => {
  data.notices = [];
  data.dismissNotice = () => {};
});

describe("HostedRoomCard slot panel", () => {
  it("HCARD-01: the header comes first and the players widget sits inside the panel below it", () => {
    const panel = panelOf(mountCard({ todaySlots: [slot()] }));
    const [header, body] = panel.element.children;

    expect(header!.matches("[data-panel-header]")).toBe(true);
    expect(header!.textContent).toContain("20:00");
    expect(body!.matches("[data-panel-body]")).toBe(true);
    expect(panel.findComponent(PlayersWidget).element.parentElement).toBe(body);
  });

  it("HCARD-08: the panel is one full-width column, with no widget grid", () => {
    const wrapper = mountCard({ todaySlots: [slot()] });
    expect(wrapper.find(".grid").exists()).toBe(false);
    expect(wrapper.find("[class*='grid-cols']").exists()).toBe(false);
    expect(wrapper.find("[data-panel-body]").classes()).toContain("flex-col");
  });

  it("HCARD-04: the players widget turns emerald on quorum inside an amber panel", () => {
    const players = [1, 2, 3, 4].map((id) => ({ id, name: `P${id}` }));
    const wrapper = mountCard({ todaySlots: [slot({ players })] });

    expect(panelOf(wrapper).classes()).toContain("border-amber-100");
    const widget = wrapper.findComponent(PlayersWidget);
    expect(widget.classes()).toContain("border-emerald-300");
    expect(widget.classes()).toContain("bg-emerald-50/60");
  });

  it("HCARD-04: below quorum the players widget keeps its own neutral border", () => {
    const wrapper = mountCard({ todaySlots: [slot()] });
    expect(wrapper.findComponent(PlayersWidget).classes()).toContain(
      "border-surface-100"
    );
  });

  const REDISTRIBUTION = () => {
    data.notices = [
      {
        id: 41,
        timeslotId: 2,
        roomId: 9,
        destinations: [
          {
            timeslotId: 7,
            roomId: 10,
            roomName: "Pitch B",
            label: "20:00",
            playerCount: 3,
          },
        ],
      },
    ];
  };

  it("HCARD-05: redistribution notices sit inside the panel below the players widget and can be dismissed", async () => {
    REDISTRIBUTION();
    const dismissed: number[] = [];
    data.dismissNotice = (id) => dismissed.push(id);

    const wrapper = mountCard({ todaySlots: [slot()] });
    const body = wrapper.find("[data-panel-body]").element;
    const notice = wrapper.findComponent(RedistributionNotice);

    expect(notice.element.parentElement).toBe(body);
    const children = [...body.children];
    expect(children.indexOf(notice.element)).toBeGreaterThan(
      children.indexOf(wrapper.findComponent(PlayersWidget).element)
    );

    await notice.find("button").trigger("click");
    expect(dismissed).toEqual([41]);
  });

  it("HCARD-06: the failed notice renders outside and below the panel", () => {
    const wrapper = mountCard({ todaySlots: [FAILED, slot()] });
    const panel = panelOf(wrapper);
    const failed = wrapper.findComponent(SlotFailedNotice);

    expect(panel.props("status")).toBe("scheduled");
    expect(failed.exists()).toBe(true);
    expect(panel.element.contains(failed.element)).toBe(false);
    expect(
      panel.element.compareDocumentPosition(failed.element) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("HCARD-07: while live, the next-slot hint is the last line inside the panel", () => {
    const wrapper = mountCard({ liveSlot: LIVE, todaySlots: [slot()] });
    const panel = panelOf(wrapper);
    const hint = panel.find("[data-panel-hint]");

    expect(hint.text()).toBe("Next: Today at 20:00");
    expect(panel.find("[data-panel-header]").text()).not.toContain("Next:");
    const body = panel.find("[data-panel-body]").element;
    expect(body.lastElementChild).toBe(hint.element);
    expect(
      wrapper
        .findComponent(PlayersWidget)
        .element.compareDocumentPosition(hint.element) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("HCARD-07: when not live, the hint stays under the label in the header", () => {
    const panel = panelOf(mountCard({ todaySlots: [slot()] }));
    expect(panel.find("[data-panel-header]").text()).toContain("Today");
    expect(panel.find("[data-panel-hint]").exists()).toBe(false);
  });

  it("HCARD-09: with nothing scheduled the players widget still shows a dash inside the panel", () => {
    const panel = panelOf(mountCard());
    expect(panel.props("status")).toBe("inactive");
    const widget = panel.findComponent(PlayersWidget);
    expect(widget.exists()).toBe(true);
    expect(widget.text()).toContain("—");
  });

  it("HCARD-10: after the day's last slot fails, the panel moves on to next week's game and the failure stays in the notice", () => {
    // The real enabled-days feed lists today's weekday too, so the failed
    // weekly slot comes back as next week's game.
    const wrapper = mountCard({
      todaySlots: [FAILED],
      enabledDays: [
        {
          day: "mo",
          label: "18:00",
          timeslotId: 3,
          players_count: 0,
          players: [],
          min_players: 4,
          max_players: 10,
        },
      ],
    });
    const panel = panelOf(wrapper);
    const failed = wrapper.findComponent(SlotFailedNotice);

    expect(panel.props("status")).toBe("scheduled");
    expect(panel.props("label")).toBe("18:00");
    expect(panel.text()).not.toContain("Didn't run");
    expect(failed.exists()).toBe(true);
    expect(panel.element.contains(failed.element)).toBe(false);
  });

  it("HCARD-11: a just-redistributed next slot still shows as scheduled, with its notice inside", () => {
    REDISTRIBUTION();
    const wrapper = mountCard({
      todaySlots: [slot({ status: "redistributed" })],
    });
    const panel = panelOf(wrapper);

    expect(panel.props("status")).toBe("scheduled");
    expect(panel.classes()).toContain("border-amber-100");
    expect(panel.findComponent(RedistributionNotice).exists()).toBe(true);
  });

  it("HCARD-12: with nothing upcoming the panel is inactive and reads No slots, even after a failure", () => {
    const wrapper = mountCard({ todaySlots: [FAILED] });
    const panel = panelOf(wrapper);

    expect(panel.props("status")).toBe("inactive");
    expect(panel.props("label")).toBeNull();
    expect(panel.text()).toContain("No slots");
    expect(panel.text()).not.toContain("Didn't run");
    expect(wrapper.findComponent(SlotFailedNotice).exists()).toBe(true);
  });

  const avatarNames = (wrapper: ReturnType<typeof mountCard>) =>
    wrapper
      .findComponent(PlayersWidget)
      .findAll("button")
      .map((b) => b.attributes("aria-label"));

  it("HCARD-14: a live slot draws its players as named avatars", () => {
    const wrapper = mountCard({ liveSlot: LIVE, todaySlots: [slot()] });
    expect(avatarNames(wrapper)).toEqual(["Lina", "Marko"]);
  });

  it("HCARD-14: a game on a later day draws its players as named avatars", () => {
    const wrapper = mountCard({
      enabledDays: [
        {
          day: "we",
          label: "19:00",
          timeslotId: 5,
          players_count: 1,
          players: [{ id: 21, name: "Petar" }],
          min_players: 4,
          max_players: 10,
        },
      ],
    });
    expect(avatarNames(wrapper)).toEqual(["Petar"]);
  });
});
