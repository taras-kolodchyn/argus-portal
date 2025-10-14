export interface ApiFetchOptions {
  skipAuth?: boolean;
}

type TokenGetter = () => string | null;
type RefreshHandler = () => Promise<boolean>;
type UnauthorizedHandler = () => void;
type SuccessHandler = () => void;

let tokenGetter: TokenGetter | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshHandler: RefreshHandler | null = null;
let successHandler: SuccessHandler | null = null;

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
  tryRefresh: RefreshHandler;
  onUnauthorized: UnauthorizedHandler;
  onRequestSuccess?: SuccessHandler;
}): void {
  tokenGetter = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized;
  refreshHandler = options.tryRefresh;
  successHandler = options.onRequestSuccess ?? null;
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

  const applyAuthorization = () => {
    if (options.skipAuth || !tokenGetter) {
      return;
    }
    const token = tokenGetter();
    if (!token) {
      headers.delete("Authorization");
      return;
    }
    headers.set("Authorization", token);
  };

  applyAuthorization();
  if ([...headers.keys()].length > 0) {
    requestInit.headers = headers;
  }

  const resolvedInput = resolveRequest(input);

  let attempt = 0;

  while (true) {
    const response = await fetch(resolvedInput, requestInit);

    if (response.ok) {
      successHandler?.();
      return response;
    }

    if (response.status === 401 && !options.skipAuth) {
      if (attempt === 0 && refreshHandler) {
        attempt += 1;
        const refreshed = await refreshHandler().catch(() => false);
        if (refreshed) {
          applyAuthorization();
          if ([...headers.keys()].length > 0) {
            requestInit.headers = headers;
          }
          continue;
        }
      }
      unauthorizedHandler?.();
    }

    return response;
  }
}
