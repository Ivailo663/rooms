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
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between !gap-3 !py-4 first:!pt-0 last:!pb-0"
        >
          <div>
            <p class="text-sm font-medium text-surface-700">
              Roster lock &amp; redistribution
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Minutes before start when the roster locks — no new joins, and
              under-filled slots are redistributed or, if they can't be, marked
              as not enough players
            </p>
          </div>
          <InputNumber
            v-model="lateJoinCutoff"
            :min="5"
            :max="60"
            suffix=" min"
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

            <AutoComplete
              v-model="playerSearch"
              :suggestions="accountSuggestions"
              option-label="name"
              :delay="350"
              placeholder="Search players by name or email…"
              class="w-full !mb-3"
              fluid
              :virtual-scroller-options="{ itemSize: 50 }"
              @complete="onSearchAccounts"
              @option-select="onSelectAccount"
            >
              <template #option="{ option }">
                <div class="flex items-center !gap-2 !py-1">
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
                  >
                    <i class="fa-solid fa-user" style="font-size: 0.6rem" />
                  </div>
                  <div class="flex flex-col leading-tight">
                    <span class="text-sm text-surface-700">
                      {{ option.name }}
                    </span>
                    <span class="text-xs text-surface-400">
                      {{ option.email }}
                    </span>
                  </div>
                </div>
              </template>
              <template #empty>
                <div class="!px-3 !py-2 text-xs text-surface-400">
                  {{
                    searchTerm.length < 3
                      ? "Type at least 3 characters to search"
                      : "No players found"
                  }}
                </div>
              </template>
            </AutoComplete>

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

          <div v-if="joinPolicy !== 'free'" class="!mt-4">
            <p class="text-xs font-medium text-surface-600 !mb-1">
              Denial message
            </p>
            <p class="!mb-2 text-xs text-surface-400">
              Shown to declined players
            </p>
            <Textarea
              v-model="deniedMessage"
              :rows="2"
              auto-resize
              fluid
              placeholder="e.g. The squad is full this week — try again for the next game."
              class="text-sm"
            />
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
              Default min Players
            </p>
            <p class="!mt-0.5 text-xs text-surface-400">
              Pre-filled minimum players required to run a new slot
            </p>
          </div>
          <InputNumber
            v-model="defaultMinPlayers"
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
                Some players will be removed from the slot if it is under-filled
                and redistributed to other slots. (some may be left behind)
              </p>

              <ToggleSwitch v-model="autoRedistribute" />
            </div>
          </Message>
        </div>
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
  AutoComplete,
  Textarea,
} from "primevue";
import { watchDebounced } from "@vueuse/core";
import type { AccountSearchResult } from "@football/shared";
import BasicWrapper from "@/components/BasicWrapper.vue";
import {
  useGetTenantSettings,
  useUpdateTenantSettings,
  useUpdateTenantAccount,
  useSearchAccounts,
} from "@/features/settings/composables/queries";

// TODO: get from auth store once tenant is wired up
const tenantId = 1;

const { mutate: saveSettings } = useUpdateTenantSettings();
const { mutate: saveAccountFlags } = useUpdateTenantAccount();
const { data: tenantData } = useGetTenantSettings(tenantId);

const hydrated = ref(false);

const lateJoinCutoff = ref(15);
const allowJoinOnLive = ref(false);

type JoinPolicy = "free" | "required" | "required-list";
const joinPolicy = ref<JoinPolicy>("free");
const joinPolicyOptions = [
  { label: "Free", value: "free" as const },
  { label: "Approval", value: "required" as const },
  { label: "Approval For Some", value: "required-list" as const },
];
// `playerSearch` holds the AutoComplete input value; `searchTerm` is the
// debounced query the server search runs against (set from @complete).
const playerSearch = ref("");
const searchTerm = ref("");
const { data: accountResults } = useSearchAccounts(searchTerm);

// Derived from the query cache — the mutation invalidates ["tenant-settings"],
// so there is no local copy to keep in sync.
const requiredPlayers = computed(() =>
  (tenantData.value?.flaggedAccounts ?? [])
    .filter((a) => a.requiresApproval)
    .map((a) => ({ id: a.accountId, name: a.name }))
);

// Drop anyone already on the list, and never show stale results for a
// sub-threshold term (keepPreviousData retains the last 3+ char result set).
const accountSuggestions = computed<AccountSearchResult[]>(() => {
  if (searchTerm.value.length < 3) return [];
  const added = new Set(requiredPlayers.value.map((p) => p.id));
  return (accountResults.value ?? []).filter((a) => !added.has(a.id));
});

const onSearchAccounts = (e: { query: string }) => {
  searchTerm.value = e.query.trim();
};

const onSelectAccount = (e: { value: AccountSearchResult }) => {
  saveAccountFlags({ tenantId, accountId: e.value.id, requiresApproval: true });
  playerSearch.value = "";
  searchTerm.value = "";
};

const removeRequiredPlayer = (id: number) => {
  saveAccountFlags({ tenantId, accountId: id, requiresApproval: false });
};
const includeBlacklisted = ref(false);
const deniedMessage = ref("");

const defaultMaxPlayers = ref(10);
const defaultPrice = ref(5.0);

const defaultMinPlayers = ref(4);
const autoRedistribute = ref(false);

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

const settingsPayload = computed(() => ({
  lateJoinCutoff: lateJoinCutoff.value,
  allowJoinOnLive: allowJoinOnLive.value,
  joinMode: joinPolicy.value,
  includeBlacklisted: includeBlacklisted.value,
  deniedMessage: deniedMessage.value.trim(),
  defaultMaxPlayers: defaultMaxPlayers.value,
  defaultMinPlayers: defaultMinPlayers.value,
  defaultPrice: defaultPrice.value,
  defaultFeatures: enabledFeatures.value,
  autoRedistribute: autoRedistribute.value,
}));

watch(
  () => tenantData.value,
  (data) => {
    const s = data?.settings;
    if (!s) return;
    lateJoinCutoff.value = s.lateJoinCutoff;
    allowJoinOnLive.value = s.allowJoinOnLive;
    defaultMaxPlayers.value = s.defaultMaxPlayers;
    defaultMinPlayers.value = s.defaultMinPlayers;
    defaultPrice.value = s.defaultPrice;
    enabledFeatures.value = s.defaultFeatures;
    const customFeatures = s.defaultFeatures
      .filter((label) => !builtInLabels.has(label))
      .map((label) => ({ label, icon: "fa-tag" }));
    globalFeatures.value = [...builtInFeatures, ...customFeatures];
    autoRedistribute.value = s.autoRedistribute;

    joinPolicy.value = s.joinMode ?? "free";
    includeBlacklisted.value = s.includeBlacklisted ?? false;
    deniedMessage.value = s.deniedMessage ?? "";

    hydrated.value = true;
  },
  { immediate: true, once: true }
);

watchDebounced(
  settingsPayload,
  (settings) => {
    if (!hydrated.value) return;
    saveSettings({ tenantId, settings });
  },
  { debounce: 800, deep: true }
);
</script>
