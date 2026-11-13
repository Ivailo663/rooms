import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createMemoryHistory, createRouter } from "vue-router";
import type { PlayerProfile } from "@football/shared";
import { api } from "@/axios";
import { queryClient as appQueryClient } from "@/queryClient";
import PlayerDetailsCard from "./PlayerDetailsCard.vue";

const profile: PlayerProfile = {
  id: 4,
  name: "Ana Petrova",
  picture_url: null,
  position: "midfielder",
  city: "Varna",
  bio: "Left foot only",
  created_at: new Date(2025, 2, 14).toISOString(),
};

const card = () =>
  document.body.querySelector<HTMLElement>("[data-player-details-card]");

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: "/profiles/:id",
      name: "player-profile",
      component: { template: "<div />" },
    },
  ],
});

let wrappers: VueWrapper[] = [];

const mountCard = (queryClient = new QueryClient()) => {
  const wrapper = mount(PlayerDetailsCard, {
    props: {
      playerId: 4,
      name: "Ana Petrova",
      anchor: document.body,
    },
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
  });
  wrappers.push(wrapper);
  return wrapper;
};

afterEach(() => {
  wrappers.forEach((w) => w.unmount());
  wrappers = [];
  vi.restoreAllMocks();
});

describe("PlayerDetailsCard", () => {
  it("PROF-10: shows the player's name, position, city and member since", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: profile });

    mountCard();
    await flushPromises();

    expect(get).toHaveBeenCalledWith("/players/4");
    const text = card()!.textContent!;
    expect(text).toContain("Ana Petrova");
    expect(text).toContain("Midfielder");
    expect(text).toContain("Varna");
    expect(text).toContain("Mar 2025");
  });

  it("PROF-10: no picture shows initials, a picture shows the picture", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });
    mountCard();
    await flushPromises();
    expect(card()!.querySelector("img")).toBeNull();
    expect(card()!.textContent).toContain("AP");
  });

  it("PROF-10: shows the player's picture when there is one", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, picture_url: "https://example.test/ana.jpg" },
    });
    mountCard();
    await flushPromises();
    expect(card()!.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/ana.jpg"
    );
  });

  it("PROF-11: the details are this player's, with no hardcoded rating, games or attendance", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, position: null, city: null },
    });
    mountCard();
    await flushPromises();

    const text = card()!.textContent!;
    expect(text).not.toContain("Midfielder");
    expect(text).not.toContain("4.6");
    expect(text).not.toContain("Games played");
    expect(text).not.toContain("Attendance");
    expect(text).toContain("Not set");
  });

  it("PROF-11: a second open of the same player is served from the cache", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: profile });
    // The app's client, with its own stale time, is what the cache claim is about.
    const queryClient = appQueryClient;
    queryClient.clear();

    mountCard(queryClient).unmount();
    await flushPromises();
    wrappers = [];
    mountCard(queryClient);
    await flushPromises();

    expect(get).toHaveBeenCalledTimes(1);
    expect(card()!.textContent).toContain("Varna");
  });

  it("PROF-29: links to the player's profile page with View profile", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: profile });
    mountCard();
    await flushPromises();

    const link = card()!.querySelector("[data-view-profile]")!;
    expect(link.textContent!.trim()).toBe("View profile");
    expect(link.getAttribute("href")).toBe("/profiles/4");
  });

  it("PROF-32: never shows an email, even if one came back", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...profile, email: "ana@example.test" },
    });
    mountCard();
    await flushPromises();
    expect(card()!.textContent).not.toContain("ana@example.test");
  });
});
