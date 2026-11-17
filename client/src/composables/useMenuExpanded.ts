import { ref } from "vue";
import { RoomView } from "@/constants";

// The drawer's open state lives outside the component tree so any surface can
// host its own trigger — fitted to that layout — without prop drilling through
// RouterView. Same module-ref pattern as useCreateRoom.
const expanded = ref(true);

export const useMenuExpanded = () => expanded;

// NAV-01/02: how the menu starts, and how it's reset when the view changes.
// On desktop it's open in Host and collapsed in Play; on a phone the drawer
// covers the page, so it's always closed until the user opens it.
export const menuStartsOpen = (view: RoomView, isPhone: boolean) =>
  !isPhone && view !== RoomView.Play;
