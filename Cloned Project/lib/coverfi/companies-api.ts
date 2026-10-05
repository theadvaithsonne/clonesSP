import { coverfiApi } from "./api";
import type {
  ApiResult,
  Company,
  CompanyEmployee,
  CompanyEnrolledProduct,
} from "./types";

const base = "/v1/coverfi/company";
const empBase = "/v1/coverfi/company-employees";

/* ---------------- companies ---------------- */

export const listCompanies = () =>
  coverfiApi<ApiResult<Company[]>>(`${base}/all`).then((r) => r.data);

export const getCompany = (id: string) =>
  coverfiApi<ApiResult<Company>>(`${base}/${id}`).then((r) => r.data);

export const createCompanyStep1 = (body: {
  legal_name: string;
  display_name?: string;
  industry?: string;
  poc?: Company["poc"];
}) =>
  coverfiApi<ApiResult<Company>>(`${base}/create/step1`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const createCompanyStep2 = (id: string, body: Partial<Company>) =>
  coverfiApi<ApiResult<Company>>(`${base}/create/step2/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const createCompanyStep3 = (
  id: string,
  body: { enrolled_products?: { productId: string; notes?: string }[] },
) =>
  coverfiApi<ApiResult<Company>>(`${base}/create/step3/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateCompany = (id: string, patch: Partial<Company>) =>
  coverfiApi<ApiResult<Company>>(`${base}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteCompany = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/delete/${id}`, { method: "DELETE" });

export const enrollProduct = (
  companyId: string,
  productId: string,
  notes?: string,
) =>
  coverfiApi<ApiResult<Company>>(`${base}/${companyId}/enroll-product`, {
    method: "POST",
    body: JSON.stringify({ productId, notes }),
  }).then((r) => r.data);

export const unenrollProduct = (companyId: string, productId: string) =>
  coverfiApi<ApiResult<Company>>(
    `${base}/${companyId}/enroll-product/${productId}`,
    { method: "DELETE" },
  ).then((r) => r.data);

/* ---------------- employees ---------------- */

export const listCompanyEmployees = (companyId: string) =>
  coverfiApi<ApiResult<CompanyEmployee[]>>(
    `${base}/${companyId}/employees`,
  ).then((r) => r.data);

export const createCompanyEmployee = (
  companyId: string,
  body: Partial<CompanyEmployee>,
) =>
  coverfiApi<ApiResult<CompanyEmployee>>(`${base}/${companyId}/employees`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateCompanyEmployee = (
  id: string,
  patch: Partial<CompanyEmployee>,
) =>
  coverfiApi<ApiResult<CompanyEmployee>>(`${empBase}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteCompanyEmployee = (id: string) =>
  coverfiApi<ApiResult<null>>(`${empBase}/${id}`, { method: "DELETE" });

export type { CompanyEnrolledProduct };
