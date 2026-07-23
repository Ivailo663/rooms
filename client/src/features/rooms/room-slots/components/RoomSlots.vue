<template>
  <div class="flex flex-col !gap-4">
    <div>
      <div>
        <div class="day-banner rounded-2xl !p-4 border border-primary-50">
          <!-- Day selector -->
          <div
            class="flex flex-wrap items-center justify-between !gap-x-2 !gap-y-3 !mb-4"
          >
            <p
              class="flex items-center !gap-1.5 text-[11px] font-medium tracking-wide text-surface-400/80"
            >
              <i class="fa-solid fa-calendar" style="font-size: 0.6rem" />
              Day
            </p>

            <p
              class="text-[20px] font-extralight tracking-[5px] text-primary-300 uppercase select-none"
            >
              {{ DAYS.find((d) => d.value === weekDay)?.full }}
            </p>

            <div class="flex items-center justify-between w-full">
              <SelectButton
                v-model="weekDay"
                :options="DAYS"
                option-value="value"
                option-label="label"
                :allow-empty="false"
                size="small"
                class="day-switch"
                @change="isCreating = false"
              >
                <template #option="{ option }">
                  <span class="relative">
                    {{ option.label }}
                    <span
                      v-if="option.value === todayValue"
                      class="absolute -bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white"
                    />
                  </span>
                </template>
              </SelectButton>
            </div>
          </div>

          <!-- Slot picker -->
          <div class="!mb-4">
            <div class="flex items-center justify-between !gap-4 !mb-3">
              <p
                class="flex items-center !gap-1.5 text-[11px] font-medium tracking-wide text-surface-400/80"
              >
                <i class="fa-solid fa-clock" style="font-size: 0.6rem" />
                Time slots
              </p>

              <div class="shrink-0">
                <Button
                  :label="newTimeslot ? newTimeslot.name : 'Pick hour'"
                  icon="fa-solid fa-plus"
                  icon-pos="left"
                  unstyled
                  class="inline-flex items-center !gap-2 !px-3 !py-1.5 rounded-lg border border-dashed border-surface-200 bg-surface-50 text-[13px] font-medium text-surface-500 cursor-pointer transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
                  @click="(e: Event) => hourPopover?.toggle(e)"
                >
                  <template #default>
                    <i class="fa-solid fa-plus" style="font-size: 0.5rem" />
                    <span>{{
                      newTimeslot ? newTimeslot.name : "Pick hour"
                    }}</span>
                    <i
                      class="fa-solid fa-chevron-down"
                      style="font-size: 0.45rem"
                    />
                  </template>
                </Button>
                <Popover ref="hourPopover">
                  <div class="grid grid-cols-4 !gap-1 !p-1 w-[220px]">
                    <Button
                      v-for="opt in availableTimeOptions"
                      :key="opt.code"
                      :label="opt.name"
                      unstyled
                      :class="[
                        'rounded-md !py-1.5 text-center text-xs font-medium cursor-pointer transition-colors',
                        newTimeslot?.code === opt.code
                          ? 'bg-primary-600 text-white'
                          : 'text-surface-500 hover:bg-primary-50 hover:text-primary-600',
                      ]"
                      @click="pickHour(opt, $event)"
                    />
                  </div>
                </Popover>
              </div>
            </div>

            <div class="flex flex-wrap !gap-1.5">
              <Button
                v-for="(slot, index) in slots"
                :key="slot.id"
                unstyled
                :class="[
                  'flex flex-col items-start !gap-0.5 !px-2 !py-1.5 rounded-lg border-1 cursor-pointer text-left transition-colors',
                  index === selectedIndex && !isCreating
                    ? 'border-dashed border-primary-300 bg-primary-50'
                    : 'border-solid border-surface-200 bg-white hover:border-primary-300',
                  !slot.enabled ? 'opacity-70' : '',
                ]"
                @click="selectSlot(index)"
              >
                <template #default>
                  <div class="flex items-center !gap-1.5">
                    <StatusDot
                      :color="slotDotColor(slot)"
                      :ping="slot.enabled && liveNow(slot)"
                    />
                    <span
                      class="text-[11px] font-semibold whitespace-nowrap text-surface-700"
                    >
                      <template v-if="liveNow(slot)">
                        {{ slot.label }}
                      </template>
                      <template v-else>{{ nextLabel(slot) }}</template>
                    </span>
                    <span
                      v-if="slot.pendingRequests.length"
                      class="flex items-center !gap-0.5 rounded-full bg-amber-100 !px-1.5 text-[9px] font-bold leading-4 text-amber-600"
                    >
                      <i
                        class="fa-solid fa-user-clock"
                        style="font-size: 0.5rem"
                      />
                      {{ slot.pendingRequests.length }}
                    </span>
                  </div>
                  <span class="text-[10px] font-medium text-surface-400">
                    {{ slot.players.length }}/{{ slot.max_players }}
                  </span>
                </template>
              </Button>
              <Tag
                v-if="isCreating && newTimeslot"
                :value="newTimeslot.name"
                icon="fa-solid fa-clock"
                rounded
                class="!border-1 !border-dashed !border-primary-300 !bg-primary-50 !text-primary-400"
              />
            </div>
            <p
              v-if="!slots?.length"
              class="!mt-1 text-xs italic text-surface-300"
            >
              No slots for this day yet
            </p>
          </div>

          <!-- Form card (nested white inset) -->
          <div
            class="rounded-xl border-1 border-dashed border-primary-300 bg-white !p-5 flex flex-col !gap-4 overflow-hidden"
          >
            <template v-if="isCreating">
              <RoomFormSlot
                v-model:enabled="enabled"
                :form="form"
                :available-features="tenantData?.settings?.defaultFeatures"
                :show-enabled-toggle="true"
              />

              <div
                class="flex justify-end !gap-2 border-t border-surface-100 !pt-3"
              >
                <Button
                  label="Discard"
                  severity="secondary"
                  outlined
                  icon="fa-solid fa-xmark"
                  size="small"
                  @click="discardNewSlot"
                />
                <Button
                  label="Save slot"
                  severity="success"
                  icon="fa-solid fa-check"
                  size="small"
                  :disabled="!newTimeslot"
                  @click="form.handleSubmit()"
                />
              </div>
            </template>

            <template v-else-if="selectedSlot">
              <div class="relative">
                <SelectButton
                  v-model="activeTab"
                  :options="tabOptions"
                  option-value="value"
                  option-label="value"
                  :allow-empty="false"
                  class="!absolute top-0 right-0"
                >
                  <template #option="{ option }">
                    <i :class="option.icon" style="font-size: 0.8rem" />
                  </template>
                </SelectButton>

                <SlotMonitor
                  v-if="activeTab === 'monitor'"
                  :timeslot="selectedSlot"
                  :enabled="enabled"
                />

                <div v-else class="flex flex-col !gap-4 !pt-10">
                  <RoomFormSlot
                    v-model:enabled="enabled"
                    :form="form"
                    :available-features="tenantData?.settings?.defaultFeatures"
                    :available-hours="editableHourOptions"
                    :show-enabled-toggle="false"
                    :disabled="enabled"
                  />
                </div>
              </div>

              <div
                v-if="activeTab === 'settings'"
                class="flex items-center justify-between border-t border-surface-100 !pt-3"
              >
                <Button
                  :label="`Delete ${selectedSlot.label}`"
                  severity="danger"
                  size="small"
                  variant="text"
                  icon="fa-solid fa-trash"
                  @click="deleteSlot"
                />
                <div v-if="isDirty" class="flex !gap-2">
                  <Button
                    label="Discard"
                    severity="secondary"
                    outlined
                    icon="fa-solid fa-rotate"
                    size="small"
                    @click="form.reset()"
                  />
                  <Button
                    label="Save"
                    severity="success"
                    icon="fa-solid fa-check"
                    size="small"
                    @click="form.handleSubmit()"
                  />
                </div>
              </div>

              <button
                class="launch-btn w-full"
                :class="enabled ? 'launch-btn--stop' : 'launch-btn--go'"
                @click="toggleLaunch"
              >
                <i
                  :class="enabled ? 'fa-solid fa-stop' : 'fa-solid fa-play'"
                  style="font-size: 0.75rem"
                />
                {{ enabled ? "Stop slot" : "Launch slot" }}
              </button>
            </template>

            <template v-else>
              <div class="flex flex-col items-center !py-10 text-center">
                <div
                  class="!mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100"
                >
                  <i class="fa-solid fa-clock text-xl text-surface-300" />
                </div>
                <p class="!mb-1 text-sm font-medium text-surface-500">
                  No time slots yet
                </p>
                <p class="!mb-4 text-xs text-surface-300">
                  Add your first time slot for this day
                </p>
                <Button
                  label="Create a slot"
                  icon="fa-solid fa-plus"
                  variant="text"
                  size="small"
                  @click="isCreating = true"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { Button, Popover, SelectButton, Tag } from "primevue";
