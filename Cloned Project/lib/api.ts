import { getToken } from "./auth";
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const GARAGE_ADMIN_API_URL = "https://my.revenue.network";

export async function api<T>(
  path: string,
  opts: RequestInit = {},
  token?: string
): Promise<T> {
  const auth = token ?? getToken() ?? undefined;

  // Don't set Content-Type for FormData, let the browser set it with boundary
  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const baseUrl = API_URL || "http://localhost:4000";
  const fullUrl = path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")
    ? path
    : `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...opts,
      headers: {
        ...headers,
        ...(opts.headers || {}),
      },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error(`[API Connection Error] Failed to fetch: ${fullUrl}`, err);
    throw new Error(`Failed to connect to API at ${fullUrl}. Please check if the server is running.`);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = `Server error (${res.status})`;
    try { const j = JSON.parse(text); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// Garage Admin specific API function
export async function garageAdminApi<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("garage_admin_token")
      : undefined;

  return api<T>(
    path,
    {
      ...opts,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    },
    token
  );
}
