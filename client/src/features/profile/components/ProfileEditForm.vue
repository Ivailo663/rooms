<template>
  <!-- Picture and member since aren't here: they're read-only (PROF-20,
       PROF-25). -->
  <div v-if="account" class="flex flex-col !gap-3">
    <p
      v-if="serverError"
      class="rounded-lg bg-red-50 !px-3 !py-2 text-xs text-red-600"
      role="alert"
      data-server-error
    >
      {{ serverError }}
    </p>

    <section class="flex flex-col !gap-5" aria-label="Your details">
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
          v-model="position"
          input-id="profile-position"
          :options="POSITIONS"
          option-label="label"
          option-value="value"
          placeholder="Pick a position"
          show-clear
          fluid
          data-field="position"
        />
      </div>

      <div class="flex flex-col !gap-1.5">
        <label for="profile-city" :class="LABEL">City</label>
        <Select
          v-model="city"
          input-id="profile-city"
          :options="cities ?? []"
          :loading="citiesLoading"
          :disabled="citiesFailed"
          :placeholder="citiesFailed ? 'Couldn\'t load cities' : 'Pick a city'"
          filter
          show-clear
          fluid
          data-field="city"
        />
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { InputText, Select, Textarea } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import type { PlayerPosition, UpdateProfileRequest } from "@football/shared";
import { errorMessage } from "@/axios";
import { useAuthStore } from "@/stores/auth";
import { updateProfile } from "../api";
import { useGetCities } from "../composables/queries";
import {
  BIO_MAX_LENGTH,
  POSITIONS,
  bioError,
  charLength,
  nameError,
} from "../composables/profileRules";

const LABEL =
  "text-xs font-semibold uppercase tracking-widest text-surface-400";
const ERROR = "text-xs text-red-500";

const authStore = useAuthStore();
const queryClient = useQueryClient();
const account = computed(() => authStore.account);

// Edit buffers. The dialog mounts this form on open, so they start from the
// saved account each time, and closing without the tick drops them (PROF-28).
const name = ref(account.value?.name ?? "");
const bio = ref(account.value?.bio ?? "");
const position = ref<PlayerPosition | null>(account.value?.position ?? null);
const city = ref<string | null>(account.value?.city ?? null);

// The limits are checked as you type, without cutting the input short
// (PROF-23, PROF-76).
const errors = computed(() => ({
  name: nameError(name.value),
  bio: bioError(bio.value),
}));

const bioLength = computed(() => charLength(bio.value.trim()));

const {
  data: cities,
  isLoading: citiesLoading,
  isError: citiesFailed,
} = useGetCities();

// Only what differs from the saved account goes in the request.
const changes = computed<UpdateProfileRequest>(() => {
  const saved = account.value;
  if (!saved) return {};
  const next = {
    name: name.value.trim(),
    bio: bio.value.trim() || null,
    position: position.value ?? null,
    city: city.value ?? null,
  };
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => (saved[key as keyof typeof next] ?? null) !== value
    )
  );
});

const dirty = computed(() => Object.keys(changes.value).length > 0);
const valid = computed(() => !errors.value.name && !errors.value.bio);

const serverError = ref<string | null>(null);
const saving = ref(false);

/** Saves the changes; resolves true when the dialog may close. */
const save = async (): Promise<boolean> => {
  if (!dirty.value) return true;
  if (!valid.value || saving.value) return false;

  saving.value = true;
  try {
    const next = await updateProfile(changes.value);
    authStore.setAccount(next);
    // The profile page behind the dialog reads this cache.
    queryClient.invalidateQueries({ queryKey: ["players", next.id] });
    serverError.value = null;
    return true;
  } catch (error) {
    serverError.value = errorMessage(error, "Couldn't save that. Try again.");
    return false;
  } finally {
    saving.value = false;
  }
};

defineExpose({ dirty, valid, saving, save });
</script>
