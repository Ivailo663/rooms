/// <reference types="vite/client" />

import type { Cap } from "./src/stores/role";
import type RoleGate from "./src/components/RoleGate.vue";

declare module "vue" {
  interface ComponentCustomProperties {
    $cap: typeof Cap;
  }

  interface GlobalComponents {
    RoleGate: typeof RoleGate;
  }
}
