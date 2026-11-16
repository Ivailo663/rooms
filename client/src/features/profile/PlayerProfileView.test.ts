import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeEach,
  type Mock,
} from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type Router,
} from "vue-router";
import PrimeVue from "primevue/config";
import { AxiosError, AxiosHeaders } from "axios";
import type { Account, MediaItem, PlayerProfile } from "@football/shared";
import { api } from "@/axios";
import { Dialog } from "primevue";
import PlayerProfileView from "./PlayerProfileView.vue";
import MediaViewer from "./components/MediaViewer.vue";

const store = vi.hoisted(() => ({
  account: null as Account | null,
  setAccount(next: Account) {
    store.account = next;
  },
}));

vi.mock("@/stores/auth", async () => {
  const { reactive } = await import("vue");
  const reactiveStore = reactive(store);
  return { useAuthStore: () => reactiveStore };
});

const storage = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  getMediaUrl: vi.fn(async (path: string) => `https://cdn.test/${path}`),
}));
vi.mock("./api/storage", () => storage);

// Decoding and canvas work have their own test (shrinkPhoto.test.ts); here a
// photo shrinks to a 900-byte full copy and a 100-byte small one.
const shrink = vi.hoisted(() => ({ shrinkPhoto: vi.fn() }));
vi.mock("./composables/shrinkPhoto", () => shrink);
const shrunk = () => ({
  full: new Blob(["f".repeat(900)], { type: "image/jpeg" }),
  small: new Blob(["s".repeat(100)], { type: "image/jpeg" }),
});
vi.mock("@/firebase", () => ({ auth: { currentUser: { uid: "fb-ana" } } }));

// Reading a clip has its own test (readClip.test.ts); here a picked clip runs
// 12 seconds and its still is 50 bytes.
const clips = vi.hoisted(() => ({ openClip: vi.fn() }));
vi.mock("./composables/readClip", () => clips);
const close = vi.fn();
const opened = (
  duration = 12,
  poster: Blob | null = new Blob(["p".repeat(50)])
) => ({
  duration,
  poster: vi.fn(async () => poster),
  close,
});

const profile: PlayerProfile = {
  id: 4,
  name: "Ana Petrova",
  picture_url: null,
  position: "midfielder",
  city: "Varna",
  bio: "Left foot only",
  created_at: new Date(2025, 2, 14).toISOString(),
};

const photo = (id: number): MediaItem => ({
  id,
  kind: "photo",
  path: `players/fb-ana/${id}.jpg`,
  poster_path: null,
  created_at: new Date(2026, 10, id).toISOString(),
});

const clip = (id: number): MediaItem => ({
  id,
  kind: "video",
  path: `players/fb-ana/${id}.mov`,
  poster_path: `players/fb-ana/${id}-small.jpg`,
  created_at: new Date(2026, 10, id).toISOString(),
});

const httpError = (status: number, data: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

// Answers GET by URL: the cities list for the edit dialog, the media list
// (read through a getter so a test can change it between requests), and the
// profile with any saved changes from the store.
const mockGet = (
  media: () => MediaItem[] = () => [],
  player: Partial<PlayerProfile> = {}
) =>
  vi.spyOn(api, "get").mockImplementation(async (url: string) => ({
    data:
      url === "/cities"
        ? ["Varna"]
        : url.endsWith("/media")
          ? media()
          : { ...profile, ...store.account, ...player },
  }));

const routes = [
  { path: "/", name: "home", component: { template: "<div />" } },
];
const router = createRouter({ history: createMemoryHistory(), routes });

let wrapper: VueWrapper | undefined;

const mountView = (id = 4, withRouter: Router = router) => {
  wrapper = mount(PlayerProfileView, {
    props: { id },
    global: {
      plugins: [
        PrimeVue,
        withRouter,
        [VueQueryPlugin, { queryClient: new QueryClient() }],
      ],
    },
    attachTo: document.body,
  });
  return wrapper;
};

// The dialog is teleported to <body>.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const account = {
  ...profile,
  email: "ana@example.test",
  terms_accepted_at: new Date(2026, 10, 1).toISOString(),
} as unknown as Account;

