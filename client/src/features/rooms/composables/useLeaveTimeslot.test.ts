import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));

const { leaveTimeslot } = vi.hoisted(() => ({ leaveTimeslot: vi.fn() }));
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  leaveTimeslot,
}));

import { useLeaveTimeslot } from "./queries";

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

// Runs the mutation inside a component, since it needs the app's query client.
const setup = (queryClient: QueryClient) => {
  let mutation!: ReturnType<typeof useLeaveTimeslot>;
  wrapper = mount(
    defineComponent({
      setup() {
        mutation = useLeaveTimeslot();
        return () => null;
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }
  );
  return mutation;
};

const player = (id: number) => ({ id, name: `Player ${id}` });
const slot = (id: number, players: ReturnType<typeof player>[]) => ({
  id,
  players,
});
const room = (id: number, timeslots: ReturnType<typeof slot>[]) => ({
  id,
  name: `Room ${id}`,
  timeslots,
});

describe("useLeaveTimeslot", () => {
  it("CARD-42: on success the cached playable rooms lose the user from the left slot, before any refetch", async () => {
    const queryClient = new QueryClient();
    // Two days cached, as the deck keeps one entry per day.
    queryClient.setQueryData(
      ["playable-rooms", "mo"],
      [
        room(1, [slot(10, [player(1), player(2)]), slot(11, [player(1)])]),
        room(2, [slot(20, [player(1)])]),
      ]
    );
    queryClient.setQueryData(
      ["playable-rooms", "tu"],
      [room(1, [slot(10, [player(1), player(3)])])]
    );

    // The refetches never land, so what's left is the patched cache.
    const fetches = vi.fn(() => new Promise(() => {}));
    queryClient.setQueryDefaults(["playable-rooms"], { queryFn: fetches });
    leaveTimeslot.mockResolvedValueOnce({ message: "left" });

    const mutation = setup(queryClient);
    mutation.mutate(10);
    await flushPromises();

    const ids = (day: string) =>
      (
        queryClient.getQueryData<ReturnType<typeof room>[]>([
          "playable-rooms",
          day,
        ]) ?? []
      ).map((r) => r.timeslots.map((t) => t.players.map((p) => p.id)));

    // Only slot 10 changes: the user's other seats and other people stay.
    expect(ids("mo")).toEqual([[[2], [1]], [[1]]]);
    expect(ids("tu")).toEqual([[[3]]]);
  });

  it("CARD-42: a failed leave leaves the cache alone", async () => {
    const queryClient = new QueryClient();
    const cached = [room(1, [slot(10, [player(1)])])];
    queryClient.setQueryData(["playable-rooms", "mo"], cached);
    leaveTimeslot.mockRejectedValueOnce(new Error("locked"));

    const mutation = setup(queryClient);
    mutation.mutate(10);
    await flushPromises();

    expect(queryClient.getQueryData(["playable-rooms", "mo"])).toEqual(cached);
  });
});
