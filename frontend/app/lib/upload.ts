import { getOperatorRequestHeaders } from "./auth";
import { getApiUrl } from "./api";

export async function uploadImage(path: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(getApiUrl(path), {
    method: "POST",
    body: formData,
    headers: typeof window === "undefined" ? undefined : getOperatorRequestHeaders(),
  });

  if (!response.ok) {
    let message = "Upload failed";

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

  return (await response.json()) as { url: string };
}
