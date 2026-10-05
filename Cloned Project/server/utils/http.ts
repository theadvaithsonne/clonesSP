export function ok<T>(data: T) {
  return { success: true, data };
}
export function fail(message: string, code?: string) {
  return { success: false, message, code };
}