import { refDebounced } from "@vueuse/core";
import { useForm } from "@tanstack/vue-form";
import type { TimeslotResponse } from "@football/shared";
import {
  useGetTimeslots,
  useCreateTimeslot,
  useUpdateTimeslot,
  useDeleteTimeslot,
} from "../../composables/queries";
import { useGetTenantSettings } from "@/features/settings/composables/queries";
import { useNow } from "../../composables/useNow";
import { isSlotLiveNow } from "../../composables/isSlotLiveNow";
import RoomFormSlot from "./RoomSlotForm.vue";
import SlotMonitor from "./SlotMonitor.vue";
import StatusDot from "@/components/StatusDot.vue";

const props = defineProps<{ id: number }>();

const tabOptions = [
  { value: "monitor", icon: "fa-solid fa-display" },
  { value: "settings", icon: "fa-solid fa-sliders" },
];
const activeTab = ref<"monitor" | "settings">("monitor");

const DAYS = [
  { label: "Mo", value: "mo", full: "Monday" },
  { label: "Tu", value: "tu", full: "Tuesday" },
  { label: "We", value: "we", full: "Wednesday" },
  { label: "Th", value: "th", full: "Thursday" },
  { label: "Fr", value: "fr", full: "Friday" },
  { label: "Sa", value: "sa", full: "Saturday" },
  { label: "Su", value: "su", full: "Sunday" },
];

