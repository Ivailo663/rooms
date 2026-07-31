import { onMounted, onBeforeUnmount } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type {
  JoinRequestCreatedPayload,
  JoinRequestResolvedPayload,
  JoinRequestValidityChangedPayload,
} from "@football/shared";

const JOIN_REQUEST_CREATED_EVENT = "join-request:created";
const JOIN_REQUEST_RESOLVED_EVENT = "join-request:resolved";
const JOIN_REQUEST_VALIDITY_CHANGED_EVENT = "join-request:validity-changed";

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
    // An approval flips a "pending" entry to "joined" in the player's list.
    queryClient.invalidateQueries({ queryKey: ["joined-slots"] });
  };

  // A request in this host's queue became un-approvable (or approvable again)
  // because the requester joined/left a game in some other room. Nothing in
  // this room changed, so only the refetch surfaces it.
  const handleValidityChanged = (
    _payload: JoinRequestValidityChangedPayload
  ) => {
    queryClient.invalidateQueries({ queryKey: ["timeslots"] });
  };

  onMounted(() => {
    socket.on(JOIN_REQUEST_CREATED_EVENT, handleCreated);
    socket.on(JOIN_REQUEST_RESOLVED_EVENT, handleResolved);
    socket.on(JOIN_REQUEST_VALIDITY_CHANGED_EVENT, handleValidityChanged);
  });

  onBeforeUnmount(() => {
    socket.off(JOIN_REQUEST_CREATED_EVENT, handleCreated);
    socket.off(JOIN_REQUEST_RESOLVED_EVENT, handleResolved);
    socket.off(JOIN_REQUEST_VALIDITY_CHANGED_EVENT, handleValidityChanged);
  });
};
