<template>
  <div class="mx-auto flex flex-col !gap-6 !py-8">
    <!-- Joining & Availability -->
    <BasicWrapper>
      <div class="!mb-5">
        <h2 class="text-base font-semibold text-surface-900">
          Joining & Availability
        </h2>
        <p class="!mt-0.5 text-sm text-surface-400">
          Control when and how players can join timeslots
        </p>
      </div>

      <div class="divide-y divide-surface-100">
        <DisabledBlock
          disabled
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Late join cutoff
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Minutes before start time after which players can no longer join
            </p>
          </div>
          <InputNumber
            v-model="lateJoinCutoff"
            :min="0"
            :max="120"
            suffix=" min"
            :show-buttons="true"
            button-layout="horizontal"
            decrement-button-icon="fa-solid fa-minus"
            increment-button-icon="fa-solid fa-plus"
          />
        </DisabledBlock>

        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Allow join on live slot
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Let players join a slot that has already started
            </p>
          </div>
          <ToggleSwitch v-model="allowJoinOnLive" />
        </div>

        <div class="!py-4 first:!pt-0 last:!pb-0">
          <div class="!mb-3">
            <p class="text-sm font-medium text-surface-700">Join policy</p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Control whether players can freely join or need approval
            </p>
          </div>

          <SelectButton
            v-model="joinPolicy"
            :options="joinPolicyOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            fluid
          />

          <div
            v-if="joinPolicy === 'required-list'"
            class="!mt-4 rounded-xl border border-surface-200 bg-surface-50/50 !p-4"
          >
            <p class="text-xs font-medium text-surface-600 !mb-1">
              Players requiring approval
            </p>
            <p class="!mb-3 text-xs text-surface-400">
              Only these players will need to request access before joining
            </p>

            <div class="relative !mb-3">
              <i
                class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-surface-300"
                style="font-size: 0.7rem"
              />
              <input
                v-model="playerSearch"
                placeholder="Search players…"
                class="w-full rounded-lg border border-surface-200 bg-white !py-2 !pl-8 !pr-3 text-sm outline-none placeholder:text-surface-300 focus:border-primary-300"
              />
            </div>

            <div v-if="requiredPlayers.length" class="flex flex-col !gap-2">
              <div
                v-for="player in requiredPlayers"
                :key="player.id"
                class="flex items-center justify-between rounded-lg bg-white !px-3 !py-2 border border-surface-100"
              >
                <div class="flex items-center !gap-2">
                  <div
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
                  >
                    <i class="fa-solid fa-user" style="font-size: 0.55rem" />
                  </div>
                  <span class="text-sm text-surface-700">
                    {{ player.name }}
                  </span>
                </div>
                <button
                  class="flex items-center justify-center rounded-full h-5 w-5 cursor-pointer border-none outline-none text-surface-300 hover:text-surface-500 hover:bg-surface-100"
                  @click="removeRequiredPlayer(player.id)"
                >
                  <i class="fa-solid fa-xmark" style="font-size: 0.6rem" />
                </button>
              </div>
            </div>
            <p v-else class="text-xs italic text-surface-300">
              No players added yet
            </p>

            <div
              class="flex items-center !gap-2 !mt-4 !pt-3 border-t border-surface-200"
            >
              <Checkbox
                v-model="includeBlacklisted"
                input-id="includeBlacklisted"
                :binary="true"
              />
              <label
                for="includeBlacklisted"
                class="text-xs text-surface-500 cursor-pointer"
              >
                Also require approval for blacklisted players
              </label>
            </div>
          </div>
        </div>
      </div>
    </BasicWrapper>

    <!-- Slot Defaults -->
    <BasicWrapper>
      <div class="!mb-5">
        <h2 class="text-base font-semibold text-surface-900">Slot Defaults</h2>
        <p class="!mt-0.5 text-sm text-surface-400">
          Default values applied when creating new timeslots
        </p>
      </div>

      <div class="divide-y divide-surface-100">
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Default max players
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Pre-filled player cap for new slots
            </p>
          </div>
          <InputNumber
            v-model="defaultMaxPlayers"
            :min="2"
            :max="50"
            :show-buttons="true"
            button-layout="horizontal"
            decrement-button-icon="fa-solid fa-minus"
            increment-button-icon="fa-solid fa-plus"
          />
        </div>

        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Min players per slot
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Minimum number of players required to run a slot
            </p>
          </div>
          <InputNumber
            v-model="minPlayers"
            :min="1"
            :max="50"
            :show-buttons="true"
            button-layout="horizontal"
            decrement-button-icon="fa-solid fa-minus"
            increment-button-icon="fa-solid fa-plus"
          />
        </div>

        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">Default price</p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Pre-filled price for new slots
            </p>
          </div>
          <InputNumber
            v-model="defaultPrice"
            :min="0"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            mode="currency"
            currency="EUR"
          />
        </div>

        <div class="!py-4 first:!pt-0 last:!pb-0">
          <div class="!mb-3">
            <p class="text-sm font-medium text-surface-700">Default features</p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Pre-selected features for new slots
            </p>
          </div>
          <div
            class="flex flex-wrap items-center !gap-2 rounded-xl border border-surface-200 bg-surface-50/50 !p-3"
          >
            <span
              v-for="feature in globalFeatures"
              :key="feature.label"
              class="inline-flex items-center !gap-1.5 rounded-full !py-2 !pl-3.5 text-sm cursor-pointer transition-colors"
              :class="[
                enabledFeatures.includes(feature.label)
                  ? 'bg-primary-500 text-white border border-primary-500'
                  : 'bg-transparent text-surface-600 border border-surface-200',
                builtInLabels.has(feature.label) ? '!pr-3.5' : '!pr-2',
              ]"
              @click="toggleFeature(feature.label)"
            >
              <i
                :class="`fa-solid ${feature.icon}`"
                style="font-size: 0.65rem"
              />
              <span class="text-sm font-medium">{{ feature.label }}</span>
              <button
                v-if="!builtInLabels.has(feature.label)"
                class="flex items-center justify-center rounded-full h-5 w-5 cursor-pointer border-none outline-none transition-colors"
                :class="
                  enabledFeatures.includes(feature.label)
                    ? 'bg-primary-600 text-white/70 hover:bg-primary-700 hover:text-white'
                    : 'bg-transparent text-surface-400 hover:bg-surface-200 hover:text-red-500'
                "
                @click.stop="removeFeature(feature.label)"
              >
                <i class="fa-solid fa-xmark" style="font-size: 0.5rem" />
              </button>
            </span>

            <span
              v-if="addingFeature"
              class="inline-flex items-center rounded-full !pl-3.5 !pr-2 !py-2 border border-surface-200"
              @focusout="handleFocusOut"
            >
              <input
                ref="newFeatureInput"
                v-model="newFeatureLabel"
                placeholder="type a feature…"
                class="w-24 text-sm outline-none border-none placeholder:text-surface-300"
                @keydown.enter="addFeature"
                @keydown.escape="cancelAddFeature"
              />
              <button
                v-if="newFeatureLabel.trim()"
                class="flex shrink-0 items-center justify-center rounded-full bg-primary-600 text-white h-5 w-5 cursor-pointer border-none outline-none"
                @mousedown.prevent="addFeature"
              >
                <i class="fa-solid fa-check" style="font-size: 0.55rem" />
              </button>
            </span>
            <Button
              v-else
              icon="fa-solid fa-plus"
              size="small"
              rounded
              variant="outlined"
              class="!cursor-pointer"
              @click="startAddFeature"
            />
          </div>
        </div>
      </div>
    </BasicWrapper>

    <!-- Player Redistribution -->
    <BasicWrapper>
      <div class="!mb-5">
        <h2 class="text-base font-semibold text-surface-900">
          Player Management
        </h2>
        <p class="!mt-0.5 text-sm text-surface-400">
          Automatically shuffle players when a slot is under-filled
        </p>
      </div>

      <div class="divide-y divide-surface-100">
        <div class="!py-4 first:!pt-0">
          <p class="text-sm font-medium text-surface-700">
            Auto-redistribute players
          </p>
          <p class="!mt-0.5 !mb-2 text-xs text-surface-400">
            Randomly redistribute players to other slots when minimum isn't
            reached
          </p>

          <Message
            severity="warn"
            :pt="{
              text: {
                class: '!w-full',
              },
            }"
          >
            <div
              class="!w-full flex flex-col sm:flex-row sm:items-center !gap-3 sm:!justify-between"
            >
              <p class="text-sm !font-light">
                Some players may be removed from the slot if it is under-filled
                and redistributed to other slots.
              </p>

              <ToggleSwitch v-model="autoRedistribute" />
            </div>
          </Message>
        </div>

        <DisabledBlock
          :disabled="!autoRedistribute"
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Redistribution window
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              How early before start time to check and redistribute
            </p>
          </div>
          <InputNumber
            v-model="redistributionWindow"
            :min="5"
            :max="60"
            suffix=" min"
            :show-buttons="true"
            button-layout="horizontal"
            decrement-button-icon="fa-solid fa-minus"
            increment-button-icon="fa-solid fa-plus"
          />
        </DisabledBlock>
      </div>
    </BasicWrapper>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick } from "vue";
