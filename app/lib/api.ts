import { getOperatorRequestHeaders } from "./auth";

const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function getApiBaseUrl() {
  if (ENV_API_BASE_URL) {
    return ENV_API_BASE_URL;
  }
  return "";
}

export function getApiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

export function resolveAssetUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return getApiUrl(path);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(typeof window === "undefined" ? {} : getOperatorRequestHeaders()),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
