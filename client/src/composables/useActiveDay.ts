import { ref } from "vue";
import { getTodayValue } from "@/constants";

const activeDay = ref(getTodayValue());

export const useActiveDay = () => activeDay;
