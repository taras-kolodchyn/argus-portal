export interface ApiFetchOptions {
  skipAuth?: boolean;
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let tokenGetter: TokenGetter | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const backendBaseUrl: string = (() => {
  const raw = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim().replace(/\/?$/, "/");
  }
  return `${DEFAULT_BACKEND_URL}/`;
})();

export function configureApiClient(options: {
  getAccessToken: TokenGetter;
  onUnauthorized: UnauthorizedHandler;
}): void {
  tokenGetter = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized;
}

function resolveRequest(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      return input;
    }
    return new URL(input.replace(/^\//, ""), backendBaseUrl).toString();
  }

  if (input instanceof URL) {
    return input;
  }

  if (input instanceof Request) {
    return input;
  }

  return input;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ApiFetchOptions = {},
): Promise<Response> {
  const requestInit: RequestInit = { ...init };
  const headers = new Headers(init.headers ?? {});

  if (!options.skipAuth && tokenGetter) {
    const token = tokenGetter();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if ([...headers.keys()].length > 0) {
    requestInit.headers = headers;
  }

  const resolvedInput = resolveRequest(input);

  const response = await fetch(resolvedInput, requestInit);

  if (response.status === 401 && !options.skipAuth) {
    unauthorizedHandler?.();
  }

  return response;
}
