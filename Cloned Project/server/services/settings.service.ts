import { Types } from "mongoose";
import { Settings, IDynamicEmailItem } from "../models/setting.model";

type EmailSection = {
  id: string;
  title: string;
  items: Array<{
    key: string;
    title: string;
    description: string;
  }>;
};

export const EMAIL_NOTIFICATION_SECTIONS: EmailSection[] = [
  {
    id: "global-emails",
    title: "Global Emails",
    items: [
      {
        key: "globalNewOfficeJoinsGarage",
        title: "New office joins Garage",
        description: "Get notified when a new office joins Garage.",
      },
      {
        key: "globalNewOfferReleased",
        title: "New offer released by any office",
        description: "Get notified when any office releases a new offer.",
      },
      {
        key: "globalNewPersonJoinsGarage",
        title: "New person joins Garage",
        description: "Get notified when a new person joins Garage.",
      },
    ],
  },
  {
    id: "office-fixed-emails",
    title: "Office Fixed Emails",
    items: [
      {
        key: "officeCommunityPost",
        title: "Community posts in your office",
        description:
          "Get notified when a new post is made in one of the communities you're in.",
      },
      {
        key: "officeNewOffer",
        title: "New offer in this office",
        description: "Get notified when a new offer is made by this office.",
      },
      {
        key: "officeNewMember",
        title: "New member in this office",
        description: "Get notified when someone joins this office.",
      },
    ],
  },
  {
    id: "office-dynamic-emails",
    title: "Office Dynamic Emails",
    items: [],
  },
  {
    id: "affiliate-emails",
    title: "Affiliate Emails",
    items: [
      {
        key: "affiliateDownlineRegistration",
        title: "Downline registrations",
        description: "Get notified when someone registers in your downline.",
      },
      {
        key: "affiliateDirectReferralRegistration",
        title: "Direct referral registrations",
        description: "Get notified when a direct referral registers.",
      },
      {
        key: "affiliateCommissionEarned",
        title: "Commission earned",
        description: "Get notified whenever you earn a commission.",
      },
      {
        key: "affiliateDownlinePurchase",
        title: "Downline purchases",
        description:
          "Get notified whenever someone in your downline buys something.",
      },
    ],
  },
];

function getDefaultPreferenceMap(): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  for (const section of EMAIL_NOTIFICATION_SECTIONS) {
    for (const item of section.items) {
      prefs[item.key] = true;
    }
  }
  return prefs;
}

function normalizeDynamicItems(
  items: IDynamicEmailItem[],
): IDynamicEmailItem[] {
  const seen = new Set<string>();
  const normalized: IDynamicEmailItem[] = [];

  for (const item of items) {
    const key = item.key.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      key,
      title: item.title.trim(),
      description: item.description.trim(),
      enabled: item.enabled,
    });
  }

  return normalized;
}

export async function createSettings(userId: string, orgId: string) {
  const existing = await Settings.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
  }).lean();

  if (existing) return existing;

  return Settings.create({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    emailPreferences: getDefaultPreferenceMap(),
    officeDynamicEmails: [],
  });
}

export async function getSettings(userId: string, orgId: string) {
  let settings = await Settings.findOne({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
  }).lean();

  if (!settings) {
    settings = await createSettings(userId, orgId);
  }

  return settings;
}

export async function updateSettings(
  userId: string,
  orgId: string,
  payload: {
    emailPreferences?: Record<string, boolean>;
    officeDynamicEmails?: IDynamicEmailItem[];
    language?: string;
    currency?: string;
  },
) {
  const existing = await getSettings(userId, orgId);
  const mergedPreferences = {
    ...getDefaultPreferenceMap(),
    ...Object.fromEntries(
      Object.entries((existing as any).emailPreferences || {}),
    ),
    ...(payload.emailPreferences || {}),
  };

  const dynamicEmails =
    payload.officeDynamicEmails !== undefined
      ? normalizeDynamicItems(payload.officeDynamicEmails)
      : (existing as any).officeDynamicEmails || [];

  const updated = await Settings.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    },
    {
      $set: {
        emailPreferences: mergedPreferences,
        officeDynamicEmails: dynamicEmails,
        // Only when sent. A PATCH carrying just emailPreferences must not
        // clear a language the user chose on another screen.
        ...(payload.language !== undefined ? { language: payload.language } : {}),
        // Same reasoning as language: only touch it when the client sends it.
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
      },
    },
    { new: true, upsert: true },
  ).lean();

  return updated;
}

export function buildSettingsResponse(settings: any) {
  const rawPrefs = settings?.emailPreferences;
  let emailPrefMap: Record<string, boolean> = {};

  if (rawPrefs instanceof Map) {
    rawPrefs.forEach((v: boolean, k: string) => {
      emailPrefMap[k] = !!v;
    });
  } else if (rawPrefs && typeof rawPrefs === "object") {
    emailPrefMap = Object.fromEntries(
      Object.entries(rawPrefs).map(([k, v]) => [k, !!v]),
    );
  }

  emailPrefMap = { ...getDefaultPreferenceMap(), ...emailPrefMap };

  // const dynamicSection: EmailSection = {
  //   id: "office-dynamic-emails",
  //   title: "Office Dynamic Emails",
  //   items: (settings?.officeDynamicEmails || []).map((item: IDynamicEmailItem) => ({
  //     key: item.key,
  //     title: item.title,
  //     description: item.description,
  //   })),
  // };

  // const sections = EMAIL_NOTIFICATION_SECTIONS.map((section) =>
  //   section.id === "office-dynamic-emails" ? dynamicSection : section
  // );

  return {
    emailPreferences: emailPrefMap,
    officeDynamicEmails: settings?.officeDynamicEmails || [],
    // null rather than omitted, so a client can tell "no preference saved"
    // from "this server predates the field".
    language: settings?.language ?? null,
    currency: settings?.currency ?? null,
  };
}
