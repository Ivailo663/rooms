<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white"
  >
    <!-- Card Header -->
    <div class="flex items-center justify-between !gap-3 !px-4 !py-3">
      <div class="flex min-w-0 items-center !gap-2.5">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50"
        >
          <i
            class="fa-solid fa-door-open text-primary-400"
            style="font-size: 0.7rem"
          />
        </div>
        <div class="min-w-0">
          <h3 class="truncate text-sm font-semibold text-surface-900">
            {{ room.name }}
          </h3>
          <p v-if="room.description" class="truncate text-xs text-surface-400">
            {{ room.description }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center !gap-2">
        <!-- Pending join requests -->
        <button
          v-if="room.pendingRequestCount > 0"
          class="flex items-center !gap-1.5 rounded-full border border-amber-200 bg-amber-50 !px-2.5 !py-1 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-100 cursor-pointer outline-none"
          @click.stop="drawerVisible = true"
        >
          <i class="fa-solid fa-user-clock" style="font-size: 0.6rem" />
          {{ room.pendingRequestCount }}
          {{ room.pendingRequestCount === 1 ? "request" : "requests" }}
        </button>

        <!-- Chat toggle button -->
        <button
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors"
          :class="
            chatOpen
              ? 'border-primary-200 bg-primary-50 text-primary-500'
              : 'border-surface-100 bg-surface-50 text-surface-400 hover:border-primary-200 hover:text-primary-400'
          "
          @click.stop="chatOpen = !chatOpen"
        >
          <i class="fa-solid fa-comment" style="font-size: 0.75rem" />
        </button>

        <span
          v-if="room.price"
          class="rounded-full bg-emerald-50 !px-2 !py-0.5 text-xs font-semibold text-emerald-600"
        >
          {{ room.price }} &euro;
        </span>
      </div>
    </div>

    <!-- Widget Grid -->
    <div class="grid grid-cols-2 !gap-2 !px-4 !pb-3">
      <!-- Status Widget -->
      <div
        class="rounded-lg border !p-3"
        :class="
          roomStatus === 'live'
            ? 'border-emerald-100 bg-emerald-50/50'
            : roomStatus === 'redistributed'
              ? 'border-violet-100 bg-violet-50/50'
              : roomStatus === 'scheduled'
                ? 'border-amber-100 bg-amber-50/50'
                : 'border-surface-100 bg-surface-50'
        "
      >
        <StatusBadge :status="roomStatus" class="!mb-2">
          <template v-if="roomStatus === 'live'" #adornment>
            {{ elapsedMinutes }}'
          </template>
        </StatusBadge>

        <div v-if="primaryLabel" class="flex items-baseline !gap-1.5">
          <span class="text-lg font-bold text-surface-900">
            {{ primaryLabel }}
          </span>
          <span
            v-if="!room.liveSlot && nextSlotInfo?.countdown"
            class="text-xs text-surface-400"
          >
            {{ nextSlotInfo.countdown }}
          </span>
        </div>

        <p v-if="nextHint" class="!mt-1.5 text-[10px] text-surface-400">
          {{ nextHint }}
        </p>
        <p
          v-else-if="!primaryLabel"
          class="text-sm font-medium text-surface-300"
        >
          No slots
        </p>
      </div>

      <!-- Players Widget -->
      <div class="rounded-lg border border-surface-100 bg-surface-50 !p-3">
        <div class="flex items-center justify-between !mb-2">
          <div class="flex items-center !gap-1.5">
            <i
              class="fa-solid fa-users text-surface-400"
              style="font-size: 0.55rem"
            />
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-surface-400"
            >
              Players
            </span>
          </div>
          <span
            v-if="activePlayerInfo"
            class="text-xs font-bold text-surface-600"
          >
            {{ activePlayerInfo.count }}/{{ activePlayerInfo.max }}
          </span>
        </div>

        <template v-if="activePlayerInfo">
          <div
            class="!mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-200"
          >
            <div
              class="h-full rounded-full transition-all"
              :class="capacityColor"
              :style="{ width: `${playerPercent}%` }"
            />
          </div>
          <div v-if="activePlayerInfo.count" class="flex items-center !gap-1.5">
            <div class="flex -space-x-1">
              <div
                v-for="n in Math.min(activePlayerInfo.count, 3)"
                :key="n"
                class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-primary-600"
              >
                <i class="fa-solid fa-user" style="font-size: 0.35rem" />
              </div>
              <div
                v-if="activePlayerInfo.count > 3"
                class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-surface-200 text-[8px] font-bold text-surface-500"
              >
                +{{ activePlayerInfo.count - 3 }}
              </div>
            </div>
            <span class="text-[10px] text-surface-400">joined</span>
          </div>
          <p v-else class="text-xs text-surface-300">No players yet</p>
        </template>

        <template v-else>
          <p class="text-sm font-medium text-surface-300">&mdash;</p>
        </template>
      </div>
    </div>

    <!-- Redistribution notices -->
    <div
      v-if="redistributionNotices.length"
      class="flex flex-col !gap-2 !px-4 !pb-3"
    >
      <RedistributionNotice
        v-for="notice in redistributionNotices"
        :key="notice.id"
        :notice="notice"
        @close="dismissNotice(notice.id)"
      />
    </div>

    <!-- Chat Panel (toggled) -->
    <div v-if="chatOpen" class="border-t border-surface-100 !px-4 !py-3">
      <SlotChat />
    </div>

    <!-- Manage Slots Button -->
    <div class="!mt-auto border-t border-surface-100">
      <button
        class="flex w-full cursor-pointer items-center justify-center !gap-2 border-none bg-transparent !py-2.5 text-[11px] font-semibold text-primary-500 transition-colors hover:bg-surface-50"
        @click="drawerVisible = true"
      >
        <i class="fa-solid fa-sliders" style="font-size: 0.5rem" />
        Manage slots
      </button>
    </div>

    <ManageSlotsDrawer
      v-model:visible="drawerVisible"
      :room-id="room.id"
      :room-name="room.name"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { HostedRoomResponse } from "@football/shared";
import ManageSlotsDrawer from "./ManageSlotsDrawer.vue";
import SlotChat from "./SlotChat.vue";
import RedistributionNotice from "./RedistributionNotice.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useNow } from "../composables/useNow";
import { useGetTimeslots, useGetEnabledDays } from "../composables/queries";
import { useRedistributionNotices } from "../composables/useRedistributionNotices";

const DAY_ORDER = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const DAY_LABELS: Record<string, string> = {
  mo: "Monday",
  tu: "Tuesday",
  we: "Wednesday",
  th: "Thursday",
  fr: "Friday",
  sa: "Saturday",
  su: "Sunday",
};

const props = defineProps<{ room: HostedRoomResponse }>();

const chatOpen = ref(false);
const drawerVisible = ref(false);
const now = useNow();

const todayDay = DAY_ORDER[(new Date().getDay() + 6) % 7]!;

const { data: todaySlots } = useGetTimeslots({
  room_id: props.room.id,
  day: todayDay,
});

const { data: enabledDays } = useGetEnabledDays(props.room.id);

const nextSlot = computed(() => {
  if (!todaySlots.value) return null;
  const currentMinutes = now.value.getHours() * 60 + now.value.getMinutes();
  return (
    todaySlots.value
      .filter(
        (s) =>
          s.status !== "ended" &&
          s.status !== "live" &&
          s.enabled &&
          s.start_time > currentMinutes
      )
      .sort((a, b) => a.start_time - b.start_time)[0] ?? null
  );
});

const nextEnabledDay = computed(() => {
  if (nextSlot.value) return null;
  if (!enabledDays.value?.length) return null;
  const todayIndex = DAY_ORDER.indexOf(todayDay);

  let best: { day: string; label: string; offset: number } | null = null;
  let bestOffset = Infinity;
  for (const entry of enabledDays.value) {
    const idx = DAY_ORDER.indexOf(entry.day);
    if (idx === -1) continue;
    let offset = (idx - todayIndex + 7) % 7;
    if (offset === 0) offset = 7;
    if (offset < bestOffset) {
      bestOffset = offset;
      best = { ...entry, offset };
    }
  }
  return best;
});

// The next upcoming slot, resolved once as { when, label, countdown }.
// `when` is relative ("Today"/"Tomorrow"/"Next Monday"); `countdown` is
// only set for same-day slots. offset === 1 covers tomorrow for any weekday,
// so Sunday → Monday reads "Tomorrow" without a special case.
const nextSlotInfo = computed(() => {
  if (nextSlot.value) {
    return {
      when: "Today",
      label: nextSlot.value.label,
      countdown: nextSlotTimeLabel.value,
    };
  }
  if (nextEnabledDay.value) {
    const { day, label, offset } = nextEnabledDay.value;
    return {
      when: offset === 1 ? "Tomorrow" : `Next ${DAY_LABELS[day]}`,
      label,
      countdown: "",
    };
  }
  return null;
});

const primaryLabel = computed(
  () => props.room.liveSlot?.label ?? nextSlotInfo.value?.label ?? null
);

const nextHint = computed(() => {
  const info = nextSlotInfo.value;
  // While a slot is live, the label shows it and the hint previews what follows.
  if (props.room.liveSlot) {
    return info ? `Next: ${info.when} at ${info.label}` : "";
  }
  // Otherwise the label already is the next slot — the hint just says when.
  return info?.when ?? "";
});

const { isRecentlyRedistributed, noticesForTimeslot, dismissNotice } =
  useRedistributionNotices();

const redistributionNotices = computed(() =>
  nextSlot.value ? noticesForTimeslot(nextSlot.value.id) : []
);

const roomStatus = computed(() => {
  if (props.room.liveSlot) return "live";
  if (nextSlot.value && isRecentlyRedistributed(nextSlot.value.id)) {
    return "redistributed";
  }
  return nextSlot.value || nextEnabledDay.value ? "scheduled" : "inactive";
});

const elapsedMinutes = computed(() => {
  if (!props.room.liveSlot) return 0;
  const n = now.value;
  return Math.max(
    1,
    n.getHours() * 60 + n.getMinutes() - props.room.liveSlot.start_time
  );
});

const nextSlotTimeLabel = computed(() => {
  if (!nextSlot.value) return "";
  const mins =
    nextSlot.value.start_time -
    (now.value.getHours() * 60 + now.value.getMinutes());
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `in ${hrs}h${rem}m` : `in ${hrs}h`;
});

const activePlayerInfo = computed(() => {
  if (props.room.liveSlot) {
    return {
      count: props.room.liveSlot.players_count,
      max: props.room.liveSlot.max_players,
    };
  }
  if (nextSlot.value) {
    return {
      count: nextSlot.value.players.length,
      max: nextSlot.value.max_players,
    };
  }
  return null;
});

const playerPercent = computed(() => {
  if (!activePlayerInfo.value) return 0;
  return Math.min(
    100,
    (activePlayerInfo.value.count / activePlayerInfo.value.max) * 100
  );
});

const capacityColor = computed(() => {
  if (!activePlayerInfo.value) return "bg-surface-300";
  const ratio = activePlayerInfo.value.count / activePlayerInfo.value.max;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-amber-400";
  return "bg-primary-400";
});
</script>
