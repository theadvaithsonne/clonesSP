type LeadLike = Record<string, unknown> | null | undefined;

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPrimaryContact(lead: LeadLike): Record<string, unknown> | null {
  if (!lead || typeof lead !== "object") return null;

  const singleContact = lead.contact;
  if (singleContact && typeof singleContact === "object") {
    return singleContact as Record<string, unknown>;
  }

  const contacts = lead.contacts;
  if (!Array.isArray(contacts) || contacts.length === 0) return null;

  const primary = contacts.find(
    (c) => c && typeof c === "object" && (c as Record<string, unknown>).isPrimary
  );
  if (primary && typeof primary === "object") {
    return primary as Record<string, unknown>;
  }

  const withEmailOrPhone = contacts.find((c) => {
    if (!c || typeof c !== "object") return false;
    const contact = c as Record<string, unknown>;
    return trimString(contact.email) || trimString(contact.phoneNumber) || trimString(contact.phone);
  });

  if (withEmailOrPhone && typeof withEmailOrPhone === "object") {
    return withEmailOrPhone as Record<string, unknown>;
  }

  const first = contacts[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

function firstPhoneFromEntity(entity: Record<string, unknown> | null): string {
  if (!entity) return "";

  const direct = trimString(entity.phoneNumber) || trimString(entity.phone) || trimString(entity.mobile);
  if (direct) return direct;

  const phoneNumbers = entity.phoneNumbers;
  if (Array.isArray(phoneNumbers)) {
    for (const item of phoneNumbers) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object") {
        const value = trimString(
          (item as Record<string, unknown>).phoneNumber ??
            (item as Record<string, unknown>).phone ??
            (item as Record<string, unknown>).number ??
            (item as Record<string, unknown>).value
        );
        if (value) return value;
      }
    }
  }

  return "";
}

/** Resolves email from lead fields or linked contact(s). */
export function resolveLeadEmail(lead: LeadLike): string {
  const direct = trimString(lead?.email);
  if (direct) return direct;

  const contact = getPrimaryContact(lead);
  return trimString(contact?.email);
}

/** Resolves phone from lead fields or linked contact(s). */
export function resolveLeadPhone(lead: LeadLike): string {
  const fromLead = firstPhoneFromEntity(
    lead && typeof lead === "object" ? (lead as Record<string, unknown>) : null
  );
  if (fromLead) return fromLead;

  const contact = getPrimaryContact(lead);
  return firstPhoneFromEntity(contact);
}

/** Fields to satisfy backend validation on partial lead updates (e.g. tags). */
export function buildLeadContactFieldsForApi(lead: LeadLike): {
  email?: string;
  phone?: string;
  phoneNumbers?: string[];
} {
  const email = resolveLeadEmail(lead);
  const phone = resolveLeadPhone(lead);
  const result: { email?: string; phone?: string; phoneNumbers?: string[] } = {};

  if (email) result.email = email;
  if (phone) {
    result.phone = phone;
    result.phoneNumbers = [phone];
  }

  return result;
}

export function hasLeadEmailOrPhone(lead: LeadLike): boolean {
  return Boolean(resolveLeadEmail(lead) || resolveLeadPhone(lead));
}
