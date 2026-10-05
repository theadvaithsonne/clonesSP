"use client";

import {
  devicesFor,
  hasDeviceChoice,
  useAdminDevice,
  useAdminProduct,
} from "@/lib/admin/product";

/**
 * All / Web / Mobile toggle for the Replays page.
 *
 * This needs no new backend filter: the web client registers `app: "nc-web"`
 * and the Expo app registers `app: "nc-mobile"`, and the recordings endpoint
 * already filters on that `apps` list for the product switch. Picking a device
 * just narrows the list that gets sent.
 *
 * Renders nothing for a product that ships one platform — Admin, Buyer and
 * Seller are a single Expo app each, so "All" and "Mobile" would return the
 * same recordings and "Web" could only ever be empty. The product switch is
 * the only control those need.
 */
export function DeviceSwitch() {
  const [device, setDevice] = useAdminDevice();
  const [product] = useAdminProduct();

  if (!hasDeviceChoice(product)) return null;

  return (
    <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5">
      {devicesFor(product).map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => setDevice(d.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            device === d.id
              ? "bg-brand text-brand-foreground"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
