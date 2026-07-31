import { Worker, type Job } from "bullmq";
import type { Server } from "socket.io";
import prisma from "../prisma.js";
import { redisConnection } from "../queues/connection.js";
import { TIMESLOT_QUEUE_NAME } from "../queues/timeslotQueue.js";
import { GO_LIVE, GO_ENDED, GO_REDISTRIBUTE, emit } from "../scheduler.js";
import { emitMembershipChanged, redistributeSlot } from "../redistribution.js";
import type { TenantSettings } from "../../packages/shared/index.js";

// A slot may run only with a real game: at least one player, and its minimum
// met when one is set. Enforced at BOTH the cutoff verdict and go-live, so a
// slot never kicks off empty even if the cutoff job never fired (server down
// at the cutoff minute, or the slot was launched after the cutoff had passed).
const meetsQuorum = (playerCount: number, min: number | null): boolean =>
  playerCount > 0 && (min === null || playerCount >= min);

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
        // failed / redistributed / ended / already-live: nothing to promote.
        if (slot.status !== "scheduled") return;

        // Re-check quorum here rather than trusting the cutoff verdict ran — it
        // may not have (see meetsQuorum note). An under-filled slot fails
        // instead of kicking off empty.
        const detail = await prisma.roomTimeslot.findUnique({
          where: { id: slot.id },
          select: {
            min_players: true,
            _count: { select: { timeslot_players: true } },
          },
        });
        const playerCount = detail?._count.timeslot_players ?? 0;

        if (!meetsQuorum(playerCount, detail?.min_players ?? null)) {
          await prisma.roomTimeslot.update({
            where: { id: slot.id },
            data: { status: "failed" },
          });
          emit(slot.id, slot.roomId, "failed");
          return;
        }

        await prisma.roomTimeslot.update({
          where: { id: slot.id },
          data: { status: "live" },
        });
        emit(slot.id, slot.roomId, "live");
        return;
      }

      if (job.name === GO_ENDED) {
        // End-of-occurrence reset. A "live" game ends normally; "failed" and
        // "redistributed" never went live but still have to return to
        // "scheduled" for next week — otherwise they'd stay stuck forever.
        if (!["live", "failed", "redistributed"].includes(slot.status)) {
          return;
        }

        // The reset empties the occurrence: the roster goes with it, so the
        // slot reopens for next week with no seats taken. Join requests
        // (pending AND denied) go too — pending ones are stale, and expiring
        // denials here is what scopes a denial to the occurrence it was
        // issued for. One transaction so a slot can never come back
        // "scheduled" while still holding last occurrence's players.
        await prisma.$transaction([
          prisma.timeslotPlayer.deleteMany({ where: { timeslotId: slot.id } }),
          prisma.timeslotJoinRequest.deleteMany({
            where: { timeslotId: slot.id },
          }),
          prisma.roomTimeslot.update({
            where: { id: slot.id },
            data: { status: "scheduled" },
          }),
        ]);

        await emitMembershipChanged(io, slot.id);
        emit(slot.id, slot.roomId, "scheduled");
        return;
      }

      if (job.name === GO_REDISTRIBUTE) {
        // The cutoff verdict: decide each under-filled slot's fate while the
        // roster is frozen (the join route rejects new joins from here on).
        if (slot.status !== "scheduled") return;

        const detail = await prisma.roomTimeslot.findUnique({
          where: { id: slot.id },
          select: {
            min_players: true,
            _count: { select: { timeslot_players: true } },
            room: { select: { tenant: { select: { settings: true } } } },
          },
        });
        if (!detail) return;

        const playerCount = detail._count.timeslot_players;
        const min = detail.min_players;

        // A healthy slot (quorum met) is left alone to go live.
        if (meetsQuorum(playerCount, min)) return;

        // Try to rescue the group into sibling slots first; only a slot that
        // can't be evacuated (no room, or redistribution disabled) fails.
        if (playerCount > 0) {
          const settings = detail.room?.tenant
            ?.settings as TenantSettings | null;
          if (settings?.autoRedistribute) {
            const outcome = await redistributeSlot(slot.id, io);
            if (outcome === "redistributed") return;
          }
        }

        await prisma.roomTimeslot.update({
          where: { id: slot.id },
          data: { status: "failed" },
        });
        emit(slot.id, slot.roomId, "failed");
        return;
      }
    },
    { connection: redisConnection }
  );

  worker.on("failed", (job, err) => {
    console.error(`Scheduler: job ${job?.id} (${job?.name}) failed:`, err);
  });

  return worker;
};
