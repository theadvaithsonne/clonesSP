import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { Organization } from "../models/organization.model";
import { DomainPurchaseRequest } from "../models/domainPurchaseRequest.model";
import {
  namecomConfigured,
  namecomIsLive,
  checkAvailability,
  searchDomains,
} from "../services/namecom";
import { User } from "../models/user.model";
import { Email } from "../models/email.model";
import { env } from "../config/env";
import dns from "dns";
import { promisify } from "util";
import { exec } from "child_process";
import Imap from "imap";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import { DnsRecord } from "../types/mongoose";

// Folder name mappings - Mailcow/IMAP servers may use different names
const FOLDER_MAPPINGS: Record<string, string[]> = {
  "INBOX": ["INBOX"],
  "Sent": ["Sent", "INBOX.Sent", "Sent Messages", "Sent Items", "INBOX/Sent"],
  "Drafts": ["Drafts", "INBOX.Drafts", "Draft", "INBOX/Drafts"],
  "Junk": ["Junk", "INBOX.Junk", "Spam", "INBOX.Spam", "Junk E-mail", "INBOX/Junk", "INBOX/Spam"],
  "Trash": ["Trash", "INBOX.Trash", "Deleted", "Deleted Items", "INBOX/Trash", "Deleted Messages"],
  "Archive": ["Archive", "INBOX.Archive", "Archives", "INBOX/Archive", "All Mail"],
};

// Legacy - keeping for backwards compatibility
const SENT_FOLDER_NAMES = FOLDER_MAPPINGS["Sent"];

// Valid folder types
const VALID_FOLDERS = ["INBOX", "Sent", "Drafts", "Junk", "Trash", "Archive"];

// Helper to normalize folder name
function normalizeFolder(folder: string): string {
  if (VALID_FOLDERS.includes(folder)) {
    return folder;
  }
  // Try to match common variations
  const lowerFolder = folder.toLowerCase();
  if (lowerFolder === "inbox") return "INBOX";
  if (lowerFolder === "sent" || lowerFolder === "sent items") return "Sent";
  if (lowerFolder === "drafts" || lowerFolder === "draft") return "Drafts";
  if (lowerFolder === "junk" || lowerFolder === "spam") return "Junk";
  if (lowerFolder === "trash" || lowerFolder === "deleted") return "Trash";
  if (lowerFolder === "archive" || lowerFolder === "all mail") return "Archive";
  return "INBOX"; // Default to INBOX
}

const router = Router();

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);

// Mailcow API configuration
const MAILCOW_API_URL = env.MAILCOW_API_URL; // Base URL without /api/v1
const MAILCOW_API_KEY_READ = env.MAILCOW_API_KEY_READ; // Read-only key
const MAILCOW_API_KEY_WRITE = env.MAILCOW_API_KEY_WRITE; // Read-write key
const DEFAULT_DOMAIN = "networkmail.com";
const MAILCOW_IMAP_HOST = "mail.networkmail.com";
const MAILCOW_IMAP_PORT = 993;
const MAILCOW_SMTP_HOST = "mail.networkmail.com";
const MAILCOW_SMTP_PORT = 465; // SSL port (more reliable than 587 STARTTLS)
const MAILCOW_SMTP_SECURE = true; // Use SSL for port 465

// Mail Proxy API configuration (for when direct IMAP/SMTP is blocked)
const MAIL_PROXY_URL = env.MAIL_PROXY_URL;
const MAIL_PROXY_API_KEY = env.MAIL_PROXY_API_KEY;

