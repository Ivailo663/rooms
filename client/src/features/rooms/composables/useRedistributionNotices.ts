import { reactive } from "vue";
import { socket } from "@/socket";
import type { TimeslotRedistributedPayload } from "@football/shared";

const TIMESLOT_REDISTRIBUTED_EVENT = "timeslot-redistributed";
const HIGHLIGHT_DURATION_MS = 30_000;

interface RedistributionNotice extends TimeslotRedistributedPayload {
  id: number;
}

// Module-level state: the socket listener is registered once for the whole
// app, not per component instance, so every room card / slot monitor reads
// from the same source instead of racing duplicate listeners.
const recentlyRedistributed = reactive(new Set<number>());
const notices = reactive<RedistributionNotice[]>([]);
const highlightTimers = new Map<number, ReturnType<typeof setTimeout>>();
let nextNoticeId = 0;

const handleRedistributed = (payload: TimeslotRedistributedPayload) => {
  recentlyRedistributed.add(payload.timeslotId);

  const existingTimer = highlightTimers.get(payload.timeslotId);
  if (existingTimer) clearTimeout(existingTimer);
  highlightTimers.set(
    payload.timeslotId,
    setTimeout(() => {
      recentlyRedistributed.delete(payload.timeslotId);
      highlightTimers.delete(payload.timeslotId);
    }, HIGHLIGHT_DURATION_MS)
  );

  notices.push({ ...payload, id: nextNoticeId++ });
};

socket.on(TIMESLOT_REDISTRIBUTED_EVENT, handleRedistributed);

export const useRedistributionNotices = () => {
  const isRecentlyRedistributed = (timeslotId: number) =>
    recentlyRedistributed.has(timeslotId);

  const noticesForTimeslot = (timeslotId: number) =>
    notices.filter((notice) => notice.timeslotId === timeslotId);

  const dismissNotice = (id: number) => {
    const index = notices.findIndex((notice) => notice.id === id);
    if (index !== -1) notices.splice(index, 1);
  };

  return { isRecentlyRedistributed, noticesForTimeslot, dismissNotice };
};
