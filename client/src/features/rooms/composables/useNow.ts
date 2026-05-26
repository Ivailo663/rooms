import { ref, onMounted, onBeforeUnmount } from "vue";

export const useNow = (intervalMs = 30_000) => {
  const now = ref(new Date());
  let handle: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    handle = setInterval(() => {
      now.value = new Date();
    }, intervalMs);
  });

  onBeforeUnmount(() => {
    if (handle) clearInterval(handle);
  });

  return now;
};