// Helper to call mail proxy API
async function mailProxyRequest(endpoint: string, body: any): Promise<any> {
  if (!MAIL_PROXY_URL) {
    throw new Error("Mail proxy URL not configured");
  }

  console.log(`[Mail Proxy] Calling: POST ${MAIL_PROXY_URL}${endpoint}`);

  const response = await fetch(`${MAIL_PROXY_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": MAIL_PROXY_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`[Mail Proxy] Error:`, data);
    throw new Error(data.error || `Mail proxy error: ${response.status}`);
  }

  return data;
}

// Check if mail proxy is available
function useMailProxy(): boolean {
  return !!MAIL_PROXY_URL && !!MAIL_PROXY_API_KEY;
}

// Helper to check if user is founder of the organization
async function isFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const membership = user.organizations?.find(
    (m: any) => m.organization.toString() === orgId
  );

  return membership ? hasFounderAccess(membership) : false;
}

// Helper to check if user is a member (founder or stakeholder) of the organization
async function isMember(userId: string, orgId: string): Promise<{ isMember: boolean; role: string | null; fullAccess?: boolean }> {
  const user = await User.findById(userId);
  if (!user) return { isMember: false, role: null };

  const membership = user.organizations?.find(
    (m: any) => m.organization.toString() === orgId
  );

  if (!membership) return { isMember: false, role: null };
  return { isMember: true, role: membership.role, fullAccess: (membership as any).fullAccess };
}

// Helper to get user's active mailbox for an organization
async function getUserMailbox(userId: string, orgId: string): Promise<any> {
  const user = await User.findById(userId);
  if (!user) return null;

  // Get all mailboxes for this org
  const orgMailboxes = user.mailboxes?.filter(
    (m: any) => m.organization.toString() === orgId
  ) || [];

  if (orgMailboxes.length === 0) return null;

  // Return the active mailbox, or the first one if none is active
  const activeMailbox = orgMailboxes.find((m: any) => m.isActive);
  return activeMailbox || orgMailboxes[0];
}

// Mailcow API helper - uses appropriate key based on method
async function mailcowRequest(endpoint: string, method: string = "GET", body?: any) {
  // Use write key for POST/PUT/DELETE, read key for GET
  const apiKey = method === "GET" ? MAILCOW_API_KEY_READ : MAILCOW_API_KEY_WRITE;

  console.log(`[Mailcow API] Calling: ${method} ${MAILCOW_API_URL}${endpoint}`);
  console.log(`[Mailcow API] Using API key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  if (body) {
    console.log(`[Mailcow API] Request body:`, JSON.stringify(body, (key, value) =>
      key === 'password' || key === 'password2' ? '***' : value
    ));
  }

  const response = await fetch(`${MAILCOW_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();

  // Try to parse as JSON
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }

  console.log(`[Mailcow API] Response status: ${response.status}`);
  console.log(`[Mailcow API] Response body:`, responseData);

  // Check HTTP status
  if (!response.ok) {
    console.error(`[Mailcow API] HTTP error: ${response.status} - ${responseText}`);
    throw new Error(`Mailcow API error: ${response.status}`);
  }

  // Mailcow often returns 200 with error in body - check for that
  // Response format: [{"type":"success|error","msg":"..."}]
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstResult = responseData[0];
    if (firstResult.type === "error") {
      console.error(`[Mailcow API] Error in response:`, firstResult.msg);
      throw new Error(firstResult.msg || "Mailcow operation failed");
    }
  }

  return responseData;
}

// Get current domain configuration (accessible by all members)
router.get("/domain-config", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get user's own mailbox config
    const userMailbox = await getUserMailbox(me.userId, orgId);

    res.json({
      domainConfig: org.domainConfig || {
        type: "default",
dnsRecords: new mongoose.Types.DocumentArray([]),
      },
      // Return user's own mailbox config instead of org's founder mailbox
      mailboxConfig: userMailbox || {
        created: false,
      },
      // Also include role info so frontend knows what to show
      userRole: memberCheck.role,
      // For founders, indicate if domain is configured
      domainConfigured: !!(org.domainConfig?.customDomain),
    });
  } catch (error: any) {
    console.error("Error getting domain config:", error);
    res.status(500).json({ error: error.message });
  }
});

// Set domain type (default shourpan.com or custom)
router.post("/domain-config", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      type: z.enum(["default", "custom"]),
      customDomain: z.string().optional(),
    });

    const { orgId, type, customDomain } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can modify domain settings" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (type === "default") {
      // Use default shourpan.com domain - already configured in Mailcow
      org.domainConfig = {
        type: "default",
        customDomain: DEFAULT_DOMAIN,
        verified: true,
        domainAddedToMailcow: true,
        dnsRecords: new mongoose.Types.DocumentArray([]),
        verifiedAt: new Date(),
      };
    } else if (type === "custom" && customDomain) {
      // Generate DNS records for custom domain verification
      // These records need to be added by the user to their DNS
      org.domainConfig = {
        type: "custom",
        customDomain,
        verified: false,
        domainAddedToMailcow: false,
        dnsRecords: new mongoose.Types.DocumentArray([
          {
            type: "MX",
            name: customDomain,
            value: "mail.networkmail.com",
            priority: 10,
            verified: false,
          },
          {
            type: "TXT",
            name: customDomain,
            value: "v=spf1 mx a include:networkmail.com ~all",
            verified: false,
          },
          {
            type: "TXT",
            name: `_dmarc.${customDomain}`,
            value: "v=DMARC1; p=none; rua=mailto:dmarc@networkmail.com",
            verified: false,
          },
          {
            type: "CNAME",
            name: `autodiscover.${customDomain}`,
            value: "mail.networkmail.com",
            verified: false,
          },
          {
            type: "CNAME",
            name: `autoconfig.${customDomain}`,
            value: "mail.networkmail.com",
            verified: false,
          },
        ] as DnsRecord[]),
      };
    }

    await org.save();

    res.json({
      success: true,
      domainConfig: org.domainConfig,
    });
  } catch (error: any) {
    console.error("Error setting domain config:", error);
    res.status(500).json({ error: error.message });
  }
});

// Verify DNS records for custom domain
router.post("/verify-dns", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
    });

    const { orgId } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can verify DNS" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (!org.domainConfig || org.domainConfig.type !== "custom") {
      return res.status(400).json({ error: "No custom domain configured" });
    }

    const customDomain = org.domainConfig.customDomain;
    const dnsRecords = org.domainConfig.dnsRecords || [];
    let allVerified = true;

    console.log(`[DNS Verify] Checking domain: ${customDomain}`);
    console.log(`[DNS Verify] Records to check:`, dnsRecords.map((r: any) => r.type));

    for (const record of dnsRecords) {
      try {
        if (record.type === "MX") {
          console.log(`[DNS Verify] Checking MX for: ${customDomain}`);
          const mxRecords = await resolveMx(customDomain!);
          console.log(`[DNS Verify] MX records found:`, mxRecords);
          record.verified = mxRecords.some(
            (r: any) => r.exchange.toLowerCase().includes("networkmail.com")
          );
          console.log(`[DNS Verify] MX verified: ${record.verified}`);
        } else if (record.type === "TXT") {
          if (record.name && record.value) {
          const txtRecords = await resolveTxt(record.name);
          const flatRecords = txtRecords.flat();
          record.verified = flatRecords.some((r: string) =>
            r.includes(record.value!.substring(0, 20)) // Partial match for long TXT records
          );
        }
        } else if (record.type === "CNAME") {
          try {
            if (record.name) {
              const cnameRecords = await resolveCname(record.name);
              record.verified = cnameRecords.some(
                (r: string) => r.toLowerCase().includes("networkmail.com")
              );
            }
          } catch (e) {
            record.verified = false;
          }
        }
      } catch (dnsError) {
        console.log(`DNS lookup failed for ${record.name}:`, dnsError);
        record.verified = false;
      }

      if (!record.verified) {
        allVerified = false;
      }
    }

    // At minimum, MX record must be verified
    const mxVerified = dnsRecords.find((r: any) => r.type === "MX")?.verified || false;
    org.domainConfig.verified = mxVerified;

    if (mxVerified) {
      org.domainConfig.verifiedAt = new Date();
    }

    await org.save();

    res.json({
      success: true,
      allVerified,
      mxVerified,
      dnsRecords: org.domainConfig.dnsRecords,
    });
  } catch (error: any) {
    console.error("Error verifying DNS:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add custom domain to Mailcow
router.post("/add-domain-to-mailcow", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
    });

    const { orgId } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can add domain" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (!org.domainConfig?.verified) {
      return res.status(400).json({ error: "DNS must be verified first" });
    }

    const customDomain = org.domainConfig.customDomain;

    // Add domain to Mailcow using the official API endpoint
    try {
      await mailcowRequest("/api/v1/add/domain", "POST", {
        domain: customDomain,
        description: `Domain for org ${orgId}`,
        aliases: "400",
        mailboxes: "10",
        defquota: "3072", // 3GB default quota
        maxquota: "10240", // 10GB max quota
        quota: "10240",
        active: "1",
        restart_sogo: "1",
        backupmx: "0",
        relay_all_recipients: "0",
      });

      org.domainConfig.domainAddedToMailcow = true;
      await org.save();

      res.json({
        success: true,
        message: `Domain ${customDomain} added to mail server`,
      });
    } catch (mailcowError: any) {
      console.error("Mailcow error:", mailcowError);
      res.status(500).json({ error: "Failed to add domain to mail server" });
    }
  } catch (error: any) {
    console.error("Error adding domain:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create mailbox for any member (founder or stakeholder)
router.post("/create-mailbox", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      localPart: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/),
      password: z.string().min(8),
      name: z.string().optional(),
    });

    const { orgId, localPart, password, name } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    // Check if user is a member of the organization
    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user already has a mailbox for this org
    const existingMailbox = user.mailboxes?.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (existingMailbox?.created) {
      return res.status(400).json({ error: "You already have a mailbox for this organization" });
    }

    // For stakeholders, check if founder has configured the domain
    if (memberCheck.role === "stakeholder") {
      if (!org.domainConfig?.customDomain) {
        return res.status(400).json({
          error: "Domain not configured yet. Please wait for the founder to set up the domain."
        });
      }
    }

    // Determine which domain to use
    const domain = org.domainConfig?.customDomain || DEFAULT_DOMAIN;
    const email = `${localPart}@${domain}`;

    // Check if domain is ready (for custom domains)
    if (org.domainConfig?.type === "custom" && !org.domainConfig?.domainAddedToMailcow) {
      return res.status(400).json({
        error: "Custom domain must be added to mail server first"
      });
    }

    // Create mailbox in Mailcow using the official API endpoint
    try {
      console.log(`[Mailbox] Creating mailbox: ${localPart}@${domain}`);
      console.log(`[Mailbox] Mailcow URL: ${MAILCOW_API_URL}`);
      console.log(`[Mailbox] Using write API key: ${MAILCOW_API_KEY_WRITE ? 'SET' : 'NOT SET'}`);

      const mailcowResponse = await mailcowRequest("/api/v1/add/mailbox", "POST", {
        local_part: localPart,
        domain: domain,
        name: name || user.name || localPart,
        password: password,
        password2: password,
        quota: "3072", // 3GB
        active: "1",
        force_pw_update: "0",
        tls_enforce_in: "0",
        tls_enforce_out: "0",
      });

      console.log(`[Mailbox] Mailcow response:`, mailcowResponse);

      // Store mailbox config in User model
      const encodedPassword = Buffer.from(password).toString("base64");

      const mailboxData = {
        organization: orgId,
        created: true,
        email: email,
        localPart: localPart,
        domain: domain,
        credentials: encodedPassword,
        createdAt: new Date(),
      };

      // Update or add mailbox entry
      if (existingMailbox) {
        // Update existing entry
        const mailboxIndex = user.mailboxes.findIndex(
          (m: any) => m.organization.toString() === orgId
        );
        user.mailboxes[mailboxIndex] = mailboxData as any;
      } else {
        // Add new entry
        if (!user.mailboxes) {
          user.mailboxes = new mongoose.Types.DocumentArray([]);
        }
        user.mailboxes.push(mailboxData as any);
      }

      await user.save();

      // Also update org.mailboxConfig if this is the founder (for backward compatibility)
      if (hasFounderAccess(memberCheck)) {
        org.mailboxConfig = {
          created: true,
          email: email,
          localPart: localPart,
          domain: domain,
          credentials: encodedPassword,
          createdAt: new Date(),
          founderUserId: new mongoose.Types.ObjectId(me.userId),
        };
        await org.save();
      }

      res.json({
        success: true,
        email: email,
        message: `Mailbox ${email} created successfully`,
      });
    } catch (mailcowError: any) {
      console.error("Mailcow mailbox error:", mailcowError);
      console.error("Mailcow mailbox error message:", mailcowError.message);
      res.status(500).json({
        error: mailcowError.message || "Failed to create mailbox",
        details: "Check server logs for more details"
      });
    }
  } catch (error: any) {
    console.error("Error creating mailbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// Save mailbox config to database (when mailbox is created directly via Mailcow API from frontend)
router.post("/save-mailbox", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      localPart: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    });

    const { orgId, localPart, email, password } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    // Check if user is a member of the organization
    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Extract domain from email
    const domain = email.split("@")[1] || DEFAULT_DOMAIN;

    // Store mailbox config in User model
    const encodedPassword = Buffer.from(password).toString("base64");

    const mailboxData = {
      organization: orgId,
      created: true,
      email: email,
      localPart: localPart,
      domain: domain,
      credentials: encodedPassword,
      createdAt: new Date(),
    };

    // Check if user already has a mailbox for this org
    const existingMailbox = user.mailboxes?.find(
      (m: any) => m.organization.toString() === orgId
    );

    // Update or add mailbox entry
    if (existingMailbox) {
      const mailboxIndex = user.mailboxes.findIndex(
        (m: any) => m.organization.toString() === orgId
      );
      user.mailboxes[mailboxIndex] = mailboxData as any;
    } else {
      if (!user.mailboxes) {
        user.mailboxes = new mongoose.Types.DocumentArray([]);
      }
      user.mailboxes.push(mailboxData as any);
    }

    await user.save();

    // Also update org.mailboxConfig if this is the founder (for backward compatibility)
    if (hasFounderAccess(memberCheck)) {
      org.mailboxConfig = {
        created: true,
        email: email,
        localPart: localPart,
        domain: domain,
        credentials: encodedPassword,
        createdAt: new Date(),
        founderUserId: new mongoose.Types.ObjectId(me.userId),
      };
      await org.save();
    }

    console.log(`[SaveMailbox] Saved mailbox config for ${email} to database`);

    res.json({
      success: true,
      email: email,
      message: `Mailbox config saved successfully`,
    });
  } catch (error: any) {
    console.error("Error saving mailbox config:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all user's mailboxes for an organization
router.get("/user-mailboxes", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all mailboxes for this org
    const mailboxes = user.mailboxes?.filter(
      (m: any) => m.organization.toString() === orgId
    ) || [];

    res.json({
      success: true,
      mailboxes: mailboxes.map((m: any) => ({
        email: m.email,
        localPart: m.localPart,
        domain: m.domain,
        created: m.created,
        createdAt: m.createdAt,
        isActive: m.isActive || false,
      })),
    });
  } catch (error: any) {
    console.error("Error getting user mailboxes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new mailbox to user's account (after creating in Mailcow)
router.post("/add-user-mailbox", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      email: z.string().email(),
      localPart: z.string().min(1),
      domain: z.string().min(1),
      password: z.string().min(1),
    });

    const { orgId, email, localPart, domain, password } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if this mailbox already exists for the user
    const existingMailbox = user.mailboxes?.find(
      (m: any) => m.email === email && m.organization.toString() === orgId
    );

    if (existingMailbox) {
      return res.status(400).json({ error: "This mailbox is already in your account" });
    }

    // Add the mailbox to user's account
    const encodedPassword = Buffer.from(password).toString("base64");
    const mailboxData = {
      organization: orgId,
      created: true,
      email: email,
      localPart: localPart,
      domain: domain,
      credentials: encodedPassword,
      createdAt: new Date(),
      isActive: false,
    };

    if (!user.mailboxes) {
      user.mailboxes = new mongoose.Types.DocumentArray([]);
    }
    user.mailboxes.push(mailboxData as any);
    await user.save();

    console.log(`[AddMailbox] Added mailbox ${email} to user account`);

    res.json({
      success: true,
      email: email,
      message: `Mailbox ${email} added to your account`,
    });
  } catch (error: any) {
    console.error("Error adding user mailbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// Switch active mailbox
router.post("/switch-mailbox", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      email: z.string().email(),
    });

    const { orgId, email } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the mailbox to switch to
    const targetMailbox = user.mailboxes?.find(
      (m: any) => m.email === email && m.organization.toString() === orgId
    );

    if (!targetMailbox) {
      return res.status(404).json({ error: "Mailbox not found in your account" });
    }

    // Update all mailboxes for this org - set isActive
    console.log(`[SwitchMailbox] Before update:`, user.mailboxes?.map((m: any) => ({ email: m.email, isActive: m.isActive })));

    user.mailboxes?.forEach((m: any) => {
      if (m.organization.toString() === orgId) {
        m.isActive = m.email === email;
      }
    });

    console.log(`[SwitchMailbox] After update:`, user.mailboxes?.map((m: any) => ({ email: m.email, isActive: m.isActive })));

    await user.save();

    // Verify the save worked
    const verifyUser = await User.findById(me.userId);
    console.log(`[SwitchMailbox] After save (verify):`, verifyUser?.mailboxes?.map((m: any) => ({ email: m.email, isActive: m.isActive })));

    console.log(`[SwitchMailbox] Switched to mailbox ${email}`);

    res.json({
      success: true,
      email: email,
      mailboxConfig: {
        created: targetMailbox.created,
        email: targetMailbox.email,
        localPart: targetMailbox.localPart,
        domain: targetMailbox.domain,
      },
    });
  } catch (error: any) {
    console.error("Error switching mailbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get emails from database (cached)
router.get("/emails", requireAuth, async (req, res) => {
  try {
    const { orgId, folder = "INBOX", limit = 50, skip = 0 } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Normalize folder name
    const normalizedFolder = normalizeFolder(folder as string);

    // Get emails from database
    const emails = await Email.find({
      user: me.userId,
      organization: orgId,
      folder: normalizedFolder,
    })
      .sort({ date: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await Email.countDocuments({
      user: me.userId,
      organization: orgId,
      folder: normalizedFolder,
    });

    res.json({
      success: true,
      emails,
      total,
      folder: normalizedFolder,
    });
  } catch (error: any) {
    console.error("Error getting emails:", error);
    res.status(500).json({ error: error.message });
  }
});

// Sync emails from IMAP server (fetch new emails and store in DB)
router.post("/sync-emails", requireAuth, async (req, res) => {
  try {
    const { orgId, folder = "INBOX", forceRefresh = false } = req.body;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Get user's ACTIVE mailbox (uses isActive flag)
    const user = await User.findById(me.userId);
    const allMailboxes = user?.mailboxes?.filter((m: any) => m.organization.toString() === orgId) || [];
    console.log(`[IMAP Sync] All mailboxes for org:`, allMailboxes.map((m: any) => ({ email: m.email, isActive: m.isActive })));

    const userMailbox = await getUserMailbox(me.userId, orgId);
    console.log(`[IMAP Sync] Selected mailbox:`, userMailbox?.email, `isActive:`, userMailbox?.isActive);

    if (!userMailbox?.created) {
      return res.status(400).json({ error: "You don't have a mailbox yet. Please create one first." });
    }

    const email = userMailbox.email;
    if (!email) {
      return res.status(400).json({ error: "Email not found for this mailbox" });
    }
    const password = "Test@123"; // Hardcoded for testing
    // const password = userMailbox.credentials ? Buffer.from(userMailbox.credentials, "base64").toString() : "";
    if (!password) {
      return res.status(400).json({ error: "Credentials not found for this mailbox" });
    }

    console.log(`[IMAP Sync] Attempting to connect as: ${email}`);
    console.log(`[IMAP Sync] Password length: ${password.length} chars hi`);
    console.log(`[IMAP Sync] Using mail proxy: ${useMailProxy()}`);

    // Normalize folder name
    const normalizedFolder = normalizeFolder(folder);

    // If forceRefresh, always fetch all emails (set lastUid to 0)
    // Otherwise, only fetch emails newer than what we have
    let lastUid = 0;
    if (!forceRefresh) {
      const lastEmail = await Email.findOne({
        user: me.userId,
        organization: orgId,
        folder: normalizedFolder,
      }).sort({ uid: -1 });
      lastUid = lastEmail?.uid || 0;
    }

    // Fetch emails - use proxy if available, otherwise direct IMAP
    let newEmails: any[] = [];
    if (useMailProxy()) {
      // Use mail proxy API
      console.log(`[IMAP Sync] Using mail proxy to fetch emails`);
      const proxyResult = await mailProxyRequest("/fetch-emails", {
        email,
        password,
        folder: normalizedFolder,
        limit: 100,
      });

      // Store fetched emails in database
      for (const emailData of proxyResult.emails || []) {
        try {
          await Email.findOneAndUpdate(
            {
              user: me.userId,
              organization: orgId,
              mailbox: email,
              messageId: emailData.messageId || `${emailData.uid}-${emailData.date}`,
            },
            {
              user: me.userId,
              organization: orgId,
              mailbox: email,
              folder: normalizedFolder,
              messageId: emailData.messageId || `${emailData.uid}-${emailData.date}`,
              uid: emailData.uid || emailData.seqno,
              seqno: emailData.seqno,
              subject: emailData.subject,
              from: emailData.from,
              to: emailData.to,
              date: new Date(emailData.date),
              text: emailData.text,
              html: emailData.html || "",
              hasHtml: emailData.hasHtml,
              attachments: emailData.attachments || 0,
              flags: emailData.flags || [],
            },
            { upsert: true, new: true }
          );
          newEmails.push(emailData);
        } catch (dbErr) {
          console.error("Error storing email:", dbErr);
        }
      }
    } else {
      // Use direct IMAP connection
      console.log(`[IMAP Sync] Using direct IMAP connection`);
      console.log(`[IMAP Sync] IMAP Host: ${MAILCOW_IMAP_HOST}:${MAILCOW_IMAP_PORT}`);
      newEmails = await fetchEmailsFromImap(
        email,
        password,
        normalizedFolder,
        100, // Fetch up to 100 emails
        lastUid,
        me.userId,
        orgId
      );
    }

    // Get updated email list from DB
    const emails = await Email.find({
      user: me.userId,
      organization: orgId,
      folder: normalizedFolder,
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      newCount: newEmails.length,
      emails,
      folder: normalizedFolder,
    });
  } catch (error: any) {
    console.error("Error syncing emails:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch emails from mailbox (works for any member with a mailbox) - Legacy endpoint
router.get("/fetch-inbox", requireAuth, async (req, res) => {
  try {
    const { orgId, folder = "INBOX", limit = 50 } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Get user's ACTIVE mailbox (uses isActive flag)
    const userMailbox = await getUserMailbox(me.userId, orgId);

    if (!userMailbox?.created) {
      return res.status(400).json({ error: "You don't have a mailbox yet. Please create one first." });
    }

    const email = userMailbox.email;
    if (!email) {
      return res.status(400).json({ error: "Email not found for this mailbox" });
    }
    const password = "Test@123"; // Hardcoded for testing
    // const password = userMailbox.credentials ? Buffer.from(userMailbox.credentials, "base64").toString() : "";
    if (!password) {
      return res.status(400).json({ error: "Credentials not found for this mailbox" });
    }

    // Normalize folder name
    const normalizedFolder = normalizeFolder(folder as string);

    // Fetch and store emails - use proxy if available
    if (useMailProxy()) {
      console.log(`[IMAP] Using mail proxy to fetch emails`);
      const proxyResult = await mailProxyRequest("/fetch-emails", {
        email,
        password,
        folder: normalizedFolder,
        limit: Number(limit),
      });

      // Store fetched emails in database
      for (const emailData of proxyResult.emails || []) {
        try {
          await Email.findOneAndUpdate(
            {
              user: me.userId,
              organization: orgId,
              mailbox: email,
              messageId: emailData.messageId || `${emailData.uid}-${emailData.date}`,
            },
            {
              user: me.userId,
              organization: orgId,
              mailbox: email,
              folder: normalizedFolder,
              messageId: emailData.messageId || `${emailData.uid}-${emailData.date}`,
              uid: emailData.uid || emailData.seqno,
              seqno: emailData.seqno,
              subject: emailData.subject,
              from: emailData.from,
              to: emailData.to,
              date: new Date(emailData.date),
              text: emailData.text,
              html: emailData.html || "",
              hasHtml: emailData.hasHtml,
              attachments: emailData.attachments || 0,
              flags: emailData.flags || [],
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error("Error storing email:", dbErr);
        }
      }
    } else {
      console.log(`[IMAP] Using direct IMAP connection`);
      await fetchEmailsFromImap(
        email,
        password,
        normalizedFolder,
        Number(limit),
        0,
        me.userId,
        orgId
      );
    }

    // Get from database (which now has the emails)
    const storedEmails = await Email.find({
      user: me.userId,
      organization: orgId,
      folder: normalizedFolder,
    })
      .sort({ date: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      emails: storedEmails,
      mailbox: email,
      folder: normalizedFolder,
    });
  } catch (error: any) {
    console.error("Error fetching inbox:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to find the correct folder name
async function findFolderName(imap: any, targetFolder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    imap.getBoxes((err: any, boxes: any) => {
      if (err) return reject(err);

      const folderNames: string[] = [];
      const extractFolders = (boxes: any, prefix = "") => {
        for (const name in boxes) {
          const fullName = prefix ? `${prefix}${boxes[name].delimiter || "/"}${name}` : name;
          folderNames.push(fullName);
          if (boxes[name].children) {
            extractFolders(boxes[name].children, fullName);
          }
        }
      };
      extractFolders(boxes);

      console.log("[IMAP] Available folders:", folderNames);

      if (targetFolder === "INBOX") {
        resolve("INBOX");
        return;
      }

      // Get possible folder names from mappings
      const possibleNames = FOLDER_MAPPINGS[targetFolder] || [targetFolder];

      // Try to find the folder with different names
      for (const folderName of possibleNames) {
        const found = folderNames.find(f =>
          f.toLowerCase() === folderName.toLowerCase() ||
          f.toLowerCase().endsWith(folderName.toLowerCase())
        );
        if (found) {
          console.log(`[IMAP] Found ${targetFolder} folder as: ${found}`);
          resolve(found);
          return;
        }
      }

      // Default to the target folder name if nothing found
      console.log(`[IMAP] No ${targetFolder} folder found, trying '${targetFolder}'`);
      resolve(targetFolder);
    });
  });
}

// Helper function to fetch emails via IMAP and store in DB
async function fetchEmailsFromImap(
  emailAddress: string,
  password: string,
  folder: string,
  limit: number,
  afterUid: number = 0,
  userId?: string,
  orgId?: string
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: emailAddress,
      password: password,
      host: MAILCOW_IMAP_HOST,
      port: MAILCOW_IMAP_PORT,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails: any[] = [];

    imap.once("ready", async () => {
      try {
        // Find the correct folder name
        const actualFolder = await findFolderName(imap, folder);
        console.log(`[IMAP] Opening folder: ${actualFolder}`);

        imap.openBox(actualFolder, true, async (err, box) => {
          if (err) {
            console.error(`[IMAP] Error opening folder ${actualFolder}:`, err.message);
            imap.end();
            return reject(err);
          }

          console.log(`[IMAP] Folder ${actualFolder} opened, total messages: ${box.messages.total}`);

          const totalMessages = box.messages.total;
          if (totalMessages === 0) {
            imap.end();
            return resolve([]);
          }

          // Fetch last N messages
          const start = Math.max(1, totalMessages - limit + 1);
          const range = `${start}:${totalMessages}`;

          const fetch = imap.seq.fetch(range, {
            bodies: "",
            struct: true,
          });

          const parsePromises: Promise<any>[] = [];

          fetch.on("message", (msg, seqno) => {
            let emailData: any = { seqno };
            let bodyBuffer = "";

            const parsePromise = new Promise<void>((resolveMsg) => {
              msg.on("body", (stream, info) => {
                stream.on("data", (chunk) => {
                  bodyBuffer += chunk.toString("utf8");
                });
              });

              msg.once("attributes", (attrs) => {
                emailData.flags = attrs.flags;
                emailData.uid = attrs.uid;
              });

              msg.once("end", async () => {
                try {
                  if (bodyBuffer) {
                    const parsed = await simpleParser(bodyBuffer);
                    emailData.messageId = parsed.messageId;
                    emailData.subject = parsed.subject || "";
                    emailData.from = parsed.from?.text || "";
                    emailData.to = Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : (parsed.to?.text || "");
                    emailData.cc = Array.isArray(parsed.cc) ? parsed.cc.map(t => t.text).join(', ') : (parsed.cc?.text || "");
                    emailData.date = parsed.date;
                    emailData.text = parsed.text || "";
                    emailData.html = parsed.html || "";
                    emailData.hasHtml = !!parsed.html;
                    emailData.attachments = parsed.attachments?.length || 0;
                    emailData.isRead = emailData.flags?.includes('\\Seen') || false;
                  }
                } catch (parseErr) {
                  console.error("Email parse error:", parseErr);
                }

                // Store in database if userId and orgId provided
                if (userId && orgId && emailData.uid) {
                  try {
                    // Skip if we already have this email
                    if (afterUid > 0 && emailData.uid <= afterUid) {
                      resolveMsg();
                      return;
                    }

                    // Upsert email into database
                    await Email.findOneAndUpdate(
                      {
                        user: userId,
                        organization: orgId,
                        folder: folder,
                        uid: emailData.uid,
                      },
                      {
                        user: userId,
                        organization: orgId,
                        mailbox: emailAddress,
                        folder: folder,
                        messageId: emailData.messageId,
                        uid: emailData.uid,
                        seqno: emailData.seqno,
                        subject: emailData.subject,
                        from: emailData.from,
                        to: emailData.to,
                        cc: emailData.cc,
                        date: emailData.date,
                        text: emailData.text,
                        html: emailData.html,
                        hasHtml: emailData.hasHtml,
                        attachments: emailData.attachments,
                        flags: emailData.flags || [],
                        isRead: emailData.isRead,
                      },
                      { upsert: true, new: true }
                    );
                  } catch (dbErr) {
                    console.error("Error storing email in DB:", dbErr);
                  }
                }

                emails.push(emailData);
                resolveMsg();
              });
            });

            parsePromises.push(parsePromise);
          });

          fetch.once("error", (err) => {
            console.error("[IMAP] Fetch error:", err);
            imap.end();
            reject(err);
          });

          fetch.once("end", async () => {
            // Wait for all emails to be parsed
            await Promise.all(parsePromises);
            imap.end();
            // Sort by date descending (newest first)
            emails.sort((a, b) => {
              const dateA = new Date(a.date || 0).getTime();
              const dateB = new Date(b.date || 0).getTime();
              return dateB - dateA;
            });
            console.log(`[IMAP] Fetched ${emails.length} emails from ${actualFolder}`);
            resolve(emails);
          });
        });
      } catch (folderErr) {
        console.error("[IMAP] Error finding folder:", folderErr);
        imap.end();
        reject(folderErr);
      }
    });

    imap.once("error", (err: any) => {
      console.error("[IMAP] Connection error:", err);
      reject(err);
    });

    // Handle socket errors to prevent crashes
    imap.once("close", (hadError: boolean) => {
      if (hadError) {
        console.error("[IMAP] Connection closed with error");
      }
    });

    try {
      imap.connect();
    } catch (connectErr) {
      console.error("[IMAP] Connect error:", connectErr);
      reject(connectErr);
    }
  });
}

// Get mailbox folders (works for any member with a mailbox)
router.get("/folders", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Get user's mailbox
    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userMailbox = user.mailboxes?.find(
      (m: any) => m.organization.toString() === orgId
    );

    if (!userMailbox?.created) {
      return res.status(400).json({ error: "You don't have a mailbox yet" });
    }

    const email = userMailbox.email;
    if(!email) {
      return res.status(400).json({ error: "Email not found for this mailbox" });
    }
    const password = userMailbox.credentials ? Buffer.from(userMailbox.credentials, "base64").toString() : "";
    if(!password) {
      return res.status(400).json({ error: "Credentials not found for this mailbox" });
    }

    const folders = await getImapFolders(email, password);

    res.json({ success: true, folders });
  } catch (error: any) {
    console.error("Error getting folders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to get IMAP folders
async function getImapFolders(email: string, password: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: password,
      host: MAILCOW_IMAP_HOST,
      port: MAILCOW_IMAP_PORT,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const folderNames: string[] = [];
        const extractFolders = (boxes: any, prefix = "") => {
          for (const name in boxes) {
            const fullName = prefix ? `${prefix}/${name}` : name;
            folderNames.push(fullName);
            if (boxes[name].children) {
              extractFolders(boxes[name].children, fullName);
            }
          }
        };
        extractFolders(boxes);

        imap.end();
        resolve(folderNames);
      });
    });

    imap.once("error", (err: any) => {
      reject(err);
    });

    // Handle socket errors to prevent crashes
    imap.once("close", (hadError: boolean) => {
      if (hadError) {
        console.error("[IMAP] Folder fetch connection closed with error");
      }
    });

    try {
      imap.connect();
    } catch (connectErr) {
      console.error("[IMAP] Folder fetch connect error:", connectErr);
      reject(connectErr);
    }
  });
}

// Get setup status overview (works for all members)
router.get("/status", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const me = (req as any).user as { userId: string };

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get user's mailbox
    const userMailbox = await getUserMailbox(me.userId, orgId);

    const domainType = org.domainConfig?.type || "default";
    const domainVerified = org.domainConfig?.verified || false;
    const domainAddedToMailcow = org.domainConfig?.domainAddedToMailcow || false;
    const domainConfigured = !!(org.domainConfig?.customDomain);
    const mailboxCreated = userMailbox?.created || false;

    // Determine current step based on role
    let currentStep = 1;
    let totalSteps = 2; // For stakeholders: just create mailbox + inbox

    if (hasFounderAccess(memberCheck)) {
      // Founder flow: domain config + mailbox creation
      totalSteps = domainType === "default" ? 3 : 5;
      if (domainType === "default") {
        currentStep = mailboxCreated ? 3 : domainConfigured ? 2 : 1;
      } else {
        if (!domainConfigured) currentStep = 1;
        else if (!domainVerified) currentStep = 2;
        else if (!domainAddedToMailcow) currentStep = 3;
        else if (!mailboxCreated) currentStep = 4;
        else currentStep = 5;
      }
    } else {
      // Stakeholder flow: just mailbox creation (if domain is configured)
      totalSteps = 2;
      if (!domainConfigured) {
        currentStep = 0; // Waiting for founder
      } else {
        currentStep = mailboxCreated ? 2 : 1;
      }
    }

    res.json({
      organization: {
        name: org.name,
        id: org._id,
      },
      setupStatus: {
        domainType,
        customDomain: org.domainConfig?.customDomain,
        domainVerified,
        domainAddedToMailcow,
        domainConfigured,
        mailboxCreated,
        mailboxEmail: userMailbox?.email,
        currentStep,
        totalSteps,
      },
      userRole: memberCheck.role,
    });
  } catch (error: any) {
    console.error("Error getting setup status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset domain configuration (only if mailbox not created)
router.post("/reset-domain-config", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
    });

    const { orgId } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can reset domain config" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Cannot reset if mailbox is already created
    if (org.mailboxConfig?.created) {
      return res.status(400).json({
        error: "Cannot reset domain configuration after mailbox is created",
      });
    }

    // Reset domain config
    org.domainConfig = undefined;
    await org.save();

    res.json({
      success: true,
      message: "Domain configuration reset successfully",
    });
  } catch (error: any) {
    console.error("Error resetting domain config:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send email via SMTP (works for any member with a mailbox)
router.post("/send-email", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      to: z.string().email().or(z.array(z.string().email())), // Single email or array
      subject: z.string().min(1),
      body: z.string().min(1),
      cc: z.string().email().or(z.array(z.string().email())).optional(),
      bcc: z.string().email().or(z.array(z.string().email())).optional(),
      isHtml: z.boolean().optional().default(false),
    });

    const { orgId, to, subject, body, cc, bcc, isHtml } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Get user's mailbox
    const user = await User.findById(me.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userMailbox = user.mailboxes?.find(
      (m: any) => m.organization.toString() === orgId
    );

    if (!userMailbox?.created) {
      return res.status(400).json({ error: "You don't have a mailbox yet. Please create one first." });
    }

    const email = userMailbox.email;
    if(!email) {
      return res.status(400).json({ error: "Email not found for this mailbox" });
    }
    const password = userMailbox.credentials ? Buffer.from(userMailbox.credentials, "base64").toString() : "";
    if(!password) {
      return res.status(400).json({ error: "Credentials not found for this mailbox" });
    }

    let messageId: string;

    // Send email - use proxy if available, otherwise direct SMTP
    if (useMailProxy()) {
      // Use mail proxy API
      console.log(`[SMTP] Using mail proxy to send email`);
      const proxyResult = await mailProxyRequest("/send-email", {
        email,
        password,
        to: Array.isArray(to) ? to : [to],
        subject,
        body,
        cc,
        bcc,
        isHtml,
        fromName: user.name || email,
      });
      messageId = proxyResult.messageId;
    } else {
      // Use direct SMTP connection
      console.log(`[SMTP] Using direct SMTP connection`);

      const transporter = nodemailer.createTransport({
          host: MAILCOW_SMTP_HOST,
          port: MAILCOW_SMTP_PORT,
          secure: MAILCOW_SMTP_SECURE, // Use SSL for port 465
          auth: {
              user: email,
              pass: password,
          },
          tls: {
              rejectUnauthorized: false, // Allow self-signed certificates
          },
          connectionTimeout: 30000, // 30 seconds timeout
          greetingTimeout: 15000,
          socketTimeout: 30000,
      } as nodemailer.TransportOptions);

      // Prepare email options
      const mail_options: any = {
        from: `${user.name || email} <${email}>`,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject: subject,
      };

      // Set body as HTML or plain text
      if (isHtml) {
        mail_options.html = body;
      } else {
        mail_options.text = body;
      }

      // Add CC if provided
      if (cc) {
        mail_options.cc = Array.isArray(cc) ? cc.join(", ") : cc;
      }

      // Add BCC if provided
      if (bcc) {
        mail_options.bcc = Array.isArray(bcc) ? bcc.join(", ") : bcc;
      }

      // Send email
      const info = await transporter.sendMail(mail_options);
      messageId = info.messageId;
    }

    console.log(`[Email Sent] From: ${email}, To: ${to}, Subject: ${subject}, MessageId: ${messageId}`);

    // Store sent email in database
    try {
      const toAddress = Array.isArray(to) ? to.join(", ") : to;
      await Email.create({
        user: me.userId,
        organization: orgId,
        mailbox: email,
        folder: "Sent",
        messageId: messageId,
        uid: Date.now(), // Use timestamp as UID for locally sent emails
        seqno: 0,
        subject: subject,
        from: `${user.name || email} <${email}>`,
        to: toAddress,
        cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : "",
        date: new Date(),
        text: isHtml ? "" : body,
        html: isHtml ? body : "",
        hasHtml: isHtml,
        attachments: 0,
        flags: ["\\Seen"],
        isRead: true,
      });
      console.log(`[Email Stored] Sent email stored in database`);
    } catch (dbErr) {
      console.error("Error storing sent email in DB:", dbErr);
      // Don't fail the request if DB storage fails
    }

    res.json({
      success: true,
      messageId: messageId,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});


// ============================================
// Custom App Domain Management (White-label)
// ============================================

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
// The shop runs as a SEPARATE Vercel project from the office app, so a
// shop domain must be attached there — adding it to the office project
// would serve the office UI on shop.<domain>. Unset ⇒ shop domains are
// stored and DNS is issued, but the Vercel attach is skipped (same
// degrade-quietly behaviour as an unconfigured VERCEL_PROJECT_ID).
const VERCEL_STORE_PROJECT_ID = process.env.VERCEL_STORE_PROJECT_ID;
// MyCryptoBrand's investor site (hyfi.mycryptobrand.com,
// my-crypto-brand-web-app-nextjs-v1) is its own Vercel project too. A domain a
// founder links from the MyCryptoBrand founder site must land there — on the
// office project it would serve my.garage.app's UI. Unset ⇒ same quiet skip.
const VERCEL_CRYPTOBRAND_PROJECT_ID = process.env.VERCEL_CRYPTOBRAND_PROJECT_ID;
// The OTC desk (otc.mycryptobrand.com, garage-otc-buyer) is a third separate
// project, linked from the same MyCryptoBrand founder site as the investor
// site. Unset ⇒ same quiet skip.
const VERCEL_OTC_PROJECT_ID = process.env.VERCEL_OTC_PROJECT_ID;
/**
 * Per-kind Vercel team, for a project that lives outside the office app's team.
 *
 * The OTC desk is in the `garage-university` team while the office app is in
 * another, and a project-scoped call carrying the wrong team (or none, which
 * means the personal account) cannot see it — the attach fails with "project
 * not found" even though the id is right. Unset ⇒ falls back to
 * VERCEL_TEAM_ID, so nothing changes for anyone already working.
 *
 * Accepts either a team id (`team_…`) or a team slug (`garage-university`);
 * Vercel takes the first as `teamId` and the second as `slug`.
 */
const VERCEL_OTC_TEAM_ID = process.env.VERCEL_OTC_TEAM_ID;
const VERCEL_STORE_TEAM_ID = process.env.VERCEL_STORE_TEAM_ID;
const VERCEL_CRYPTOBRAND_TEAM_ID = process.env.VERCEL_CRYPTOBRAND_TEAM_ID;

/**
 * Which Vercel project a custom domain attaches to.
 *
 * "shop" is the storefront project; "cryptobrand" is the MyCryptoBrand
 * investor site; "otc" is the OTC desk; "app" and "event" are both the office
 * app — an event's public page is a route inside it, so it needs no project of
 * its own, only its own kind so the two can be told apart when listing.
 */
export type DomainKind = "app" | "shop" | "event" | "cryptobrand" | "otc";

function vercelProjectFor(kind: DomainKind): string | undefined {
  if (kind === "shop") return VERCEL_STORE_PROJECT_ID;
  if (kind === "cryptobrand") return VERCEL_CRYPTOBRAND_PROJECT_ID;
  if (kind === "otc") return VERCEL_OTC_PROJECT_ID;
  return VERCEL_PROJECT_ID;
}

/** The team that owns this kind's project, falling back to the shared one. */
function vercelTeamFor(kind: DomainKind): string | undefined {
  if (kind === "shop") return VERCEL_STORE_TEAM_ID || VERCEL_TEAM_ID;
  if (kind === "cryptobrand") return VERCEL_CRYPTOBRAND_TEAM_ID || VERCEL_TEAM_ID;
  if (kind === "otc") return VERCEL_OTC_TEAM_ID || VERCEL_TEAM_ID;
  return VERCEL_TEAM_ID;
}

/** `?teamId=team_x` for an id, `?slug=my-team` for a slug, `""` for neither. */
function vercelScopeQuery(team: string | undefined): string {
  if (!team) return "";
  return team.startsWith("team_")
    ? `?teamId=${encodeURIComponent(team)}`
    : `?slug=${encodeURIComponent(team)}`;
}

export async function addDomainToVercel(
  domain: string,
  kind: DomainKind = "app",
): Promise<{ success: boolean; error?: string; vercelConfig?: any }> {
  const projectId = vercelProjectFor(kind);
  if (!VERCEL_TOKEN || !projectId) {
    console.log(`[Vercel] Not configured for ${kind}, skipping`);
    return { success: true };
  }
  try {
    const url = `https://api.vercel.com/v10/projects/${projectId}/domains${vercelScopeQuery(
      vercelTeamFor(kind),
    )}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    });
    const data = await response.json();
    if (!response.ok) {
      // Vercel returns 409 `domain_already_in_use` even when the domain is
      // already attached to OUR OWN project — typical when an org was
      // deleted locally without cleaning Vercel, when a previous attempt
      // wrote to Vercel but failed to persist to Mongo, or when a founder
      // added the domain via the Vercel dashboard first. The domain is
      // already correctly configured on the platform, so treat the
      // same-project case as success and pass the existing config back so
      // the route can extract verification records as usual.
      // A different-project conflict is still a real error — the founder
      // genuinely can't have it on this project.
      if (
        data?.error?.code === "domain_already_in_use" &&
        // The project this kind attaches to, not always the office one —
        // re-adding a shop or cryptobrand domain already on its own project
        // is the same harmless case.
        data.error?.domain?.projectId === projectId
      ) {
        console.log(
          `[Vercel] Domain ${domain} already on this project — treating as success`,
        );
        return { success: true, vercelConfig: data.error.domain };
      }
      console.error(`[Vercel] Error adding ${domain}:`, data);
      return { success: false, error: data.error?.message || "Failed" };
    }
    console.log(`[Vercel] Added domain ${domain}`);
    return { success: true, vercelConfig: data };
  } catch (error: any) {
    console.error(`[Vercel] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// `kind` must match the kind the domain was ADDED with, or this deletes
// nothing: the domain only exists on that kind's project.
export async function removeDomainFromVercel(
  domain: string,
  kind: DomainKind = "app",
): Promise<void> {
  const projectId = vercelProjectFor(kind);
  if (!VERCEL_TOKEN || !projectId) return;
  try {
    const url = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}`;
    await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    console.log(`[Vercel] Removed domain ${domain}`);
  } catch (e) {
    console.error("[Vercel] Error removing domain");
  }
}

interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

// `kind` must match the kind the domain was ADDED with. Asking the office
// project about a cryptobrand/shop domain 404s, which this reads as
// `verified: false` — the domain then shows "Pending / Not detected" in the
// founder UI forever, even while it is live and serving.
/**
 * Ask Vercel to RUN the ownership check, rather than just reading its result.
 *
 * A subdomain added to a project Vercel cannot already prove you own sits at
 * `pending_domain_verification` until something calls this. Vercel does not
 * re-poll the `_vercel` TXT on its own, so a founder could add the record,
 * see it resolve worldwide, and still be told "Not detected" forever — which
 * is exactly what happened to the first OTC domain.
 *
 * Idempotent: on an already-verified domain it returns the same verified
 * state. Errors are swallowed; the caller falls back to reading the status,
 * so a Vercel hiccup leaves the old behaviour rather than failing the poll.
 */
async function verifyDomainOnVercel(
  domain: string,
  kind: DomainKind = "app",
): Promise<{ verified: boolean; verification?: VercelVerification[] } | null> {
  const projectId = vercelProjectFor(kind);
  if (!VERCEL_TOKEN || !projectId) return null;
  try {
    const url = `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}/verify${vercelScopeQuery(
      vercelTeamFor(kind),
    )}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      verified: data.verified === true,
      verification: Array.isArray(data.verification) ? data.verification : [],
    };
  } catch {
    return null;
  }
}

export async function getDomainFromVercel(
  domain: string,
  kind: DomainKind = "app",
): Promise<{ verified: boolean; verification?: VercelVerification[] }> {
  const projectId = vercelProjectFor(kind);
  if (!VERCEL_TOKEN || !projectId) return { verified: false };
  try {
    const url = `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}${vercelScopeQuery(
      vercelTeamFor(kind),
    )}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    if (!response.ok) return { verified: false };
    const data = await response.json();
    return {
      verified: data.verified === true,
      verification: Array.isArray(data.verification) ? data.verification : [],
    };
  } catch {
    return { verified: false };
  }
}

