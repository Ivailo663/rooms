<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 !px-4"
  >
    <form class="w-full max-w-[380px]" @submit.prevent="handleContinue">
      <div class="!mb-6 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-surface-900">
          One quick thing
        </h1>
        <p class="!mt-1 text-sm text-surface-400">
          Tick the box and you're in.
        </p>
      </div>

      <Card class="!shadow-xl !shadow-surface-300/30">
        <template #content>
          <div class="flex flex-col !gap-5 !px-1 !py-1">
            <TermsCheckbox v-model="ticked" input-id="terms-gate-tick" />

            <p
              v-if="error"
              class="text-xs text-red-500"
              role="alert"
              data-terms-error
            >
              {{ error }}
            </p>

            <Button
              type="submit"
              label="Continue"
              :disabled="!ticked"
              :loading="isSaving"
              class="w-full"
            />

            <div class="text-center">
              <Button
                link
                size="small"
                label="Sign out"
                @click="signOut(getAuth())"
              />
            </div>
          </div>
        </template>
      </Card>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button, Card } from "primevue";
import { getAuth, signOut } from "firebase/auth";
import { errorMessage } from "@/axios";
import { useAuthStore } from "@/stores/auth";
import TermsCheckbox from "./TermsCheckbox.vue";

// AUTH-21/24: everything else waits behind this until the box is ticked.
const authStore = useAuthStore();

const ticked = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);

const handleContinue = async () => {
  if (!ticked.value) return;
  isSaving.value = true;
  error.value = null;
  try {
    await authStore.acceptTerms();
  } catch (err) {
    error.value = errorMessage(err, "Something went wrong. Try again.");
  } finally {
    isSaving.value = false;
  }
};
</script>
