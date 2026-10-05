import { coverfiApi } from "./api";
import type { ApiResult, InsuranceCompany } from "./types";

const base = "/v1/coverfi/insurance";

export const listInsuranceCompanies = () =>
  coverfiApi<ApiResult<InsuranceCompany[]>>(base).then((r) => r.data);

export const getInsuranceCompany = (id: string) =>
  coverfiApi<ApiResult<InsuranceCompany>>(`${base}/${id}`).then((r) => r.data);

export const createInsuranceCompany = (
  body: Omit<
    InsuranceCompany,
    "_id" | "brokerageId" | "orgId" | "createdAt" | "updatedAt" | "is_active"
  > & { is_active?: boolean },
) =>
  coverfiApi<ApiResult<InsuranceCompany>>(`${base}/create`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateInsuranceCompany = (
  id: string,
  patch: Partial<InsuranceCompany>,
) =>
  coverfiApi<ApiResult<InsuranceCompany>>(`${base}/update/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteInsuranceCompany = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/delete/${id}`, { method: "DELETE" });
