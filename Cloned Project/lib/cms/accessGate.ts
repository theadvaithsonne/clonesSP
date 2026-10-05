const CMS_ACCESS_STORAGE_KEY = "garage:cms-access-unlocked";
export const CMS_ACCESS_PASSWORD = "Garage@CMS!2026";

type AccessCallback = () => void;

let openDialogHandler: ((onGranted: AccessCallback) => void) | null = null;

export function registerCmsAccessDialog(handler: (onGranted: AccessCallback) => void) {
  openDialogHandler = handler;
}

export function unregisterCmsAccessDialog() {
  openDialogHandler = null;
}

export function isCmsAccessUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(CMS_ACCESS_STORAGE_KEY) === "1";
}

export function unlockCmsAccess() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CMS_ACCESS_STORAGE_KEY, "1");
}

export function verifyCmsPassword(password: string): boolean {
  return password.trim() === CMS_ACCESS_PASSWORD;
}

export function requestCmsAccess(onGranted: AccessCallback) {
  if (isCmsAccessUnlocked()) {
    onGranted();
    return;
  }
  if (openDialogHandler) {
    openDialogHandler(onGranted);
    return;
  }
  // ponytail: host not mounted yet — fail closed
}
