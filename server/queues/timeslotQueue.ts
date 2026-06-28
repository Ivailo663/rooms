import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const TIMESLOT_QUEUE_NAME = "timeslot-transitions";

export const timeslotQueue = new Queue<{ slotId: number }>(TIMESLOT_QUEUE_NAME, {
  connection: redisConnection,
});
