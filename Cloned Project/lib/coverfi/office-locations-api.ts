import { coverfiApi } from "./api";
import type { ApiResult, OfficeLocation } from "./types";

const base = "/v1/coverfi/locations";

export const listOfficeLocations = () =>
  coverfiApi<ApiResult<OfficeLocation[]>>(`${base}/list`).then((r) => r.data);

export const createOfficeLocation = (
  body: Omit<
    OfficeLocation,
    "_id" | "brokerageId" | "orgId" | "createdAt" | "updatedAt" | "is_active"
  >,
) =>
  coverfiApi<ApiResult<OfficeLocation>>(`${base}/create`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateOfficeLocation = (
  id: string,
  patch: Partial<OfficeLocation>,
) =>
  coverfiApi<ApiResult<OfficeLocation>>(`${base}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteOfficeLocation = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/${id}`, { method: "DELETE" });