// Vercel sometimes returns a TXT challenge at `_vercel.<apex>` to prove
// ownership of the apex (happens when the apex is registered on a
// different Vercel team). The founder needs to add this record in DNS
// or the subdomain never verifies. Map Vercel's `verification[]` shape
// onto our internal dnsRecord shape so the UI can render it next to
// the A/CNAME records.
export function verificationToDnsRecords(
  verification: VercelVerification[] | undefined,
): Array<{ type: string; name: string; value: string; verified: boolean }> {
  if (!Array.isArray(verification)) return [];
  return verification.map((v) => ({
    type: v.type,
    name: v.domain,
    value: v.value,
    verified: false,
  }));
}


// Target server for custom domains (your Garage app server)
const APP_DOMAIN_TARGET = "my.garage.app";
const APP_SERVER_IP = process.env.APP_SERVER_IP || "YOUR_SERVER_IP"; // Set in .env

// Provision SSL certificate for custom domain using certbot + nginx
async function provisionSSLForDomain(domain: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Create nginx config for this specific domain
    const nginxConfig = `
server {
    listen 80;
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
`;

    // Write nginx config and run certbot
    const commands = `
echo '${nginxConfig}' > /etc/nginx/sites-enabled/garage-${domain} && \
nginx -t && \
certbot certonly --nginx -d ${domain} --non-interactive --agree-tos -m admin@garage.app && \
systemctl reload nginx
`;

    exec(commands, (error, stdout, stderr) => {
      if (error) {
        console.error(`[SSL] Error provisioning SSL for ${domain}:`, error.message);
        resolve({ success: false, error: error.message });
      } else {
        console.log(`[SSL] Successfully provisioned SSL for ${domain}`);
        resolve({ success: true });
      }
    });
  });
}


