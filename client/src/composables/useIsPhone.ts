import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";

// Below Tailwind's `md` (768px) the app is laid out for a phone: the sidebar
// is a drawer (NAV-02, NAV-10) and dialogs open as bottom sheets. One media
// query, so the code and the `md:` classes always agree.
export const useIsPhone = () => useBreakpoints(breakpointsTailwind).smaller("md");
