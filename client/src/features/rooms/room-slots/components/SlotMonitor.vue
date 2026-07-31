<template>
  <div class="flex flex-col !gap-4">
    <!-- Status row -->
    <div class="flex items-center justify-between">
      <StatusBadge :status="badgeStatus" pill>
        <template v-if="!enabled"> Draft </template>
        <template v-else-if="badgeStatus === 'failed'"> GAME OFF </template>
        <template v-else-if="badgeStatus === 'redistributed'">
          REDISTRIBUTED
        </template>
        <template v-else-if="isLive"> LIVE </template>
        <template v-else> SCHEDULED </template>
        <template v-if="enabled && isLive" #adornment>
          {{ elapsed }}'
        </template>
      </StatusBadge>
      <span class="text-xs font-medium text-surface-500">
        {{ timeslot.players.length }}/{{ timeslot.max_players }} players
      </span>
    </div>

    <SlotFailedNotice
      v-if="badgeStatus === 'failed'"
      :players-count="timeslot.players.length"
      :min-players="timeslot.min_players"
    />

    <RedistributionNotice
      v-for="notice in redistributionNotices"
      :key="notice.id"
      :notice="notice"
      @close="dismissNotice(notice.id)"
    />

    <!-- Capacity bar -->
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
      <div
        class="h-full rounded-full transition-all"
        :class="capacityColor"
        :style="{ width: `${playerPercent}%` }"
      />
    </div>

    <!-- Player list -->
    <div class="flex items-start justify-between !gap-3">
      <div class="flex min-w-0 flex-wrap items-center !gap-3">
        <template v-if="timeslot.players.length">
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
        </template>
        <p v-else class="text-xs italic text-surface-300">No players yet</p>
      </div>

      <span
        class="flex shrink-0 items-center !gap-1.5 rounded-full !px-2.5 !py-1 text-xs font-semibold tabular-nums"
        :class="counterColor"
      >
        <i class="fa-solid fa-users" style="font-size: 0.65rem" />
        {{ timeslot.players.length }}/{{ timeslot.max_players }}
      </span>
    </div>

    <!-- Pending join requests -->
    <div
      v-if="timeslot.pendingRequests.length"
      class="rounded-xl border border-amber-100 bg-amber-50/50 !p-3"
    >
      <p
        class="!mb-2 flex items-center !gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600"
      >
        <i class="fa-solid fa-user-clock" style="font-size: 0.55rem" />
        Awaiting approval
      </p>
      <div class="flex flex-col !gap-2">
        <div
          v-for="request in timeslot.pendingRequests"
          :key="request.accountId"
          class="flex flex-col !gap-1.5 rounded-lg bg-white !px-3 !py-2 border"
          :class="request.valid ? 'border-amber-100' : 'border-surface-200'"
        >
          <div class="flex items-center justify-between !gap-2">
            <span
              class="truncate text-xs"
              :class="request.valid ? 'text-surface-700' : 'text-surface-400'"
            >
              {{ request.name }}
            </span>

            <!-- A void request has nothing to approve or decline — the only
                 move left is to clear it away. -->
            <div
              v-if="request.valid"
              class="flex shrink-0 items-center !gap-1.5"
            >
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="isResolving(request.accountId)"
                @click="approve(request.accountId)"
              >
                <i class="fa-solid fa-check" style="font-size: 0.6rem" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-50 text-surface-400 hover:bg-surface-100 hover:text-surface-600 cursor-pointer border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="isResolving(request.accountId)"
                @click="deny(request.accountId)"
              >
                <i class="fa-solid fa-xmark" style="font-size: 0.6rem" />
              </button>
            </div>
            <button
              v-else
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-50 text-surface-400 hover:bg-surface-100 hover:text-surface-600 cursor-pointer border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="isResolving(request.accountId)"
              title="Acknowledge"
              aria-label="Acknowledge"
              @click="acknowledge(request.accountId)"
            >
              <i class="fa-solid fa-check-double" style="font-size: 0.6rem" />
            </button>
          </div>

          <p
            v-if="!request.valid"
            class="flex items-center !gap-1.5 text-[11px] leading-tight text-surface-400"
          >
            <i class="fa-solid fa-calendar-xmark" style="font-size: 0.55rem" />
            This player is already in another game at this hour
          </p>
        </div>
      </div>
    </div>

    <SlotChat />

    <!-- Nothing to move out of an empty slot. -->
    <Button
      v-if="enabled && timeslot.players.length"
      label="Redistribute players"
      icon="fa-solid fa-shuffle"
      severity="secondary"
      outlined
      size="small"
      class="w-full !cursor-pointer"
      :loading="redistributeMutation.isPending.value"
      @click="handleRedistribute"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "primevue";
