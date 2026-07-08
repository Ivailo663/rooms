<template>
  <div class="flex flex-col rounded-xl border border-surface-100 bg-surface-50">
    <div
      class="flex items-center !gap-1.5 border-b border-surface-100 !px-4 !py-3"
    >
      <i
        class="fa-solid fa-comments text-surface-400"
        style="font-size: 0.6rem"
      />
      <span
        class="text-[10px] font-semibold uppercase tracking-widest text-surface-400"
      >
        Chat
      </span>
    </div>

    <div
      v-if="!messages.length"
      class="flex flex-col items-center justify-center !py-8 text-center"
    >
      <div
        class="!mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-100"
      >
        <i class="fa-solid fa-message text-surface-300" style="font-size: 0.7rem" />
      </div>
      <p class="text-xs text-surface-300">No messages yet</p>
    </div>

    <div v-else class="flex max-h-40 flex-col !gap-2 overflow-y-auto !p-3">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="flex items-start !gap-2"
      >
        <div
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
        >
          <i class="fa-solid fa-user" style="font-size: 0.45rem" />
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-semibold text-surface-500">You</span>
          <span class="text-xs text-surface-600">{{ msg }}</span>
        </div>
      </div>
    </div>

    <div
      class="flex items-center !gap-2 border-t border-surface-100 !px-3 !py-2.5"
    >
      <input
        v-model="message"
        type="text"
        placeholder="Type a message..."
        class="flex-1 rounded-lg border border-surface-200 bg-white !px-2.5 !py-1.5 text-xs text-surface-700 outline-none placeholder:text-surface-300 focus:border-primary-300"
        @keydown.enter="sendMessage"
      />
      <button
        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:cursor-default disabled:opacity-50"
        :disabled="!message.trim()"
        @click="sendMessage"
      >
        <i class="fa-solid fa-paper-plane" style="font-size: 0.6rem" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const message = ref("");
const messages = ref<string[]>([]);

const sendMessage = () => {
  if (!message.value.trim()) return;
  messages.value.push(message.value.trim());
  message.value = "";
};
</script>
