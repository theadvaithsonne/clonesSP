import type { CmsColumnData, CmsModule, CmsModuleType } from "./types";
import { createModule } from "./moduleDefaults";
import { getLayoutColumns, isLayoutModule, withLayoutColumns } from "./columns";

function mapColumnModules(
  columns: CmsColumnData[],
  id: string,
  fn: (m: CmsModule) => CmsModule | null
): CmsColumnData[] {
  return columns.map((col) => ({
    ...col,
    modules: col.modules.flatMap((m) => {
      if (m.id === id) {
        const next = fn(m);
        return next ? [next] : [];
      }
      if (isLayoutModule(m.type)) {
        const nested = getLayoutColumns(m);
        const updated = mapColumnModules(nested, id, fn);
        if (updated !== nested) {
          return [{ ...withLayoutColumns(m, updated) }];
        }
      }
      if (m.children) {
        const nextChildren = mapModules(m.children, id, fn);
        if (nextChildren !== m.children) return [{ ...m, children: nextChildren }];
      }
      return [m];
    }),
  }));
}

export function mapModules(
  modules: CmsModule[],
  id: string,
  fn: (m: CmsModule) => CmsModule | null
): CmsModule[] {
  const result: CmsModule[] = [];
  for (const m of modules) {
    if (m.id === id) {
      const next = fn(m);
      if (next) result.push(next);
      continue;
    }

    let updated = m;

    if (isLayoutModule(m.type)) {
      const cols = getLayoutColumns(m);
      const nextCols = mapColumnModules(cols, id, fn);
      if (nextCols !== cols) {
        updated = withLayoutColumns(m, nextCols);
      }
    } else if (m.children) {
      const nextChildren = mapModules(m.children, id, fn);
      if (nextChildren !== m.children) {
        updated = { ...m, children: nextChildren };
      }
    }

    result.push(updated);
  }
  return result;
}

export function findModule(modules: CmsModule[], id: string): CmsModule | null {
  for (const m of modules) {
    if (m.id === id) return m;

    if (isLayoutModule(m.type)) {
      for (const col of getLayoutColumns(m)) {
        const found = findModule(col.modules, id);
        if (found) return found;
      }
    }

    if (m.children) {
      const found = findModule(m.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findModuleParent(
  modules: CmsModule[],
  id: string
): { layoutId: string; columnId: string } | null {
  for (const m of modules) {
    if (isLayoutModule(m.type)) {
      for (const col of getLayoutColumns(m)) {
        if (col.modules.some((child) => child.id === id)) {
          return { layoutId: m.id, columnId: col.id };
        }
        for (const child of col.modules) {
          const nested = findModuleParent([child], id);
          if (nested) return nested;
        }
      }
    }
    if (m.children) {
      const found = findModuleParent(m.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateLayoutColumns(
  modules: CmsModule[],
  layoutId: string,
  updater: (cols: CmsColumnData[]) => CmsColumnData[]
): CmsModule[] {
  return mapModules(modules, layoutId, (m) => {
    if (!isLayoutModule(m.type)) return m;
    return withLayoutColumns(m, updater(getLayoutColumns(m)));
  });
}

export function addModuleToColumn(
  modules: CmsModule[],
  layoutId: string,
  columnId: string,
  type: CmsModuleType
): CmsModule[] {
  const mod = createModule(type);
  return updateLayoutColumns(modules, layoutId, (cols) =>
    cols.map((col) =>
      col.id === columnId ? { ...col, modules: [...col.modules, mod] } : col
    )
  );
}

export function removeModuleFromColumn(
  modules: CmsModule[],
  layoutId: string,
  columnId: string,
  moduleId: string
): CmsModule[] {
  return updateLayoutColumns(modules, layoutId, (cols) =>
    cols.map((col) =>
      col.id === columnId
        ? { ...col, modules: col.modules.filter((m) => m.id !== moduleId) }
        : col
    )
  );
}

export function addModuleToLayoutStack(
  modules: CmsModule[],
  layoutId: string,
  type: CmsModuleType
): CmsModule[] {
  const mod = createModule(type);
  return mapModules(modules, layoutId, (m) => {
    if (!isLayoutModule(m.type)) {
      return { ...m, children: [...(m.children || []), mod] };
    }
    const cols = getLayoutColumns(m);
    if (cols.length === 0) return withLayoutColumns(m, [{ id: `col_${mod.id}`, width: 100, modules: [mod] }]);
    const first = cols[0];
    return withLayoutColumns(
      m,
      cols.map((col, i) => (i === 0 ? { ...col, modules: [...col.modules, mod] } : col))
    );
  });
}
