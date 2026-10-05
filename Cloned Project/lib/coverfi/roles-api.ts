import { coverfiApi } from "./api";
import type { ApiResult, CoverfiRole } from "./types";

const base = "/v1/coverfi/roles";

export const listRoles = () =>
  coverfiApi<ApiResult<CoverfiRole[]>>(base).then((r) => r.data);

export const createRole = (body: { name: string; description?: string }) =>
  coverfiApi<ApiResult<CoverfiRole>>(base, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateRole = (id: string, patch: Partial<CoverfiRole>) =>
  coverfiApi<ApiResult<CoverfiRole>>(`${base}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteRole = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/${id}`, { method: "DELETE" });
