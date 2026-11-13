<template>
  <!-- Sidebar -->
  <div
    class="shrink-0 transition-all duration-300 ease-in-out"
    :class="sidebarContainerClass"
  >
    <aside
      id="app-sidebar"
      class="flex flex-col !gap-5 border-surface-200 bg-white transition-all duration-300 overflow-hidden"
      :class="sidebarClass"
    >
      <!-- Header -->
      <div
        class="flex items-center !px-1"
        :class="collapsed ? 'justify-center' : 'justify-between'"
      >
        <div class="flex items-center !gap-2">
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500"
          >
            <i class="fa-solid fa-grip text-white" style="font-size: 0.7rem" />
          </div>
          <span
            v-if="!collapsed"
            class="text-sm font-bold tracking-tight text-surface-900"
          >
            Rooms
          </span>
        </div>
        <Button
          v-if="!collapsed"
          ref="closeButton"
          :icon="isMobile ? 'fa-solid fa-xmark' : 'fa-solid fa-chevron-left'"
          :aria-label="isMobile ? 'Close menu' : 'Collapse sidebar'"
          severity="secondary"
          text
          size="small"
          @click="expanded = false"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col !gap-1">
        <router-link
          v-for="item in items"
          :key="item.route.name"
          :to="item.route"
          class="flex items-center rounded-lg text-sm font-medium text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
          :class="collapsed ? 'justify-center !p-2.5' : '!gap-3 !px-3 !py-2.5'"
          exact-active-class="!bg-primary-50 !text-primary-600"
          @click="isMobile && (expanded = false)"
        >
          <i
            :class="['w-4 text-center', item.icon]"
            style="font-size: 0.8rem"
          />
          <span v-if="!collapsed">{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="flex-1" />

      <!-- Primary actions -->
      <RoleGate v-if="isHomeRoute" :capability="$cap.rooms.create">
        <div
          class="flex flex-col rounded-xl bg-surface-50 w-full"
          :class="collapsed ? '!gap-1 !p-1.5 items-center' : '!gap-2 !p-2'"
        >
          <Button
            v-if="showCreateButton"
            icon="fa-solid fa-plus"
            :label="collapsed ? undefined : 'Create room'"
            :size="collapsed ? 'small' : undefined"
            :class="collapsed ? '' : 'w-full'"
            @click="createRoomVisible = true"
          />
          <SelectButton
            v-if="!collapsed"
            :model-value="roomView"
            :options="viewOptions"
            :allow-empty="false"
            option-label="label"
            option-value="value"
            fluid
            @update:model-value="(val) => (roomView = val)"
          />
          <Button
            v-else
            v-tooltip.right="
              roomView === RoomView.Host ? 'Switch to Play' : 'Switch to Host'
            "
            :icon="
              roomView === RoomView.Host
                ? 'fa-solid fa-eye'
                : 'fa-solid fa-gamepad'
            "
            size="small"
            variant="outlined"
            class="w-full"
            @click="
              roomView =
                roomView === RoomView.Host ? RoomView.Play : RoomView.Host
            "
          />
        </div>
      </RoleGate>

      <!-- User -->
      <div
        class="flex flex-col border-t border-surface-100 !pt-4 w-full"
        :class="collapsed ? '!gap-1 items-center' : '!gap-2'"
      >
        <!-- PROF-26: your own avatar is the way to your profile. -->
        <router-link
          v-if="!collapsed"
          :to="ownProfile"
          aria-label="Your profile"
          class="flex items-center !gap-2 rounded-full border border-surface-200 bg-surface-50 !px-3 !py-1.5 transition-colors hover:border-primary-200 hover:bg-primary-50"
          exact-active-class="!border-primary-200 !bg-primary-50"
          @click="isMobile && (expanded = false)"
        >
          <PlayerAvatar
            :name="avatarName"
            :picture-url="authStore.account?.picture_url"
            class="h-5 w-5 text-[0.55rem]"
          />
          <span class="truncate text-xs font-medium text-surface-600">
            {{ authStore?.user?.email }}
          </span>
        </router-link>
        <router-link
          v-else
          :to="ownProfile"
          aria-label="Your profile"
          title="Your profile"
          class="flex justify-center rounded-full"
        >
          <PlayerAvatar
            :name="avatarName"
            :picture-url="authStore.account?.picture_url"
            class="h-7 w-7 text-[0.6rem]"
          />
        </router-link>
        <Button
          icon="fa-solid fa-right-from-bracket"
          :label="collapsed ? undefined : 'Sign out'"
          severity="secondary"
          text
          size="small"
          :class="collapsed ? '' : 'w-full'"
          @click="handleLogout"
        />
      </div>

      <!-- Collapse toggle (desktop only) -->
      <button
        v-if="!isMobile && !expanded"
        class="flex w-full items-center justify-center rounded-lg !py-1.5 text-surface-400 hover:bg-surface-50 hover:text-surface-600 cursor-pointer border-none outline-none bg-transparent transition-colors"
        @click="expanded = true"
      >
        <i class="fa-solid fa-chevron-right" style="font-size: 0.65rem" />
      </button>
    </aside>
  </div>

  <!-- Mobile drawer handle (NAV-10). A right-edge swipe is the real way in;
       this is the hairline that makes it discoverable, so it's a grab pill
       rather than a button — no card, border, shadow or icon to sit on top of
       the view. The touch target around it is invisible and much larger than
       the line. -->
  <button
    v-if="isMobile && !expanded"
    type="button"
    aria-label="Open menu"
    aria-controls="app-sidebar"
    :aria-expanded="expanded"
    class="group fixed right-0 top-1/2 z-40 flex h-16 w-6 -translate-y-1/2 cursor-pointer items-center justify-end border-none bg-transparent outline-none"
    @click="openMenu"
  >
    <span
      class="h-11 w-1 rounded-l-full bg-surface-400/60 transition-colors group-hover:bg-surface-400 group-focus-visible:bg-primary-400"
    />
  </button>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  useTemplateRef,
} from "vue";
import { Button, SelectButton } from "primevue";
import { useAuthStore } from "@/stores/auth";
import { useRoleStore } from "@/stores/role";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { useMenuExpanded } from "@/composables/useMenuExpanded";
import { useSwipe } from "@/composables/useSwipe";
import {
  backSwipeCanStart,
  drawerSwipeCanStart,
  hasInAppHistory,
  isStandalone,
} from "@/composables/edgeGestures";
import { RoomView } from "@/constants";
import { signOut, getAuth } from "firebase/auth";
import RoleGate from "./RoleGate.vue";
import PlayerAvatar from "./PlayerAvatar.vue";