const ALL_TIME_OPTIONS = Array.from({ length: 25 }, (_, h) => {
  const t = `${String(h).padStart(2, "0")}:00`;
  return { name: t, code: t, order: h };
});

const availableTimeOptions = computed(() => {
  const used = new Set(slots.value?.map((s) => s.label) ?? []);
  return ALL_TIME_OPTIONS.filter((o) => !used.has(o.code));
});

const editableHourOptions = computed(() => {
  const currentLabel = selectedSlot.value?.label;
  const used = new Set(
    slots.value?.filter((s) => s.label !== currentLabel).map((s) => s.label) ?? [],
  );
  return ALL_TIME_OPTIONS.filter((o) => !used.has(o.code));
});

const { data: tenantData } = useGetTenantSettings(1);

const defaultForm = computed(() => {
  const s = tenantData.value?.settings;
  return {
    label: "" as string,
    price: s?.defaultPrice !== null ? String(s?.defaultPrice) : null,
    message: null as string | null,
    min_players: s?.defaultMinPlayers ?? null,
    max_players: s?.defaultMaxPlayers ?? null,
    features: s?.defaultFeatures ?? [],
  };
});

const slotToForm = (slot: TimeslotResponse) => ({
  label: slot.label,
  price: slot.price !== null ? String(slot.price) : null,
  message: slot.message ?? null,
  min_players: slot.min_players ?? null,
  max_players: slot.max_players ?? null,
  features: Array.isArray(slot.features)
    ? [...(slot.features as string[])].sort()
    : [],
});

const todayValue =
  DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]?.value;

const weekDay = ref(todayValue as string);
const debouncedWeekDay = refDebounced(weekDay, 300);

const { data: slots } = useGetTimeslots({
  room_id: props.id,
  day: debouncedWeekDay,
});

const createMutation = useCreateTimeslot();
const updateMutation = useUpdateTimeslot();
const deleteMutation = useDeleteTimeslot();

// ── Slot time labels ──
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

const liveNow = (slot: TimeslotResponse) => isSlotLiveNow(slot, now.value);

const slotDotColor = (slot: TimeslotResponse): "green" | "amber" | "gray" => {
  if (!slot.enabled) return "gray";
  return liveNow(slot) ? "green" : "amber";
};

const minutesUntilStart = (slot: TimeslotResponse) => {
  const n = now.value;
  return slot.start_time - (n.getHours() * 60 + n.getMinutes());
};

const nextLabel = (slot: TimeslotResponse): string => {
  const n = now.value;
  const diff = minutesUntilStart(slot);
  if (slot.day === DAY_MAP[n.getDay()] && diff > -60)
    return `Today ${slot.label}`;

  const daysUntil = (DAY_MAP.indexOf(slot.day) - n.getDay() + 7) % 7 || 7;

  if (daysUntil === 1) return `Tomorrow ${slot.label}`;
  return `Next ${DAY_LABELS[slot.day]} ${slot.label}`;
};

