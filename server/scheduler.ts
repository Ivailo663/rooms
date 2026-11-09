import type { Server } from "socket.io";
import type { SlotStatus } from "@prisma/client";
import prisma from "./prisma.js";
import { timeslotQueue } from "./queues/timeslotQueue.js";
import type { TimeslotStatusChangedPayload } from "../packages/shared/index.js";
import {
  SLOT_DURATION_MINUTES,
  isInsideWindow,
  resolveCutoff,
  toCron,
} from "./slotRules.js";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";
// How often to re-check every slot's status against the wall clock. Delayed
// BullMQ jobs handle the exact transitions while the process is alive, but a
// slot can be orphaned in "live" if the server is down (or Redis loses the
// job) across its end boundary. This sweep heals such slots within a minute.
const RECONCILE_INTERVAL_MS = 60 * 1000;

export const GO_LIVE = "go-live";
export const GO_ENDED = "go-ended";
export const GO_REDISTRIBUTE = "go-redistribute";

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

const liveSchedulerId = (slotId: number) => `slot-${slotId}-live`;
const endSchedulerId = (slotId: number) => `slot-${slotId}-end`;
const redistributeSchedulerId = (slotId: number) =>
  `slot-${slotId}-redistribute`;

const scheduleSlotJobs = async (slot: SlotInfo, cutoff: number) => {
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
  await timeslotQueue.upsertJobScheduler(
    redistributeSchedulerId(slot.id),
    { pattern: toCron(slot.day, slot.start_time - cutoff) },
    { name: GO_REDISTRIBUTE, data: { slotId: slot.id } }
  );
};

const removeSlotJobs = async (slotId: number) => {
  await timeslotQueue.removeJobScheduler(liveSchedulerId(slotId));
  await timeslotQueue.removeJobScheduler(endSchedulerId(slotId));
  await timeslotQueue.removeJobScheduler(redistributeSchedulerId(slotId));
};

// Fixes up slots whose transition was missed while the server was down:
// stuck "live" past the end of the window, or should already be "live" but
// isn't yet, by enqueuing an immediate one-off job.
const catchUp = async (slot: SlotInfo & { status: SlotStatus }) => {
  const inWindow = isInsideWindow(slot.day, slot.start_time, new Date());

  if (slot.status === "live" && !inWindow) {
    await timeslotQueue.add(GO_ENDED, { slotId: slot.id });
  } else if (slot.status !== "live" && inWindow) {
    await timeslotQueue.add(GO_LIVE, { slotId: slot.id });
  }
};

export const syncSlot = async (slotId: number) => {
  const slot = await prisma.roomTimeslot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      day: true,
      start_time: true,
      status: true,
      enabled: true,
      room: { select: { tenant: { select: { settings: true } } } },
    },
  });

  if (!slot?.enabled) {
    await removeSlotJobs(slotId);
    return;
  }

  await scheduleSlotJobs(slot, resolveCutoff(slot.room?.tenant?.settings));
  await catchUp(slot);
};

// Re-checks every enabled slot's status against the current time and enqueues
// a corrective transition for any mismatch. catchUp only acts on a mismatch,
// and the worker no-ops when the slot is already in the target state, so this
// is safe to run repeatedly.
const reconcileSlots = async () => {
  const slots = await prisma.roomTimeslot.findMany({
    where: { enabled: true },
    select: { id: true, day: true, start_time: true, status: true },
  });

  for (const slot of slots) {
    await catchUp(slot);
  }
};

export const startScheduler = async (io: Server) => {
  _io = io;

  const slots = await prisma.roomTimeslot.findMany({
    where: { enabled: true },
    select: {
      id: true,
      day: true,
      start_time: true,
      status: true,
      room: { select: { tenant: { select: { settings: true } } } },
    },
  });

  for (const slot of slots) {
    await scheduleSlotJobs(slot, resolveCutoff(slot.room?.tenant?.settings));
    await catchUp(slot);
  }

  console.log(`Scheduler: ${slots.length} slot(s) loaded`);

  setInterval(() => {
    reconcileSlots().catch((err) =>
      console.error("Scheduler: reconciliation failed:", err)
    );
  }, RECONCILE_INTERVAL_MS);
};
