"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const CONTACT_EMAIL = "info@garage.app";
const LAST_UPDATED = "August 20, 2026";

type Section = {
  /** Clause number as it appears in the executed document. */
  number: string;
  title: string;
  clauses: string[];
};

// Mirrors garage-store-nextjs-v1/app/terms/page.tsx verbatim. Any legal
// change there must be copied here — the two must never drift.
const SECTIONS: Section[] = [
  {
    number: "1",
    title: "Acceptance",
    clauses: [
      "1.1 By registering for an Account, clicking “I Agree”, accessing or using the Garage Platform, the User acknowledges that the User has read, understood, and agreed to this Tos.",
      "1.2 If the User does not agree to this Tos, the User must not access or use Garage.",
      "1.3 Where the User accesses Garage on behalf of an organization, the User represents that the User is authorized to bind such organization to this Tos.",
    ],
  },
  {
    number: "2",
    title: "Licence Grant",
    clauses: [
      "2.1 Subject to the User’s compliance with this Tos and payment of applicable fees, Garage grants the User a limited, non-exclusive, non-transferable, non-sublicensable and revocable right to access and use the Garage Platform during the applicable subscription or authorization period.",
      "2.2 The licence granted under this Tos is solely for the User’s internal business or personal use, as applicable, and only for the purposes for which Garage makes the relevant Services available.",
      "2.3 Except as expressly permitted under this Tos, no ownership interest in the Garage Platform is transferred to the User.",
      "2.4 The User is solely responsible for determining whether the Garage Platform and the particular Services being accessed or used by the User are permitted under the laws and regulations applicable to the User. Garage does not represent or warrant that the Garage Platform, or any particular feature or Service, is available, appropriate or legally permissible in every jurisdiction.",
      "2.5 Where access to or use of any feature, Service or functionality of the Garage Platform is prohibited or restricted in a particular jurisdiction, the User shall not access or use such feature, Service or functionality to the extent prohibited or restricted by applicable law.",
      "2.6 Garage reserves the right, at its discretion and to the extent permitted by applicable law, to restrict, suspend or terminate access to the Garage Platform or any particular Service where Garage reasonably determines that such access or use may violate applicable law, regulatory requirements, sanctions, governmental restrictions or this Tos.",
    ],
  },
  {
    number: "3",
    title: "Restrictions on Use",
    clauses: [
      "3.1 The User shall not, and shall not permit any third party to copy, reproduce, modify, adapt, translate or create derivative works of the Garage Platform.",
      "3.2 The User shall not reverse engineer, decompile, disassemble or attempt to discover the source code of Garage, except to the extent expressly permitted by applicable law.",
      "3.3 The User shall not rent, lease, sell, sublicense, distribute, assign, transfer or commercially exploit Garage except as expressly permitted.",
      "3.4 The User shall not interfere with or disrupt the security, integrity, availability or operation and circumvent authentication, access controls, usage restrictions or security measures of Garage.",
      "3.5 The User shall not introduce malware, viruses, malicious code or other harmful material and access Garage through automated means, scraping, bots or similar mechanisms except through APIs or mechanisms expressly authorized by Garage.",
      "3.6 The User shall not use Garage for unlawful, fraudulent, abusive or unauthorized activities and use Garage in violation of applicable laws or regulations.",
    ],
  },
  {
    number: "4",
    title: "User Account",
    clauses: [
      "4.1 The User shall provide accurate, complete and current information when creating an Account.",
      "4.2 The User is responsible for maintaining the confidentiality of login credentials and for all activities conducted through the User’s Account.",
      "4.3 The User shall promptly notify Garage of any unauthorized access, suspected security incident or compromise of Account credentials.",
      "4.4 Garage may require identity verification or additional information where reasonably necessary for security, compliance, fraud prevention or regulatory purposes.",
    ],
  },
  {
    number: "5",
    title: "User Content",
    clauses: [
      "5.1 The User retains ownership of Content submitted or uploaded by the User to Garage, subject to the rights granted under this Tos.",
      "5.2 The User grants Garage a limited, worldwide, non-exclusive licence to host, store, reproduce, process, transmit and otherwise use User Content solely to the extent reasonably necessary to provide, maintain, secure and improve the Services and to comply with applicable law.",
      "5.3 The User represents and warrants that the User has all rights, permissions and lawful authority necessary to submit such Content to Garage and to grant the rights contemplated under this Tos.",
      "5.4 The User shall not upload or transmit Content that infringes any third-party intellectual property, privacy, confidentiality or other rights.",
    ],
  },
  {
    number: "6",
    title: "Intellectual Property Rights",
    clauses: [
      "6.1 All rights, title and interest in and to the Garage Platform, including its software, source code, object code, architecture, interfaces, designs, trademarks, logos, documentation, databases, algorithms, features and improvements, shall remain exclusively vested in Garage.",
      "6.2 Except for the limited licence expressly granted under this Tos, no rights or licences are granted to the User, whether by implication, estoppel or otherwise.",
      "6.3 The User shall not remove, obscure or alter any copyright, trademark, proprietary or other legal notices displayed on Garage.",
    ],
  },
  {
    number: "8",
    title: "Third-Party Services and Integrations",
    clauses: [
      "8.1 Garage may integrate with or provide access to third-party products, platforms, payment providers, APIs, applications or services.",
      "8.2 Such third-party services may be subject to separate terms and privacy policies.",
      "8.3 Garage does not control and except as expressly stated, is not responsible for third-party services, their availability, functionality, security, content or performance.",
    ],
  },
  {
    number: "9",
    title: "Marketplace",
    clauses: [
      "9.1 Where Garage provides marketplace functionality, Garage may facilitate interactions between Users and independent third-party sellers, service providers or other businesses.",
      "9.2 Unless expressly stated otherwise, Garage is not the seller, manufacturer or provider of products or services listed by third parties.",
      "9.3 Garage acts solely as a technology platform and marketplace intermediary that facilitates the listing, discovery, communication and where applicable, transaction of products and services offered by Sellers. Unless expressly stated otherwise, Garage does not itself sell, manufacture, supply, own, possess, control or provide any product or service listed by a Seller.",
      "9.4 The User acknowledges and agrees that Garage operates the Marketplace as a technology platform and intermediary facilitating the discovery, listing, communication and, where applicable, transaction between Sellers and Customers. Any purchase, engagement, order or other transaction undertaken through the Marketplace is entered into between the relevant Seller and Customer with Garage facilitating such interaction through the Marketplace. Accordingly, the Seller remains primarily responsible for the products and services offered by it, including their availability, quality, accuracy, delivery, performance, cancellation, refund and fulfilment, as applicable. Garage does not assume responsibility for the underlying transaction or the acts or omissions of the relevant Seller, except to the extent expressly provided under applicable law or expressly agreed by Garage marketplace policy.",
      "9.5 Transactions conducted through the Marketplace may be subject to separate Marketplace Terms, seller terms, refund policies and applicable laws.",
      "9.6 The User’s access to and use of the Garage Marketplace, including the listing, offering, purchase, sale and provision of products and services through the Marketplace, shall be subject to the Garage Marketplace Policy.",
    ],
  },
  {
    number: "10",
    title: "Payments and Transactions",
    clauses: [
      "10.1 Certain features of Garage may require payment of subscription fees, transaction fees, commissions or other applicable charges.",
      "10.2 The User agrees to pay all applicable fees in accordance with the pricing and payment terms displayed by Garage.",
      "10.3 Where third-party payment processors are used, transactions may also be subject to the applicable terms of such payment providers.",
      "10.4 Garage reserves the right to suspend access to paid features for overdue or failed payments, subject to applicable law and the applicable subscription terms.",
      "10.5 Any settlement, payout, commission, revenue share or other amount payable to the User through Garage shall be processed and made in accordance with the Garage Settlement Policy, as amended from time to time, and the User expressly agrees to be bound by such policy.",
    ],
  },
  {
    number: "11",
    title: "Privacy and Data Protection",
    clauses: [
      "11.1 Garage’s collection and processing of personal data is governed by its Privacy Policy, the User acknowledges that use of the Garage Platform may involve the collection, storage, processing and transmission of personal data as necessary to provide the Services.",
      "11.2 Where applicable, the parties shall comply with applicable data protection and privacy laws.",
    ],
  },
  {
    number: "12",
    title: "Updates and Modifications",
    clauses: [
      "12.1 Garage may update, modify, enhance, replace or discontinue features or functionality of the Garage Platform from time to time.",
      "12.2 Garage may release software updates, patches, security fixes and other modifications that may be automatically applied or required for continued use of the Services.",
      "12.3 Garage may modify this Tos from time to time. Where required by applicable law, Garage shall provide reasonable notice of material changes.",
    ],
  },
  {
    number: "13",
    title: "Availability and Maintenance",
    clauses: [
      "13.1 Garage will use commercially reasonable efforts to maintain the availability of the Services.",
      "13.2 The User acknowledges that temporary interruptions may occur due to maintenance, upgrades, technical failures, third-party dependencies, network failures or events beyond Garage’s reasonable control.",
    ],
  },
  {
    number: "14",
    title: "Suspension",
    clauses: [
      "14.1 Garage may suspend or restrict the User’s access to all or part of the Services where reasonably necessary to prevent security threats or harm, investigate suspected fraud or misuse, comply with applicable law or governmental requirements, address a material breach of this Tos or prevent harm to Garage, other Users or third parties.",
    ],
  },
  {
    number: "15",
    title: "Termination",
    clauses: [
      "15.1 The User may terminate the Account in accordance with the applicable subscription or account terms.",
      "15.2 Garage may terminate or suspend this Tos or the User’s access where the User materially breaches this Tos, where capable of remedy, fails to remedy such breach within a reasonable period after notice.",
      "15.3 Garage may immediately suspend or terminate access where reasonably necessary to prevent fraud, security threats, unlawful activity or material harm.",
    ],
  },
  {
    number: "16",
    title: "Effect of Termination",
    clauses: [
      "16.1 Upon termination the User’s right to access and use Garage shall cease and the User shall cease all use of the Garage Platform and unpaid amounts accrued before termination shall remain payable, provisions intended by their nature to survive termination shall continue to apply.",
    ],
  },
  {
    number: "17",
    title: "Disclaimers",
    clauses: [
      "17.1 To the maximum extent permitted by applicable law, Garage provides the Services on an “as is” and “as available” basis and does not warrant that the Services will be uninterrupted, error-free, completely secure or suitable for every particular purpose. Garage does not warrant the accuracy, completeness or reliability of third-party content or AI-generated outputs.",
    ],
  },
  {
    number: "18",
    title: "Limitation of Liability",
    clauses: [
      "18.1 To the maximum extent permitted by applicable law, Garage shall not be liable for any indirect, incidental, consequential, special or punitive damages or for any loss of profits, revenue, business opportunities, goodwill or data arising out of or relating to the use of the Services. Subject to applicable law, Garage’s aggregate liability arising out of or relating to this Tos shall be limited to the amount of fees actually paid by the User to Garage for the Services giving rise to the claim.",
      "18.2 To the maximum extent permitted by applicable law, the User shall not seek to hold any director, officer, employee, representative, agent or other personnel of Garage personally liable for any claim, loss, damage or liability arising out of or relating to this Tos or the Services. Any liability of Garage and its directors, officers, employees, representatives, agents or personnel, to the extent legally permissible, shall be subject to the limitations and exclusions set out in this Clause and shall in no event exceed the fees actually paid by the User to Garage for the Services giving rise to the claim.",
    ],
  },
  {
    number: "19",
    title: "Indemnification",
    clauses: [
      "19.1 The User shall indemnify and hold harmless Garage its directors, officers, employees and representatives from claims, losses, liabilities, damages, costs and expenses arising out of the User’s breach of this Tos and unlawful or unauthorized use of Garage and infringement of third-party rights through User Content and the User’s violation of applicable law.",
    ],
  },
  {
    number: "20",
    title: "Confidentiality",
    clauses: [
      "20.1 Where the User receives confidential or proprietary information belonging to Garage, the User shall not disclose or use such information except as necessary to use the Services or as otherwise permitted by Garage.",
    ],
  },
  {
    number: "21",
    title: "Compliance with Laws",
    clauses: [
      "21.1 The User shall use Garage in compliance with all applicable laws, regulations, rules and governmental requirements, including applicable laws relating to intellectual property, privacy, data protection, consumer protection, cybersecurity, taxation and electronic transactions.",
    ],
  },
  {
    number: "22",
    title: "Third-Party Beneficiaries",
    clauses: [
      "22.1 Except as expressly provided in this Tos no person other than the parties shall have any right to enforce any provision of this Tos.",
    ],
  },
  {
    number: "23",
    title: "Assignment",
    clauses: [
      "23.1 The User shall not assign or transfer this Tos or any rights granted under it without Garage’s prior written consent. Garage may assign or transfer this Tos in connection with a merger, acquisition, corporate restructuring, sale of assets or similar transaction.",
    ],
  },
  {
    number: "24",
    title: "Governing Law and Jurisdiction",
    clauses: [
      "24.1 This Tos shall be governed by and construed in accordance with the laws of India. Any dispute, claim or difference arising out of or relating to this Tos shall, to the maximum extent permitted by applicable law, be resolved exclusively through arbitration seated in Bangalore, Karnataka, India, in accordance with the Arbitration and Conciliation Act, 1996, and the User expressly agrees to submit to such arbitration before initiating, except where court intervention is mandatorily required by law.",
    ],
  },
  {
    number: "25",
    title: "Severability",
    clauses: [
      "If any provision of this Tos is held to be invalid or unenforceable, such provision shall be modified to the minimum extent necessary to make it enforceable and the remaining provisions shall continue in full force and effect.",
    ],
  },
];

type TermsAndConditionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user explicitly accepts from inside the modal. */
  onAccept: () => void;
};

export function TermsAndConditionsModal({
  open,
  onOpenChange,
  onAccept,
}: TermsAndConditionsModalProps) {
  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111114] border-[#2a2a35] text-white max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-[#2a2a35] px-6 py-4">
          <DialogTitle className="text-white text-[17px]">
            Terms &amp; Conditions
          </DialogTitle>
          <DialogDescription className="text-[#9fa0b8] text-xs">
            Last updated {LAST_UPDATED}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6 text-[13px] leading-relaxed [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2a2a35] [&::-webkit-scrollbar-thumb]:rounded-full"
        >
          <div className="space-y-3 text-[#9fa0b8]">
            <p>
              Terms of service (“Tos” or “Agreement”) governs the access to and
              use of the Garage platform, applications, features and related
              services made available by Starfish Accelerators Partners Private
              Limited, a company incorporated under the laws of India referred
              as (“Garage”, “Company”, “we”, “us” or “our”), by any person or
              entity accessing or using Garage, including Founders and
              Affiliates (collectively, the “Users” and individually, a “User”).
            </p>
            <p>
              For the purposes of this Tos, “Founder” means User who can be any
              person or entity that registers with, accesses or uses Garage for
              the purpose of creating, managing or participating in a business,
              venture, project, offering or other activity through the Garage
              platform and “Affiliate” means a User who can be any person that
              participates or uses Garage under its Garage Affiliate Policy.
            </p>
            <p>
              By clicking “I Agree,” creating an account, accessing,
              downloading, installing or otherwise using Garage, whether as a
              Founder or Affiliate, the User acknowledges that they have read,
              understood and agree to be legally bound by this Tos.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <section key={section.number}>
              <h3 className="text-[14px] font-semibold text-white mb-2">
                {section.number}. {section.title}
              </h3>
              <div className="space-y-2 text-[#9fa0b8]">
                {section.clauses.map((clause, i) => (
                  <p key={i}>{clause}</p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h3 className="text-[14px] font-semibold text-white mb-2">
              26. Contact
            </h3>
            <p className="text-[#9fa0b8]">
              For questions, notices or legal enquiries relating to this Tos,
              the User may contact{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-brand underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-[#2a2a35] px-6 py-4 bg-[#0e0e12]">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-10 px-5 rounded-lg font-medium text-sm"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            className="bg-brand text-brand-foreground font-semibold hover:bg-[#fde047] h-10 px-5 rounded-lg text-sm"
          >
            I Understand &amp; Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TermsAndConditionsModal;
