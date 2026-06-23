import type { Server } from "socket.io";
import type { SlotStatus } from "@prisma/client";
import prisma from "./prisma.js";
import { timeslotQueue } from "./queues/timeslotQueue.js";
import type { TimeslotStatusChangedPayload } from "../packages/shared/index.js";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";
const SLOT_DURATION_MS = 60 * 60 * 1000;
const SLOT_DURATION_MINUTES = SLOT_DURATION_MS / (60 * 1000);

export const GO_LIVE = "go-live";
export const GO_ENDED = "go-ended";

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
  day: string;
  start_time: number;
};

let _io: Server;

export const emit = (
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

export const isInsideWindow = (day: string, startMinutes: number): boolean => {
  const now = new Date();
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= startMinutes && minutesNow < startMinutes + SLOT_DURATION_MINUTES;
};

// Converts a (day, minutes-from-midnight) pair into a "minute hour * * dow"
// cron pattern. minutesFromMidnight may exceed 1440 (e.g. start_time + 60 for
// a slot starting at 23:00+), in which case the day-of-week rolls over too.
const toCron = (day: string, minutesFromMidnight: number): string => {
  const wrapped = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const dayOffset = Math.floor(minutesFromMidnight / 1440);
  const dow = (DAY_INDEX[day] + dayOffset + 7) % 7;
  return `${wrapped % 60} ${Math.floor(wrapped / 60)} * * ${dow}`;
};

const liveSchedulerId = (slotId: number) => `slot-${slotId}-live`;
const endSchedulerId = (slotId: number) => `slot-${slotId}-end`;

const scheduleSlotJobs = async (slot: SlotInfo) => {
  await timeslotQueue.upsertJobScheduler(
    liveSchedulerId(slot.id),
    { pattern: toCron(slot.day, slot.start_time) },
    { name: GO_LIVE, data: { slotId: slot.id } }
  );
  await timeslotQueue.upsertJobScheduler(
    endSchedulerId(slot.id),
    { pattern: toCron(slot.day, slot.start_time + SLOT_DURATION_MINUTES) },
    { name: GO_ENDED, data: { slotId: slot.id } }
  );
};

const removeSlotJobs = async (slotId: number) => {
  await timeslotQueue.removeJobScheduler(liveSchedulerId(slotId));
  await timeslotQueue.removeJobScheduler(endSchedulerId(slotId));
};

// Fixes up slots whose transition was missed while the server was down:
// stuck "live" past the end of the window, or should already be "live" but
// isn't yet, by enqueuing an immediate one-off job.
const catchUp = async (slot: SlotInfo & { status: SlotStatus }) => {
  const inWindow = isInsideWindow(slot.day, slot.start_time);

  if (slot.status === "live" && !inWindow) {
    await timeslotQueue.add(GO_ENDED, { slotId: slot.id });
  } else if (slot.status !== "live" && inWindow) {
    await timeslotQueue.add(GO_LIVE, { slotId: slot.id });
  }
};

export const syncSlot = async (slotId: number) => {
  const slot = await prisma.roomTimeslot.findUnique({
    where: { id: slotId },
    select: { id: true, day: true, start_time: true, status: true, enabled: true },
  });

  if (!slot?.enabled) {
    await removeSlotJobs(slotId);
    return;
  }

  await scheduleSlotJobs(slot);
  await catchUp(slot);
};

export const startScheduler = async (io: Server) => {
  _io = io;

  const slots = await prisma.roomTimeslot.findMany({
    where: { enabled: true },
    select: { id: true, day: true, start_time: true, status: true },
  });

  for (const slot of slots) {
    await scheduleSlotJobs(slot);
    await catchUp(slot);
  }

  console.log(`Scheduler: ${slots.length} slot(s) loaded`);
};
