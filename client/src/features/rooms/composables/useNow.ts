import { ref, onMounted, onBeforeUnmount } from "vue";

const TICK_MS = 30_000;

// One clock for the whole app, so every component reading it ticks together.
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;
let readers = 0;

const tick = () => {
  now.value = new Date();
};

// Runs only while something is mounted that reads it.
export const useNow = () => {
  onMounted(() => {
    readers += 1;
    if (timer) return;

    tick(); // update now, right this moment
    timer = setInterval(tick, TICK_MS); // and again every 30 s from here on
  });

  onBeforeUnmount(() => {
    readers -= 1;
    if (readers > 0) return;

    clearInterval(timer);
    timer = undefined;
  });

  return now;
};
