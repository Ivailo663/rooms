import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import SlotRoster from "./SlotRoster.vue";

// The avatars inside open a details card that fetches the player's profile
// (PROF-11); nothing here opens one, so the fetch never settles.
vi.mock("@/features/profile/api", () => ({
  getPlayer: () => new Promise(() => {}),
}));

const players = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }));

let wrapper: VueWrapper | undefined;

const mountRoster = (joined: number, maxPlayers: number) => {
  wrapper = mount(SlotRoster, {
    props: { players: players(joined), maxPlayers, currentUserId: 1 },
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
  });
  return wrapper;
};

const openSeats = (w: VueWrapper) => w.findAll("[data-open-seat]");

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("SlotRoster open seats", () => {
  it("CARD-25: draws one dashed circle per open seat, after the avatars", () => {
    const w = mountRoster(7, 10);

    expect(openSeats(w)).toHaveLength(3);
    expect(openSeats(w)[0]!.classes()).toContain("border-dashed");

    // Order matters: the seats read as the remainder of the squad, so they
    // follow the avatar row rather than sitting before or around it.
    const seats = w.element.querySelectorAll("[data-open-seat]");
    const row = w.element.querySelector("ul")!;
    expect(row.compareDocumentPosition(seats[0]!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("CARD-25: a full squad draws none", () => {
    expect(openSeats(mountRoster(10, 10))).toHaveLength(0);
  });

  it("CARD-25: an over-full roster draws none, never a negative count", () => {
    expect(openSeats(mountRoster(12, 10))).toHaveLength(0);
  });

  // The live slot table is mostly games like this one, so a roster that is
  // nearly all gaps is the normal case rather than an extreme.
  it("CARD-25: a game with one player draws a ring for every empty seat", () => {
    const w = mountRoster(1, 12);

    expect(openSeats(w)).toHaveLength(11);
    expect(w.text()).toContain("11 spots left");
  });

  it("CARD-25: no cap — 20 gaps draw 20 rings", () => {
    expect(openSeats(mountRoster(2, 22))).toHaveLength(20);
  });

  it("CARD-27: the seats are decorative — not buttons, and hidden from screen readers", () => {
    const w = mountRoster(1, 5);

    // CARD-21's "N spots left" is the only place the count is announced, so
    // the circles must not repeat it.
    expect(openSeats(w).every((s) => s.attributes("aria-hidden") === "true"))
      .toBe(true);
    expect(w.findAll("button")).toHaveLength(1);
    expect(w.text()).toContain("4 spots left");
  });

  // jsdom doesn't lay anything out, so this checks the geometry that produces
  // the alignment instead of the painted result: both kinds of seat are placed
  // by inline styles, and a wrapped line starts at the strip's own padding.
  it("CARD-26: a wrapped line starts where the avatars start", () => {
    const w = mountRoster(3, 14);
    const px = (value: string) => parseFloat(value || "0");

    const row = w.element.querySelector("ul")!;
    const avatars = row.parentElement as HTMLElement;
    const strip = avatars.parentElement as HTMLElement;
    const firstAvatar = row.firstElementChild as HTMLElement;
    const ring = w.element.querySelector("[data-open-seat]") as HTMLElement;

    // The avatar row pins its own margin with `!m-0`, so only the wrapper's
    // shift counts here; a margin set on the row itself would never apply.
    const firstSeat =
      px(strip.style.paddingLeft) +
      px(avatars.style.marginLeft) +
      px(row.style.paddingLeft) +
      px(firstAvatar.style.marginLeft);
    const wrappedSeat = px(strip.style.paddingLeft) + px(ring.style.marginLeft);

    expect(wrappedSeat).toBe(firstSeat);
    // And neither hangs outside the card it sits in.
    expect(firstSeat).toBeGreaterThanOrEqual(0);
  });

  it("CARD-25: there is no progress bar left", () => {
    const w = mountRoster(5, 10);

    // The old meter was the only element carrying a width percentage.
    const widths = [...w.element.querySelectorAll("[style]")].map(
      (el) => (el as HTMLElement).style.width
    );
    expect(widths.some((width) => width.endsWith("%"))).toBe(false);
  });
});