// Add custom app domain
/**
 * GET /initial-setup/domain-search?keyword=bigwin
 * GET /initial-setup/domain-search?domains=a.com,b.net
 *
 * Reseller availability + pricing. Read-only on purpose: registration
 * spends real money, and payment, refund-on-failure and renewal billing
 * are undecided, so no purchase route exists yet.
 *
 * Prices already include the reseller margin — the client is shown what it
 * would pay, and never sends a price back.
 */
router.get("/domain-search", requireAuth, async (req, res) => {
  try {
    if (!namecomConfigured()) {
      return res
        .status(503)
        .json({ error: "Domain search is not configured" });
    }

    const keyword = (req.query.keyword as string | undefined)?.trim();
    const domainsParam = (req.query.domains as string | undefined)?.trim();
    if (!keyword && !domainsParam) {
      return res
        .status(400)
        .json({ error: "Provide either keyword or domains" });
    }

    const results = domainsParam
      ? await checkAvailability(domainsParam.split(","))
      : await searchDomains(keyword as string);

    res.json({
      success: true,
      // Surfaced so the caller can tell sandbox results from real ones —
      // dev prices and availability do not match production.
      live: namecomIsLive(),
      results,
    });
  } catch (error: any) {
    console.error("[domain-search]", error?.message || error);
    res.status(502).json({ error: "Domain search failed" });
  }
});

