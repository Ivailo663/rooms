import type { Server } from "socket.io";
import prisma from "./prisma.js";
import type { TimeslotStatusChangedPayload } from "../packages/shared/index.js";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";
const SLOT_DURATION_MS = 60 * 60 * 1000;
const SLOT_DURATION_MINUTES = SLOT_DURATION_MS / (60 * 1000);

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

type SlotInfo = {
  id: number;
  roomId: number;
  day: string;
  start_time: number;
};

const timers = new Map<number, NodeJS.Timeout>();
let _io: Server;

// Returns the next Date at which this slot should go live.
// If today is the slot's day and we're still inside or before the window,
// returns today's occurrence. If the window has already ended today,
// returns next week's occurrence.
const nextSlotStart = (day: string, startMinutes: number): Date => {
  const now = new Date();
  const target = DAY_INDEX[day];
  let daysUntil = (target - now.getDay() + 7) % 7;

  if (daysUntil === 0) {
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    if (minutesNow >= startMinutes + SLOT_DURATION_MINUTES) daysUntil = 7;
  }

  const date = new Date(now);
  date.setDate(date.getDate() + daysUntil);
  date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  return date;
};

const cancelTimer = (slotId: number) => {
  const t = timers.get(slotId);
  if (t !== undefined) {
    clearTimeout(t);
    timers.delete(slotId);
  }
};

const emit = (
  slotId: number,
  roomId: number,
  status: TimeslotStatusChangedPayload["status"]
) => {
  _io.emit(TIMESLOT_STATUS_CHANGED_EVENT, {
    timeslotId: slotId,
    roomId,
    status,
  } satisfies TimeslotStatusChangedPayload);
};

const goEnded = async (slot: SlotInfo) => {
  try {
    await prisma.roomTimeslot.update({
      where: { id: slot.id },
      data: { status: "ended" },
    });
    emit(slot.id, slot.roomId, "ended");

    await prisma.roomTimeslot.update({
      where: { id: slot.id },
      data: { status: "scheduled" },
    });
    emit(slot.id, slot.roomId, "scheduled");

    scheduleSlot(slot);
  } catch (err) {
    console.error(`Scheduler: goEnded failed for slot ${slot.id}:`, err);
  }
};

const goLive = async (slot: SlotInfo) => {
  try {
    await prisma.roomTimeslot.update({
      where: { id: slot.id },
      data: { status: "live" },
    });
    emit(slot.id, slot.roomId, "live");
    const t = setTimeout(() => goEnded(slot), SLOT_DURATION_MS);
    timers.set(slot.id, t);
  } catch (err) {
    console.error(`Scheduler: goLive failed for slot ${slot.id}:`, err);
  }
};

const scheduleSlot = (slot: SlotInfo) => {
  cancelTimer(slot.id);

  const now = new Date();
  const start = nextSlotStart(slot.day, slot.start_time);
  const msToStart = start.getTime() - now.getTime();
  const msToEnd = start.getTime() + SLOT_DURATION_MS - now.getTime();

  if (msToStart <= 0) {
    // Server was down during the window — catch up: go live, schedule end for remaining time.
    prisma.roomTimeslot
      .update({ where: { id: slot.id }, data: { status: "live" } })
      .then(() => {
        emit(slot.id, slot.roomId, "live");
        const t = setTimeout(() => goEnded(slot), msToEnd);
        timers.set(slot.id, t);
      })
      .catch((err) =>
        console.error(`Scheduler: catch-up failed for slot ${slot.id}:`, err)
      );
    return;
  }

  const t = setTimeout(() => goLive(slot), msToStart);
  timers.set(slot.id, t);
};

const isInsideWindow = (day: string, startMinutes: number): boolean => {
  const now = new Date();
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= startMinutes && minutesNow < startMinutes + SLOT_DURATION_MINUTES;
};

export const syncSlot = async (slotId: number) => {
  cancelTimer(slotId);

  const slot = await prisma.roomTimeslot.findUnique({
    where: { id: slotId },
    select: { id: true, roomId: true, day: true, start_time: true, status: true, enabled: true },
  });

  if (!slot?.enabled) return;

  if (slot.status === "live" && !isInsideWindow(slot.day, slot.start_time)) {
    goEnded(slot);
  } else {
    scheduleSlot(slot);
  }
};

export const startScheduler = (io: Server) => {
  _io = io;

  prisma.roomTimeslot
    .findMany({
      where: { enabled: true },
      select: { id: true, roomId: true, day: true, start_time: true, status: true },
    })
    .then((slots) => {
      for (const { status, ...slot } of slots) {
        if (status === "live" && !isInsideWindow(slot.day, slot.start_time)) {
          // Stuck live slot from a previous session — end it now and reschedule.
          goEnded(slot);
        } else {
          scheduleSlot(slot);
        }
      }
      console.log(`Scheduler: ${slots.length} slot(s) loaded`);
    })
    .catch((err) => console.error("Scheduler: startup query failed:", err));
};