const expanded = useMenuExpanded();

const authStore = useAuthStore();
const roleStore = useRoleStore();
const auth = getAuth();
const router = useRouter();

const roomView = useRoomView();
const createRoomVisible = useCreateRoom();
const showCreateButton = computed(() => roomView.value === RoomView.Host);

const MOBILE_BREAKPOINT = 768;
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
};

const collapsed = computed(() => !isMobile.value && !expanded.value);

// Opening the drawer unmounts the handle that was just pressed, which would
// drop focus back to <body>. Hand it to the drawer's close button instead.
const closeButton = useTemplateRef<{ $el: HTMLButtonElement }>("closeButton");

const openMenu = async () => {
  expanded.value = true;
  await nextTick();
  closeButton.value?.$el.focus();
};

// Swipe is the primary way in and out of the drawer on mobile (NAV-10): a
// leftward drag from the right edge opens it, a rightward drag across it
// closes it. The left edge is "back" (NAV-11), and only in an installed app:
// a browser already does that itself. Both are wired here because they share
// the screen, and back mustn't fire under the open drawer.
useSwipe({
  enabled: isMobile,
  canStart: ({ x }) =>
    drawerSwipeCanStart(x, window.innerWidth, expanded.value),
  onSwipeLeft: () => !expanded.value && openMenu(),
  onSwipeRight: () => (expanded.value = false),
});

useSwipe({
  enabled: () => !(isMobile.value && expanded.value),
  canStart: ({ x }) =>
    backSwipeCanStart(x) && isStandalone() && hasInAppHistory(),
  onSwipeRight: () => router.back(),
});

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkMobile);
});

const sidebarContainerClass = computed(() => {
  if (isMobile.value) {
    return [
      "fixed inset-y-0 right-0 z-50 w-full",
      expanded.value ? "translate-x-0" : "translate-x-full invisible",
    ];
  }
  return expanded.value ? "w-72 !ml-4 !mr-2" : "w-16 !ml-4 !mr-2";
});

const sidebarClass = computed(() => {
  if (isMobile.value) {
    return "h-full w-full !p-3";
  }
  // Expanding swaps in the labelled layout at once while the card is still
  // 64px wide, so without a floor every row rewraps on every frame of the
  // width transition ("Create room" breaks onto two lines and shoves the rest
  // down). Holding each row at its final width (w-72 less p-3 and the border)
  // lets the card's overflow-hidden reveal it instead.
  return [
    "sticky top-4 rounded-xl h-[calc(100vh-2rem)] border",
    expanded.value
      ? "w-72 !p-3 opacity-100 *:min-w-[calc(18rem-1.5rem-2px)]"
      : "w-16 !p-2 opacity-100 items-center",
  ];
});

const viewOptions = [
  { label: "Host", value: RoomView.Host },
  { label: "Play", value: RoomView.Play },
];

// Each entry says who it's for; the sidebar shows only the visible ones.
// Settings is for someone who manages a venue (SET-10), since for anyone else
// the page would have nothing to show.
const items = computed(() =>
  [
    {
      label: "Home",
      icon: "fa-solid fa-house",
      route: { name: "home" },
      visible: true,
    },
    {
      label: "Settings",
      icon: "fa-solid fa-gear",
      route: { name: "settings" },
      visible: roleStore.managesVenue,
    },
  ].filter((item) => item.visible)
);

const avatarName = computed(() => authStore.account?.name ?? "");

// PROF-26. Before the account has loaded, /profile gets there once it has.
const ownProfile = computed(() => {
  const id = authStore.account?.id;
  return id ? { name: "player-profile", params: { id } } : { name: "profile" };
});

const isHomeRoute = computed(() => router.currentRoute.value.name === "home");

const handleLogout = async () => {
  await signOut(auth);
  router.push({ name: "auth" });
};
</script>
