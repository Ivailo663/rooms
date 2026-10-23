<template>
  <div
    class="rounded-lg border !p-3 transition-colors"
    :class="
      hasQuorum
        ? 'border-emerald-300 bg-emerald-50/60'
        : 'border-surface-100 bg-surface-50'
    "
  >
    <div class="flex items-center justify-between !mb-2">
      <div class="flex items-center !gap-1.5">
        <i
          class="fa-solid fa-users"
          :class="hasQuorum ? 'text-emerald-500' : 'text-surface-400'"
          style="font-size: 0.55rem"
        />
        <span
          class="text-[10px] font-semibold uppercase tracking-widest"
          :class="hasQuorum ? 'text-emerald-600' : 'text-surface-400'"
        >
          Players
        </span>
      </div>
      <SlotPlayerCount
        v-if="info"
        :count="info.count"
        :max="info.max"
        :gathered="hasQuorum"
        :title="quorumTitle"
      />
    </div>

    <template v-if="info">
      <div
        class="!mb-2 h-1.5 w-full overflow-hidden rounded-full transition-colors"
        :class="hasQuorum ? 'bg-emerald-100' : 'bg-surface-200'"
      >
        <div
          class="h-full rounded-full transition-all"
          :class="capacityColor"
          :style="{ width: `${playerPercent}%` }"
        />
      </div>

      <div v-if="info.count" class="flex items-center !gap-1.5">
        <div class="flex -space-x-1">
          <div
            v-for="(player, index) in avatars"
            :key="player?.id ?? index"
            class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-primary-600"
            :class="
              player ? 'cursor-pointer text-[8px] font-bold outline-none' : ''
            "
            :tabindex="player ? 0 : undefined"
            @mouseenter="player && openDetails(player, $event)"
            @mouseleave="player && scheduleClose()"
            @focus="player && openDetails(player, $event)"
            @blur="player && closeDetails()"
          >
            <span v-if="player">{{ initialOf(player) }}</span>
            <i v-else class="fa-solid fa-user" style="font-size: 0.35rem" />
          </div>
          <div
            v-if="info.count > AVATAR_LIMIT"
            class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-surface-200 text-[8px] font-bold text-surface-500"
          >
            +{{ info.count - AVATAR_LIMIT }}
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-surface-300">No players yet</p>
    </template>

    <p v-else class="text-sm font-medium text-surface-300">&mdash;</p>

    <PlayerDetailsCard
      v-if="hovered"
      :name="hovered.player.name"
      :anchor="hovered.anchor"
      @hold="cancelClose"
      @close="closeDetails"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { PlayerSummary } from "@football/shared";
import SlotPlayerCount from "../../components/SlotPlayerCount.vue";
import PlayerDetailsCard from "../../components/PlayerDetailsCard.vue";
import {
  gatheredTitle,
  type SlotPlayerInfo,
} from "../../composables/slotQuorum";

const props = withDefaults(
  defineProps<{
    // Counts for whichever slot the card is describing above — null when the
    // room has no game to count players for at all.
    info: SlotPlayerInfo | null;
    // Roster behind those counts, when the caller has one: it names the avatars
    // and gives each a details card on hover. Slots whose counts arrive as a
    // summary have no roster, so those avatars stay anonymous.
    players?: PlayerSummary[];
    // Only picks the wording of the quorum check mark's tooltip; whether quorum
    // is met already comes in on `info.gathered`.
    live?: boolean;
  }>(),
  { players: undefined, live: false }
);

// Avatars drawn before the remainder collapses into a "+N" bubble.
const AVATAR_LIMIT = 3;

// Delay before a card closes, so moving the pointer across the gap between an
// avatar and the card below it doesn't dismiss what you were reaching for.
const CLOSE_DELAY = 120;

// One entry per drawn avatar: the player it stands for, or null when the
// roster is unknown and all we have is a count.
const avatars = computed<(PlayerSummary | null)[]>(() => {
  const drawn = Math.min(props.info?.count ?? 0, AVATAR_LIMIT);
  return Array.from({ length: drawn }, (_, i) => props.players?.[i] ?? null);
});

const initialOf = (player: PlayerSummary) =>
  player.name.trim()[0]?.toUpperCase() ?? "?";

const hovered = ref<{ player: PlayerSummary; anchor: HTMLElement } | null>(
  null
);
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const cancelClose = () => {
  clearTimeout(closeTimer);
  closeTimer = undefined;
};

const closeDetails = () => {
  cancelClose();
  hovered.value = null;
};

const scheduleClose = () => {
  cancelClose();
  closeTimer = setTimeout(closeDetails, CLOSE_DELAY);
};

const openDetails = (player: PlayerSummary, event: Event) => {
  cancelClose();
  hovered.value = {
    player,
    anchor: event.currentTarget as HTMLElement,
  };
};

onBeforeUnmount(cancelClose);

const hasQuorum = computed(() => props.info?.gathered ?? false);

const quorumTitle = computed(() => gatheredTitle(props.live));

const playerPercent = computed(() => {
  if (!props.info) return 0;
  return Math.min(100, (props.info.count / props.info.max) * 100);
});

const capacityColor = computed(() => {
  if (!props.info) return "bg-surface-300";
  const ratio = props.info.count / props.info.max;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-amber-400";
  return "bg-primary-400";
});
</script>
