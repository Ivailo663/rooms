import { onMounted, onBeforeUnmount } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type {
  JoinRequestCreatedPayload,
  JoinRequestResolvedPayload,
} from "@football/shared";

const JOIN_REQUEST_CREATED_EVENT = "join-request:created";
const JOIN_REQUEST_RESOLVED_EVENT = "join-request:resolved";

// Keeps request-related queries fresh in response to realtime events. The
// queries themselves (hosted-rooms count, per-slot pendingRequests, the
// player's pending flag) are the source of truth — sockets only nudge them to
// refetch, so a missed event self-heals on the next load.
export const useJoinRequestSync = () => {
  const queryClient = useQueryClient();

  const handleCreated = (_payload: JoinRequestCreatedPayload) => {
    queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
    queryClient.invalidateQueries({ queryKey: ["timeslots"] });
  };

  const handleResolved = (_payload: JoinRequestResolvedPayload) => {
    queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
    queryClient.invalidateQueries({ queryKey: ["timeslots"] });
    queryClient.invalidateQueries({ queryKey: ["playable-rooms"] });
  };

  onMounted(() => {
    socket.on(JOIN_REQUEST_CREATED_EVENT, handleCreated);
    socket.on(JOIN_REQUEST_RESOLVED_EVENT, handleResolved);
  });

  onBeforeUnmount(() => {
    socket.off(JOIN_REQUEST_CREATED_EVENT, handleCreated);
    socket.off(JOIN_REQUEST_RESOLVED_EVENT, handleResolved);
  });
};
