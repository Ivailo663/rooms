import { defineStore } from "pinia";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { isAxiosError } from "axios";
import { api } from "@/axios";
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import type { Account, CreateUserRequest } from "@football/shared";
import { queryClient } from "@/queryClient";
import { needsTermsTick } from "@/features/profile/composables/profileRules";

export const useAuthStore = defineStore("auth", () => {
  const userAuthState = ref<User | null>(null);
  const account = ref<Account | null>(null);
  // Whether POST /user has answered for the current Firebase user. Until it
  // has, a null account means "not asked yet", not "no account".
  const accountKnown = ref(false);
  const initializedState = ref(false);

  // Set by the sign-up form just before it creates the Firebase user: the
  // checkbox was part of that form (AUTH-24), so the POST /user that the
  // auth listener sends next carries the tick instead of asking again.
  const acceptTermsOnSignIn = ref(false);

  const router = useRouter();

  // Settles once the first auth state (and, when signed in, the account) is
  // known. Route guards wait on it: the router starts its first navigation
  // before main.ts has finished awaiting init().
  const { promise: ready, resolve: markReady } = Promise.withResolvers<void>();

  // AUTH-23: a brand-new user without the tick gets 400 and no account. That
  // is the "no account yet" answer, not a failure: the terms screen follows.
  const fetchUser = async (body: CreateUserRequest = {}) => {
    try {
      const { data } = await api.post<Account>("/user", body);
      account.value = data;
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 400) throw error;
      account.value = null;
    }
  };

  // AUTH-21/24. Throws on refusal so the terms screen can show why.
  const acceptTerms = async () => {
    const { data } = await api.post<Account>("/user", {
      acceptTerms: true,
    } satisfies CreateUserRequest);
    account.value = data;
  };

  const setAccount = (next: Account) => {
    account.value = next;
  };

  const init = async () => {
    return new Promise<void>((resolve) => {
      const auth = getAuth();

      onAuthStateChanged(auth, async (userPayload) => {
        userAuthState.value = userPayload;
        initializedState.value = true;
        accountKnown.value = false;

        if (userPayload) {
          await userPayload.getIdToken();

          // Wipe any data cached under the previous session so a new login
          // on the same tab (e.g. after logout) can't briefly show the
          // prior user's queries before fresh ones load.
          queryClient.clear();
          const acceptTerms = acceptTermsOnSignIn.value;
          acceptTermsOnSignIn.value = false;
          await fetchUser(acceptTerms ? { acceptTerms } : {});
          accountKnown.value = true;

          if (router.currentRoute.value.name === "auth") {
            router.push({ name: "home" });
          }
        } else {
          account.value = null;
          router.push({ name: "auth" });
        }

        markReady();
        resolve();
      });
    });
  };

  const user = computed(() => {
    const result = {
      ...userAuthState.value,
      // Typed as always present, as it was before `account` existed; callers
      // that can run before the account loads check `id` themselves.
      ...(account.value ?? ({} as Account)),
    };

    return !Object.keys(result).length ? null : result;
  });

  // AUTH-24: signed in to Firebase, but no account or no tick yet.
  const needsTerms = computed(
    () =>
      !!userAuthState.value &&
      accountKnown.value &&
      needsTermsTick(account.value)
  );

  return {
    user,
    account,
    needsTerms,
    acceptTermsOnSignIn,
    init,
    fetchUser,
    acceptTerms,
    setAccount,
    ready,
    initialized: initializedState,
  };
});
