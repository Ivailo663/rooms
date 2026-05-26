import { ref } from "vue";

export type RoomView = "hosted" | "others";

const view = ref<RoomView>("hosted");

export const useRoomView = () => view;
