import type { BrowserContextOptions } from "@playwright/test";
import type { PlannerState } from "./planner-state";

type StorageState = Exclude<BrowserContextOptions["storageState"], undefined>;

const STORAGE_KEYS = {
  data: "groupLessonPlannerData",
  settings: "groupLessonPlannerSettings",
  template: "paymentTemplate",
};

export const buildStorageState = (
  baseURL: string,
  { groups, defaultCurrency, template }: PlannerState,
): StorageState => {
  const localStorage = [
    {
      name: STORAGE_KEYS.data,
      value: JSON.stringify(groups),
    },
    {
      name: STORAGE_KEYS.settings,
      value: JSON.stringify({ defaultCurrency }),
    },
  ];

  if (template !== undefined) {
    localStorage.push({
      name: STORAGE_KEYS.template,
      value: template,
    });
  }

  return {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage,
      },
    ],
  };
};
