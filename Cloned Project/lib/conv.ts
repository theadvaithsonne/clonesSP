// lib/conv.ts
export function dmConvId(a: string, b: string) {
  return `dm:${[a, b].sort().join(":")}`;
}
export function groupConvId(groupId: string) {
  return `g:${groupId}`;
}
export function globalDmConvId(a: string, b: string) {
  return `global-dm:${[a, b].sort().join(":")}`;
}
