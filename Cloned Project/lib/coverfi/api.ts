import { getToken } from "@/lib/auth";

export const COVERFI_API_URL =
  process.env.NEXT_PUBLIC_COVERFI_API_URL || "http://localhost:4100";


  
export async function coverfiApi<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const auth = getToken() ?? undefined;

  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${COVERFI_API_URL}${path}`, {
    ...opts,
    headers: {
      ...headers,
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || text;
    } catch {
      /* not json */
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return res.json();
}
