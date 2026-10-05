import type { CmsColumnData, CmsModule, CmsModuleType } from "./types";
import { newModuleId } from "./ids";

export const LAYOUT_MODULE_TYPES: CmsModuleType[] = [
  "section",
  "container",
  "two_column",
  "three_column",
  "columns",
];

export function isLayoutModule(type: CmsModuleType) {
  return LAYOUT_MODULE_TYPES.includes(type);
}

export function defaultColumnCount(type: CmsModuleType) {
  if (type === "three_column") return 3;
  if (type === "two_column") return 2;
  if (type === "section" || type === "container") return 1;
  return 2;
}

export function makeColumns(count: number): CmsColumnData[] {
  const safe = Math.min(4, Math.max(1, count));
  const w = Math.floor(100 / safe);
  return Array.from({ length: safe }, (_, i) => ({
    id: newModuleId(),
    width: i === safe - 1 ? 100 - w * (safe - 1) : w,
    modules: [],
  }));
}

/** Migrate legacy flat `children` (one block per column) → `props.columns`. */
export function getLayoutColumns(module: CmsModule): CmsColumnData[] {
  if (Array.isArray(module.props?.columns) && module.props.columns.length > 0) {
    return module.props.columns as CmsColumnData[];
  }

  const count = defaultColumnCount(module.type);
  if (module.children?.length) {
    const cols = makeColumns(count);
    module.children.forEach((child, i) => {
      if (cols[i]) cols[i].modules = [child];
    });
    return cols;
  }

  return makeColumns(count);
}

export function withLayoutColumns(module: CmsModule, columns: CmsColumnData[]): CmsModule {
  const { children: _legacy, ...rest } = module;
  return {
    ...rest,
    props: { ...module.props, columns },
    children: undefined,
  };
}
