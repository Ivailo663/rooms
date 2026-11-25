import { onMounted, shallowRef } from "vue";
import { vi } from "vitest";

// Embla needs real layout, so unit tests swap it for this stand-in:
// vi.mock("embla-carousel-vue", async () =>
//   (await import("./__tests__/fakeEmbla")).module)
// Real swiping and snapping is covered in e2e/playable-room-card.spec.ts.
//
// It lives under __tests__ because it imports vitest: that's the one path
// tsconfig.app.json excludes, so nothing in the app can reach for it by
// accident and drag the test framework along.
type Handler = () => void;

let node: HTMLElement | undefined;
let progress = 0;
let selected = 0;
let handlers: Record<string, Handler[]> = {};

const slideCount = () => node?.children[0]?.children.length ?? 0;

const api = {
  on: vi.fn((event: string, handler: Handler) => {
    (handlers[event] ??= []).push(handler);
    return api;
  }),
  scrollTo: vi.fn(),
  scrollSnapList: () => {
    const n = slideCount();
    return Array.from({ length: n }, (_, i) => (n > 1 ? i / (n - 1) : 0));
  },
  scrollProgress: () => progress,
  selectedScrollSnap: () => selected,
};

const emit = (event: string) => handlers[event]?.forEach((h) => h());

export const fakeEmbla = {
  api,
  options: undefined as Record<string, unknown> | undefined,
  // The strip moves to a slide mid-swipe: the scroll position changes, nothing
  // is settled yet.
  swipeTo: (index: number) => {
    const n = slideCount();
    progress = n > 1 ? index / (n - 1) : 0;
    emit("scroll");
  },
  // The strip comes to rest on a slide.
  settleOn: (index: number) => {
    selected = index;
    fakeEmbla.swipeTo(index);
    emit("settle");
  },
  reset: () => {
    node = undefined;
    progress = 0;
    selected = 0;
    handlers = {};
    api.on.mockClear();
    api.scrollTo.mockClear();
  },
};

export const module = {
  default: (options: { startIndex?: number } = {}) => {
    const element = shallowRef<HTMLElement>();
    const instance = shallowRef<typeof api>();
    onMounted(() => {
      node = element.value;
      fakeEmbla.options = options;
      selected = options.startIndex ?? 0;
      const n = slideCount();
      progress = n > 1 ? selected / (n - 1) : 0;
      instance.value = api;
    });
    return [element, instance];
  },
};