/**
 * POST /initial-setup/domain-request
 *
 * Records a founder's request to buy a domain, with the registrant details
 * name.com needs at registration. Does NOT register or charge: payment and
 * refund-on-failure are undecided, so this queues the request instead of
 * spending money on its own.
 *
 * The quoted price is re-fetched here rather than trusted from the client —
 * a browser must never be able to name its own price.
 */
router.post("/domain-request", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      domain: z.string().min(3).regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i),
      kind: z.enum(["app", "shop"]).optional().default("app"),
      contact: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(5),
        address1: z.string().min(1),
        address2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().min(1),
        zip: z.string().min(1),
        country: z.string().length(2),
      }),
    });
    const body = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, body.orgId))) {
      return res
        .status(403)
        .json({ error: "Only founders can request domains" });
    }

    const domain = body.domain.toLowerCase();

    // Re-price server-side, and confirm it's still available.
    let priceUsd = 0;
    let renewalUsd = 0;
    if (namecomConfigured()) {
      const [offer] = await checkAvailability([domain]);
      if (!offer || !offer.available) {
        return res
          .status(409)
          .json({ error: "That domain is no longer available" });
      }
      priceUsd = offer.priceUsd;
      renewalUsd = offer.renewalUsd;
    }

    const existing = await DomainPurchaseRequest.findOne({
      domain,
      status: "pending",
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "There is already a pending request for this domain" });
    }

    const doc = await DomainPurchaseRequest.create({
      orgId: body.orgId,
      requestedBy: me.userId,
      domain,
      kind: body.kind,
      priceUsd,
      renewalUsd,
      contact: body.contact,
      status: "pending",
    });

    res.json({
      success: true,
      requestId: doc._id,
      domain,
      priceUsd,
      renewalUsd,
      message:
        "Request received. The domain is registered manually for now — you'll be notified once it's live.",
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Missing or invalid details" });
    }
    console.error("[domain-request]", error?.message || error);
    res.status(500).json({ error: "Could not record the request" });
  }
});