import { useConfirm } from "primevue/useconfirm";
import type { TimeslotResponse } from "@football/shared";
import StatusBadge from "@/components/StatusBadge.vue";
import SlotChat from "../../components/SlotChat.vue";
import RedistributionNotice from "../../components/RedistributionNotice.vue";
import SlotFailedNotice from "../../components/SlotFailedNotice.vue";
import { useNow } from "../../composables/useNow";
import {
  useRedistributeTimeslot,
  useApproveJoinRequest,
  useDenyJoinRequest,
  useAcknowledgeJoinRequest,
} from "../../composables/queries";
import { useRedistributionNotices } from "../../composables/useRedistributionNotices";
import {
  isSlotLiveNow,
  isSlotFailedNow,
} from "../../composables/isSlotLiveNow";
import { elapsedMinutes } from "../../composables/gameTime";

const props = defineProps<{
  timeslot: TimeslotResponse;
  enabled: boolean;
}>();

const redistributeMutation = useRedistributeTimeslot();
const approveMutation = useApproveJoinRequest();
const denyMutation = useDenyJoinRequest();
const acknowledgeMutation = useAcknowledgeJoinRequest();

// Track which accounts are mid-resolution so both buttons on a row disable
// together while the request is being approved/denied.
const resolving = ref(new Set<number>());
const isResolving = (accountId: number) => resolving.value.has(accountId);

const resolve = (
  accountId: number,
  mutate:
    | typeof approveMutation
    | typeof denyMutation
    | typeof acknowledgeMutation
) => {
  resolving.value.add(accountId);
  mutate.mutate(
    { timeslotId: props.timeslot.id, accountId },
    {
      onSettled: () => {
        resolving.value.delete(accountId);
      },
    }
  );
};

const approve = (accountId: number) => resolve(accountId, approveMutation);
const deny = (accountId: number) => resolve(accountId, denyMutation);
// Clears a request voided by the player joining elsewhere in the hour. No
// denial is recorded — see the server handler.
const acknowledge = (accountId: number) =>
  resolve(accountId, acknowledgeMutation);
const { isRecentlyRedistributed, noticesForTimeslot, dismissNotice } =
  useRedistributionNotices();
const confirm = useConfirm();

const redistributionNotices = computed(() =>
  noticesForTimeslot(props.timeslot.id)
);

const handleRedistribute = () => {
  const playerCount = props.timeslot.players.length;

  confirm.require({
    header: "You are about to redistribute players",
    message: `${playerCount} ${playerCount === 1 ? "player" : "players"} ${
      playerCount === 1 ? "is" : "are"
    } about to be moved into another room with an open slot at this time.`,
    acceptLabel: "Redistribute",
    rejectLabel: "Cancel",
    acceptProps: {
      severity: "primary",
    },
    rejectProps: {
      severity: "secondary",
      outlined: true,
    },
    accept: () => {
      redistributeMutation.mutate(props.timeslot.id, {
        onError: (error) => {
          console.error("Failed to redistribute players:", error);
        },
      });
    },
  });
};

const now = useNow();
const isLive = computed(() => isSlotLiveNow(props.timeslot, now.value));
const elapsed = computed(() =>
  elapsedMinutes(props.timeslot.start_time, now.value)
);

const badgeStatus = computed(() => {
  if (!props.enabled) return "inactive";
  // "failed" only shows during the slot's own hour; past that it's a normal
  // scheduled occurrence again.
  if (isSlotFailedNow(props.timeslot, now.value)) return "failed";
  if (props.timeslot.status === "redistributed") return "redistributed";
  if (!isLive.value && isRecentlyRedistributed(props.timeslot.id)) {
    return "redistributed";
  }
  return isLive.value ? "live" : "scheduled";
});

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

// Mirrors the capacity bar so the counter reads as the same signal.
const counterColor = computed(() => {
  const ratio = props.timeslot.players.length / props.timeslot.max_players;
  if (ratio >= 1) return "bg-emerald-50 text-emerald-700";
  if (ratio >= 0.6) return "bg-amber-50 text-amber-700";
  return "bg-primary-50 text-primary-700";
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
