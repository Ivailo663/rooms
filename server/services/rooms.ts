import prisma from "../prisma.js";
import type { RoomWithPlayersResponse } from "../../packages/shared/index.js";

type RoomWithPlayers = Awaited<ReturnType<typeof findRoomsWithPlayers>>[number];

const findRoomsWithPlayers = () =>
  prisma.room.findMany({
    include: {
      roomPlayers: {
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

export const formatRoomWithPlayers = (
  room: RoomWithPlayers,
): RoomWithPlayersResponse => ({
  id: room.id,
  name: room.name,
  description: room.description,
  price: room.price?.toString() ?? null,
  players: room.roomPlayers.map((player) => ({
    id: player.account.id,
    name: player.account.name,
  })),
});

export const getRoomsWithPlayers = async () => {
  const rooms = await findRoomsWithPlayers();

  return rooms.map(formatRoomWithPlayers);
};
