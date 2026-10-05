/**
 * Salary slip email — renders a self-contained HTML email and sends via the
 * existing Resend-backed mailer. Tone: clean, neutral, white-bg (the dark
 * Teamforce theme is for the in-app drawer; emails should be friendly).
 */

import { sendMail, EMAIL_FROM_NOTIFICATION } from "../../mailer";

interface SlipEmailInput {
  recipientEmail: string;
  recipientName: string;
  payMonthLabel: string; // e.g. "Apr 2025"
  fyString: string; // e.g. "2024-25"
  regime: "OLD" | "NEW";
  windowStart: Date;
  windowEnd: Date;
  earnings: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  grossSalary: number;
  pfEmployee: number;
  esiEmployee: number;
  professionalTax: number;
  monthlyTDS: number;
  joiningPartialPay: number;
  netPay: number;
  attendance: {
    factor: number;
    daysPresent: number;
    calendarDays: number;
    lopDays: number;
  };
  warnings: string[];
}

const INR = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function sendSalarySlipEmail(input: SlipEmailInput) {
  const subject = `Salary slip · ${input.payMonthLabel} · ${input.fyString}`;

  const earnRows = input.earnings
    .filter((e) => e.amount > 0)
    .map(
      (e) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#444;">${escape(e.label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:#111;">${INR(e.amount)}</td></tr>`
    )
    .join("");

  const dedRowsRaw = [
    ["PF (Employee)", input.pfEmployee],
    ["ESI (Employee)", input.esiEmployee],
    ["Professional Tax", input.professionalTax],
    ["TDS (Income Tax)", input.monthlyTDS],
    ...input.deductions
      .filter((d) => d.amount > 0)
      .map((d) => [d.label, d.amount] as [string, number]),
  ];
  const dedRows = dedRowsRaw
    .filter(([, v]) => Number(v) > 0)
    .map(
      ([label, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#444;">${escape(label as string)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:#111;">${INR(v as number)}</td></tr>`
    )
    .join("");

  const totalDeductions = dedRowsRaw
    .filter(([, v]) => Number(v) > 0)
    .reduce((s, [, v]) => s + (v as number), 0);

  const warningsBlock =
    input.warnings && input.warnings.length > 0
      ? `<div style="margin-top:16px;padding:12px 14px;background:#fff8e1;border:1px solid #f0c14b;border-radius:8px;font-size:12px;color:#7a5d00;line-height:1.55;">
          <strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Notes</strong>
          <ul style="margin:0;padding-left:18px;">${input.warnings.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>
        </div>`
      : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;">
  <div style="max-width:640px;margin:0 auto;background:#fff;padding:32px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px;">
      <div>
        <h1 style="margin:0;font-size:20px;font-weight:700;">Salary Slip</h1>
        <div style="font-size:12px;color:#555;margin-top:4px;">Hi ${escape(input.recipientName)},</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#555;line-height:1.6;">
        <strong style="color:#111;font-size:13px;">${escape(input.payMonthLabel)}</strong><br/>
        FY ${escape(input.fyString)} · ${escape(input.regime)} regime<br/>
        Window: ${escape(fmtDate(input.windowStart))} – ${escape(fmtDate(input.windowEnd))}
      </div>
    </div>

    <p style="font-size:13px;line-height:1.6;color:#444;margin:0 0 24px;">
      Your salary slip for <strong>${escape(input.payMonthLabel)}</strong> has been
      finalised. The breakdown is below; you can also view + print a copy from
      <strong>My Salary Slips</strong> in Teamforce.
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:16px;">
      <div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Attendance Factor</div>
        <div style="font-size:13px;color:#111;font-weight:500;">${(input.attendance.factor * 100).toFixed(2)}% (${input.attendance.daysPresent}/${input.attendance.calendarDays} days)</div>
      </div>
      <div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">LOP Days</div>
        <div style="font-size:13px;color:#111;font-weight:500;">${input.attendance.lopDays}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px 12px;border-bottom:1px solid #ddd;background:#fafafa;">Earning</th>
          <th style="text-align:right;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px 12px;border-bottom:1px solid #ddd;background:#fafafa;">Amount</th>
        </tr>
      </thead>
      <tbody>${earnRows || `<tr><td colspan="2" style="padding:16px;color:#999;text-align:center;font-size:12px;">No earnings</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td style="padding:10px 12px;font-weight:700;font-size:13px;border-top:2px solid #111;">Gross Salary</td>
          <td style="padding:10px 12px;font-weight:700;font-size:13px;border-top:2px solid #111;text-align:right;font-variant-numeric:tabular-nums;">${INR(input.grossSalary)}</td>
        </tr>
      </tfoot>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px 12px;border-bottom:1px solid #ddd;background:#fafafa;">Deduction</th>
          <th style="text-align:right;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;padding:8px 12px;border-bottom:1px solid #ddd;background:#fafafa;">Amount</th>
        </tr>
      </thead>
      <tbody>${dedRows || `<tr><td colspan="2" style="padding:16px;color:#999;text-align:center;font-size:12px;">No deductions</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td style="padding:10px 12px;font-weight:700;font-size:13px;border-top:2px solid #111;">Total Deductions</td>
          <td style="padding:10px 12px;font-weight:700;font-size:13px;border-top:2px solid #111;text-align:right;font-variant-numeric:tabular-nums;">${INR(totalDeductions)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:24px;padding:16px 20px;background:#fff7d6;border:1px solid #e5c100;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#7a5d00;">Net Pay</div>
      <div style="font-size:24px;font-weight:700;color:#111;font-variant-numeric:tabular-nums;">${INR(input.netPay)}</div>
    </div>

    ${
      input.joiningPartialPay > 0
        ? `<p style="font-size:11px;color:#666;margin:8px 0 0;text-align:right;">Includes joining partial pay ${INR(input.joiningPartialPay)}.</p>`
        : ""
    }

    ${warningsBlock}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10.5px;color:#888;text-align:center;line-height:1.6;">
      Computer-generated salary slip · No signature required.<br/>
      Reach out to your HR admin if anything looks off.
    </div>
  </div>
</body>
</html>`;

  const text = `Salary Slip — ${input.payMonthLabel} (FY ${input.fyString})

Hi ${input.recipientName},

Your salary for ${input.payMonthLabel} has been finalised.

Gross Salary  : ${INR(input.grossSalary)}
Total Deduct. : ${INR(totalDeductions)}
Net Pay       : ${INR(input.netPay)}

View the full breakdown in Teamforce → My Salary Slips.`;

  await sendMail(input.recipientEmail, subject, html, text, EMAIL_FROM_NOTIFICATION);
}
