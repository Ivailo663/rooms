import type { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";
import type { TimeslotStatusChangedPayload } from "../packages/shared/index.js";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";
const SLOT_DURATION_MINUTES = 60;
const TICK_INTERVAL_MS = 60_000;

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const startScheduler = (io: Server) => {
  setInterval(async () => {
    try {
      const now = new Date();
      const today = localDateStr(now);
      const minutes = now.getHours() * 60 + now.getMinutes();

      // Advance past-week scheduled slots to their next weekly occurrence on or after today.
      // Uses server local time so the date/minute comparisons match how start_time was stored.
      await prisma.$executeRaw`
        UPDATE room_timeslots
        SET available_date = available_date +
            (CEIL((${today}::date - available_date)::float / 7.0) * 7)::int
        WHERE enabled = true
          AND status = 'scheduled'
          AND available_date < ${today}::date
      `;

      // Reschedule today's slots whose window already closed (server was down during the window).
      await prisma.$executeRaw`
        UPDATE room_timeslots
        SET available_date = available_date + 7
        WHERE enabled = true
          AND status = 'scheduled'
          AND available_date = ${today}::date
          AND start_time + ${SLOT_DURATION_MINUTES} <= ${minutes}
      `;

      const toLive = await prisma.$queryRaw<Array<{ id: number; room_id: number }>>`
        UPDATE room_timeslots
        SET status = 'live'
        WHERE enabled = true
          AND status = 'scheduled'
          AND available_date = ${today}::date
          AND start_time <= ${minutes}
          AND start_time + ${SLOT_DURATION_MINUTES} > ${minutes}
        RETURNING id, room_id
      `;

      for (const { id, room_id } of toLive) {
        const payload: TimeslotStatusChangedPayload = { timeslotId: id, roomId: room_id, status: "live" };
        io.emit(TIMESLOT_STATUS_CHANGED_EVENT, payload);
      }

      const toEnded = await prisma.$queryRaw<Array<{ id: number; room_id: number }>>`
        UPDATE room_timeslots
        SET status = 'ended'
        WHERE status = 'live'
          AND (
            available_date < ${today}::date
            OR (available_date = ${today}::date AND start_time + ${SLOT_DURATION_MINUTES} <= ${minutes})
          )
        RETURNING id, room_id
      `;

      for (const { id, room_id } of toEnded) {
        const payload: TimeslotStatusChangedPayload = { timeslotId: id, roomId: room_id, status: "ended" };
        io.emit(TIMESLOT_STATUS_CHANGED_EVENT, payload);
      }

      if (toEnded.length > 0) {
        const ids = toEnded.map((r) => r.id);
        await prisma.$executeRaw(
          Prisma.sql`UPDATE room_timeslots SET status = 'scheduled', available_date = available_date + 7 WHERE id IN (${Prisma.join(ids)})`
        );
        for (const { id, room_id } of toEnded) {
          const payload: TimeslotStatusChangedPayload = { timeslotId: id, roomId: room_id, status: "scheduled" };
          io.emit(TIMESLOT_STATUS_CHANGED_EVENT, payload);
        }
      }
    } catch (err) {
      console.error("Scheduler tick failed:", err);
    }
  }, TICK_INTERVAL_MS);
};
