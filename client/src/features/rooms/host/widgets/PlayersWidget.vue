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

      <p v-if="!info.count" class="text-xs text-surface-300">
        No players yet
      </p>
      <SlotAvatars
        v-else
        :players="players"
        :current-user-id="currentUserId"
      />
    </template>

    <p v-else class="text-sm font-medium text-surface-300">&mdash;</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PlayerSummary } from "@football/shared";
import SlotPlayerCount from "../../components/SlotPlayerCount.vue";
import SlotAvatars from "../../player/SlotAvatars.vue";
import {
  gatheredTitle,
  type SlotPlayerInfo,
} from "../../composables/slotQuorum";
import { useAuthStore } from "@/stores/auth";

const props = withDefaults(
  defineProps<{
    // Counts for whichever slot the card is describing above — null when the
    // room has no game to count players for at all.
    info: SlotPlayerInfo | null;
    // Who those counts are. Every slot the card can describe carries its
    // roster, so there is always someone behind each avatar.
    players: PlayerSummary[];
    // Only picks the wording of the quorum check mark's tooltip; whether quorum
    // is met already comes in on `info.gathered`.
    live?: boolean;
  }>(),
  { live: false }
);

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

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