router.post("/add-app-domain", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      domain: z.string().min(1).regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i),
      // "shop" attaches to the store's Vercel project and issues subdomain
      // DNS instead of apex records. "cryptobrand" attaches to the
      // MyCryptoBrand investor site. Defaults to the office app.
      kind: z.enum(["app", "shop", "cryptobrand", "otc"]).optional().default("app"),
    });

    const { orgId, domain, kind } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can add app domains" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const existingDomain = org.customAppDomains?.find(
      (d: any) => d.domain.toLowerCase() === domain.toLowerCase()
    );
    if (existingDomain) {
      return res.status(400).json({ error: "This domain is already added to your organization" });
    }

    const otherOrg = await Organization.findOne({
      _id: { $ne: orgId },
      "customAppDomains.domain": domain.toLowerCase(),
    });
    if (otherOrg) {
      return res.status(400).json({ error: "This domain is already in use by another organization" });
    }

    // Base DNS records for routing traffic.
    // An apex domain needs an A record plus the www alias. A subdomain
    // (shop.acme.com) needs a single CNAME on its own label — pointing an
    // apex A record at it would be wrong and the www alias meaningless.
    const label = domain.toLowerCase().split(".")[0];
    const isSubdomain = domain.toLowerCase().split(".").length > 2;
    const dnsRecords: Array<{ type: string; name: string; value: string; verified: boolean }> =
      isSubdomain
        ? [
            {
              type: "CNAME",
              name: label,
              value: "cname.vercel-dns.com",
              verified: false,
            },
          ]
        : [
            {
              type: "A",
              name: "@",
              value: "216.198.79.1",
              verified: false,
            },
            {
              type: "CNAME",
              name: "www",
              value: "cname.vercel-dns.com",
              verified: false,
            },
          ];

    // Hit Vercel BEFORE persisting so we can fold any TXT verification
    // challenge into the records we save + return to the founder. If we
    // saved first and added the TXT later, the UI's first render would
    // be missing the most important record and the founder would point
    // DNS without ever seeing the ownership challenge.
    const vercelResult = await addDomainToVercel(domain.toLowerCase(), kind);
    console.log("[Vercel] Add domain result:", vercelResult);

    const verification = vercelResult.vercelConfig?.verification as
      | VercelVerification[]
      | undefined;
    const extra = verificationToDnsRecords(verification);
    if (extra.length > 0) {
      dnsRecords.push(...extra);
    }

    const isPrimary = !org.customAppDomains || org.customAppDomains.length === 0;

    if (!org.customAppDomains) {
      (org as any).customAppDomains = [];
    }

    org.customAppDomains.push({
      domain: domain.toLowerCase(),
      kind,
      verified: false,
      // Only an office-app domain can be the office's primary — that flag
      // drives where the office UI is served, and a shop or cryptobrand
      // domain serves a different site.
      isPrimary: kind === "app" ? isPrimary : false,
      createdAt: new Date(),
      dnsRecords,
    });

    await org.save();

    res.json({
      success: true,
      domain: domain.toLowerCase(),
      kind,
      dnsRecords,
      vercelConfig: vercelResult.vercelConfig,
      message: vercelResult.success
        ? extra.length > 0
          ? "Domain added. Add ALL DNS records below — including the TXT ownership record — then click Verify."
          : "Domain added to Vercel! Configure DNS records."
        : "Domain saved but Vercel error: " + vercelResult.error,
    });
  } catch (error: any) {
    console.error("Error adding app domain:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get app domains for organization
router.get("/app-domains", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    const me = (req as any).user as { userId: string };

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      success: true,
      domains: org.customAppDomains || [],
      targetCname: "my.garage.app",
      targetIp: "216.198.79.1", // Vercel IP
    });
  } catch (error: any) {
    console.error("Error getting app domains:", error);
    res.status(500).json({ error: error.message });
  }
});

// Verify app domain DNS
router.post("/verify-app-domain", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      domain: z.string(),
    });

    const { orgId, domain } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can verify domains" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const domainEntry = org.customAppDomains?.find(
      (d: any) => d.domain.toLowerCase() === domain.toLowerCase()
    );
    if (!domainEntry) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const dnsPromises = require("dns").promises;
    let aRecordVerified = false;

    // Check A record pointing to Vercel (216.198.79.1)
    try {
      const aRecords = await dnsPromises.resolve4(domain);
      aRecordVerified = aRecords.includes("216.198.79.1") || aRecords.includes("76.76.21.21");
      console.log(`[DNS] A records for ${domain}:`, aRecords, "Verified:", aRecordVerified);
    } catch (e) {
      console.log(`[DNS] A record not found for ${domain}`);
    }

    // Update DNS record status
    domainEntry.dnsRecords?.forEach((record: any) => {
      if (record.type === "A") {
        record.verified = aRecordVerified;
      }
    });

    // Check Vercel API for verification. Vercel's `verified` flag is
    // the source of truth — it only flips to true once ownership is
    // proven AND DNS resolves AND SSL is provisioned. A local A-record
    // resolving to 216.198.79.1 is necessary but NOT sufficient (the
    // platform will still 404 until Vercel verifies the apex), so we
    // don't OR-in `aRecordVerified` anymore.
    // Ask the project this domain actually lives on — a cryptobrand domain
    // is not on the office project, and asking there reports it unverified
    // forever.
    const domainKind = ((domainEntry as any).kind as DomainKind) || "app";
    // Run the ownership check first, then read the result. Reading alone
    // never moves a domain off pending_domain_verification, however long the
    // founder waits — see verifyDomainOnVercel.
    const vercelStatus =
      (await verifyDomainOnVercel(domain, domainKind)) ??
      (await getDomainFromVercel(domain, domainKind));
    const allVerified = vercelStatus.verified;

    console.log(`[Verify] A record: ${aRecordVerified}, Vercel: ${vercelStatus.verified}`);

    // Sync the TXT verification entries from Vercel back into the
    // saved dnsRecords on every poll: the challenge can be added late
    // (e.g. Vercel issues it only after the apex check kicks in), and
    // we want the UI to surface it as soon as it appears.
    if (Array.isArray(vercelStatus.verification)) {
      const existingByKey = new Map(
        (domainEntry.dnsRecords || []).map((r: any) => [`${r.type}:${r.name}`, r]),
      );
      for (const v of vercelStatus.verification) {
        const key = `${v.type}:${v.domain}`;
        const existing = existingByKey.get(key) as any;
        if (existing) {
          existing.value = v.value;
          existing.verified = vercelStatus.verified;
        } else {
          (domainEntry.dnsRecords as any[]).push({
            type: v.type,
            name: v.domain,
            value: v.value,
            verified: vercelStatus.verified,
          });
        }
      }
    }

    if (allVerified && !domainEntry.verified) {
      domainEntry.verified = true;
      domainEntry.verifiedAt = new Date();
      domainEntry.sslProvisioned = true;
      domainEntry.sslProvisionedAt = new Date();
    } else if (!allVerified && domainEntry.verified) {
      // Recover from the pre-fix state where domains got marked
      // verified=true purely on the local A-record check while Vercel
      // had never actually verified them. Flip back so the founder
      // sees the DNS records (including the TXT) and can finish setup.
      domainEntry.verified = false;
      domainEntry.verifiedAt = undefined;
      domainEntry.sslProvisioned = false;
      domainEntry.sslProvisionedAt = undefined;
    }

    await org.save();

    res.json({
      success: true,
      verified: allVerified,
      aRecordVerified,

      dnsRecords: domainEntry.dnsRecords,
      message: allVerified
        ? "Domain verified successfully!"
        : "DNS records not yet configured. Please wait for propagation (up to 48 hours).",
    });
  } catch (error: any) {
    console.error("Error verifying app domain:", error);
    res.status(500).json({ error: error.message });
  }
});

// Remove app domain
router.delete("/app-domain", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      domain: z.string(),
    });

    const { orgId, domain } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can remove domains" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const domainIndex = org.customAppDomains?.findIndex(
      (d: any) => d.domain.toLowerCase() === domain.toLowerCase()
    );

    if (domainIndex === -1 || domainIndex === undefined) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const removedDomain = org.customAppDomains[domainIndex].domain;
    org.customAppDomains.splice(domainIndex, 1);

    if (org.customAppDomains.length > 0) {
      const hasPrimary = org.customAppDomains.some((d: any) => d.isPrimary);
      if (!hasPrimary) {
        org.customAppDomains[0].isPrimary = true;
      }
    }

    await org.save();

    res.json({
      success: true,
      message: "Domain removed successfully",
    });
  } catch (error: any) {
    console.error("Error removing app domain:", error);
    res.status(500).json({ error: error.message });
  }
});

// Set primary app domain
router.post("/set-primary-app-domain", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      domain: z.string(),
    });

    const { orgId, domain } = schema.parse(req.body);
    const me = (req as any).user as { userId: string };

    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json({ error: "Only founders can set primary domain" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const domainEntry = org.customAppDomains?.find(
      (d: any) => d.domain.toLowerCase() === domain.toLowerCase()
    );
    if (!domainEntry) {
      return res.status(404).json({ error: "Domain not found" });
    }

    if (!domainEntry.verified) {
      return res.status(400).json({ error: "Domain must be verified before setting as primary" });
    }

    org.customAppDomains?.forEach((d: any) => {
      d.isPrimary = d.domain.toLowerCase() === domain.toLowerCase();
    });

    await org.save();

    res.json({
      success: true,
      message: `${domain} is now your primary domain`,
    });
  } catch (error: any) {
    console.error("Error setting primary domain:", error);
    res.status(500).json({ error: error.message });
  }
});

// Verify domain for SSL (Caddy on_demand_tls)
router.get("/verify-domain-for-ssl", async (req, res) => {
  try {
    const domain = (req.query.domain as string)?.toLowerCase();

    if (!domain) {
      return res.status(400).send("Domain is required");
    }

    const org = await Organization.findOne({
      customAppDomains: {
        $elemMatch: {
          domain: domain,
          verified: true,
        },
      },
    });

    if (org) {
      return res.status(200).send("OK");
    }

    return res.status(404).send("Not found");
  } catch (error: any) {
    console.error("Error verifying domain for SSL:", error);
    res.status(500).send("Error");
  }
});

