// Public Privacy Policy page. Linked from signup / book-demo (and used as the
// App Store privacy URL). No auth — anyone, including a store reviewer, can
// open it. Static content; update the "Last updated" date and the contact
// address if the policy changes.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Garage",
  description: "How Garage collects, uses, and protects your information.",
};

const LAST_UPDATED = "September 4, 2026";
const CONTACT_EMAIL = "support@garage.app";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-[#1a1713] sm:text-xl">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-[#3f3a34]">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-[100dvh] bg-[#faf8f5] text-[#1a1713]">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Link
          href="/"
          className="text-sm font-semibold text-[#b38600] hover:underline"
        >
          &larr; Back to Garage
        </Link>

        <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#8a857e]">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-[15px] leading-relaxed text-[#3f3a34]">
          Garage (&ldquo;Garage,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
          provides a platform for creating and running online businesses,
          workspaces, webinars, and an affiliate program. This Privacy Policy
          explains what information we collect, how we use it, and the choices
          you have. By using Garage you agree to this policy.
        </p>

        <Section title="Information We Collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account information</strong> — your name, email address,
              phone number, and profile details you provide when you sign up or
              complete your profile.
            </li>
            <li>
              <strong>Organization &amp; usage data</strong> — the workspaces,
              webinars, products, and content you create or interact with, and
              basic activity needed to operate the service.
            </li>
            <li>
              <strong>Payment information</strong> — when you make or receive a
              payment, it is processed by third-party payment providers (such as
              Razorpay and other processors). We receive transaction details
              (amount, status, an identifier) but do not store your full card
              or bank credentials.
            </li>
            <li>
              <strong>Communications</strong> — messages, support requests, and
              one-time verification codes sent to your email or phone.
            </li>
            <li>
              <strong>Device &amp; log data</strong> — standard technical
              information such as IP address, browser type, and timestamps used
              to keep the service secure and reliable.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To provide, operate, and improve the Garage platform.</li>
            <li>To authenticate you and secure your account (including OTP verification).</li>
            <li>To process payments, subscriptions, and affiliate commissions.</li>
            <li>To send service messages, updates, and support responses.</li>
            <li>To detect, prevent, and address fraud, abuse, or technical issues.</li>
            <li>To comply with legal and tax obligations.</li>
          </ul>
        </Section>

        <Section title="How We Share Information">
          <p>
            We do <strong>not</strong> sell your personal information. We share
            it only as needed to run the service:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Service providers</strong> — payment processors, hosting,
              email/SMS delivery, and analytics, who process data on our behalf
              under confidentiality obligations.
            </li>
            <li>
              <strong>Within your organization</strong> — data you add to a
              workspace is visible to that workspace&rsquo;s authorized members
              according to their role.
            </li>
            <li>
              <strong>Legal reasons</strong> — where required by law, regulation,
              or valid legal process, or to protect the rights and safety of
              our users and the platform.
            </li>
          </ul>
        </Section>

        <Section title="Data Retention">
          <p>
            We keep your information for as long as your account is active and
            as needed to provide the service. Certain records (for example,
            financial and transaction records) are retained longer where
            required for legal, accounting, or fraud-prevention purposes. When
            an account is deleted, associated personal data is removed or
            anonymized, except records we must keep by law.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use reasonable technical and organizational measures to protect
            your information, including encrypted connections and access
            controls. No method of transmission or storage is completely
            secure, so we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="Your Rights &amp; Choices">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Access, update, or correct your profile information at any time.</li>
            <li>Request deletion of your account and associated personal data.</li>
            <li>Opt out of non-essential communications.</li>
          </ul>
          <p>
            To exercise any of these, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-[#b38600] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="Cookies &amp; Similar Technologies">
          <p>
            We use cookies and local storage to keep you signed in, remember
            your preferences, and understand how the service is used. You can
            control cookies through your browser settings; disabling them may
            affect some features.
          </p>
        </Section>

        <Section title="Children&rsquo;s Privacy">
          <p>
            Garage is not directed to children under 13 (or the minimum age
            required in your jurisdiction), and we do not knowingly collect
            their personal information.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            Payments, communications, and some features rely on third-party
            services that have their own privacy policies. We encourage you to
            review the policies of any third-party service you interact with
            through Garage.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we
            will revise the &ldquo;Last updated&rdquo; date above. Significant
            changes may be communicated through the service.
          </p>
        </Section>

        <Section title="Contact Us">
          <p>
            If you have questions about this Privacy Policy or your data, contact
            us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-[#b38600] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <p className="mt-12 border-t border-[#e8e7e5] pt-6 text-xs text-[#8a857e]">
          &copy; {new Date().getFullYear()} Garage. All rights reserved.
        </p>
      </div>
    </main>
  );
}
