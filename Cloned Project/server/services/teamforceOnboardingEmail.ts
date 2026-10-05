import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { sendMail, EMAIL_FROM_NOTIFICATION } from "./mailer";
import { emailShell, ctaButton, greeting, bodyText, fallbackLink } from "./bulkEmail";
import { env } from "../config/env";

function onboardingEmailHtml(recipientName: string, orgName: string, link: string): string {
  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:26px;font-weight:700;">Welcome to ${orgName}!</h1>
    <p style="margin:8px 0 0;color:#0C0C0E;font-size:15px;opacity:0.8;">One last step to get set up</p>`;

  let body = greeting(recipientName);
  body += bodyText(
    "For your onboarding, please fill in your employee details so your HR team can finish setting up your profile."
  );
  body += ctaButton(link, "Fill in Employee Details");
  body += fallbackLink(link);
  return emailShell(header, body);
}

function onboardingEmailText(recipientName: string, orgName: string, link: string): string {
  const salutation = recipientName ? `Hi ${recipientName},` : "Hi there,";
  return `${salutation}\n\nWelcome to ${orgName}! For your onboarding, please fill in your employee details so your HR team can finish setting up your profile.\n\nFill in your details: ${link}\n\n- Garage`;
}

/** Fire-and-forget: tells a newly-joined stakeholder to complete their
 *  Teamforce onboarding profile. Never sent to founders — they aren't
 *  gated by the onboarding form. Caller should .catch() this. */
export async function sendTeamforceOnboardingEmail(
  userId: string,
  orgId: string
): Promise<void> {
  try {
    const user = await User.findById(userId).select("email name").lean();
    if (!user?.email) {
      console.log("[TeamforceOnboarding] User not found or no email:", userId);
      return;
    }

    const org = await Organization.findById(orgId).select("name").lean();
    const orgName = org?.name || "your organization";

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    // orgId is required — without it, the recipient's browser falls back to
    // whatever org happens to be active in localStorage (e.g. GARAGE HQ,
    // auto-joined on signup), and the onboarding form ends up saving the
    // profile under the wrong org entirely.
    const link = `${frontendUrl}/workspace?openApp=teamforce&orgId=${orgId}`;

    const html = onboardingEmailHtml(user.name || "", orgName, link);
    const text = onboardingEmailText(user.name || "", orgName, link);

    await sendMail(
      user.email,
      `Complete your profile at ${orgName}`,
      html,
      text,
      EMAIL_FROM_NOTIFICATION
    );
    console.log(`[TeamforceOnboarding] Sent to ${user.email}`);
  } catch (err) {
    console.error("[TeamforceOnboarding] Failed to send:", err);
  }
}
