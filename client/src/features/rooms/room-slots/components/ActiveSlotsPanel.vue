<template>
  <div class="w-72 shrink-0">
    <!-- Header -->
    <div class="!mb-3 flex items-center justify-between">
      <span
        class="text-xs font-semibold uppercase tracking-widest text-surface-500"
      >
        Active slots
      </span>
      <span
        v-if="slots?.length"
        class="rounded-full bg-emerald-50 !px-2 !py-0.5 text-xs font-semibold text-emerald-600"
      >
        {{ slots.length }}
      </span>
    </div>

    <!-- Legend -->
    <div class="!mb-4 flex items-center !gap-4">
      <div class="flex items-center !gap-1.5">
        <StatusDot color="green" />
        <span class="text-xs text-surface-400">Now playing</span>
      </div>
      <div class="flex items-center !gap-1.5">
        <StatusDot color="amber" />
        <span class="text-xs text-surface-400">Upcoming</span>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!slots?.length"
      class="flex flex-col items-center rounded-xl border border-dashed border-surface-200 !py-10 text-center"
    >
      <div
        class="!mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-100"
      >
        <i class="fa-solid fa-clock text-lg text-surface-300" />
      </div>
      <p class="text-xs font-medium text-surface-400">No active slots</p>
      <p class="!mt-0.5 text-xs text-surface-300">
        Launch a slot to see it here
      </p>
    </div>

    <!-- Slot list -->
    <div
      v-else
      class="overflow-y-auto !mb-5"
      :style="maxHeight ? { maxHeight: `${maxHeight - 100}px` } : undefined"
    >
      <div
        v-for="slot in slots"
        :key="slot.id"
        class="rounded-xl border border-surface-200 bg-white !p-4 !mb-2"
      >
        <!-- Slot header -->
        <div class="flex items-center justify-between !gap-2 !mb-4">
          <div class="flex items-center !gap-2">
            <i
              class="fa-solid fa-clock text-primary-400 !mr-1"
              style="font-size: 0.7rem"
            />
            <span class="text-sm font-bold text-surface-900">{{
              slot.label
            }}</span>
            <StatusDot
              :color="slotStatus(slot) === 'live' ? 'green' : 'amber'"
              :ping="slotStatus(slot) === 'live'"
            />
          </div>

          <p
            v-if="slotStatus(slot) === 'live'"
            class="italic text-sm font-semibold text-emerald-600"
          >
            {{ now.getMinutes() }} '
          </p>
          <p v-else class="text-xs text-surface-400">
            {{ nextLabel(slot) }}
          </p>
        </div>

        <div class="flex items-center !gap-1.5 !mb-2">
          <i
            class="fa-solid fa-users text-surface-400"
            style="font-size: 0.6rem"
          />
          <span class="text-xs font-medium text-surface-500">
            {{ slot.players.length }}/{{ slot.max_players }}
          </span>
        </div>

        <!-- Capacity bar -->
        <div
          class="!mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-100"
        >
          <div
            class="h-full rounded-full transition-all"
            :class="capacityColor(slot)"
            :style="{
              width: `${Math.min(100, (slot.players.length / slot.max_players) * 100)}%`,
            }"
          />
        </div>

        <!-- Player list -->
        <div v-if="slot.players.length" class="flex flex-col !gap-2">
          <div
            v-for="player in slot.players"
            :key="player.id"
            class="flex items-center !gap-2"
          >
            <div
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
            >
              <i class="fa-solid fa-user" style="font-size: 0.55rem" />
            </div>
            <span class="truncate text-xs text-surface-600">
              {{ player.name || "Player #" + player.id }}
            </span>
          </div>
        </div>
        <p v-else class="text-xs italic text-surface-300">No players yet</p>

        <!-- Price + features -->
        <div
          v-if="slot.price || (slot.features as string[])?.length"
          class="!mt-4 flex flex-wrap items-center !gap-2 border-t border-surface-100 !pt-3"
        >
          <span
            v-if="slot.price"
            class="rounded-full bg-emerald-50 !px-2 !py-0.5 text-xs font-semibold text-emerald-600"
          >
            {{ slot.price }} €
          </span>
          <span
            v-for="feature in slot.features as string[] | undefined"
            :key="feature"
            class="rounded-full border border-surface-100 !px-2 !py-0.5 text-xs text-surface-400"
          >
            {{ feature }}
          </span>
        </div>
      </div>
    </div>
    <Button label="Show all days" variant="text" size="small" fluid disabled />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useGetEnabledTimeslots } from "../../composables/queries";
