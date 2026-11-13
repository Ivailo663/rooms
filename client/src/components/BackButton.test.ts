import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import BackButton from "./BackButton.vue";

const Blank = { template: "<div />" };

const mountButton = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: Blank },
      { path: "/profiles/:id", name: "player-profile", component: Blank },
    ],
  });
  await router.push("/profiles/4");
  const wrapper = mount(BackButton, { global: { plugins: [router] } });
  return { wrapper, router };
};

afterEach(() => {
  window.history.replaceState(null, "");
});

describe("BackButton", () => {
  it("NAV-12: a labelled button with a thumb-sized (44px) target", async () => {
    const { wrapper } = await mountButton();

    const button = wrapper.find("button");
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("aria-label")).toBe("Back");
    expect(button.classes()).toEqual(
      expect.arrayContaining(["h-11", "w-11", "rounded-full"])
    );
  });

  it("NAV-12: goes back to the previous page when there is one", async () => {
    window.history.replaceState({ back: "/" }, "");
    const { wrapper, router } = await mountButton();
    const back = vi.spyOn(router, "back").mockImplementation(() => {});

    await wrapper.find("button").trigger("click");

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("NAV-12: opened directly, it goes home", async () => {
    const { wrapper, router } = await mountButton();
    const back = vi.spyOn(router, "back");

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(back).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("home");
  });
});
