<template>
  <div class="flex h-full w-full flex-col items-center justify-center !gap-3">
    <!-- Multi-game switcher -->
    <div
      v-if="orderedGames.length > 1"
      class="flex items-center !gap-1.5 !mb-5"
    >
      <button
        v-for="game in orderedGames"
        :key="game.timeslotId"
        type="button"
        class="cursor-pointer rounded-xl border !px-3 !py-1.5 text-xs font-semibold transition-all outline-none"
        :class="
          game.timeslotId === primaryGame?.timeslotId
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm'
            : 'border-surface-200/60 bg-white/60 text-surface-500 hover:border-surface-300 hover:text-surface-700'
        "
        @click="selectedGameId = game.timeslotId"
      >
        {{ shortDay(game, now) }} {{ game.label }}
      </button>
    </div>

    <!-- Matchday card -->
    <div
      v-if="primaryGame"
      class="hub-card relative w-full max-w-2xl max-h-full overflow-hidden rounded-3xl border bg-white"
      :class="
        isLive ? 'hub-card--live border-emerald-200' : 'border-surface-200/70'
      "
    >
      <!-- Emerald wash from the top: the accent carries the moment, not darkness -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-56"
        :class="isLive ? 'hub-glow-live' : 'hub-glow'"
      />

      <div class="relative flex h-full flex-col overflow-y-auto !p-7 sm:!p-8">
        <!-- Top row -->
        <div class="flex items-center justify-between">
          <span
            class="inline-flex items-center !gap-2 rounded-full bg-emerald-50 !px-3 !py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-600"
          >
            <i class="fa-solid fa-circle-check" style="font-size: 0.6rem" />
            You're in
          </span>
          <span class="text-sm tabular-nums text-surface-400">
            {{ primaryGame.players.length }}/{{ primaryGame.max_players }}
            players
          </span>
        </div>

        <!-- Center: anticipation / live -->
        <div class="flex flex-col items-center !gap-1 !pt-8 !pb-2 text-center">
          <template v-if="isLive">
            <span
              class="flex items-center !gap-3 text-xs font-bold uppercase tracking-[0.3em] text-emerald-600"
            >
              <span class="relative flex h-2 w-2">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                />
                <span
                  class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
                />
              </span>
              Live
            </span>
            <span
              class="!mt-2 text-6xl font-bold tabular-nums text-emerald-600 sm:text-7xl"
            >
              {{ elapsedMinutes }}'
            </span>
            <span class="!mt-1 text-sm text-surface-400">
              Game on — kicked off at {{ primaryGame.label }}
            </span>
          </template>

          <template v-else>
            <span
              class="text-xs font-bold uppercase tracking-[0.3em] text-surface-400"
            >
              Kicks off in
            </span>
            <span
              class="!mt-2 text-6xl font-bold tabular-nums text-surface-900 sm:text-7xl"
            >
              {{ countdown }}
            </span>
            <span class="!mt-1 text-sm text-surface-400">
              {{ dayDisplay(primaryGame, now) }} at {{ primaryGame.label }}
            </span>
          </template>

          <div class="!mt-6 flex flex-col items-center !gap-1">
            <h2 class="text-2xl font-bold leading-tight text-surface-900">
              {{ primaryGame.roomName }}
            </h2>
            <span class="flex items-center !gap-1.5 text-sm text-surface-400">
              <i class="fa-solid fa-location-dot" style="font-size: 0.55rem" />
              {{ primaryGame.address || "Location not set" }}
            </span>
          </div>

          <!-- Features + price: a compact, legible chip row -->
          <div
            v-if="features.length || primaryGame.price"
            class="!mt-3 flex flex-wrap items-center justify-center !gap-2"
          >
            <span
              v-for="feature in features"
              :key="feature"
              class="inline-flex items-center !gap-1.5 rounded-full bg-surface-100 !px-3 !py-1.5 text-xs font-medium text-surface-600"
            >
              <i
                :class="['fa-solid', featureIconMap[feature] ?? 'fa-circle']"
                style="font-size: 0.5rem"
              />
              {{ feature }}
            </span>
            <span
              v-if="primaryGame.price"
              class="inline-flex items-center !gap-1 rounded-full bg-emerald-50 !px-3 !py-1.5 text-xs font-bold text-emerald-700"
            >
              {{ primaryGame.price }}€
            </span>
          </div>
        </div>

        <!-- Roster -->
        <div
          class="!mt-6 rounded-2xl border border-surface-100 bg-surface-50/60 !p-4"
        >
          <div class="flex items-center justify-between !mb-2.5">
            <span class="text-sm font-medium text-surface-500">Roster</span>
            <span class="text-xs text-surface-400">
              {{ spotsLeft === 0 ? "Full squad" : `${spotsLeft} spots left` }}
            </span>
          </div>

          <div
            class="!mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-100"
          >
            <div
              class="h-full rounded-full bg-emerald-500 transition-all"
              :style="{ width: `${rosterPercent}%` }"
            />
          </div>

          <div class="flex flex-wrap !gap-2">
            <span
              v-for="player in primaryGame.players"
              :key="player.id"
              class="inline-flex items-center !gap-2 rounded-full !px-3 !py-1.5 text-sm"
              :class="
                player.id === currentUserId
                  ? 'bg-emerald-100 font-medium text-emerald-700'
                  : 'bg-white text-surface-600 border border-surface-100'
              "
            >
              <i class="fa-solid fa-user" style="font-size: 0.55rem" />
              {{
                player.id === currentUserId
                  ? "You"
                  : player.name || "Player #" + player.id
              }}
            </span>
          </div>
        </div>

        <!-- Pending requests elsewhere -->
        <div
          v-if="pendingSlots.length"
          class="!mt-3 flex flex-col !gap-1.5 rounded-2xl border border-amber-100 bg-amber-50/60 !px-4 !py-3"
        >
          <span
            v-for="slot in pendingSlots"
            :key="slot.timeslotId"
            class="flex items-center !gap-2 text-xs text-amber-700"
          >
            <i class="fa-solid fa-user-clock" style="font-size: 0.6rem" />
            {{ slot.roomName }} · {{ shortDay(slot, now) }} {{ slot.label }} —
            awaiting approval
          </span>
        </div>

        <!-- Actions -->
        <div class="!mt-5 flex flex-col items-center !gap-3">
          <button
            type="button"
            class="flex w-full items-center justify-center !gap-2 rounded-xl border border-surface-200 bg-white !py-3 text-sm font-medium text-surface-500 transition-all hover:border-surface-300 hover:text-surface-700 cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="leaveMutation.isPending.value"
            @click="handleLeave"
          >
            <i
              :class="
                leaveMutation.isPending.value
                  ? 'fa-solid fa-spinner fa-spin'
                  : 'fa-solid fa-right-from-bracket'
              "
              style="font-size: 0.65rem"
            />
            Leave game
          </button>

          <button
            type="button"
            class="cursor-pointer border-none bg-transparent text-sm text-surface-400 transition-colors hover:text-surface-600 outline-none"
            @click="emit('browse')"
          >
            Find another game
            <i class="fa-solid fa-arrow-right" style="font-size: 0.6rem" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type { JoinedSlotSummary } from "@football/shared";
