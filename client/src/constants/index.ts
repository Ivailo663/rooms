export enum RoomView {
  Host = "host",
  Play = "play",
}

export const DAYS = [
  { label: "Mo", value: "mo" },
  { label: "Tu", value: "tu" },
  { label: "We", value: "we" },
  { label: "Th", value: "th" },
  { label: "Fr", value: "fr" },
  { label: "Sa", value: "sa" },
  { label: "Su", value: "su" },
];

export const getTodayValue = () => {
  const jsDay = new Date().getDay();
  return DAYS[jsDay === 0 ? 6 : jsDay - 1]!.value;
};

export const TIME_SLOTS = [
  { id: "17:00", value: 17, label: "5 PM" },
  { id: "18:00", value: 18, label: "6 PM" },
  { id: "19:00", value: 19, label: "7 PM" },
  { id: "20:00", value: 20, label: "8 PM" },
  { id: "21:00", value: 21, label: "9 PM" },
  { id: "22:00", value: 22, label: "10 PM" },
];