beforeEach(async () => {
  await router.replace("/");
  store.account = null;
  // PrimeVue's Select and Textarea (in the dialog) need these; jsdom has
  // neither.
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  // jsdom has no object URLs; an upload's preview needs one.
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => {};
  storage.uploadFile.mockReset();
  storage.getMediaUrl.mockClear();
  shrink.shrinkPhoto.mockReset().mockImplementation(async () => shrunk());
  clips.openClip.mockReset().mockImplementation(async () => opened());
  close.mockReset();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlayerProfileView", () => {
  it("PROF-29: shows the player from GET /players/:id", async () => {
    const get = mockGet();

    const view = mountView();
    await flushPromises();

    expect(get).toHaveBeenCalledWith("/players/4");
    expect(view.find("h1").text()).toBe("Ana Petrova");
  });

  it("PROF-29: an unknown id shows Player not found, without retrying", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockRejectedValue(httpError(404, "Player not found"));

    const view = mountView(999);
    await flushPromises();

    expect(view.find("[data-not-found]").text()).toContain("Player not found");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("NAV-12: the page floats a back arrow, whether the player loads or not", async () => {
    mockGet();
    const view = mountView();
    await flushPromises();
    expect(view.find('button[aria-label="Back"]').exists()).toBe(true);
    view.unmount();

    const missing = mountView(Number("abc"));
    await flushPromises();
    expect(missing.find('button[aria-label="Back"]').exists()).toBe(true);
  });

  it("PROF-29: an id that isn't a number shows Player not found and asks nothing", async () => {
    const get = vi.spyOn(api, "get");

    const view = mountView(Number("abc"));
    await flushPromises();

    expect(view.find("[data-not-found]").exists()).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it("PROF-70: a round picture, initials when there's none, and the details with icons", async () => {
    mockGet();

    const view = mountView();
    await flushPromises();

    expect(view.find("img").exists()).toBe(false);
    expect(view.text()).toContain("AP");
    const meta = view.find("[data-profile-meta]");
    expect(meta.text()).toContain("Midfielder");
    expect(meta.text()).toContain("Varna");
    expect(meta.text()).toContain("Member since Mar 2025");
    expect(meta.findAll("i")).toHaveLength(3);
  });

  it("PROF-70: shows the picture when there is one", async () => {
    mockGet(undefined, { picture_url: "https://example.test/ana.jpg" });

    const view = mountView();
    await flushPromises();

    expect(view.find("img").attributes("src")).toBe(
      "https://example.test/ana.jpg"
    );
  });

  it("PROF-70: an unset position or city drops out of the details", async () => {
    mockGet(undefined, { position: null, city: null });

    const view = mountView();
    await flushPromises();

    const meta = view.find("[data-profile-meta]");
    expect(meta.findAll("li")).toHaveLength(1);
    expect(meta.text()).not.toContain("Not set");
  });

  it("PROF-32: never shows an email, even if one came back", async () => {
    mockGet(undefined, { email: "ana@example.test" } as Partial<PlayerProfile>);

    const view = mountView();
    await flushPromises();

    expect(view.text()).not.toContain("ana@example.test");
  });

  it("PROF-74: your own page shows Edit and Add, even with an empty grid", async () => {
    store.account = { id: 4 } as Account;
    mockGet();

    const view = mountView();
    await flushPromises();

    const actions = view.find("[data-own-actions]");
    expect(actions.find("[data-edit-profile]").text()).toBe("Edit");
    const add = actions.find("[data-add-media]");
    expect(add.text()).toBe("Add");
    expect(add.attributes("disabled")).toBeUndefined();
    expect(view.text()).not.toContain("Coming soon");
  });

  it("PROF-74: someone else's page has no Edit or Add", async () => {
    store.account = { id: 7 } as Account;
    mockGet();

    const view = mountView();
    await flushPromises();

    expect(view.find("[data-own-actions]").exists()).toBe(false);
    expect(view.find("[data-edit-profile]").exists()).toBe(false);
    expect(view.find("[data-add-media]").exists()).toBe(false);
  });

  it("PROF-28: Edit opens the dialog with the profile fields", async () => {
    store.account = { ...account };
    mockGet();

    const view = mountView();
    await flushPromises();
    expect(dialog()).toBeNull();

    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    expect(dialog()?.textContent).toContain("Edit profile");
    expect(
      dialog()?.querySelector<HTMLInputElement>("#profile-name")?.value
    ).toBe("Ana Petrova");
  });

  it("PROF-28: ✕ turns into ✓ on a change, and ✓ saves, closes and updates the page", async () => {
    store.account = { ...account };
    mockGet();
    vi.spyOn(api, "patch").mockImplementation(async (_url, body) => ({
      data: { ...store.account, ...(body as object) },
    }));

    const view = mountView();
    await flushPromises();
    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    const input = dialog()!.querySelector<HTMLInputElement>("#profile-name")!;
    input.value = "Ana P.";
    expect(dialog()!.querySelector("[data-close]")).not.toBeNull();
    input.dispatchEvent(new Event("input"));
    await flushPromises();

    expect(dialog()!.querySelector("[data-close]")).toBeNull();
    dialog()!.querySelector<HTMLButtonElement>("[data-save]")!.click();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);

    expect(view.find("h1").text()).toBe("Ana P.");
    expect(dialog()).toBeNull();
  });

  it("PROF-28: closing with ✕ when nothing changed sends nothing", async () => {
    store.account = { ...account };
    mockGet();
    const patch = vi.spyOn(api, "patch");

    const view = mountView();
    await flushPromises();
    await view.find("[data-edit-profile]").trigger("click");
    await flushPromises();

    dialog()!.querySelector<HTMLButtonElement>("[data-close]")!.click();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);

    expect(patch).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("PROF-75: your own empty grid says Add your first photo or clip, and nothing else", async () => {
    store.account = { id: 4 } as Account;
    mockGet();

    const view = mountView();
    await flushPromises();

    const grid = view.find("[data-profile-grid]");
    expect(grid.text()).toBe("Add your first photo or clip");
    expect(grid.find("button").exists()).toBe(false);
  });

  it("PROF-75: someone else's empty grid says No posts yet", async () => {
    store.account = { id: 7 } as Account;
    mockGet();

    const view = mountView();
    await flushPromises();

    const grid = view.find("[data-profile-grid]");
    expect(grid.text()).toContain("No posts yet");
    expect(grid.text()).not.toContain("Add your first photo or clip");
  });

  describe("media", () => {
    const pick = async (view: VueWrapper, files: File[]) => {
      const input = view.find<HTMLInputElement>("[data-media-picker]");
      Object.defineProperty(input.element, "files", {
        value: files,
        configurable: true,
      });
      await input.trigger("change");
      await flushPromises();
    };

    it("PROF-60: Add opens the file picker, which offers photos and clips", async () => {
      store.account = { id: 4 } as Account;
      mockGet();

      const view = mountView();
      await flushPromises();

      const picker = view.find<HTMLInputElement>("[data-media-picker]");
      const click = vi.spyOn(picker.element, "click");
      await view.find("[data-add-media]").trigger("click");

      expect(click).toHaveBeenCalled();
      expect(picker.attributes("accept")).toContain("image/heic");
      expect(picker.attributes("accept")).toContain("video/quicktime");
    });

    it("PROF-72: the grid shows every item's small copy in the server's order, three per row, lazily", async () => {
      store.account = { id: 7 } as Account;
      const get = mockGet(() => [
        { ...photo(3), poster_path: "players/fb-ana/3-small.jpg" },
        photo(2),
        photo(1),
      ]);

      const view = mountView();
      await flushPromises();

      expect(get).toHaveBeenCalledWith("/players/4/media");
      const grid = view.find("[data-profile-grid] ul");
      expect(grid.classes()).toContain("grid-cols-3");
      const images = grid.findAll("img");
      expect(images.map((img) => img.attributes("src"))).toEqual([
        "https://cdn.test/players/fb-ana/3-small.jpg",
        // Items from before the small copy existed show the full one.
        "https://cdn.test/players/fb-ana/2.jpg",
        "https://cdn.test/players/fb-ana/1.jpg",
      ]);
      expect(images[0]!.attributes("loading")).toBe("lazy");
    });

    it("PROF-60: a file of another type is refused with the reason, and nothing is uploaded", async () => {
      store.account = { id: 4 } as Account;
      mockGet();
      const post = vi.spyOn(api, "post");

      const view = mountView();
      await flushPromises();
      await pick(view, [new File(["x"], "funny.gif", { type: "image/gif" })]);

      expect(view.find("[data-media-refusal]").text()).toContain(
        "JPEG, PNG, WebP or HEIC photo, or an MP4 or MOV clip"
      );
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(view.find("[data-pending-upload]").exists()).toBe(false);
    });

    it("PROF-67: a photo is shrunk, both copies go to the player's own folder, then to the server, and it shows first with progress meanwhile", async () => {
      store.account = { id: 4 } as Account;
      let media = [photo(1)];
      mockGet(() => media);
      const progress: Record<string, (fraction: number) => void> = {};
      const finish: (() => void)[] = [];
      storage.uploadFile.mockImplementation(
        (
          path: string,
          _file: Blob,
          _type: string,
          onProgress: (fraction: number) => void
        ) =>
          new Promise<void>((resolve) => {
            progress[path] = onProgress;
            finish.push(resolve);
          })
      );
      const post = vi.spyOn(api, "post").mockImplementation(async () => {
        media = [photo(9), photo(1)];
        return { data: photo(9) };
      });

      const view = mountView();
      await flushPromises();
      const original = new File(["x"], "me.png", { type: "image/png" });
      await pick(view, [original]);

      expect(shrink.shrinkPhoto).toHaveBeenCalledWith(original);
      const calls = storage.uploadFile.mock.calls;
      expect(calls).toHaveLength(2);
      const [path, full, fullType] = calls[0]!;
      const [posterPath, small, smallType] = calls[1]!;
      expect(path).toMatch(/^players\/fb-ana\/[\w-]+\.jpg$/);
      expect(posterPath).toBe(path.replace(/\.jpg$/, "-small.jpg"));
      expect([full.size, small.size]).toEqual([900, 100]);
      expect([fullType, smallType]).toEqual(["image/jpeg", "image/jpeg"]);
      expect(post).not.toHaveBeenCalled();

      // One bar for both files, by bytes: half the full copy and all of the
      // small one is 550 of 1000.
      progress[path]!(0.5);
      progress[posterPath]!(1);
      await flushPromises();
      const pending = view.find("[data-pending-upload]");
      expect(
        pending.find('[role="progressbar"]').attributes("aria-valuenow")
      ).toBe("55");
      expect(view.find("[data-profile-grid] li").element).toBe(pending.element);

      finish[1]!();
      await flushPromises();
      expect(post).not.toHaveBeenCalled();

      finish[0]!();
      await flushPromises();

      expect(post).toHaveBeenCalledWith("/media", {
        kind: "photo",
        path,
        posterPath,
      });
      expect(view.find("[data-pending-upload]").exists()).toBe(false);
      expect(view.findAll("[data-media-tile]")).toHaveLength(2);
    });

    it("PROF-67: a clip goes up as it is, with its still beside it, then to the server; its tile shows the still and a play mark", async () => {
      store.account = { id: 4 } as Account;
      let media: MediaItem[] = [];
      mockGet(() => media);
      storage.uploadFile.mockResolvedValue(undefined);
      const post = vi.spyOn(api, "post").mockImplementation(async () => {
        media = [clip(9)];
        return { data: clip(9) };
      });
      let finishRead: () => void = () => {};
      clips.openClip.mockImplementation(
        () => new Promise((resolve) => (finishRead = () => resolve(opened())))
      );

      const view = mountView();
      await flushPromises();
      const original = new File(["m".repeat(950)], "IMG_1.MOV", { type: "" });
      await pick(view, [original]);

      // While the clip is read, its tile is already there, marked as a clip.
      const pending = view.find("[data-pending-upload]");
      expect(
        pending.find('[role="progressbar"]').attributes("aria-label")
      ).toBe("Uploading clip");
      expect(pending.find(".fa-play").exists()).toBe(true);

      finishRead();
      await flushPromises();

      expect(clips.openClip).toHaveBeenCalledWith(original);
      expect(shrink.shrinkPhoto).not.toHaveBeenCalled();
      const calls = storage.uploadFile.mock.calls;
      const [path, file, type] = calls[0]!;
      const [posterPath, still, stillType] = calls[1]!;
      expect(path).toMatch(/^players\/fb-ana\/[\w-]+\.mov$/);
      expect(file).toBe(original);
      expect(type).toBe("video/quicktime");
      expect(posterPath).toBe(path.replace(/\.mov$/, "-small.jpg"));
      expect([still.size, stillType]).toEqual([50, "image/jpeg"]);
      expect(close).toHaveBeenCalled();
      expect(post).toHaveBeenCalledWith("/media", {
        kind: "video",
        path,
        posterPath,
      });

      const tile = view.find("[data-media-tile]");
      expect(tile.find("img").attributes("src")).toBe(
        "https://cdn.test/players/fb-ana/9-small.jpg"
      );
      expect(tile.find("[data-play-mark]").exists()).toBe(true);
      expect(tile.find("[data-open-media]").attributes("aria-label")).toBe(
        "Open clip"
      );
      // PROF-72: the grid loads only the still, never the clip.
      expect(storage.getMediaUrl).not.toHaveBeenCalledWith(
        "players/fb-ana/9.mov"
      );
    });

    it("PROF-60: a clip over 30 seconds is refused with the reason, and nothing is uploaded", async () => {
      store.account = { id: 4 } as Account;
      mockGet();
      const post = vi.spyOn(api, "post");
      const tooLong = opened(42);
      clips.openClip.mockResolvedValue(tooLong);

      const view = mountView();
      await flushPromises();
      await pick(view, [new File(["x"], "match.mp4", { type: "video/mp4" })]);

      expect(view.find("[data-media-refusal]").text()).toBe(
        '"match.mp4" is longer than 30 seconds. Trim it and try again.'
      );
      expect(tooLong.poster).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(view.find("[data-pending-upload]").exists()).toBe(false);
    });

    it("PROF-60: a clip this device can't read, or can't take a still from, is refused with the reason", async () => {
      store.account = { id: 4 } as Account;
      mockGet();
      const post = vi.spyOn(api, "post");
      clips.openClip.mockResolvedValueOnce(null);
      clips.openClip.mockResolvedValueOnce(opened(12, null));

      const view = mountView();
      await flushPromises();
      await pick(view, [
        new File(["x"], "IMG_2.mov", { type: "video/quicktime" }),
      ]);
      expect(view.find("[data-media-refusal]").text()).toBe(
        '"IMG_2.mov" can\'t be played on this device. Try an MP4.'
      );

      await pick(view, [
        new File(["x"], "IMG_3.mov", { type: "video/quicktime" }),
      ]);
      expect(view.find("[data-media-refusal]").text()).toBe(
        '"IMG_3.mov" can\'t be played on this device. Try an MP4.'
      );
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    it("PROF-60: a photo this device can't decode is refused with the reason, and nothing is uploaded", async () => {
      store.account = { id: 4 } as Account;
      mockGet();
      const post = vi.spyOn(api, "post");
      shrink.shrinkPhoto.mockResolvedValue(null);

      const view = mountView();
      await flushPromises();
      await pick(view, [new File(["x"], "IMG_1.HEIC", { type: "" })]);

      expect(view.find("[data-media-refusal]").text()).toBe(
        '"IMG_1.HEIC" can\'t be opened on this device. Try a JPEG or PNG.'
      );
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(view.find("[data-pending-upload]").exists()).toBe(false);
    });

    it("PROF-67: when the server refuses, the item shows why and can be dismissed", async () => {
      store.account = { id: 4 } as Account;
      mockGet();
      storage.uploadFile.mockResolvedValue(undefined);
      vi.spyOn(api, "post").mockRejectedValue(
        httpError(400, "Upload the file first")
      );

      const view = mountView();
      await flushPromises();
      await pick(view, [new File(["x"], "me.jpg", { type: "image/jpeg" })]);

      const pending = view.find("[data-pending-upload]");
      expect(pending.find('[role="alert"]').text()).toBe(
        "Upload the file first"
      );

      await pending.find("[data-dismiss-upload]").trigger("click");
      expect(view.find("[data-pending-upload]").exists()).toBe(false);
      expect(view.find("[data-profile-grid]").text()).toBe(
        "Add your first photo or clip"
      );
    });

    it("PROF-74: your own item is deleted by tapping its delete button and confirming", async () => {
      store.account = { id: 4 } as Account;
      let media = [photo(2), photo(1)];
      mockGet(() => media);
      const del = vi.spyOn(api, "delete").mockImplementation(async () => {
        media = [photo(1)];
        return { data: "" };
      });

      const view = mountView();
      await flushPromises();

      const first = () => view.find("[data-media-tile]");
      await first().find("[data-delete-media]").trigger("click");
      expect(del).not.toHaveBeenCalled();

      await first().find("[data-keep]").trigger("click");
      expect(first().find("[data-confirm-delete]").exists()).toBe(false);

      await first().find("[data-delete-media]").trigger("click");
      await first().find("[data-confirm]").trigger("click");
      await flushPromises();

      expect(del).toHaveBeenCalledWith("/media/2");
      expect(view.findAll("[data-media-tile]")).toHaveLength(1);
    });

    it("PROF-62: someone else's items have no delete button", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(1)]);

      const view = mountView();
      await flushPromises();

      expect(view.find("[data-media-tile]").exists()).toBe(true);
      expect(view.find("[data-delete-media]").exists()).toBe(false);
    });
  });
  describe("viewer", () => {
    const withSmall = (id: number): MediaItem => ({
      ...photo(id),
      poster_path: `players/fb-ana/${id}-small.jpg`,
    });
    const viewer = () =>
      document.querySelector<HTMLElement>("[data-media-feed]");
    const slides = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-media-slide]"));
    const open = async (view: VueWrapper, nth: number) => {
      await view.findAll("[data-open-media]")[nth]!.trigger("click");
      await flushPromises();
    };
    // jsdom has no layout: give the feed a screen height and scroll it.
    const swipeTo = async (nth: number) => {
      const feed = viewer()!;
      Object.defineProperty(feed, "clientHeight", { value: 800 });
      feed.scrollTop = nth * 800;
      feed.dispatchEvent(new Event("scroll"));
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();
    };

    it("PROF-73: tapping an item opens it full screen, the full copy over the small one, with its neighbours loading", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [withSmall(4), withSmall(3), withSmall(2), withSmall(1)]);

      const view = mountView();
      await flushPromises();
      expect(viewer()).toBeNull();
      await open(view, 1);

      expect(router.currentRoute.value.query.media).toBe("3");
      expect(slides().map((slide) => slide.getAttribute("aria-label"))).toEqual(
        ["1 of 4", "2 of 4", "3 of 4", "4 of 4"]
      );
      const shown = slides()[1]!;
      expect(shown.querySelector("[data-full-copy]")?.getAttribute("src")).toBe(
        "https://cdn.test/players/fb-ana/3.jpg"
      );
      expect(
        shown.querySelector("[data-small-copy]")?.getAttribute("src")
      ).toBe("https://cdn.test/players/fb-ana/3-small.jpg");
      // The one before and the one after are ready to swipe to; the rest wait.
      expect(slides()[0]!.querySelector("[data-full-copy]")).not.toBeNull();
      expect(slides()[2]!.querySelector("[data-full-copy]")).not.toBeNull();
      expect(slides()[3]!.querySelector("img")).toBeNull();
    });

    it("PROF-73: swiping moves through the items in grid order, replacing the address so one back still closes", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(4), photo(3), photo(2), photo(1)]);

      const view = mountView();
      await flushPromises();
      await open(view, 0);
      const push = vi.spyOn(router, "push");

      await swipeTo(2);
      expect(router.currentRoute.value.query.media).toBe("2");
      expect(slides()[3]!.querySelector("[data-full-copy]")).not.toBeNull();
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        "3 of 4"
      );

      await swipeTo(1);
      expect(router.currentRoute.value.query.media).toBe("3");
      expect(push).not.toHaveBeenCalled();
    });

    it("PROF-73: a link with ?media opens the viewer; ✕ then clears it and stays on the page", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(2), photo(1)]);
      await router.replace("/?media=1");

      mountView();
      await flushPromises();
      expect(viewer()).not.toBeNull();
      expect(document.activeElement).toBe(viewer());

      document.querySelector<HTMLElement>("[data-close-viewer]")!.click();
      await flushPromises();

      expect(router.currentRoute.value.fullPath).toBe("/");
      expect(viewer()).toBeNull();
      expect(document.querySelector("[data-profile-grid]")).not.toBeNull();
    });

    it("PROF-73: a link to an item that's gone clears ?media", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(2)]);
      await router.replace("/?media=99");

      mountView();
      await flushPromises();

      expect(router.currentRoute.value.fullPath).toBe("/");
      expect(viewer()).toBeNull();
    });

    it("PROF-73: opened from the grid, ✕, Escape and back all go back, closing the viewer and keeping the page", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(2), photo(1)]);
      const webRouter = createRouter({ history: createWebHistory(), routes });
      await webRouter.push("/");
      const back = vi.spyOn(webRouter, "back");

      const view = mountView(4, webRouter);
      await flushPromises();
      await open(view, 1);
      expect(webRouter.currentRoute.value.query.media).toBe("1");

      document.querySelector<HTMLElement>("[data-close-viewer]")!.click();
      expect(back).toHaveBeenCalledTimes(1);

      // Escape: PrimeVue binds it on the open transition, which the test
      // renderer skips, so ask the dialog to close the way Escape does.
      view
        .findComponent(MediaViewer)
        .findComponent(Dialog)
        .vm.$emit("update:visible", false);
      expect(back).toHaveBeenCalledTimes(2);

      // The browser's back (or the NAV-11 swipe) lands on the page without
      // ?media, and the viewer follows the address.
      await webRouter.replace("/");
      await flushPromises();
      expect(viewer()).toBeNull();
      expect(view.find("h1").text()).toBe("Ana Petrova");
    });

    it("PROF-74: your own item is deleted from the viewer, which moves to the next, then closes when none are left", async () => {
      store.account = { id: 4 } as Account;
      let media = [photo(3), photo(2), photo(1)];
      mockGet(() => media);
      const del = vi
        .spyOn(api, "delete")
        .mockImplementation(async (url: string) => {
          const id = Number(url.split("/").pop());
          media = media.filter((item) => item.id !== id);
          return { data: "" };
        });

      const view = mountView();
      await flushPromises();
      await open(view, 1);

      const confirmDelete = async () => {
        document
          .querySelector<HTMLElement>("[role='dialog'] [data-delete-media]")!
          .click();
        await flushPromises();
        document
          .querySelector<HTMLElement>("[role='dialog'] [data-confirm]")!
          .click();
        await flushPromises();
        await vi.advanceTimersByTimeAsync(200);
        await flushPromises();
      };

      await confirmDelete();
      expect(del).toHaveBeenCalledWith("/media/2");
      expect(router.currentRoute.value.query.media).toBe("1");
      expect(slides()).toHaveLength(2);

      await confirmDelete();
      await confirmDelete();
      expect(media).toEqual([]);
      expect(viewer()).toBeNull();
      expect(router.currentRoute.value.query.media).toBeUndefined();
    });

    it("PROF-74: Escape backs out of the delete confirm without closing the viewer", async () => {
      store.account = { id: 4 } as Account;
      mockGet(() => [photo(1)]);

      const view = mountView();
      await flushPromises();
      await open(view, 0);

      document
        .querySelector<HTMLElement>("[role='dialog'] [data-delete-media]")!
        .click();
      await flushPromises();
      const keep = document.querySelector<HTMLElement>(
        "[role='dialog'] [data-keep]"
      )!;
      expect(document.activeElement).toBe(keep);
      keep.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        })
      );
      await flushPromises();

      expect(
        document.querySelector("[role='dialog'] [data-confirm-delete]")
      ).toBeNull();
      expect(viewer()).not.toBeNull();
    });

    it("PROF-62: someone else's viewer has no delete", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(1)]);

      const view = mountView();
      await flushPromises();
      await open(view, 0);

      expect(viewer()).not.toBeNull();
      expect(document.querySelector("[data-delete-media]")).toBeNull();
    });

    describe("clips", () => {
      // jsdom plays nothing; play and pause are recorded per element, and a
      // play that goes through leaves the element playing.
      let play: Mock<(el: HTMLMediaElement) => Promise<void>>;
      let pause: Mock<(el: HTMLMediaElement) => void>;
      const setPaused = (el: HTMLMediaElement, value: boolean) =>
        Object.defineProperty(el, "paused", { value, configurable: true });
      beforeEach(() => {
        play = vi.fn(async () => {});
        pause = vi.fn();
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
          async function (this: HTMLMediaElement) {
            await play(this);
            setPaused(this, false);
          }
        );
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
          function (this: HTMLMediaElement) {
            pause(this);
            setPaused(this, true);
          }
        );
      });
      const clipIn = (nth: number) =>
        slides()[nth]!.querySelector<HTMLVideoElement>("[data-clip]");
      const tap = async () => {
        document.querySelector<HTMLElement>("[data-toggle-mute]")!.click();
        await flushPromises();
      };

      it("PROF-73: an opened clip plays with sound, looping and inline, over its still; the next one only reads ahead", async () => {
        store.account = { id: 7 } as Account;
        mockGet(() => [photo(3), clip(2), clip(1)]);

        const view = mountView();
        await flushPromises();
        await open(view, 1);

        const shown = clipIn(1)!;
        expect(shown.getAttribute("src")).toBe(
          "https://cdn.test/players/fb-ana/2.mov"
        );
        expect(shown.loop).toBe(true);
        expect(shown.hasAttribute("playsinline")).toBe(true);
        expect(shown.preload).toBe("auto");
        expect(play).toHaveBeenCalledTimes(1);
        expect(play).toHaveBeenCalledWith(shown);
        expect(shown.muted).toBe(false);
        expect(document.querySelector("[data-muted]")).toBeNull();

        // The still shows until the clip is actually playing.
        const still = slides()[1]!.querySelector("[data-small-copy]")!;
        expect(still.getAttribute("src")).toBe(
          "https://cdn.test/players/fb-ana/2-small.jpg"
        );
        expect(shown.classList).toContain("opacity-0");
        shown.dispatchEvent(new Event("playing"));
        await flushPromises();
        expect(shown.classList).toContain("opacity-100");
        expect(still.classList).toContain("opacity-0");

        expect(clipIn(2)!.preload).toBe("metadata");
        expect(slides()[0]!.querySelector("[data-toggle-mute]")).toBeNull();
      });

      it("PROF-73: swiping away stops the clip and rewinds it; the next one plays once the feed rests", async () => {
        store.account = { id: 7 } as Account;
        mockGet(() => [clip(2), clip(1)]);

        const view = mountView();
        await flushPromises();
        await open(view, 0);
        const first = clipIn(0)!;
        first.currentTime = 5;
        play.mockClear();

        const feed = viewer()!;
        Object.defineProperty(feed, "clientHeight", { value: 800 });
        feed.scrollTop = 800;
        feed.dispatchEvent(new Event("scroll"));
        await flushPromises();

        expect(pause).toHaveBeenCalledWith(first);
        expect(first.currentTime).toBe(0);
        expect(play).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(200);
        await flushPromises();
        expect(play).toHaveBeenCalledWith(clipIn(1));
      });

      it("PROF-73: a tap mutes or unmutes, flashing the new state, and muting holds for the next clip", async () => {
        store.account = { id: 7 } as Account;
        mockGet(() => [clip(2), clip(1)]);

        const view = mountView();
        await flushPromises();
        await open(view, 0);

        await tap();
        expect(clipIn(0)!.muted).toBe(true);
        expect(
          document
            .querySelector("[data-toggle-mute]")!
            .getAttribute("aria-label")
        ).toBe("Unmute");
        expect(document.querySelector("[data-muted]")).not.toBeNull();
        expect(
          document.querySelector("[data-mute-flash] .fa-volume-xmark")
        ).not.toBeNull();
        await vi.advanceTimersByTimeAsync(700);
        expect(document.querySelector("[data-mute-flash]")).toBeNull();

        await swipeTo(1);
        expect(play).toHaveBeenLastCalledWith(clipIn(1));
        expect(clipIn(1)!.muted).toBe(true);

        await tap();
        expect(clipIn(1)!.muted).toBe(false);
        expect(document.querySelector("[data-muted]")).toBeNull();
        expect(
          document.querySelector("[data-mute-flash] .fa-volume-high")
        ).not.toBeNull();
      });

      it("PROF-73: where the browser won't start a clip with sound, it plays muted and says so, and a tap unmutes", async () => {
        store.account = { id: 7 } as Account;
        mockGet(() => [clip(1)]);
        play.mockImplementation(async (el: HTMLMediaElement) => {
          if (!el.muted) throw new DOMException("gesture", "NotAllowedError");
        });

        const view = mountView();
        await flushPromises();
        await open(view, 0);

        const shown = clipIn(0)!;
        expect(play).toHaveBeenCalledTimes(2);
        expect(shown.muted).toBe(true);
        expect(document.querySelector("[data-muted]")).not.toBeNull();

        await tap();
        expect(shown.muted).toBe(false);
        expect(document.querySelector("[data-muted]")).toBeNull();
      });
    });

    it("NAV-10: a swipe in the viewer never reaches the drawer, but the left edge's back (NAV-11) does", async () => {
      store.account = { id: 7 } as Account;
      mockGet(() => [photo(1)]);
      const reached = vi.fn();
      window.addEventListener("touchstart", reached);

      const view = mountView();
      await flushPromises();
      await open(view, 0);

      const touchAt = (clientX: number) => {
        const event = new Event("touchstart", { bubbles: true });
        Object.assign(event, { touches: [{ clientX, clientY: 300 }] });
        viewer()!.dispatchEvent(event);
      };
      touchAt(370);
      expect(reached).not.toHaveBeenCalled();
      touchAt(5);
      expect(reached).toHaveBeenCalledTimes(1);
      window.removeEventListener("touchstart", reached);
    });
  });
});
