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

export const fetchDocuments = async (
  _token: string,
): Promise<ServerDocuments> => {
  throw new Error("not implemented");
};

export const putDocument = async (
  _token: string,
  _key: DocumentKey,
  _body: unknown,
  _baseUpdatedAt: string | null,
): Promise<PutResult> => {
  throw new Error("not implemented");
};

/** Where a caller gets its token. `fresh` asks the auth server, not a cache. */
export type GetToken = (options?: {
  fresh?: boolean;
}) => Promise<string | null>;

export const withToken = async <T>(
  _getToken: GetToken,
  _call: (token: string) => Promise<T>,
): Promise<T> => {
  throw new Error("not implemented");
};
