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
      <StatusWidget
        :status="roomStatus"
        :label="primaryLabel"
        :hint="nextHint"
        :elapsed="elapsed"
        :countdown="nextSlotInfo?.countdown"
      />
      <PlayersWidget
        :info="activePlayerInfo"
        :players="activeRoster"
        :live="!!room.liveSlot"
      />
    </div>

    <!-- Failed / under-filled notice -->
    <div v-if="failedSlot" class="!px-4 !pb-3">
      <SlotFailedNotice
        :players-count="failedSlot.players.length"
        :min-players="failedSlot.min_players"
        :slot-label="failedSlot.label"
      />
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
import type { EnabledDaySummary, HostedRoomResponse } from "@football/shared";
import ManageSlotsDrawer from "./ManageSlotsDrawer.vue";
import PlayersWidget from "./widgets/PlayersWidget.vue";
import StatusWidget from "./widgets/StatusWidget.vue";
import SlotChat from "../components/SlotChat.vue";
import RedistributionNotice from "../components/RedistributionNotice.vue";
import SlotFailedNotice from "../components/SlotFailedNotice.vue";
import {
  DAYS_PER_WEEK,
  dayValueOf,
  daysUntilDay,
  relativeDayLabel,
} from "@/constants";
import { useNow } from "../composables/useNow";
import { isSlotFailedNow } from "../composables/isSlotLiveNow";
import { elapsedMinutes } from "../composables/gameTime";
import { useGetTimeslots, useGetEnabledDays } from "../composables/queries";
import { useRedistributionNotices } from "../composables/useRedistributionNotices";
import {
  slotPlayerInfo,
  liveSlotPlayerInfo,
  enabledDayPlayerInfo,
} from "../composables/slotQuorum";

const props = defineProps<{ room: HostedRoomResponse }>();

const chatOpen = ref(false);
const drawerVisible = ref(false);
const now = useNow();

// Derived from the ticking clock, not a setup-time snapshot: a card left open
// across midnight would otherwise keep querying the day the tab was opened on
// and label those slots "Today". Driving the query key off this also makes the
// slot list refetch itself on the rollover.
const todayDay = computed(() => dayValueOf(now.value));

const { data: todaySlots } = useGetTimeslots({
  room_id: props.room.id,
  day: todayDay,
});

const { data: enabledDays } = useGetEnabledDays(props.room.id);

const nextSlot = computed(() => {
  if (!todaySlots.value) return null;
  const currentMinutes = now.value.getHours() * 60 + now.value.getMinutes();
  // A slot that hasn't started yet is upcoming by definition — any
  // live/failed/ended on it is a stale status from a past occurrence the
  // scheduler didn't reset, so we gate on the clock, not the stored status.
  // The day is re-checked rather than assumed from the query: anything else
  // here would be rendered as "Today", the way isSlotLiveNow guards too.
  return (
    todaySlots.value
      .filter(
        (s) =>
          s.enabled && s.day === todayDay.value && s.start_time > currentMinutes
      )
      .sort((a, b) => a.start_time - b.start_time)[0] ?? null
  );
});

// A slot that didn't reach its minimum by go-live. Surfaced at room level so
// the host sees the outcome without opening the drawer; the most recent one
// wins. Cleared automatically when the occurrence resets to scheduled.
const failedSlot = computed(() => {
  if (!todaySlots.value) return null;
  return (
    todaySlots.value
      .filter((s) => s.enabled && isSlotFailedNow(s, now.value))
      .sort((a, b) => b.start_time - a.start_time)[0] ?? null
  );
});

// The soonest day that has slots at all, used when today has nothing left.
// Carries the roster of that day's first slot so the player widget has
// something to show for a game that isn't today.
const nextEnabledDay = computed(() => {
  if (nextSlot.value) return null;
  if (!enabledDays.value?.length) return null;

  let best: (EnabledDaySummary & { offset: number }) | null = null;
  for (const entry of enabledDays.value) {
    let offset = daysUntilDay(entry.day, now.value);
    if (offset === -1) continue;
    // Today is already spent — nextSlot was null — so today's own weekday
    // means this time next week, not a few hours ago.
    if (offset === 0) offset = DAYS_PER_WEEK;
    if (offset < (best?.offset ?? Infinity)) best = { ...entry, offset };
  }
  return best;
});

// The next upcoming slot, resolved once as { when, label, countdown }.
// `when` is relative ("Today"/"Tomorrow"/"Next Monday"); `countdown` is
// only set for same-day slots.
const nextSlotInfo = computed(() => {
  if (nextSlot.value) {
    return {
      when: relativeDayLabel(todayDay.value, 0, now.value),
      label: nextSlot.value.label,
      countdown: nextSlotTimeLabel.value,
    };
  }

  if (nextEnabledDay.value) {
    const { day, label, offset } = nextEnabledDay.value;
    return {
      when: relativeDayLabel(day, offset, now.value),
      label,
      countdown: "",
    };
  }
  return null;
});

const primaryLabel = computed(
  () =>
    props.room.liveSlot?.label ??
    nextSlotInfo.value?.label ??
    failedSlot.value?.label ??
    null
);

const nextHint = computed(() => {
  const info = nextSlotInfo.value;
  // While a slot is live, the label shows it and the hint previews what follows.
  if (props.room.liveSlot) {
    return info ? `Next: ${info.when} at ${info.label}` : "";
  }
  // A failed slot with nothing upcoming: name the outcome rather than a time.
  if (!info && failedSlot.value) return "Didn't run";
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
  // Anything still upcoming owns the widget — it describes what's next, not
  // what already happened. A failed slot only takes it over when the day has
  // nothing left; otherwise the failure lives solely in the banner below.
  if (nextSlot.value || nextEnabledDay.value) return "scheduled";
  if (failedSlot.value) return "failed";
  return "inactive";
});

const elapsed = computed(() =>
  props.room.liveSlot
    ? elapsedMinutes(props.room.liveSlot.start_time, now.value)
    : 0
);

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

// Follows whichever slot the status widget is describing, so the counts always
// belong to the game named above them — today's next slot, or the first slot
// of the next day that has one.
const activePlayerInfo = computed(() => {
  if (props.room.liveSlot) return liveSlotPlayerInfo(props.room.liveSlot);
  if (nextSlot.value) return slotPlayerInfo(nextSlot.value);
  if (nextEnabledDay.value) return enabledDayPlayerInfo(nextEnabledDay.value);
  return null;
});

// Who those counts are, when the slot above them is one we hold the full roster
// for. The live slot and a later day both reach the card as summaries carrying
// a count only, so their avatars stay unnamed until that changes.
const activeRoster = computed(() =>
  !props.room.liveSlot && nextSlot.value ? nextSlot.value.players : undefined
);
</script>
