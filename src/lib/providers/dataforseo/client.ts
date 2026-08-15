import "server-only";

/**
 * Minimal DataForSEO v3 REST client.
 *
 * Deliberately hand-rolled rather than pulling in the vendor SDK: we call five
 * endpoints, all of them "live" (synchronous), and the SDK's generated surface
 * is large enough that it would obscure exactly which fields we read. Keeping
 * the wire shapes visible here is the point — every mapping decision in this
 * integration has to be auditable, because the whole product rests on knowing
 * which numbers are real.
 *
 * Auth is HTTP Basic with the API login and password from the DataForSEO
 * dashboard. Every response is wrapped in the same envelope:
 *
 *   { version, status_code, status_message, cost, tasks_count, tasks_error,
 *     tasks: [ { id, status_code, status_message, cost, result: [...] } ] }
 *
 * A 200 HTTP status does not mean success — `status_code` 20000 does, and each
 * task carries its own status code on top of that.
 */

const BASE_URL = "https://api.dataforseo.com";

/** DataForSEO's "everything went fine" code, at both envelope and task level. */
const OK = 20000;

export const DATAFORSEO_ENV = ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"] as const;

export interface DataForSeoCredentials {
  login: string;
  password: string;
}

export function readCredentials(): DataForSeoCredentials | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  return { login, password };
}

/**
 * A failure that came from DataForSEO itself rather than from the network. The
 * message is safe to show the operator: it is the vendor's own explanation of
 * why the call did not work (bad credentials, empty payload, out of funds).
 */
export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

interface Envelope<T> {
  status_code?: number;
  status_message?: string;
  cost?: number;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    result?: T[] | null;
  }>;
}

export interface DataForSeoResponse<T> {
  results: T[];
  /** Credits the call consumed, as reported by the API. */
  cost: number | null;
}

/**
 * Issues one call and flattens the envelope down to the task results.
 *
 * Task-level errors are raised rather than returned empty: a caller that cannot
 * tell "no data" from "the call failed" would end up writing a null into the
 * database as though the provider had genuinely reported nothing.
 */
export async function callDataForSeo<T>(
  path: string,
  options: {
    credentials: DataForSeoCredentials;
    /** Omitted for GET endpoints (the location lists). */
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<DataForSeoResponse<T>> {
  const { credentials, body, signal } = options;
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString(
    "base64",
  );

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new DataForSeoError(
      `Could not reach DataForSEO: ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  if (response.status === 401) {
    throw new DataForSeoError(
      "DataForSEO rejected the credentials. Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.",
      401,
    );
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new DataForSeoError(
      `DataForSEO returned a non-JSON response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (payload.status_code !== OK) {
    throw new DataForSeoError(
      payload.status_message ?? `DataForSEO returned status ${payload.status_code}.`,
      payload.status_code ?? response.status,
    );
  }

  const results: T[] = [];
  for (const task of payload.tasks ?? []) {
    if (task.status_code !== OK) {
      throw new DataForSeoError(
        task.status_message ?? `DataForSEO task failed with ${task.status_code}.`,
        task.status_code ?? null,
      );
    }
    for (const item of task.result ?? []) {
      if (item !== null && item !== undefined) results.push(item);
    }
  }

  return { results, cost: typeof payload.cost === "number" ? payload.cost : null };
}
