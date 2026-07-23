import type { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";
import type {
  TimeslotMembershipChangedPayload,
  TimeslotRedistributedPayload,
} from "../packages/shared/index.js";

export const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";
export const TIMESLOT_REDISTRIBUTED_EVENT = "timeslot-redistributed";

export const getUpdatedPlayers = async (
  timeslotId: number
): Promise<TimeslotMembershipChangedPayload["players"]> => {
  const rows = await prisma.timeslotPlayer.findMany({
    where: { timeslotId },
    select: { accounts: { select: { id: true, name: true, email: true } } },
  });

  return rows.map(({ accounts }) => accounts);
};

const emitMembershipChanged = async (io: Server, timeslotId: number) => {
  const players = await getUpdatedPlayers(timeslotId);
  const payload: TimeslotMembershipChangedPayload = { timeslotId, players };
  io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, payload);
};

type RedistributionResult = {
  affectedTimeslotIds: number[];
  redistribution: TimeslotRedistributedPayload | null;
};

// Moves players out of an under-filled slot into sibling slots (same tenant,
// day and start_time, i.e. other rooms' occurrence of the same hour). Only
// runs if every displaced player can be placed somewhere — a partial
// evacuation would leave the original slot in a half-cancelled state with no
// clean way to represent it.
export const redistributeSlot = async (
  slotId: number,
  io: Server
): Promise<void> => {
  const result = await prisma.$transaction<RedistributionResult>(
    async (tx) => {
      const noop: RedistributionResult = {
        affectedTimeslotIds: [],
        redistribution: null,
      };

      const slot = await tx.roomTimeslot.findUnique({
        where: { id: slotId },
        select: {
          id: true,
          day: true,
          start_time: true,
          min_players: true,
          status: true,
          enabled: true,
          room: { select: { id: true, tenantid: true } },
          timeslot_players: { select: { accountId: true } },
        },
      });

      if (
        !slot?.enabled ||
        slot.status !== "scheduled" ||
        slot.min_players === null
      ) {
        return noop;
      }

      // Redistribution is not needed if the slot is already full or empty.
      const playerIds = slot.timeslot_players.map((p) => p.accountId);
      if (!playerIds.length || playerIds.length >= slot.min_players) {
        return noop;
      }

      const siblingsSlots = await tx.roomTimeslot.findMany({
        where: {
          id: { not: slot.id },
          day: slot.day,
          start_time: slot.start_time,
          enabled: true,
          status: "scheduled",
          room: { tenantid: slot.room.tenantid },
        },
        select: {
          id: true,
          label: true,
          max_players: true,
          timeslot_players: { select: { accountId: true } },
          join_requests: {
            where: { status: "denied" },
            select: { accountId: true },
          },
          room: { select: { id: true, name: true } },
        },
      });

      // Track open seats and existing members per sibling — a player already
      // in a sibling slot can't be assigned there again (unique constraint on
      // timeslotId+accountId), even if that sibling has open seats. Players
      // the sibling's host denied this occurrence are likewise off-limits:
      // redistribution must not sneak them past the denial.
      const candidates = siblingsSlots
        .map((s) => ({
          id: s.id,
          label: s.label,
          roomId: s.room.id,
          roomName: s.room.name,
          open: s.max_players - s.timeslot_players.length,
          members: new Set(s.timeslot_players.map((p) => p.accountId)),
          denied: new Set(s.join_requests.map((r) => r.accountId)),
        }))
        .filter((s) => s.open > 0);

      //TODO: this must be refined
      const totalOpen = candidates.reduce((sum, s) => sum + s.open, 0);
      if (totalOpen < playerIds.length) {
        return noop;
      }

      const shuffledPlayerIds = [...playerIds].sort(() => Math.random() - 0.5);
      const assignments = new Map<number, number[]>();

      for (const accountId of shuffledPlayerIds) {
        const target = candidates.find(
          (c) =>
            c.open > 0 && !c.members.has(accountId) && !c.denied.has(accountId)
        );
        // No sibling has room for this specific player (e.g. they're already
        // a member of every sibling with open seats) — bail out entirely
        // rather than leave the group partially redistributed.
        if (!target) return noop;

        target.open -= 1;
        target.members.add(accountId);
        const accountIds = assignments.get(target.id) ?? [];
        accountIds.push(accountId);
        assignments.set(target.id, accountIds);
      }

      await tx.timeslotPlayer.deleteMany({ where: { timeslotId: slot.id } });

      for (const [timeslotId, accountIds] of Array.from(assignments)) {
        await tx.timeslotPlayer.createMany({
          data: accountIds.map((accountId) => ({ timeslotId, accountId })),
        });
      }

      const destinations = Array.from(assignments.entries()).map(
        ([timeslotId, accountIds]) => {
          const candidate = candidates.find((c) => c.id === timeslotId)!;
          return {
            timeslotId,
            roomId: candidate.roomId,
            roomName: candidate.roomName,
            label: candidate.label,
            playerCount: accountIds.length,
          };
        }
      );

      return {
        affectedTimeslotIds: [slot.id, ...Array.from(assignments.keys())],
        redistribution: {
          timeslotId: slot.id,
          roomId: slot.room.id,
          destinations,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  for (const timeslotId of result.affectedTimeslotIds) {
    await emitMembershipChanged(io, timeslotId);
  }

  if (result.redistribution) {
    io.emit(TIMESLOT_REDISTRIBUTED_EVENT, result.redistribution);
  }
};