const selectedIndex = ref(0);
const isCreating = ref(false);
const newTimeslot = ref<{ name: string; code: string; order: number } | null>(
  null
);
const enabled = ref(false);
const hourPopover = ref();

// ── Hour picker ──
const pickHour = (
  opt: { name: string; code: string; order: number },
  e: Event
) => {
  newTimeslot.value = opt;
  isCreating.value = true;
  hourPopover.value?.hide(e);
};

const selectedSlot = computed(() => slots.value?.[selectedIndex.value]);

const form = useForm({
  defaultValues: { ...defaultForm.value },
  onSubmit: async ({ value }) => {
    if (isCreating.value && newTimeslot.value) {
      await createMutation.mutateAsync({
        room_id: props.id,
        order: newTimeslot.value.order,
        day: weekDay.value,
        name: newTimeslot.value.name,
        label: newTimeslot.value.code,
        min_players: value.min_players,
        max_players: value.max_players ?? 0,
        price: value.price,
        message: value.message,
        features: value.features,
        enabled: enabled.value,
      });
      discardNewSlot();
    } else if (selectedSlot.value) {
      await updateMutation.mutateAsync({
        id: selectedSlot.value.id,
        label: value.label,
        min_players: value.min_players,
        max_players: value.max_players ?? 0,
        price: value.price,
        message: value.message,
        features: value.features,
      });
      form.reset(value);
    }
  },
});

const isDirty = form.useStore((s) => s.isDirty);

// On today's list, default to the slot that is live or starts next; otherwise the first one.
const defaultSlotIndex = (list: TimeslotResponse[]) => {
  if (debouncedWeekDay.value !== todayValue) return 0;
  const nowMinutes = now.value.getHours() * 60 + now.value.getMinutes();
  let best = -1;
  list.forEach((slot, index) => {
    if (!liveNow(slot) && slot.start_time < nowMinutes) return;
    if (best === -1 || list[best]!.start_time > slot.start_time) best = index;
  });
  return best === -1 ? 0 : best;
};

const autoSelectedDay = ref<string | null>(null);

watch(
  slots,
  (next) => {
    if (!next?.length) {
      selectedIndex.value = 0;
      autoSelectedDay.value = null;
    } else if (autoSelectedDay.value !== debouncedWeekDay.value) {
      autoSelectedDay.value = debouncedWeekDay.value;
      selectedIndex.value = defaultSlotIndex(next);
    } else if (selectedIndex.value >= next.length) {
      selectedIndex.value = next.length - 1;
    }
  },
  { immediate: true }
);

watch(
  [() => selectedSlot.value?.id, isCreating],
  ([, creating]) => {
    activeTab.value = "monitor";
    if (creating || !selectedSlot.value) {
      form.reset({ ...defaultForm.value });
      if (creating) enabled.value = false;
    } else {
      form.reset(slotToForm(selectedSlot.value));
      enabled.value = selectedSlot.value.enabled ?? false;
    }
  },
  { immediate: true }
);

const selectSlot = (index: number) => {
  selectedIndex.value = index;
  isCreating.value = false;
  newTimeslot.value = null;
};

const discardNewSlot = () => {
  isCreating.value = false;
  newTimeslot.value = null;
  if (slots.value?.length) selectedIndex.value = 0;
};

const toggleLaunch = () => {
  if (!selectedSlot.value) return;
  enabled.value = !enabled.value;
  updateMutation.mutate({ id: selectedSlot.value.id, enabled: enabled.value });
};

const deleteSlot = async () => {
  if (!selectedSlot.value) return;
  try {
    await deleteMutation.mutateAsync(selectedSlot.value.id);
    selectedIndex.value = Math.max(0, selectedIndex.value - 1);
  } catch (error) {
    console.error("Failed to delete timeslot:", error);
  }
};
</script>

<style>
.day-banner {
  background-image: linear-gradient(
    135deg,
    #eeedff 0%,
    #f8f7ff 40%,
    #ffffff 100%
  );
}
</style>

<style scoped>
.launch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
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
.day-switch :deep(.p-togglebutton) {
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--p-surface-400);
}
.day-switch :deep(.p-togglebutton:not(.p-togglebutton-checked):hover) {
  background: var(--p-primary-50);
  color: var(--p-primary-500);
}
.day-switch :deep(.p-togglebutton-checked) {
  background: var(--p-primary-600);
  color: #fff;
}
</style>
