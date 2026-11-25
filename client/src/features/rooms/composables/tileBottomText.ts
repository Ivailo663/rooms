export type TileAction = {
  state: "join" | "leave" | "awaiting" | "declined" | "cantJoin" | "cantLeave";
  label?: string;
  icon?: string;
};

const STATUS_ICON: Partial<Record<TileAction["state"], string>> = {
  awaiting: "fa-user-clock",
  declined: "fa-circle-xmark",
};

// The last line of a tile: what holding it does, or why nothing does.
export const tileBottomText = (
  action: TileAction,
  { pending, releasedEarly }: { pending: boolean; releasedEarly: boolean }
): { text: string; icon?: string } => {
  const icon = action.icon ?? STATUS_ICON[action.state];

  if (pending) {
    return { text: action.state === "leave" ? "Leaving…" : "Joining…", icon };
  }
  switch (action.state) {
    case "join":
      return { text: releasedEarly ? "Keep holding…" : "Hold to join", icon };
    case "leave":
      return { text: releasedEarly ? "Keep holding…" : "Hold to leave", icon };
    case "awaiting":
      return { text: "Awaiting approval", icon };
    case "declined":
      return { text: "Not accepted", icon };
    default:
      return { text: action.label ?? "", icon };
  }
};
