import { test } from "../fixtures/test";

export const step = async <T>(title: string, run: () => Promise<T>) => {
  return test.step(title, run);
};
