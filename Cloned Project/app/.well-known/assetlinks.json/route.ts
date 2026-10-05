import { NextResponse } from "next/server";

// Android Digital Asset Links — served at https://my.garage.app/.well-known/assetlinks.json
//
// This domain (my.garage.app) is the Garage HQ web app.
// The Garage HQ Android app (com.garageapp.hq) is authorized here so its
// autoVerify intent filters pass App Link verification:
//  • /webinar (declared since 1.0.4)
//  • /hq      (declared from 1.0.5 — canonical content deep links)
// Which paths actually open the app is decided by the APK's intent filters,
// not this file, so /workspace, /guest/* etc. keep opening as normal Chrome
// pages. Fingerprints are the Play App Signing SHA-256s for com.garageapp.hq.
//
// GarageIRL (com.garagepayseller.app) is authorized for its /product, /s and
// /a links (lib/garageIrl.ts). Fingerprints: the Play App Signing key (what
// Play installs are signed with) and the EAS upload key (what the sideloaded
// production APK is signed with).
//
// NOTE: app.garage.store (the Garage Store consumer app) is registered to
// the separate domain garage.app / www.garage.app — NOT this domain.

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.garageapp.hq",
          sha256_cert_fingerprints: [
            "A8:02:F2:AD:FD:D9:46:74:E5:33:B8:98:46:71:DE:7A:DF:8E:04:E4:28:91:73:9C:D7:97:41:93:CB:7E:57:5C",
            "6E:5B:F3:C9:A0:C5:F0:B9:C8:CE:3B:D3:4F:AC:A0:DD:05:8A:2B:25:71:81:5F:38:5A:14:66:59:E7:E3:53:6B",
          ],
        },
      },
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.garagepayseller.app",
          sha256_cert_fingerprints: [
            "01:C0:5B:76:4E:AB:38:64:7B:CC:9A:50:DE:0D:FF:96:8F:37:2A:07:97:3B:C2:D2:B6:CA:E1:9E:51:32:4A:56",
            "61:03:63:23:B9:D9:20:2B:D0:09:C2:AC:8B:D2:68:F9:20:A4:E5:C8:EE:1F:10:FA:A9:16:7C:86:3D:B3:A4:0F",
          ],
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
