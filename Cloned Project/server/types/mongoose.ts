import mongoose from "mongoose";

export interface DnsRecord {
  type: "MX" | "TXT" | "CNAME" | "A" | "AAAA";
  name?: string;
  value?: string;
  priority?: number;
  verified?: boolean;
}

export interface DomainConfig {
  type: "default" | "custom";
  customDomain?: string;
  verified?: boolean;
  domainAddedToMailcow?: boolean;
  dnsRecords?: mongoose.Types.DocumentArray<DnsRecord>;
  verifiedAt?: Date;
}

export interface MailboxConfig {
  created?: boolean;
  email?: string;
  localPart?: string;
  domain?: string;
  credentials?: string;
  createdAt?: Date;
  founderUserId?: mongoose.Types.ObjectId;
}

export interface UserMailbox {
  organization: mongoose.Types.ObjectId | string;
  created?: boolean;
  email?: string;
  localPart?: string;
  domain?: string;
  credentials?: string;
  createdAt?: Date;
}
