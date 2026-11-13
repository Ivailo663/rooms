<template>
  <div class="!mx-auto flex w-full max-w-3xl flex-col">
    <BackButton />

    <!-- PROF-29: an id that isn't a number never reaches the server. -->
    <div
      v-if="notFound"
      class="flex flex-col items-center !gap-3 !pt-16 text-center"
      data-not-found
    >
      <i class="fa-solid fa-user-slash text-3xl text-surface-200" />
      <h1 class="text-base font-semibold text-surface-700">Player not found</h1>
      <RouterLink
        :to="{ name: 'home' }"
        class="text-sm font-medium text-primary-600 hover:underline"
      >
        Back to games
      </RouterLink>
    </div>

    <div
      v-else-if="isError"
      class="flex flex-col items-center !gap-3 !pt-16 text-center"
      data-load-error
    >
      <p class="text-sm text-surface-500">Couldn't load this profile.</p>
      <Button
        label="Try again"
        size="small"
        severity="secondary"
        @click="refetch()"
      />
    </div>

    <template v-else>
      <!-- PROF-70. The skeleton has the header's shape, so nothing jumps
           when the profile lands. -->
      <header
        class="flex flex-col items-center !gap-3 !pt-4 text-center"
        :aria-busy="!profile"
      >
        <PlayerAvatar
          v-if="profile"
          :name="profile.name"
          :picture-url="profile.picture_url"
          class="h-[100px] w-[100px] text-3xl shadow-md ring-4 ring-white"
        />
        <span
          v-else
          class="h-[100px] w-[100px] animate-pulse rounded-full bg-surface-100"
        />

        <template v-if="profile">
          <h1 class="text-xl font-bold tracking-tight text-surface-900">
            {{ profile.name }}
          </h1>

          <!-- Never the email (PROF-32): the profile doesn't carry one. -->
          <ul
            role="list"
            class="flex flex-wrap justify-center !gap-x-1.5 !gap-y-1 text-xs text-surface-500"
            data-profile-meta
          >
            <li
              v-for="item in meta"
              :key="item.icon"
              class="flex items-center !gap-1 not-last:after:-ml-1 not-last:after:content-[',']"
            >
              <i
                :class="item.icon"
                class="text-surface-400"
                aria-hidden="true"
              />
              {{ item.text }}
            </li>
          </ul>

          <p
            v-if="profile.bio"
            class="max-w-sm whitespace-pre-line text-sm text-surface-600"
            data-profile-bio
          >
            {{ profile.bio }}
          </p>

          <!-- PROF-74: always both, whatever the grid holds. -->
          <div
            v-if="isOwn"
            class="!mt-1 grid w-full max-w-xs grid-cols-2 !gap-x-2 !gap-y-1"
            data-own-actions
          >
            <Button
              label="Edit"
              size="small"
              severity="secondary"
              aria-haspopup="dialog"
              data-edit-profile
              @click="editing = true"
            />
            <!-- Uploads arrive with PROF-60. A disabled button swallows
                 pointer events, so the hint sits on the wrapper, and is
                 spelled out for touch screens, where nothing hovers. -->
            <span title="Coming soon" class="flex">
              <Button
                label="Add"
                icon="fa-solid fa-plus"
                size="small"
                severity="secondary"
                disabled
                fluid
                aria-describedby="profile-add-soon"
                data-add-media
              />
            </span>
            <span
              id="profile-add-soon"
              class="col-start-2 text-[11px] text-surface-300"
            >
              Coming soon
            </span>
          </div>
        </template>
        <template v-else>
          <span class="h-6 w-40 animate-pulse rounded bg-surface-100" />
          <span class="h-4 w-56 animate-pulse rounded bg-surface-100" />
        </template>
      </header>

      <!-- PROF-72: full-bleed on phones, so it runs edge to edge under the
           header like a feed does. Media fills it in a later step; for now
           every grid is empty (PROF-75). -->
      <section
        v-if="profile"
        aria-label="Posts"
        class="!-mx-4 !mt-6 border-t border-surface-200 sm:!mx-0"
        data-profile-grid
      >
        <div class="flex flex-col items-center !gap-3 !px-4 !py-14 text-center">
          <i
            class="fa-solid fa-camera text-2xl text-surface-200"
            aria-hidden="true"
          />
          <p class="text-sm text-surface-400">
            {{ isOwn ? "Add your first photo or clip" : "No posts yet" }}
          </p>
        </div>
      </section>
    </template>

    <!-- PROF-28. A sheet from the bottom on phones, where the keyboard and
         the thumb are; a plain dialog from sm up. The form mounts on open, so
         it starts from the saved account each time, and any way of closing
         other than the tick drops what was typed. -->
    <Dialog
      v-if="isOwn"
      v-model:visible="editing"
      header="Edit profile"
      modal
      dismissable-mask
      :position="isPhone ? 'bottom' : 'center'"
      :draggable="false"
      :class="
        isPhone
          ? '!m-0 max-h-[90dvh] w-full !rounded-b-none'
          : 'w-full max-w-md'
      "
    >
      <!-- A quiet ✕ until something changes, then a bold "Save" in the
           primary colour that pops in, as iOS does: a bare ✓ reads as
           "already saved", not as a button. -->
      <template #closebutton="{ closeCallback }">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-75"
        >
          <Button
            v-if="editForm?.dirty"
            key="save"
            label="Save ?"
            text
            size="small"
            class="!px-3 !font-bold"
            :loading="editForm.saving"
            :disabled="!editForm.valid"
            data-save
            @click="saveAndClose"
          />
          <Button
            v-else
            key="close"
            icon="fa-solid fa-xmark"
            aria-label="Close"
            severity="secondary"
            text
            rounded
            size="small"
            data-close
            @click="closeCallback"
          />
        </Transition>
      </template>
      <ProfileEditForm ref="editForm" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { Button, Dialog } from "primevue";
