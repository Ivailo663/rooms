<template>
  <div class="flex flex-col !gap-4">
    <!-- Status row -->
    <div class="flex items-center justify-between">
      <StatusBadge :status="badgeStatus" pill>
        <template v-if="!enabled">
          Draft
        </template>
        <template v-else-if="timeslot.status === 'live'">
          LIVE
        </template>
        <template v-else>
          SCHEDULED
        </template>
        <template v-if="enabled && timeslot.status === 'live'" #adornment>
          {{ elapsedMinutes }}'
        </template>
      </StatusBadge>
      <span class="text-xs font-medium text-surface-500">
        {{ timeslot.players.length }}/{{ timeslot.max_players }} players
      </span>
    </div>

    <!-- Capacity bar -->
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
      <div
        class="h-full rounded-full transition-all"
        :class="capacityColor"
        :style="{ width: `${playerPercent}%` }"
      />
    </div>

    <!-- Player list -->
    <div v-if="timeslot.players.length" class="flex flex-col !gap-2">
      <div
        v-for="player in timeslot.players"
        :key="player.id"
        class="flex items-center !gap-2"
      >
        <div
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
        >
          <i class="fa-solid fa-user" style="font-size: 0.6rem" />
        </div>
        <span class="text-xs text-surface-600">
          {{ player.name || "Player #" + player.id }}
        </span>
      </div>
    </div>
    <p v-else class="text-xs italic text-surface-300">
      No players yet
    </p>

    <SlotChat />

    <Button
      :label="enabled ? 'Stop slot' : 'Launch slot'"
      :icon="enabled ? 'fa-solid fa-stop' : 'fa-solid fa-play'"
      class="w-full launch-btn"
      :class="enabled ? 'launch-btn--stop' : 'launch-btn--go'"
      unstyled
      @click="emit('toggle-launch')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "primevue";
import type { TimeslotResponse } from "@football/shared";
import StatusBadge from "@/components/StatusBadge.vue";
import SlotChat from "../../components/SlotChat.vue";
import { useNow } from "../../composables/useNow";

const props = defineProps<{
  timeslot: TimeslotResponse;
  enabled: boolean;
}>();

const now = useNow();
const elapsedMinutes = computed(() =>
  Math.max(
    1,
    now.value.getHours() * 60 +
      now.value.getMinutes() -
      props.timeslot.start_time
  )
);

const badgeStatus = computed(() => {
  if (!props.enabled) return "inactive";
  return props.timeslot.status === "live" ? "live" : "scheduled";
});

const emit = defineEmits<{
  (e: "toggle-launch"): void;
}>();

const playerPercent = computed(() =>
  Math.min(
    100,
    (props.timeslot.players.length / props.timeslot.max_players) * 100
  )
);

const capacityColor = computed(() => {
  const ratio = props.timeslot.players.length / props.timeslot.max_players;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-amber-400";
  return "bg-primary-400";
});
</script>

<style scoped>
.launch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.65rem 1.25rem;
  border-radius: 0.75rem;
  border: none;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
}
.launch-btn--go {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #065f46;
}
.launch-btn--go:hover {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.15);
}
.launch-btn--stop {
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  color: #991b1b;
}
.launch-btn--stop:hover {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12);
}
</style>
