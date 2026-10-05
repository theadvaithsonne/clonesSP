// Pure, immutable helpers for editing the funnel tree by path.
// A Path is a list of sibling indices from the root options down to a node:
//   []      -> the opening question (root)
//   [0]     -> first top-level option
//   [0, 2]  -> third sub-option of the first option
import type { FunnelNode, FunnelTemplate } from "@/lib/funnel-tree";

export type Path = number[];

export function newNode(order: number): FunnelNode {
  return { key: crypto.randomUUID(), label: "", order, videos: [], children: [] };
}

export function pathsEqual(a: Path | null, b: Path | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function getNode(tpl: FunnelTemplate, path: Path): FunnelNode | null {
  if (path.length === 0) return null;
  let nodes: FunnelNode[] = tpl.options;
  let node: FunnelNode | null = null;
  for (const i of path) {
    node = nodes[i] ?? null;
    if (!node) return null;
    nodes = node.children;
  }
  return node;
}

export function updateNode(
  tpl: FunnelTemplate,
  path: Path,
  updater: (n: FunnelNode) => FunnelNode
): FunnelTemplate {
  if (path.length === 0) return tpl;
  const recurse = (nodes: FunnelNode[], depth: number): FunnelNode[] =>
    nodes.map((n, idx) => {
      if (idx !== path[depth]) return n;
      if (depth === path.length - 1) return updater(n);
      return { ...n, children: recurse(n.children, depth + 1) };
    });
  return { ...tpl, options: recurse(tpl.options, 0) };
}

export function deleteNode(tpl: FunnelTemplate, path: Path): FunnelTemplate {
  const idx = path[path.length - 1];
  const parent = path.slice(0, -1);
  const removeAt = (nodes: FunnelNode[]) => nodes.filter((_, j) => j !== idx);
  if (parent.length === 0) return { ...tpl, options: removeAt(tpl.options) };
  return updateNode(tpl, parent, (n) => ({ ...n, children: removeAt(n.children) }));
}

export function addChild(
  tpl: FunnelTemplate,
  parent: Path,
  child: FunnelNode
): FunnelTemplate {
  if (parent.length === 0) return { ...tpl, options: [...tpl.options, child] };
  return updateNode(tpl, parent, (n) => ({ ...n, children: [...n.children, child] }));
}

export function moveNode(
  tpl: FunnelTemplate,
  path: Path,
  dir: "up" | "down"
): FunnelTemplate {
  const idx = path[path.length - 1];
  const parent = path.slice(0, -1);
  const swap = (nodes: FunnelNode[]) => {
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= nodes.length) return nodes;
    const copy = [...nodes];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  };
  if (parent.length === 0) return { ...tpl, options: swap(tpl.options) };
  return updateNode(tpl, parent, (n) => ({ ...n, children: swap(n.children) }));
}

/** Reassign `order` to match array position, recursively (called before save). */
export function normalizeOrders(tpl: FunnelTemplate): FunnelTemplate {
  const walk = (nodes: FunnelNode[]): FunnelNode[] =>
    nodes.map((n, i) => ({
      ...n,
      order: i,
      videos: n.videos.map((v, vi) => ({ ...v, order: vi })),
      children: walk(n.children),
    }));
  return { ...tpl, options: walk(tpl.options) };
}

/** How many videos exist anywhere under a node (for structure badges). */
export function countVideosDeep(node: FunnelNode): number {
  return (
    node.videos.length +
    node.children.reduce((sum, c) => sum + countVideosDeep(c), 0)
  );
}
