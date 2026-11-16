/**
 * The browser's half of the documents API — plan batch 6.2.
 *
 * The server half is `GET /api/documents` and `PUT /api/documents/:key` in
 * `api/[...all].ts` (batch 6.1). This module only speaks HTTP: it knows the
 * paths, the body shape and what each status means. When to save, how often to
 * retry and what to tell the teacher are `StoreProvider`'s business.
 *
 * **Every failure that is not a saved answer or a conflict throws `ApiError`**,
 * with the HTTP status, or `0` when the request never got an answer (offline,
 * DNS, a refused connection). The caller decides from the status alone whether
 * a retry can help.
 */

/** The three documents a user has, one per planner key (batch 6.1). */
export type DocumentKey = "data" | "settings" | "template";

export const DOCUMENT_KEYS: readonly DocumentKey[] = [
  "data",
  "settings",
  "template",
];

/** One document as the server holds it. */
export type RemoteDocument = {
  body: unknown;
  schemaVersion: number;
  /** The server's version stamp, sent back unchanged as `baseUpdatedAt`. */
  updatedAt: string;
};

/** `null` means the account has no row for that key yet. */
export type ServerDocuments = Record<DocumentKey, RemoteDocument | null>;

/**
 * What a save did.
 *
 * A conflict's `document` is `null` when the server holds no row for the key
 * although the client named a base — the row is gone. The 6.1 API answers that
 * case `409 {document: null}`.
 */
export type PutResult =
  | { kind: "saved"; updatedAt: string }
  | { kind: "conflict"; document: RemoteDocument | null };

/** The schema version every body is written with (6.1, test condition C5). */
export const SCHEMA_VERSION = 1;

/** A request that did not end in a usable answer. */
export class ApiError extends Error {
  /** The HTTP status, or 0 when no answer arrived at all. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Whether trying the same request again later can succeed. */
export const isRetryable = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 0 || error.status >= 500);

/** The error the server named, or a plain description of the status. */
const reasonOf = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Not JSON — a proxy's error page, say. The status is all there is.
  }
  return `the server answered ${String(response.status)}`;
};

/**
 * `fetch`, with "no answer" turned into `ApiError(0)`.
 *
 * `fetch` rejects only when no response arrived — offline, a dropped
 * connection. Every answer, a 500 included, resolves, and the callers below
 * read its status.
 */
const send = async (path: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(path, init);
  } catch (error) {
    throw new ApiError(
      0,
      error instanceof Error ? error.message : "the request did not complete",
    );
  }
};

const authorization = (token: string) => ({
  authorization: `Bearer ${token}`,
});

/** `GET /api/documents`: every document the account holds. */
export const fetchDocuments = async (
  token: string,
): Promise<ServerDocuments> => {
  const response = await send("/api/documents", {
    headers: authorization(token),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await reasonOf(response));
  }
  const { documents } = (await response.json()) as {
    documents: ServerDocuments;
  };
  return documents;
};

/**
 * `PUT /api/documents/:key`.
 *
 * `baseUpdatedAt` names the version this body replaces: the stamp the server
 * gave the last save or load of this key, or `null` when the account has no
 * row for it yet. A mismatch is a conflict, never an overwrite.
 */
export const putDocument = async (
  token: string,
  key: DocumentKey,
  body: unknown,
  baseUpdatedAt: string | null,
): Promise<PutResult> => {
  const response = await send(`/api/documents/${key}`, {
    method: "PUT",
    headers: {
      ...authorization(token),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      body,
      schemaVersion: SCHEMA_VERSION,
      baseUpdatedAt,
    }),
  });
  if (response.status === 409) {
    const { document } = (await response.json()) as {
      document: RemoteDocument | null;
    };
    return { kind: "conflict", document };
  }
  if (!response.ok) {
    throw new ApiError(response.status, await reasonOf(response));
  }
  const { updatedAt } = (await response.json()) as { updatedAt: string };
  return { kind: "saved", updatedAt };
};

/** Where a caller gets its token. `fresh` asks the auth server, not a cache. */
export type GetToken = (options?: {
  fresh?: boolean;
}) => Promise<string | null>;

const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

/**
 * Runs `call` with a token, and once more with a fresh one after a 401.
 *
 * Review focus item 1: Neon's JWT lives 15 minutes, and the auth client
 * caches it, so a long session meets an expired token. The rule is **one
 * fresh token and one retry**, then a 401 goes to the caller, which keeps the
 * edit and asks her to sign in. Never a loop: a token the server refuses
 * twice in a row will not be accepted a third time, and a loop would hammer
 * the API while the screen claimed to be saving.
 *
 * No token at all (the session ended) counts as a refusal, so the caller sees
 * one kind of failure for "not signed in" however it was found out.
 */
export const withToken = async <T>(
  getToken: GetToken,
  call: (token: string) => Promise<T>,
): Promise<T> => {
  const cached = await getToken();
  if (cached !== null) {
    try {
      return await call(cached);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    }
  }
  const fresh = await getToken({ fresh: true });
  if (fresh === null) throw new ApiError(401, "not signed in");
  return call(fresh);
};
