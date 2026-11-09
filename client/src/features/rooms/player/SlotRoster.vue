<template>
  <div class="rounded-2xl border border-surface-100 bg-surface-50/60 !p-4">
    <div class="flex items-center justify-between !mb-2.5">
      <span class="text-sm font-medium text-surface-500">Roster</span>
      <span class="text-xs text-surface-400">
        {{ spotsLeftLabel(players.length, maxPlayers) }}
      </span>
    </div>

    <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
      <div
        class="h-full rounded-full bg-emerald-500 transition-all"
        :style="{ width: `${fillPercent}%` }"
      />
    </div>

    <SlotAvatars
      v-if="players.length"
      class="!mt-3"
      :players="players"
      :current-user-id="currentUserId"
    />
    <p v-else class="!m-0 !mt-3 text-sm text-surface-400">
      No one's in yet — be the first.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PlayerSummary } from "@football/shared";
import { spotsLeftLabel } from "../composables/spotsLeft";
import SlotAvatars from "./SlotAvatars.vue";

const props = defineProps<{
  players: PlayerSummary[];
  maxPlayers: number;
  currentUserId?: number;
}>();

const fillPercent = computed(() =>
  props.maxPlayers
    ? Math.min(100, (props.players.length / props.maxPlayers) * 100)
    : 0
);
</script>
