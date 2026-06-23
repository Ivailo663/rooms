import { Worker, type Job } from "bullmq";
import prisma from "../prisma.js";
import { redisConnection } from "../queues/connection.js";
import { TIMESLOT_QUEUE_NAME } from "../queues/timeslotQueue.js";
import { GO_LIVE, GO_ENDED, emit } from "../scheduler.js";

export const timeslotWorker = new Worker<{ slotId: number }>(
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

      await prisma.roomTimeslot.update({
        where: { id: slot.id },
        data: { status: "scheduled" },
      });
      emit(slot.id, slot.roomId, "scheduled");
    }
  },
  { connection: redisConnection }
);

timeslotWorker.on("failed", (job, err) => {
  console.error(`Scheduler: job ${job?.id} (${job?.name}) failed:`, err);
});
