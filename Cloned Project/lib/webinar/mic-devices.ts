/**
 * Which microphones are really *choices*, for the "pick a mic" prompt.
 *
 * `enumerateDevices()` is not a list of hardware. Chrome on Windows prepends
 * two virtual entries — `deviceId: "default"` and `"communications"` — that
 * are aliases for a real device further down the list. Counting raw entries
 * there reports 3 mics on a laptop that has one, so a prompt gated on
 * "more than one mic" would open for everybody on Windows.
 *
 * Kept free of any DOM/React import so it can be tested on its own.
 */

/** Alias ids that point at another entry rather than naming hardware. */
const ALIAS_IDS = new Set(["default", "communications"]);

/**
 * Real, distinct microphones, in the order the browser gave them.
 *
 * Both filters are deliberately conservative — when the browser tells us too
 * little to be sure, the device stays in the list. Dropping a real mic from
 * the picker is worse than showing one extra row.
 */
export function realAudioInputs(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  const usable = devices.filter((d) => d.deviceId);

  // Only drop the aliases when a real entry survives: Safari and some mobile
  // browsers expose the default mic and nothing else, and filtering there
  // would leave an empty list.
  const named = usable.filter((d) => !ALIAS_IDS.has(d.deviceId));
  const list = named.length > 0 ? named : usable;

  // One physical device can appear twice (a headset's mic under two ids).
  // groupId is what ties those together — but it is optional, and browsers
  // that omit it report "" for every device, where this would collapse the
  // whole list to one. So dedupe only on a groupId that actually exists.
  const seen = new Set<string>();
  return list.filter((d) => {
    if (!d.groupId) return true;
    if (seen.has(d.groupId)) return false;
    seen.add(d.groupId);
    return true;
  });
}

/** Label to show for a mic — browsers return "" until permission is granted. */
export function micLabel(device: MediaDeviceInfo, index: number): string {
  return device.label?.trim() || `Microphone ${index + 1}`;
}