import BackButton from "@/components/BackButton.vue";
import PlayerAvatar from "@/components/PlayerAvatar.vue";
import ProfileEditForm from "./components/ProfileEditForm.vue";
import { useAuthStore } from "@/stores/auth";
import { isNotFound, useGetPlayer } from "./composables/queries";
import { memberSince, positionLabel } from "./composables/profileRules";

const props = defineProps<{ id: number }>();

const authStore = useAuthStore();

const validId = computed(() => Number.isInteger(props.id) && props.id > 0);

// Shares the details card's cache (PROF-11), so a profile opened from the
// card paints at once. A 404 is final; retrying it only delays the message.
const {
  data: profile,
  isError,
  error,
  refetch,
} = useGetPlayer(() => props.id, {
  enabled: validId,
  retry: (failureCount: number, error: Error) =>
    !isNotFound(error) && failureCount < 3,
});

const notFound = computed(
  () => !validId.value || (isError.value && isNotFound(error.value))
);

const isOwn = computed(() => authStore.account?.id === props.id);

const editing = ref(false);
const editForm =
  useTemplateRef<InstanceType<typeof ProfileEditForm>>("editForm");

const saveAndClose = async () => {
  if (await editForm.value?.save()) editing.value = false;
};
const isPhone = useMediaQuery("(max-width: 639px)");

// PROF-70: the small line under the name. Unset fields drop out rather than
// reading "Not set", which on someone's page is just noise.
const meta = computed(() => {
  if (!profile.value) return [];
  const { position, city, created_at } = profile.value;
  return [
    { icon: "fa-solid fa-shirt", text: positionLabel(position) },
    { icon: "fa-solid fa-location-dot", text: city },
    {
      icon: "fa-solid fa-calendar",
      text: `Member since ${memberSince(created_at)}`,
    },
  ].filter((item): item is { icon: string; text: string } => !!item.text);
});
</script>