import {
  InputNumber,
  ToggleSwitch,
  Button,
  Message,
  SelectButton,
  Checkbox,
} from "primevue";
import { watchDebounced } from "@vueuse/core";
import BasicWrapper from "@/components/BasicWrapper.vue";
import DisabledBlock from "@/components/DisabledBlock.vue";
import {
  useGetTenantSettings,
  useUpdateTenantSettings,
} from "@/features/settings/composables/queries";

const { mutate: saveSettings } = useUpdateTenantSettings();
const { data: tenantData } = useGetTenantSettings(1);

const hydrated = ref(false);

// TODO: get from auth store once tenant is wired up
const tenantId = 1;

const lateJoinCutoff = ref(15);
const allowJoinOnLive = ref(false);

type JoinPolicy = "free" | "required" | "required-list";
const joinPolicy = ref<JoinPolicy>("free");
const joinPolicyOptions = [
  { label: "Free", value: "free" as const },
  { label: "Required", value: "required" as const },
  { label: "Required List", value: "required-list" as const },
];
const playerSearch = ref("");
const requiredPlayers = ref([
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" },
]);
const removeRequiredPlayer = (id: number) => {
  requiredPlayers.value = requiredPlayers.value.filter((p) => p.id !== id);
};
const includeBlacklisted = ref(false);

