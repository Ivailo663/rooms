<template>
  <div
    v-if="indicators.length"
    class="flex flex-wrap items-center !gap-2 rounded-xl border border-surface-200 bg-surface-50 !px-3 !py-2"
  >
    <RouterLink
      :to="{ name: 'settings' }"
      class="flex items-center !gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-surface-400 transition-colors hover:text-primary-500 cursor-pointer outline-none"
    >
      <i class="fa-solid fa-sliders" style="font-size: 0.55rem" />
      Settings
    </RouterLink>

    <span
      v-for="indicator in indicators"
      :key="indicator.key"
      class="inline-flex items-center !gap-1.5 rounded-full !px-2.5 !py-1 text-xs font-medium"
      :class="
        indicator.on
          ? indicator.onClass
          : 'border border-surface-200 bg-white text-surface-400'
      "
      :title="indicator.title"
    >
      <i
        :class="['fa-solid', indicator.icon]"
        style="font-size: 0.6rem"
      />
      {{ indicator.label }}
      <span class="opacity-60">{{ indicator.on ? "on" : "off" }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useGetTenantSettings } from "@/features/settings/composables/queries";

// A host owns a single tenant; mirrors the hardcoded id used elsewhere
// (RoomSlots) until a real tenant-id source is threaded through the client.
const { data: tenantData } = useGetTenantSettings(1);

// Crucial tenant-wide settings surfaced at a glance above the room grid. Each
// entry is fully self-describing so adding a new one later is a one-line push —
// this bar is meant to grow as more "important" settings need highlighting.
const indicators = computed(() => {
  const settings = tenantData.value?.settings;
  if (!settings) return [];

  return [
    {
      key: "autoRedistribute",
      label: "Auto-redistribute",
      icon: "fa-shuffle",
      on: !!settings.autoRedistribute,
      onClass: "border border-violet-200 bg-violet-50 text-violet-600",
      title: settings.autoRedistribute
        ? "Under-filled slots are automatically moved into sibling rooms before kickoff"
        : "Under-filled slots are not redistributed",
    },
  ];
});
</script>
