import { Worker, type Job } from "bullmq";
import type { Server } from "socket.io";
import prisma from "../prisma.js";
import { redisConnection } from "../queues/connection.js";
import { TIMESLOT_QUEUE_NAME } from "../queues/timeslotQueue.js";
import { GO_LIVE, GO_ENDED, GO_REDISTRIBUTE, emit } from "../scheduler.js";
import { redistributeSlot } from "../redistribution.js";
import type { TenantSettings } from "../../packages/shared/index.js";

export const createTimeslotWorker = (io: Server) => {
  const worker = new Worker<{ slotId: number }>(
    TIMESLOT_QUEUE_NAME,
    async (job: Job<{ slotId: number }>) => {
      const slot = await prisma.roomTimeslot.findUnique({
        where: { id: job.data.slotId },
        select: { id: true, roomId: true, status: true, enabled: true },
      });

      if (!slot?.enabled) return;

      if (job.name === GO_LIVE) {
        if (slot.status === "live") return;
        await prisma.roomTimeslot.update({
          where: { id: slot.id },
          data: { status: "live" },
        });
        emit(slot.id, slot.roomId, "live");
        return;
      }

      if (job.name === GO_ENDED) {
        if (slot.status !== "live") return;
        await prisma.roomTimeslot.update({
          where: { id: slot.id },
          data: { status: "ended" },
        });
        emit(slot.id, slot.roomId, "ended");

        // The occurrence is over — wipe its join requests (pending AND
        // denied). Pending ones are stale; denied ones expire here, which is
        // what scopes a denial to the occurrence it was issued for.
        await prisma.timeslotJoinRequest.deleteMany({
          where: { timeslotId: slot.id },
        });

        await prisma.roomTimeslot.update({
          where: { id: slot.id },
          data: { status: "scheduled" },
        });
        emit(slot.id, slot.roomId, "scheduled");
        return;
      }

      if (job.name === GO_REDISTRIBUTE) {
        const room = await prisma.room.findUnique({
          where: { id: slot.roomId },
          select: { tenant: { select: { settings: true } } },
        });
        const settings = room?.tenant?.settings as TenantSettings | null;
        if (!settings?.autoRedistribute) return;

        await redistributeSlot(slot.id, io);
      }
    },
    { connection: redisConnection }
  );

  worker.on("failed", (job, err) => {
    console.error(`Scheduler: job ${job?.id} (${job?.name}) failed:`, err);
  });

  return worker;
};
