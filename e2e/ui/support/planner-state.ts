import type { Group } from "./test-data";

export type PlannerStateInput = {
  groups?: Group[];
  defaultCurrency?: string;
  template?: string;
};

export type PlannerState = {
  groups: Group[];
  defaultCurrency: string;
  template?: string;
};

export const plannerState = (input: PlannerStateInput = {}): PlannerState => {
  const groups = input.groups ?? [];
  const state: PlannerState = {
    groups,
    defaultCurrency: input.defaultCurrency ?? groups[0]?.currency ?? "UAH",
  };

  if (input.template !== undefined) {
    state.template = input.template;
  }

  return state;
};
