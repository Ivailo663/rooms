import { ref, computed } from "vue";
import { useGetJoinedSlots } from "./queries";

// "In the game" is a mode, not an annotation. With a confirmed slot, the
// match hub owns the play view and the browse deck becomes an explicit,
// secondary choice ("find another game"). Joining a game clears the override
// so the hub re-takes the screen — that flip is the "you're in" moment.
const browsingOverride = ref(false);

// Standalone so join flows can flip back to the hub without subscribing to
// the joined-slots query.
export const returnToGame = () => {
  browsingOverride.value = false;
};

export const useGameMode = () => {
  const { data: joinedSlots } = useGetJoinedSlots();

  const confirmedSlots = computed(
    () =>
      joinedSlots.value?.filter((slot) => slot.membership === "joined") ?? []
  );
  const pendingSlots = computed(
    () =>
      joinedSlots.value?.filter((slot) => slot.membership === "pending") ?? []
  );

  const hasGame = computed(() => confirmedSlots.value.length > 0);
  const showGameHub = computed(() => hasGame.value && !browsingOverride.value);

  const browseGames = () => {
    browsingOverride.value = true;
  };

  return {
    confirmedSlots,
    pendingSlots,
    hasGame,
    showGameHub,
    browseGames,
    returnToGame,
  };
};
