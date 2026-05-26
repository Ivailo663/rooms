import { nextTick, onMounted } from "vue";

export function useAfterPaint(callback: () => void) {
  onMounted(async () => {
    await nextTick();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        callback();
      });
    });
  });
}
