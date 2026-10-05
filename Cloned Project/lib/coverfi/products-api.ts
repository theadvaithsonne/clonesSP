import { coverfiApi } from "./api";
import type {
  ApiResult,
  FilterItem,
  FilterType,
  Product,
  ProductCategory,
} from "./types";

/* ---------------- categories ---------------- */

const catBase = "/v1/coverfi/categories";

export const listCategories = () =>
  coverfiApi<ApiResult<ProductCategory[]>>(catBase).then((r) => r.data);

export const createCategory = (body: {
  category_name: string;
  category_description?: string;
}) =>
  coverfiApi<ApiResult<ProductCategory>>(catBase, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateCategory = (id: string, body: Partial<ProductCategory>) =>
  coverfiApi<ApiResult<ProductCategory>>(`${catBase}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const deleteCategory = (id: string) =>
  coverfiApi<ApiResult<null>>(`${catBase}/${id}`, { method: "DELETE" });

/* ---------------- filter types ---------------- */

const filterBase = "/v1/coverfi/filter";

export const listFilterTypes = () =>
  coverfiApi<ApiResult<FilterType[]>>(`${filterBase}/types`).then((r) => r.data);

export const listFilterItemsForType = (filterTypeId: string) =>
  coverfiApi<ApiResult<FilterItem[]>>(
    `${filterBase}/types/${filterTypeId}/items`,
  ).then((r) => r.data);

export const createFilterType = (body: {
  filter_type_name: string;
  filter_type_description?: string;
}) =>
  coverfiApi<ApiResult<FilterType>>(`${filterBase}/types`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateFilterType = (id: string, body: Partial<FilterType>) =>
  coverfiApi<ApiResult<FilterType>>(`${filterBase}/types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const deleteFilterType = (id: string) =>
  coverfiApi<ApiResult<null>>(`${filterBase}/types/${id}`, { method: "DELETE" });

export const createFilterItem = (body: {
  filter_type_id: string;
  filter_item_name: string;
  filter_item_description?: string;
}) =>
  coverfiApi<ApiResult<FilterItem>>(`${filterBase}/items`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const updateFilterItem = (id: string, body: Partial<FilterItem>) =>
  coverfiApi<ApiResult<FilterItem>>(`${filterBase}/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const deleteFilterItem = (id: string) =>
  coverfiApi<ApiResult<null>>(`${filterBase}/items/${id}`, { method: "DELETE" });

/* ---------------- products ---------------- */

const prodBase = "/v1/coverfi/products";

export const listProducts = () =>
  coverfiApi<ApiResult<Product[]>>(prodBase).then((r) => r.data);

export const getProduct = (id: string) =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/${id}`).then((r) => r.data);

export const createDraftProduct = () =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/create/step1`, {
    method: "POST",
    body: "{}",
  }).then((r) => r.data);

export const stepCategory = (id: string, category: string) =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/create/step2/${id}`, {
    method: "POST",
    body: JSON.stringify({ category }),
  }).then((r) => r.data);

export const stepFilters = (id: string, filters: string[]) =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/create/step3/${id}`, {
    method: "POST",
    body: JSON.stringify({ filters }),
  }).then((r) => r.data);

export const stepInfo = (
  id: string,
  body: {
    name: string;
    description?: string;
    type?: string;
    insurance_provider: string;
    logo?: string;
    product_document?: string;
  },
) =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/create/step4/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const stepBilling = (
  id: string,
  body: Partial<Product>,
) =>
  coverfiApi<ApiResult<Product>>(`${prodBase}/create/step5/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);

export const deleteProduct = (id: string) =>
  coverfiApi<ApiResult<null>>(`${prodBase}/${id}`, { method: "DELETE" });
