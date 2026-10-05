import { coverfiApi } from "./api";
import type { ApiResult, EmailSender, EmailTemplate } from "./types";

const commBase = "/v1/coverfi/communication";

/* ---------------- senders ---------------- */

export const listSenders = () =>
  coverfiApi<ApiResult<EmailSender[]>>(commBase).then((r) => r.data);

export const getSender = (id: string) =>
  coverfiApi<ApiResult<EmailSender>>(`${commBase}/sender/${id}`).then(
    (r) => r.data,
  );

export const createSender = (body: {
  nickname: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  address?: EmailSender["address"];
}) =>
  coverfiApi<ApiResult<EmailSender>>(`${commBase}/create/sender`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateSender = (id: string, patch: Partial<EmailSender>) =>
  coverfiApi<ApiResult<EmailSender>>(`${commBase}/sender/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteSender = (id: string) =>
  coverfiApi<ApiResult<null>>(`${commBase}/sender/${id}`, { method: "DELETE" });

export const verifySender = (id: string) =>
  coverfiApi<ApiResult<EmailSender>>(`${commBase}/sender/${id}/verify`, {
    method: "POST",
    body: "{}",
  }).then((r) => r.data);

/* ---------------- templates ---------------- */

export const listTemplates = () =>
  coverfiApi<ApiResult<EmailTemplate[]>>("/v1/coverfi/templates").then(
    (r) => r.data,
  );

export const getTemplate = (id: string) =>
  coverfiApi<ApiResult<EmailTemplate>>(`/v1/coverfi/template/${id}`).then(
    (r) => r.data,
  );

export const createTemplate = (body: {
  trigger_event_name: string;
  email_subject: string;
  email_content: string;
  is_active?: boolean;
}) =>
  coverfiApi<ApiResult<EmailTemplate>>("/v1/coverfi/template/create", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateTemplate = (id: string, patch: Partial<EmailTemplate>) =>
  coverfiApi<ApiResult<EmailTemplate>>(`/v1/coverfi/template/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.data);

export const deleteTemplate = (id: string) =>
  coverfiApi<ApiResult<null>>(`/v1/coverfi/template/${id}`, {
    method: "DELETE",
  });
