export function newModuleId() {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
}
