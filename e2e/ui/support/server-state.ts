import type { APIRequestContext } from "@playwright/test";
import type { PlannerState } from "./planner-state";

/**
 * The server's copy of a planner, for remote-mode specs — plan batch 6.2.
 *
 * Seeding goes **through the API**, with the spec's own minted token, rather
 * than into the database behind it. So a seeded row is one the API itself
 * accepted: a fixture the server would refuse cannot slip in and make a spec
 * pass for the wrong reason (testing.md §2.9).
 */

export type DocumentKey = "data" | "settings" | "template";

export type ServerDocument = {
  body: unknown;
  schemaVersion: number;
  updatedAt: string;
};

export type ServerDocuments = Record<DocumentKey, ServerDocument | null>;

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** Every document the account holds, as `GET /api/documents` answers. */
export const readServer = async (
  request: APIRequestContext,
  token: string,
): Promise<ServerDocuments> => {
  const response = await request.get("/api/documents", {
    headers: auth(token),
  });
  if (!response.ok()) {
    throw new Error(`GET /api/documents answered ${String(response.status())}`);
  }
  const { documents } = (await response.json()) as {
    documents: ServerDocuments;
  };
  return documents;
};

/**
 * One save, as another device would make it. Returns the new stamp, and
 * throws on anything but 200 so a seeding mistake fails where it happened.
 */
export const putServerDocument = async (
  request: APIRequestContext,
  token: string,
  key: DocumentKey,
  body: unknown,
  baseUpdatedAt: string | null,
): Promise<string> => {
  const response = await request.put(`/api/documents/${key}`, {
    headers: auth(token),
    data: { body, schemaVersion: 1, baseUpdatedAt },
  });
  if (response.status() !== 200) {
    throw new Error(
      `PUT /api/documents/${key} answered ${String(response.status())}: ${await response.text()}`,
    );
  }
  const { updatedAt } = (await response.json()) as { updatedAt: string };
  return updatedAt;
};

/** Writes a planner state into an empty account, one document per key. */
export const seedServer = async (
  request: APIRequestContext,
  token: string,
  state: PlannerState,
): Promise<void> => {
  await putServerDocument(request, token, "data", state.groups, null);
  await putServerDocument(
    request,
    token,
    "settings",
    { defaultCurrency: state.defaultCurrency },
    null,
  );
  if (state.template !== undefined) {
    await putServerDocument(request, token, "template", state.template, null);
  }
};