import { useAuthStore } from "@/stores/auth";
import { useLeaveTimeslot } from "./composables/queries";
import { useGameMode } from "./composables/useGameMode";
import { useNow } from "./composables/useNow";
import { isSlotLiveNow } from "./composables/isSlotLiveNow";
import {
  dayDisplay,
  shortDay,
  minutesUntil,
  formatCountdown,
} from "./composables/gameTime";

const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";
const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";

const emit = defineEmits<{ browse: [] }>();

const authStore = useAuthStore();
const queryClient = useQueryClient();
const leaveMutation = useLeaveTimeslot();
const { confirmedSlots, pendingSlots } = useGameMode();
const now = useNow();

const currentUserId = computed(() => authStore.user?.id);

const featureIconMap: Record<string, string> = {
  ball: "fa-futbol",
  showers: "fa-shower",
  parking: "fa-square-parking",
  lights: "fa-sun",
  water: "fa-bottle-water",
};

// Soonest game first (live counts as "now").
const orderedGames = computed(() =>
  [...confirmedSlots.value].sort(
    (a, b) => minutesUntil(a, now.value) - minutesUntil(b, now.value)
  )
);

const selectedGameId = ref<number | null>(null);
const primaryGame = computed<JoinedSlotSummary | undefined>(
  () =>
    orderedGames.value.find(
      (game) => game.timeslotId === selectedGameId.value
    ) ?? orderedGames.value[0]
);

const features = computed(() =>
  Array.isArray(primaryGame.value?.features)
    ? (primaryGame.value.features as string[])
    : []
);

const isLive = computed(
  () => !!primaryGame.value && isSlotLiveNow(primaryGame.value, now.value)
);

const elapsedMinutes = computed(() =>
  primaryGame.value
    ? Math.max(
        1,
        now.value.getHours() * 60 +
          now.value.getMinutes() -
          primaryGame.value.start_time
      )
    : 0
);

const countdown = computed(() =>
  primaryGame.value
    ? formatCountdown(minutesUntil(primaryGame.value, now.value))
    : ""
);

const spotsLeft = computed(() =>
  primaryGame.value
    ? Math.max(
        0,
        primaryGame.value.max_players - primaryGame.value.players.length
      )
    : 0
);

const rosterPercent = computed(() =>
  primaryGame.value
    ? Math.min(
        100,
        (primaryGame.value.players.length / primaryGame.value.max_players) * 100
      )
    : 0
);

const handleLeave = () => {
  if (primaryGame.value) leaveMutation.mutate(primaryGame.value.timeslotId);
};

// The browse deck (which normally keeps membership fresh) is not mounted in
// hub mode, so the hub listens for itself.
const invalidateJoinedSlots = () => {
  queryClient.invalidateQueries({ queryKey: ["joined-slots"] });
};

onMounted(() => {
  socket.on(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, invalidateJoinedSlots);
  socket.on(TIMESLOT_STATUS_CHANGED_EVENT, invalidateJoinedSlots);
});
onBeforeUnmount(() => {
  socket.off(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, invalidateJoinedSlots);
  socket.off(TIMESLOT_STATUS_CHANGED_EVENT, invalidateJoinedSlots);
});
</script>

<style scoped>
/* A single soft shadow to lift the card off the surface-50 page — just enough
   separation, not a spotlight. */
.hub-card {
  box-shadow: 0 8px 24px -12px rgba(15, 23, 42, 0.15);
}

.hub-card--live {
  box-shadow: 0 8px 24px -12px rgba(16, 185, 129, 0.28);
}

/* A soft emerald halo bleeding down from the top edge — enough to feel like a
   "matchday" moment without leaving the app's light surface. */
.hub-glow {
  background: radial-gradient(
    120% 100% at 50% 0%,
    rgba(16, 185, 129, 0.14) 0%,
    transparent 70%
  );
}

.hub-glow-live {
  background: radial-gradient(
    120% 100% at 50% 0%,
    rgba(16, 185, 129, 0.22) 0%,
    transparent 72%
  );
}
</style>