import { socket } from "@/socket";
import type {
  TimeslotResponse,
  TimeslotMembershipChangedPayload,
} from "@football/shared";
import { useNow } from "../../composables/useNow";
import { Button } from "primevue";
import StatusDot from "@/components/StatusDot.vue";

const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";

const props = defineProps<{
  roomId: number;
  selectedDay: string;
  maxHeight?: number | null;
}>();

const queryClient = useQueryClient();

const { data: slots } = useGetEnabledTimeslots({
  room_id: props.roomId,
  day: () => props.selectedDay,
});

const slotFirstSeen = ref<Record<number, number>>({});

watch(slots, (newSlots, oldSlots) => {
  const oldIds = new Set(oldSlots?.map((s) => s.id) ?? []);
  newSlots?.forEach((slot) => {
    if (!oldIds.has(slot.id)) slotFirstSeen.value[slot.id] = Date.now();
  });
});

const handleMembershipChanged = ({
  timeslotId,
  players,
}: TimeslotMembershipChangedPayload) => {
  queryClient.setQueryData<TimeslotResponse[]>(
    ["timeslots", "enabled", props.roomId, props.selectedDay],
    (current) =>
      current?.map((slot) =>
        slot.id === timeslotId ? { ...slot, players } : slot
      )
  );
};

onMounted(() => {
  socket.on(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged);
});

onBeforeUnmount(() => {
  socket.off(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged);
});

const capacityColor = (slot: TimeslotResponse) => {
  const ratio = slot.players.length / slot.max_players;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-amber-400";
  return "bg-primary-400";
};

const now = useNow();

const DAY_MAP = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const DAY_LABELS: Record<string, string> = {
  su: "Sunday",
  mo: "Monday",
  tu: "Tuesday",
  we: "Wednesday",
  th: "Thursday",
  fr: "Friday",
  sa: "Saturday",
};

const getStartMinutes = (slot: TimeslotResponse) =>
  parseInt(slot.label.split(":")[0] ?? "0", 10) * 60;

const minutesUntilStart = (slot: TimeslotResponse) => {
  const n = now.value;
  return getStartMinutes(slot) - (n.getHours() * 60 + n.getMinutes());
};

const slotStatus = (slot: TimeslotResponse): "live" | "next" => {
  const n = now.value;
  if (slot.day !== DAY_MAP[n.getDay()]) return "next";
  const diff = minutesUntilStart(slot);
  if (diff <= 0 && diff > -60) {
    const startMs = new Date(n).setHours(0, 0, 0, 0) + getStartMinutes(slot) * 60_000;
    const appearedAt = slotFirstSeen.value[slot.id];
    if (appearedAt && appearedAt > startMs) return "next";
    return "live";
  }
  return "next";
};

const nextLabel = (slot: TimeslotResponse): string => {
  const n = now.value;
  const diff = minutesUntilStart(slot);
  if (slot.day === DAY_MAP[n.getDay()] && diff > 0) return `Today ${slot.label}`;
  const daysUntil = (DAY_MAP.indexOf(slot.day) - n.getDay() + 7) % 7 || 7;
  if (daysUntil === 1) return `Tomorrow ${slot.label}`;
  return `Next ${DAY_LABELS[slot.day]}`;
};
</script>
