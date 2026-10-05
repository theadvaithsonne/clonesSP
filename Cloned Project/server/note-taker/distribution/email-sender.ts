import { Resend } from 'resend';
import { env } from '../../config/env';

let resend: Resend | null = null;

function getClient(): Resend {
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
}

/**
 * Send a note-taker summary email via Resend.
 *
 * We use Resend (not contacts-backend's nodemailer/SMTP path) because roam-backend
 * already runs the platform's email delivery on Resend — same RESEND_API_KEY, same
 * verified sending domains. The SMTP path in office-mailer.ts exists for OfficeStream
 * but isn't configured in prod, and its hardcoded "OfficeStream" from-address would
 * be wrong branding for a Garage/NetworkChains summary email anyway.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<string[]> {
  if (opts.to.length === 0) return [];

  if (!env.RESEND_API_KEY) {
    console.warn('[EmailSender] RESEND_API_KEY not configured, skipping email send');
    return [];
  }

  const client = getClient();

  try {
    await client.emails.send({
      from: env.RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    console.log(`[EmailSender] Sent to ${opts.to.length} recipients: ${opts.to.join(', ')}`);
    return opts.to;
  } catch (error) {
    console.error('[EmailSender] Resend send failed:', error);
    throw error;
  }
}
