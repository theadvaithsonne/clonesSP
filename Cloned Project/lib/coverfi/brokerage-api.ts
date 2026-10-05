import { coverfiApi } from "./api";
import type {
  ApiResult,
  Brokerage,
  BrokerageLocation,
  Stakeholder,
} from "./types";

const base = "/v1/coverfi/brokerage";

/* ---------------- profile ---------------- */

export const getBrokerage = () =>
  coverfiApi<ApiResult<Brokerage | null>>(`${base}/profile`).then((r) => r.data);

export const patchBrokerageProfile = (patch: Partial<Brokerage>) =>
  coverfiApi<ApiResult<Brokerage>>(`${base}/profile`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

/* ---------------- branding ---------------- */

export const patchBrokerageBranding = (patch: Partial<Brokerage>) =>
  coverfiApi<ApiResult<Brokerage>>(`${base}/branding`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

/* ---------------- landing page ---------------- */

export const saveLandingPage = (patch: Partial<Brokerage>) =>
  coverfiApi<ApiResult<Brokerage>>(`${base}/landing-page`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const publishLandingPage = () =>
  coverfiApi<ApiResult<Brokerage>>(`${base}/landing-page/publish`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then((r) => r.data);

/* ---------------- locations ---------------- */

export const listLocations = () =>
  coverfiApi<ApiResult<BrokerageLocation[]>>(`${base}/location`).then(
    (r) => r.data,
  );

export const createLocation = (
  body: Omit<BrokerageLocation, "_id" | "brokerageId" | "orgId" | "createdAt" | "updatedAt">,
) =>
  coverfiApi<ApiResult<BrokerageLocation>>(`${base}/location`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateLocation = (
  id: string,
  patch: Partial<BrokerageLocation>,
) =>
  coverfiApi<ApiResult<BrokerageLocation>>(`${base}/location/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteLocation = (id: string) =>
  coverfiApi<ApiResult<null>>(`${base}/location/${id}`, { method: "DELETE" });

/* ---------------- stakeholders (read-only) ---------------- */

export const listStakeholders = () =>
  coverfiApi<ApiResult<Stakeholder[]>>(`${base}/stakeholders`).then(
    (r) => r.data,
  );

export const updateStakeholderAssignment = (
  userId: string,
  patch: { role_id?: string | null; branch_id?: string | null },
) =>
  coverfiApi<ApiResult<unknown>>(
    `${base}/stakeholders/${userId}/assignment`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
