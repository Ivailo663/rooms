import { ref } from "vue";
import { useRoleStore, Cap } from "@/stores/role";
import { RoomView } from "@/constants";

const view = ref<RoomView>(RoomView.Play);
let initialized = false;

export const useRoomView = () => {
  if (!initialized) {
    const roleStore = useRoleStore();
    view.value = roleStore.can(Cap.rooms.create) ? RoomView.Host : RoomView.Play;
    initialized = true;
  }

  return view;
};
