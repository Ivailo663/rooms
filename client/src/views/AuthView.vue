<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 !px-4"
  >
    <div class="w-full max-w-[380px]">
      <!-- Brand -->
      <div class="!mb-8 text-center">
        <div
          class="!mx-auto !mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-200/60"
        >
          <i class="fa-solid fa-grip text-white" style="font-size: 1.1rem" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-surface-900">
          Rooms
        </h1>
        <p class="!mt-1 text-sm text-surface-400">
          {{
            isLogin
              ? "Welcome back. Sign in to continue."
              : "Create your account to get started."
          }}
        </p>
      </div>

      <!-- Card -->
      <Card class="!shadow-xl !shadow-surface-300/30">
        <template #content>
          <div class="flex flex-col !gap-5 !px-1 !py-1">
            <div class="flex flex-col !gap-1.5">
              <label
                class="flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
              >
                <i class="fa-solid fa-envelope" style="font-size: 0.65rem" />
                Email
              </label>
              <InputText
                v-model="email"
                placeholder="you@example.com"
                class="w-full"
              />
            </div>

            <div class="flex flex-col !gap-1.5">
              <label
                class="flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
              >
                <i class="fa-solid fa-lock" style="font-size: 0.65rem" />
                Password
              </label>
              <Password
                v-model="password"
                placeholder="••••••••"
                :feedback="false"
                toggle-mask
                fluid
              />
            </div>

            <Button
              :label="isLogin ? 'Sign in' : 'Create account'"
              :icon="
                isLogin ? 'fa-solid fa-right-to-bracket' : 'fa-solid fa-user'
              "
              :loading="isLoading"
              class="w-full"
              @click="handleSubmit"
            />

            <div class="text-center">
              <Button
                link
                size="small"
                :label="
                  isLogin
                    ? 'New here? Create an account →'
                    : '← Already have an account?'
                "
                @click="isLogin = !isLogin"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button, Card, InputText, Password } from "primevue";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const email = ref("");
const password = ref("");
const isLogin = ref(true);
const isLoading = ref(false);

const auth = getAuth();
const handleSubmit = async () => {
  try {
    isLoading.value = true;

    if (isLogin.value) {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};
</script>
