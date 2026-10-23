import { ref } from "vue";

// The drawer's open state lives outside the component tree so any surface can
// host its own trigger — fitted to that layout — without prop drilling through
// RouterView. Same module-ref pattern as useCreateRoom.
const expanded = ref(true);

export const useMenuExpanded = () => expanded;
