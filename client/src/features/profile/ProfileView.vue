<template>
  <div v-if="account" class="!mx-auto flex w-full max-w-md flex-col !gap-5">
    <!-- Picture and member since are read-only (PROF-20, PROF-25). -->
    <header class="flex flex-col items-center !gap-2 !pt-2 text-center">
      <PlayerAvatar
        :name="account.name"
        :picture-url="account.picture_url"
        class="h-20 w-20 text-2xl shadow-sm ring-4 ring-white"
      />
      <h1 class="text-lg font-bold tracking-tight text-surface-900">
        {{ account.name }}
      </h1>
      <p class="text-xs text-surface-400" data-member-since>
        Member since {{ memberSince(account.created_at) }}
      </p>
    </header>

    <section
      class="flex flex-col !gap-5 rounded-2xl border border-surface-100 bg-white !p-4"
      aria-label="Your details"
    >
      <div class="flex flex-col !gap-1.5">
        <label for="profile-name" :class="LABEL">Name</label>
        <InputText
          id="profile-name"
          v-model="name"
          autocomplete="name"
          :invalid="!!errors.name"
          :aria-describedby="errors.name ? 'profile-name-error' : undefined"
          fluid
          data-field="name"
          @blur="saveName"
        />
        <p
          v-if="errors.name"
          id="profile-name-error"
          :class="ERROR"
          data-error="name"
        >
          {{ errors.name }}
        </p>
      </div>

      <div class="flex flex-col !gap-1.5">
        <label for="profile-position" :class="LABEL">Position</label>
        <Select
          :model-value="position"
          input-id="profile-position"
          :options="POSITIONS"
          option-label="label"
          option-value="value"
          placeholder="Pick a position"
          show-clear
          :invalid="!!errors.position"
          :aria-describedby="
            errors.position ? 'profile-position-error' : undefined
          "
          fluid
          data-field="position"
          @update:model-value="pickPosition"
        />
        <p
          v-if="errors.position"
          id="profile-position-error"
          :class="ERROR"
          data-error="position"
        >
          {{ errors.position }}
        </p>
      </div>

      <div class="flex flex-col !gap-1.5">
        <label for="profile-city" :class="LABEL">City</label>
        <Select
          :model-value="city"
          input-id="profile-city"
          :options="cities ?? []"
          :loading="citiesLoading"
          :disabled="citiesFailed"
          :placeholder="citiesFailed ? 'Couldn\'t load cities' : 'Pick a city'"
          filter
          show-clear
          :invalid="!!errors.city"
          :aria-describedby="errors.city ? 'profile-city-error' : undefined"
          fluid
          data-field="city"
          @update:model-value="pickCity"
        />
        <p
          v-if="errors.city"
          id="profile-city-error"
          :class="ERROR"
          data-error="city"
        >
          {{ errors.city }}
        </p>
      </div>

      <div class="flex flex-col !gap-1.5">
        <div class="flex items-baseline justify-between">
          <label for="profile-bio" :class="LABEL">Bio</label>
          <span
            class="text-[11px] tabular-nums"
            :class="
              bioLength > BIO_MAX_LENGTH ? 'text-red-500' : 'text-surface-400'
            "
            aria-hidden="true"
          >
            {{ bioLength }}/{{ BIO_MAX_LENGTH }}
          </span>
        </div>
        <Textarea
          id="profile-bio"
          v-model="bio"
          rows="3"
          auto-resize
          placeholder="A line or two about how you play"
          :invalid="!!errors.bio"
          :aria-describedby="errors.bio ? 'profile-bio-error' : undefined"
          fluid
          data-field="bio"
          @blur="saveBio"
        />
        <p
          v-if="errors.bio"
          id="profile-bio-error"
          :class="ERROR"
          data-error="bio"
        >
          {{ errors.bio }}
        </p>
      </div>
    </section>

    <!-- Space reserved so the status appearing doesn't move anything. -->
    <p
      class="h-4 text-center text-xs text-surface-400"
      aria-live="polite"
      data-save-status
    >
      {{ statusText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import { InputText, Select, Textarea } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import type { PlayerPosition, UpdateProfileRequest } from "@football/shared";
import { errorMessage } from "@/axios";
import { useAuthStore } from "@/stores/auth";
import PlayerAvatar from "@/components/PlayerAvatar.vue";
import { updateProfile } from "./api";
import { useGetCities } from "./composables/queries";
import {
  BIO_MAX_LENGTH,
  POSITIONS,
  bioError,
  charLength,
  memberSince,
  nameError,
} from "./composables/profileRules";

type Field = "name" | "position" | "city" | "bio";

const LABEL =
  "text-xs font-semibold uppercase tracking-widest text-surface-400";
const ERROR = "text-xs text-red-500";

// How long typing has to pause before a text field saves (PROF-28).
const SAVE_DELAY = 700;

const authStore = useAuthStore();
const queryClient = useQueryClient();
const account = computed(() => authStore.account);

// Edit buffers, deliberately: a refused value stays in the field (PROF-28)
// while the account keeps what the server actually holds.
const name = ref(account.value?.name ?? "");
const bio = ref(account.value?.bio ?? "");
const position = ref<PlayerPosition | null>(account.value?.position ?? null);
const city = ref<string | null>(account.value?.city ?? null);

const errors = reactive<Record<Field, string | null>>({
  name: null,
  position: null,
  city: null,
  bio: null,
});

const bioLength = computed(() => charLength(bio.value.trim()));

const {
  data: cities,
  isLoading: citiesLoading,
  isError: citiesFailed,
} = useGetCities();

const pending = ref(0);
const savedOnce = ref(false);
const statusText = computed(() => {
  if (pending.value) return "Saving…";
  if (Object.values(errors).some(Boolean)) return "";
  return savedOnce.value ? "Saved" : "";
});

// PATCH /user always carries a name, so every save sends the saved one unless
// it's the name being changed. Saves run one at a time: two in flight could
// land out of order and put back the older name.
let queue = Promise.resolve();

const save = (field: Field, value: string | null) => {
  pending.value++;
  queue = queue.then(async () => {
    try {
      const current = authStore.account;
      if (!current) return;
      // Typed back to what's saved, or a repeat of a save that already landed.
      if ((current[field] ?? null) === value) {
        errors[field] = null;
        return;
      }
      const update: UpdateProfileRequest = { name: current.name };
      Object.assign(update, { [field]: value });
      const next = await updateProfile(update);
      authStore.setAccount(next);
      errors[field] = null;
      savedOnce.value = true;
      queryClient.invalidateQueries({ queryKey: ["players", next.id] });
    } catch (error) {
      errors[field] = errorMessage(error, "Couldn't save that. Try again.");
    } finally {
      pending.value--;
    }
  });
};

// The limits are checked here as well as on the server (PROF-23), without
// cutting the input short: the field keeps what was typed and says why.
const saveName = () => {
  errors.name = nameError(name.value);
  if (!errors.name) save("name", name.value.trim());
};

const saveBio = () => {
  errors.bio = bioError(bio.value);
  if (!errors.bio) save("bio", bio.value.trim() || null);
};

const pickPosition = (value: PlayerPosition | null) => {
  position.value = value ?? null;
  save("position", position.value);
};

const pickCity = (value: string | null) => {
  city.value = value ?? null;
  save("city", city.value);
};

watchDebounced(name, saveName, { debounce: SAVE_DELAY });
watchDebounced(bio, saveBio, { debounce: SAVE_DELAY });

// Leaving the page mid-pause still saves what was typed.
onBeforeUnmount(() => {
  saveName();
  saveBio();
});
</script>
