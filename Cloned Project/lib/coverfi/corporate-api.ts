import { coverfiApi } from "./api";
import type {
  ApiResult,
  Corporate,
  CorporateDependent,
  CorporateEmployee,
  CorporateProductMapping,
} from "./types";

const base = "/v1/coverfi/corporate";

/* ---------------- corporates ---------------- */

export const listCorporates = () =>
  coverfiApi<ApiResult<Corporate[]>>(`${base}/all`).then((r) => r.data);

export const getCorporate = (id: string) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/${id}`).then((r) => r.data);

export const createCorporateStep1 = (body: {
  legal_name: string;
  display_name?: string;
  industry?: string;
  admin_email: string;
  admin_first_name?: string;
  admin_last_name?: string;
  admin_phone?: string;
  admin_phone_code?: string;
  poc?: Corporate["poc"];
}) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/create/step1`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const createCorporateStep2 = (id: string, body: Partial<Corporate>) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/create/step2/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const createCorporateStep3 = (id: string) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/create/step3/${id}`, {
    method: "POST",
    body: "{}",
  }).then((r) => r.data);

export const createCorporateStep4 = (id: string) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/create/step4/${id}`, {
    method: "POST",
    body: "{}",
  }).then((r) => r.data);

export const updateCorporate = (id: string, patch: Partial<Corporate>) =>
  coverfiApi<ApiResult<Corporate>>(`${base}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteCorporate = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/delete/${id}`, { method: "DELETE" });

/* ---------------- employees ---------------- */

export const listCorporateEmployees = (corporateId: string) =>
  coverfiApi<ApiResult<CorporateEmployee[]>>(
    `${base}/${corporateId}/employees`,
  ).then((r) => r.data);

export const createCorporateEmployee = (
  corporateId: string,
  body: Partial<CorporateEmployee>,
) =>
  coverfiApi<ApiResult<CorporateEmployee>>(`${base}/${corporateId}/employees`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateCorporateEmployee = (
  id: string,
  patch: Partial<CorporateEmployee>,
) =>
  coverfiApi<ApiResult<CorporateEmployee>>(`/v1/coverfi/corporate-employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const suspendCorporateEmployee = (id: string) =>
  coverfiApi<ApiResult<CorporateEmployee>>(`/v1/coverfi/corporate-employees/${id}`, {
    method: "DELETE",
  }).then((r) => r.data);

/* ---------------- dependents ---------------- */

export const listDependentsForEmployee = (employeeId: string) =>
  coverfiApi<ApiResult<CorporateDependent[]>>(
    `/v1/coverfi/corporate-employees/${employeeId}/dependents`,
  ).then((r) => r.data);

export const createDependent = (
  employeeId: string,
  body: Partial<CorporateDependent>,
) =>
  coverfiApi<ApiResult<CorporateDependent>>(
    `/v1/coverfi/corporate-employees/${employeeId}/dependents`,
    { method: "POST", body: JSON.stringify(body) },
  ).then((r) => r.data);

export const updateDependent = (
  id: string,
  patch: Partial<CorporateDependent>,
) =>
  coverfiApi<ApiResult<CorporateDependent>>(`/v1/coverfi/corporate-dependents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteDependent = (id: string) =>
  coverfiApi<ApiResult<null>>(`/v1/coverfi/corporate-dependents/${id}`, {
    method: "DELETE",
  });

/* ---------------- product mappings ---------------- */

export const listMappingsForCorporate = (corporateId: string) =>
  coverfiApi<ApiResult<CorporateProductMapping[]>>(
    `${base}/${corporateId}/product-mappings`,
  ).then((r) => r.data);

export const createMapping = (
  corporateId: string,
  body: Partial<CorporateProductMapping>,
) =>
  coverfiApi<ApiResult<CorporateProductMapping>>(
    `${base}/${corporateId}/product-mappings`,
    { method: "POST", body: JSON.stringify(body) },
  ).then((r) => r.data);

export const updateMapping = (
  id: string,
  patch: Partial<CorporateProductMapping>,
) =>
  coverfiApi<ApiResult<CorporateProductMapping>>(
    `/v1/coverfi/corporate-product-mappings/${id}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  ).then((r) => r.data);

export const deleteMapping = (id: string) =>
  coverfiApi<ApiResult<null>>(`/v1/coverfi/corporate-product-mappings/${id}`, {
    method: "DELETE",
  });
