import { coverfiApi } from "./api";
import type { ApiResult, PolicySettingsDoc } from "./types";

const base = "/v1/coverfi/policy-settings";

export const getPolicySettings = () =>
  coverfiApi<ApiResult<PolicySettingsDoc>>(base).then((r) => r.data);

export const patchPolicySettings = (patch: Record<string, unknown>) =>
  coverfiApi<ApiResult<PolicySettingsDoc>>(base, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const unsetPolicySetting = (key: string) =>
  coverfiApi<ApiResult<PolicySettingsDoc>>(
    `${base}/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  ).then((r) => r.data);
