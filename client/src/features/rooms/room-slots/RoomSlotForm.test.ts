import { describe, it, expect } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { useForm } from "@tanstack/vue-form";
import { InputNumber } from "primevue";
import PrimeVue from "primevue/config";
import RoomSlotForm from "./RoomSlotForm.vue";

const createForm = () =>
  useForm({
    defaultValues: {
      label: "18:00",
      price: null as string | null,
      message: null as string | null,
      min_players: 8 as number | null,
      max_players: 10 as number | null,
      features: [] as string[],
    },
  });

const mountForm = () => {
  let form!: ReturnType<typeof createForm>;
  const Host = defineComponent(() => {
    form = createForm();
    return () => h(RoomSlotForm, { form, enabled: false });
  });
  const wrapper = mount(Host, { global: { plugins: [PrimeVue] } });
  const [min, max] = wrapper.findAllComponents(InputNumber);
  return { wrapper, form, min: min!, max: max! };
};

// What InputNumber emits on a keystroke or a +/- press, before any blur.
const type = async (input: VueWrapper, value: number | null) => {
  input.vm.$emit("input", { value });
  await nextTick();
};

const errorText = (wrapper: VueWrapper) =>
  wrapper.findAll("small").map((s) => s.text());

describe("RoomSlotForm player limits", () => {
  it("SLOT-17: the inputs never rewrite what the host typed", () => {
    const { min, max } = mountForm();
    // null is InputNumber's "no bound", so it never clamps on blur.
    expect(min.props("min")).toBeNull();
    expect(min.props("max")).toBeNull();
    expect(max.props("min")).toBeNull();
    expect(max.props("max")).toBeNull();
  });

  it("SLOT-17: a min above max shows an error and blocks submitting", async () => {
    const { wrapper, form, min } = mountForm();
    await type(min, 12);
    expect(form.state.values.min_players).toBe(12);
    expect(errorText(wrapper)).toEqual(["Can't be more than max players"]);
    expect(form.state.canSubmit).toBe(false);
  });

  it("SLOT-17: lowering max below min flags the min", async () => {
    const { wrapper, max } = mountForm();
    await type(max, 6);
    expect(errorText(wrapper)).toEqual(["Can't be more than max players"]);
  });

  it("SLOT-17: max is required and at least 1, min is at least 1", async () => {
    const { wrapper, min, max } = mountForm();
    await type(max, null);
    expect(errorText(wrapper)).toEqual(["Required"]);
    await type(max, 0);
    await type(min, null);
    expect(errorText(wrapper)).toEqual(["At least 1"]);
    await type(max, 10);
    await type(min, 0);
    expect(errorText(wrapper)).toEqual(["At least 1"]);
  });

  it("SLOT-17: fixing the values clears the error", async () => {
    const { wrapper, form, min } = mountForm();
    await type(min, 12);
    await type(min, 9);
    expect(errorText(wrapper)).toEqual([]);
    expect(form.state.canSubmit).toBe(true);
  });

  it("SLOT-19: a keystroke marks the form changed without leaving the field", async () => {
    const { form, max } = mountForm();
    expect(form.state.isDirty).toBe(false);
    await type(max, 11);
    expect(form.state.isDirty).toBe(true);
  });
});
