export class SwitchRouteError extends Error {
  readonly status: number | undefined;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(message: string, options: { status?: number; code?: string; requestId?: string } = {}) {
    super(message);
    this.name = "SwitchRouteError";
    this.status = options.status;
    this.code = options.code ?? "api_error";
    this.requestId = options.requestId;
  }
}

export class AuthenticationError extends SwitchRouteError {}
export class RateLimitError extends SwitchRouteError {}
export class RequestTimeoutError extends SwitchRouteError {}

export async function errorFromResponse(response: Response): Promise<SwitchRouteError> {
  let message = "SwitchRoute request failed.";
  let code = "api_error";
  try {
    const body = (await response.json()) as { error?: { message?: unknown; code?: unknown; type?: unknown } };
    if (typeof body.error?.message === "string") message = body.error.message;
    const candidate = body.error?.code ?? body.error?.type;
    if (typeof candidate === "string") code = candidate;
  } catch {
    // Never surface an arbitrary raw upstream body.
  }
  const options = {
    status: response.status,
    code,
    requestId: response.headers.get("x-switchroute-request-id") ?? response.headers.get("x-request-id") ?? undefined,
  };
  if (response.status === 401 || response.status === 403) return new AuthenticationError(message, options);
  if (response.status === 429) return new RateLimitError(message, options);
  if (response.status === 408 || response.status === 504) return new RequestTimeoutError(message, options);
  return new SwitchRouteError(message, options);
}
