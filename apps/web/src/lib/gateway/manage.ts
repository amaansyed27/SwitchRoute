export class ManageError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ManageError";
  }
}

const RETRYABLE = new Set([502, 503, 504]);

export async function manageFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const attempts = method === "GET" ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/manage/${path.replace(/^\//, "")}`, {
        ...init,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        cache: "no-store",
      });
      if (!response.ok) {
        let message = "SwitchRoute request failed.";
        try {
          const body = await response.json();
          message = body?.error?.message ?? body?.message ?? message;
        } catch {}
        if (attempt + 1 < attempts && RETRYABLE.has(response.status)) continue;
        throw new ManageError(message, response.status);
      }
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof ManageError) throw error;
      if (attempt + 1 < attempts) continue;
      if (error instanceof DOMException && error.name === "AbortError") throw new ManageError("The gateway took too long to respond. Try again.", 504);
      throw new ManageError(error instanceof Error ? error.message : "The gateway could not be reached.", 503);
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new ManageError("SwitchRoute request failed.", 500);
}
