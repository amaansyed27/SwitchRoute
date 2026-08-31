export class ManageError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function manageFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/manage/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "SwitchRoute request failed.";
    try {
      const body = await response.json();
      message = body?.error?.message ?? body?.message ?? message;
    } catch {}
    throw new ManageError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
