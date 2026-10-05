// import { NextRequest, NextResponse } from "next/server";

// const OPENCLAW_API_URL =
//   process.env.OPENCLAW_AGENT_MANAGER_URL || "https://openclaw.marketsverse.com";

// type Params = { params: { integrationName: string } };

// async function proxyAM(req, path: string, method: string, body?: string): Promise<NextResponse> {
//   try {
//     const res = await fetch(`${OPENCLAW_API_URL}/api/${path}`, {
//       method,
//       headers: { "Content-Type": "application/json" },
//       ...(body ? { body } : {}),
//       signal: AbortSignal.timeout(30_000),
//     });
//     const text = await res.text();
//     let data: any;
//     try { data = JSON.parse(text); } catch {
//       return NextResponse.json({ error: "OpenClaw service returned invalid response" }, { status: 502 });
//     }
//     return NextResponse.json(data, { status: res.status });
//   } catch (err: any) {
//     if (err?.name === "TimeoutError") return NextResponse.json({ error: "OpenClaw service timed out" }, { status: 504 });
//     return NextResponse.json({ error: "Failed to reach OpenClaw service" }, { status: 502 });
//   }
// }

// export const PATCH = async (req: NextRequest, { params }: Params) =>
//   proxyAM(req, `integrations/${params.integrationName}`, "PATCH", await req.text());
// export const DELETE = (_req: NextRequest, { params }: Params) =>
//   proxyAM(req, `integrations/${params.integrationName}`, "DELETE");