// Lookup app domain (public endpoint for middleware)
router.get("/lookup-app-domain", async (req, res) => {
  try {
    const domain = (req.query.domain as string)?.toLowerCase();

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    // A white-labelled office also white-labels its shop at
    // shop.<their-domain>. Offices register the office domain only, so an
    // exact match can never resolve the shop host. On a miss, strip a leading
    // "shop." and retry the remainder — and also "app.<remainder>", since an
    // office may have registered either the apex (acme.com) or the app
    // subdomain (app.acme.com) while its shop is always shop.acme.com.
    const candidates = [domain];
    if (domain.startsWith("shop.")) {
      const base = domain.slice("shop.".length);
      candidates.push(base, `app.${base}`);
    }

    const org = await Organization.findOne({
      customAppDomains: {
        $elemMatch: {
          domain: { $in: candidates },
          verified: true,
        },
      },
    }).select("_id name icon branding coverPhoto");

    if (!org) {
      return res.status(404).json({ error: "Domain not found or not verified" });
    }

        let whitelabelActive = true;
    try {
      const { getWhitelabelStatus } = await import(
        "../services/whitelabelAddonPurchase"
      );
      const st = await getWhitelabelStatus(String(org._id));
      whitelabelActive = !!st.hasAccess;
    } catch (err: any) {
      console.error(
        "[lookup-app-domain] whitelabel status check failed:",
        err?.message || err
      );
    }

    res.json({
      success: true,
      orgId: org._id,
      orgName: org.name,
      orgIcon: org.icon || null,
      primaryColor: org.branding?.primaryColor || "#FBD10D",
      // Falls back to the primary so a one-colour brand renders flat
      // rather than fading into Garage yellow.
      secondaryColor:
        org.branding?.secondaryColor ||
        org.branding?.primaryColor ||
        "#FBD10D",
      /**
       * Is the white-label add-on still paid for?
       *
       * The domain deliberately keeps resolving when it lapses — taking a
       * client's public site down over a billing miss punishes their
       * visitors, not the person who owes. The front end uses this to show a
       * blocking notice instead, so the site opens but nothing can be done
       * in it.
       *
       * Never fails the lookup: if the entitlement check errors we assume
       * active, because a false "expired" would lock out a paying office.
       */
      whitelabelActive,
      coverPhoto: org.coverPhoto || null,
    });
  } catch (error: any) {
    console.error("Error looking up app domain:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ── White-label sender domain (Resend) ─────────────────────────────────────
 *
 * Lets an org send transactional mail from its OWN domain. Separate from the
 * Mailcow flow above: that provisions mailboxes (receiving, IMAP), this only
 * authorises outbound sending. Both can run on the same domain, which is
 * exactly why the SPF handling below matters — see services/resendDomains.ts.
 */

/** Founder-only: these change how mail from this org is authenticated. */
async function requireFounder(
  userId: string,
  orgId: string
): Promise<{ ok: boolean; error?: string }> {
  const check = await isMember(userId, orgId);
  if (!check.isMember) return { ok: false, error: "Not a member of this organization" };
  if (check.role !== "founder") {
    return { ok: false, error: "Only founders can change the sender domain" };
  }
  return { ok: true };
}

/**
 * GET /initial-setup/email-sender?orgId=...
 *
 * Current sender config plus the DNS records still to publish. Re-reads Resend
 * so a domain verified since the last visit shows as verified without the
 * founder having to press anything.
 */
router.get("/email-sender", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const me = (req as any).user as { userId: string };
    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "Organization ID is required" });
    }
    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const cfg = (org as any).emailSender;
    if (!cfg?.resendDomainId) {
      return res.json({ success: true, configured: false, emailSender: null });
    }

    // Refresh from Resend — status changes on their side, not ours.
    try {
      const { getResendDomain } = await import("../services/resendDomains");
      const live = await getResendDomain(cfg.resendDomainId);
      cfg.status = live.status;
      cfg.dnsRecords = live.records as any;
      cfg.lastCheckedAt = new Date();
      if (live.status === "verified" && !cfg.verifiedAt) cfg.verifiedAt = new Date();
      await org.save();
    } catch (err: any) {
      // A Resend outage must not hide the stored config.
      console.error("[EmailSender] refresh failed:", err?.message || err);
    }

    res.json({ success: true, configured: true, emailSender: cfg });
  } catch (error: any) {
    console.error("[EmailSender] get error:", error);
    res.status(500).json({ error: "Failed to load sender configuration" });
  }
});

/**
 * POST /initial-setup/email-sender
 * Body: { orgId, domain, fromEmail?, fromName? }
 *
 * Registers the domain with Resend and returns the DNS records to publish.
 * Does NOT start sending from it — that waits for verification.
 */
router.post("/email-sender", requireAuth, async (req, res) => {
  try {
    const { orgId, domain, fromEmail, fromName } = req.body || {};
    const me = (req as any).user as { userId: string };

    if (!orgId || !domain) {
      return res.status(400).json({ error: "orgId and domain are required" });
    }
    const allowed = await requireFounder(me.userId, orgId);
    if (!allowed.ok) return res.status(403).json({ error: allowed.error });

    const clean = String(domain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
      return res.status(400).json({ error: "Enter a valid domain, e.g. example.com" });
    }
    // A from-address on a different domain would never authenticate.
    if (fromEmail && !String(fromEmail).toLowerCase().endsWith(`@${clean}`)) {
      return res.status(400).json({ error: `From address must end with @${clean}` });
    }

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const {
      addResendDomain,
      listResendDomains,
      getResendDomain,
      resendConfigured,
      mergeSpf,
    } = await import("../services/resendDomains");

    if (!resendConfigured()) {
      return res.status(503).json({ error: "Email sending is not configured" });
    }

    // Reuse an existing registration rather than erroring on a duplicate —
    // the same domain may already be on the account from an earlier attempt.
    let live;
    const existing = (await listResendDomains()).find((d) => d.name === clean);
    live = existing
      ? await getResendDomain(existing.id)
      : await addResendDomain(clean);

    /**
     * Fold Resend's SPF into any SPF the domain already publishes.
     *
     * Publishing two SPF records is a permerror and breaks authentication for
     * BOTH senders, which is the likely outcome here because these orgs often
     * already run Mailcow on the same domain.
     */
    let currentSpf: string | null = null;
    try {
      const { resolveTxt } = await import("dns/promises");
      const txt = await resolveTxt(clean);
      const flat = txt.map((chunks) => chunks.join(""));
      currentSpf = flat.find((r) => /^v=spf1/i.test(r.trim())) || null;
    } catch {
      /* no TXT yet, or NXDOMAIN — treat as no existing SPF */
    }

    const records = (live.records || []).map((r: any) => {
      if (String(r.record).toUpperCase() === "SPF" && currentSpf) {
        return { ...r, value: mergeSpf(currentSpf, r.value), merged: true };
      }
      return r;
    });

    (org as any).emailSender = {
      domain: clean,
      resendDomainId: live.id,
      status: live.status,
      fromEmail: fromEmail || `noreply@${clean}`,
      fromName: fromName || org.name,
      dnsRecords: records,
      lastCheckedAt: new Date(),
      verifiedAt: live.status === "verified" ? new Date() : undefined,
    };
    await org.save();

    res.json({
      success: true,
      emailSender: (org as any).emailSender,
      spfMerged: !!currentSpf,
    });
  } catch (error: any) {
    console.error("[EmailSender] add error:", error);
    res.status(500).json({ error: error?.message || "Failed to add sender domain" });
  }
});

/**
 * DELETE /initial-setup/email-sender
 * Body: { orgId, removeFromResend? }
 *
 * Stop sending from this office's own domain. Mail immediately reverts to the
 * Garage address — senderForOrg only returns a custom sender while the config
 * exists and is verified.
 *
 * `removeFromResend` also deletes the domain from the Resend account. Off by
 * default and skipped when another org still points at the same domain,
 * because that delete is account-wide: it would silently break the other
 * office's sending. Re-adding later issues fresh DKIM keys, so the DNS records
 * must be published again.
 */
router.delete("/email-sender", requireAuth, async (req, res) => {
  try {
    const { orgId, removeFromResend } = req.body || {};
    const me = (req as any).user as { userId: string };
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const allowed = await requireFounder(me.userId, orgId);
    if (!allowed.ok) return res.status(403).json({ error: allowed.error });

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const cfg = (org as any).emailSender;
    if (!cfg?.domain) {
      return res.status(400).json({ error: "No sender domain configured" });
    }

    const domain = cfg.domain;
    const resendDomainId = cfg.resendDomainId;

    // Clear the org's config first: even if the Resend delete fails, this
    // office stops claiming a sender it no longer owns.
    (org as any).emailSender = undefined;
    org.markModified("emailSender");
    await org.save();

    let deletedFromResend = false;
    let keptBecauseShared = false;
    if (removeFromResend && resendDomainId) {
      const stillUsed = await Organization.exists({
        _id: { $ne: org._id },
        "emailSender.domain": domain,
      });
      if (stillUsed) {
        keptBecauseShared = true;
      } else {
        try {
          const { deleteResendDomain } = await import(
            "../services/resendDomains"
          );
          await deleteResendDomain(resendDomainId);
          deletedFromResend = true;
        } catch (err: any) {
          // The org config is already cleared, which is the part that
          // matters; a stale Resend entry is harmless.
          console.error(
            "[EmailSender] Resend delete failed:",
            err?.message || err
          );
        }
      }
    }

    res.json({ success: true, domain, deletedFromResend, keptBecauseShared });
  } catch (error: any) {
    console.error("[EmailSender] delete error:", error);
    res.status(500).json({ error: error?.message || "Could not remove domain" });
  }
});

/**
 * POST /initial-setup/email-sender/verify
 *
 * Asks Resend to re-check DNS. Their verification is asynchronous, so this
 * re-reads the domain afterwards and reports the real status rather than
 * assuming the trigger succeeded.
 */
router.post("/email-sender/verify", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.body || {};
    const me = (req as any).user as { userId: string };
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const allowed = await requireFounder(me.userId, orgId);
    if (!allowed.ok) return res.status(403).json({ error: allowed.error });

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const cfg = (org as any).emailSender;
    if (!cfg?.resendDomainId) {
      return res.status(400).json({ error: "No sender domain configured" });
    }

    const { verifyResendDomain, getResendDomain } = await import(
      "../services/resendDomains"
    );
    await verifyResendDomain(cfg.resendDomainId);
    const live = await getResendDomain(cfg.resendDomainId);

    cfg.status = live.status;
    cfg.dnsRecords = live.records as any;
    cfg.lastCheckedAt = new Date();
    if (live.status === "verified" && !cfg.verifiedAt) cfg.verifiedAt = new Date();
    await org.save();

    res.json({ success: true, status: live.status, emailSender: cfg });
  } catch (error: any) {
    console.error("[EmailSender] verify error:", error);
    res.status(500).json({ error: error?.message || "Verification failed" });
  }
});

export default router;