const defaultMaxPlayers = ref(10);
const defaultPrice = ref(5.0);

const minPlayers = ref(4);
const autoRedistribute = ref(false);
const redistributionWindow = ref(15);

const builtInFeatures = [
  { label: "ball", icon: "fa-futbol" },
  { label: "showers", icon: "fa-shower" },
  { label: "parking", icon: "fa-square-parking" },
  { label: "lights", icon: "fa-sun" },
];
const builtInLabels = new Set(builtInFeatures.map((f) => f.label));
const globalFeatures = ref([...builtInFeatures]);
const enabledFeatures = ref<string[]>(builtInFeatures.map((f) => f.label));
const newFeatureLabel = ref("");
const addingFeature = ref(false);
const newFeatureInput = ref<HTMLInputElement | null>(null);

const startAddFeature = async () => {
  addingFeature.value = true;
  await nextTick();
  newFeatureInput.value?.focus();
};

const cancelAddFeature = () => {
  addingFeature.value = false;
  newFeatureLabel.value = "";
};

const handleFocusOut = (e: FocusEvent) => {
  const container = e.currentTarget as HTMLElement;
  if (!container.contains(e.relatedTarget as Node)) {
    cancelAddFeature();
  }
};

const toggleFeature = (label: string) => {
  if (enabledFeatures.value.includes(label)) {
    enabledFeatures.value = enabledFeatures.value.filter((f) => f !== label);
  } else {
    enabledFeatures.value = [...enabledFeatures.value, label].sort();
  }
};

const addFeature = () => {
  const label = newFeatureLabel.value.trim().toLowerCase();
  if (!label || globalFeatures.value.some((f) => f.label === label)) return;
  globalFeatures.value.push({ label, icon: "fa-tag" });
  enabledFeatures.value = [...enabledFeatures.value, label].sort();
  newFeatureLabel.value = "";
  addingFeature.value = false;
};

const removeFeature = (label: string) => {
  globalFeatures.value = globalFeatures.value.filter((f) => f.label !== label);
  enabledFeatures.value = enabledFeatures.value.filter((f) => f !== label);
};

const joinPolicyValue = computed<number[]>(() => {
  if (joinPolicy.value === "free") return [-2];
  if (joinPolicy.value === "required") return [-1];
  const ids = requiredPlayers.value.map((p) => p.id);
  return includeBlacklisted.value ? [0, ...ids] : ids;
});

const settingsPayload = computed(() => ({
  lateJoinCutoff: lateJoinCutoff.value,
  allowJoinOnLive: allowJoinOnLive.value,
  joinPolicy: joinPolicyValue.value,
  defaultMaxPlayers: defaultMaxPlayers.value,
  minPlayers: minPlayers.value,
  defaultPrice: defaultPrice.value,
  defaultFeatures: enabledFeatures.value,
  autoRedistribute: autoRedistribute.value,
  redistributionWindow: redistributionWindow.value,
}));

watch(
  () => tenantData.value?.settings,
  (s) => {
    if (!s) return;
    lateJoinCutoff.value = s.lateJoinCutoff;
    allowJoinOnLive.value = s.allowJoinOnLive;
    defaultMaxPlayers.value = s.defaultMaxPlayers;
    minPlayers.value = s.minPlayers;
    defaultPrice.value = s.defaultPrice;
    enabledFeatures.value = s.defaultFeatures;
    const customFeatures = s.defaultFeatures
      .filter((label) => !builtInLabels.has(label))
      .map((label) => ({ label, icon: "fa-tag" }));
    globalFeatures.value = [...builtInFeatures, ...customFeatures];
    autoRedistribute.value = s.autoRedistribute;
    redistributionWindow.value = s.redistributionWindow;

    const jp = s.joinPolicy;
    if (jp[0] === -2) {
      joinPolicy.value = "free";
    } else if (jp[0] === -1) {
      joinPolicy.value = "required";
    } else {
      joinPolicy.value = "required-list";
      includeBlacklisted.value = jp[0] === 0;
      const ids = jp.filter((id) => id > 0);
      requiredPlayers.value = ids.map((id) => ({ id, name: `Player ${id}` }));
    }

    hydrated.value = true;
  },
  { immediate: true, once: true },
);

watchDebounced(
  settingsPayload,
  (settings) => {
    if (!hydrated.value) return;
    saveSettings({ tenantId, settings });
  },
  { debounce: 800, deep: true },
);
</script>
