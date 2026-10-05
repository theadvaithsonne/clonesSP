// Mailcow API Service
// Supports multiple domains with configurable API endpoints

export interface MailDomainConfig {
  id: string;
  name: string;
  domain: string;
  apiBase: string;
  readKey: string;
  writeKey: string;
  isDefault: boolean;
}

export interface Mailbox {
  username: string;
  name: string;
  active: string | number;
  quota: number;
  quota_used: number;
  messages: number;
  percent_in_use: number;
  domain: string;
  local_part: string;
  attributes?: {
    force_pw_update: string;
    mailbox_format: string;
    quarantine_notification: string;
    sogo_access: string;
    tls_enforce_in: string;
    tls_enforce_out: string;
  };
}

export interface Alias {
  id: number;
  address: string;
  goto: string;
  active: string | number;
  domain: string;
  is_catch_all: number;
  created: string;
  modified: string;
}

export interface Domain {
  domain_name: string;
  description: string;
  aliases: number;
  mailboxes: number;
  defquota: number;
  maxquota: number;
  quota: number;
  active: string | number;
  backupmx: string | number;
  relay_all_recipients: string | number;
  mboxes_in_domain: number;
  mboxes_left: number;
  aliases_in_domain: number;
  aliases_left: number;
}

export interface MailApiResponse {
  type: "success" | "danger" | "error";
  msg: string | string[];
  log?: unknown[];
}

// Default configuration for networkmail.com
const DEFAULT_CONFIG: MailDomainConfig = {
  id: "default",
  name: "Network Mail",
  domain: "networkmail.com",
  apiBase: "https://mail.networkmail.com",
  readKey: "1E6EEE-113FF4-084C18-622C2C-4CF815",
  writeKey: "06730C-B99DF6-744240-6F14DD-CC01DD",
  isDefault: true,
};

// Storage key for domain configurations
const STORAGE_KEY = "mail_domain_configs";
const ACTIVE_DOMAIN_KEY = "mail_active_domain";

// Get all domain configurations
export function getDomainConfigs(): MailDomainConfig[] {
  if (typeof window === "undefined") return [DEFAULT_CONFIG];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_CONFIG]));
    return [DEFAULT_CONFIG];
  }

  const configs = JSON.parse(stored) as MailDomainConfig[];
  // Ensure default is always present
  if (!configs.find(c => c.id === "default")) {
    configs.unshift(DEFAULT_CONFIG);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }
  return configs;
}

// Get active domain configuration
export function getActiveDomainConfig(): MailDomainConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  const activeId = localStorage.getItem(ACTIVE_DOMAIN_KEY) || "default";
  const configs = getDomainConfigs();
  return configs.find(c => c.id === activeId) || DEFAULT_CONFIG;
}

// Set active domain
export function setActiveDomain(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_DOMAIN_KEY, id);
}

// Save domain configuration
export function saveDomainConfig(config: MailDomainConfig): void {
  if (typeof window === "undefined") return;

  const configs = getDomainConfigs();
  const existingIndex = configs.findIndex(c => c.id === config.id);

  if (existingIndex >= 0) {
    configs[existingIndex] = config;
  } else {
    configs.push(config);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

// Delete domain configuration
export function deleteDomainConfig(id: string): boolean {
  if (typeof window === "undefined") return false;
  if (id === "default") return false; // Cannot delete default

  const configs = getDomainConfigs();
  const filtered = configs.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  // If deleted domain was active, switch to default
  const activeId = localStorage.getItem(ACTIVE_DOMAIN_KEY);
  if (activeId === id) {
    localStorage.setItem(ACTIVE_DOMAIN_KEY, "default");
  }

  return true;
}

// Generic API call function
async function mailApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  useWriteKey: boolean = false
): Promise<T> {
  const config = getActiveDomainConfig();
  const apiKey = useWriteKey ? config.writeKey : config.readKey;

  const options: RequestInit = {
    method,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${config.apiBase}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ==================== MAILBOX APIS ====================

export async function getMailboxes(domain?: string): Promise<Mailbox[]> {
  const config = getActiveDomainConfig();
  const targetDomain = domain || config.domain;
  return mailApi<Mailbox[]>(`/api/v1/get/mailbox/all/${targetDomain}`);
}

export async function getMailbox(username: string): Promise<Mailbox> {
  const result = await mailApi<Mailbox[]>(`/api/v1/get/mailbox/${username}`);
  return Array.isArray(result) ? result[0] : result;
}

export async function createMailbox(data: {
  local_part: string;
  name: string;
  password: string;
  password2: string;
  domain?: string;
  quota?: string;
  active?: string;
  force_pw_update?: string;
  tls_enforce_in?: string;
  tls_enforce_out?: string;
}): Promise<MailApiResponse[]> {
  const config = getActiveDomainConfig();
  return mailApi<MailApiResponse[]>(
    "/api/v1/add/mailbox",
    "POST",
    {
      active: "1",
      domain: data.domain || config.domain,
      quota: "1024",
      force_pw_update: "0",
      tls_enforce_in: "1",
      tls_enforce_out: "1",
      ...data,
    },
    true
  );
}

export async function updateMailbox(
  username: string,
  data: Partial<{
    name: string;
    quota: string;
    active: string;
    password: string;
    password2: string;
  }>
): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/edit/mailbox",
    "POST",
    {
      items: [username],
      attr: data,
    },
    true
  );
}

export async function deleteMailbox(usernames: string[]): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>("/api/v1/delete/mailbox", "POST", usernames, true);
}

// ==================== ALIAS APIS ====================

export async function getAliases(id: string = "all"): Promise<Alias[]> {
  return mailApi<Alias[]>(`/api/v1/get/alias/${id}`);
}

export async function createAlias(data: {
  address: string;
  goto: string;
  active?: string;
  sogo_visible?: string;
}): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/add/alias",
    "POST",
    {
      active: "1",
      sogo_visible: "1",
      ...data,
    },
    true
  );
}

export async function updateAlias(
  id: number,
  data: Partial<{
    address: string;
    goto: string;
    active: string;
  }>
): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/edit/alias",
    "POST",
    {
      items: [id.toString()],
      attr: data,
    },
    true
  );
}

export async function deleteAlias(ids: number[]): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/delete/alias",
    "POST",
    ids.map(id => id.toString()),
    true
  );
}

// ==================== DOMAIN APIS ====================

export async function getDomains(): Promise<Domain[]> {
  return mailApi<Domain[]>("/api/v1/get/domain/all");
}

export async function getDomain(domain: string): Promise<Domain> {
  const result = await mailApi<Domain[]>(`/api/v1/get/domain/${domain}`);
  return Array.isArray(result) ? result[0] : result;
}

// ==================== SSO APIS ====================

// Generate SSO token for webmail access
export async function generateSSOToken(username: string): Promise<{ token: string }> {
  // For mailbox users, we use a different endpoint
  // The mailcow SSO works by redirecting to /SOGo/so/{domain}/{user}
  // with an sso_token query parameter
  return mailApi<{ token: string }>(
    "/api/v1/add/sso/domain-admin",
    "POST",
    { username },
    true
  );
}

// Build webmail URL with SSO
export function buildWebmailURL(mailbox: Mailbox, ssoToken?: string): string {
  const config = getActiveDomainConfig();
  const baseUrl = `${config.apiBase}/SOGo/so/${mailbox.domain}/${mailbox.local_part}`;

  if (ssoToken) {
    return `${baseUrl}?sso_token=${ssoToken}`;
  }

  // Fallback to regular login
  return `${config.apiBase}/SOGo`;
}

// ==================== QUOTA & STATS ====================

export async function getMailboxRatelimit(mailbox: string): Promise<unknown> {
  return mailApi(`/api/v1/get/rl-mbox/${mailbox}`);
}

export async function getDomainRatelimit(domain: string): Promise<unknown> {
  return mailApi(`/api/v1/get/rl-domain/${domain}`);
}

// ==================== QUARANTINE ====================

export async function getQuarantine(): Promise<unknown[]> {
  return mailApi("/api/v1/get/quarantine/all");
}

// ==================== LOGS ====================

export async function getPostfixLogs(count: number = 50): Promise<unknown[]> {
  return mailApi(`/api/v1/get/logs/postfix/${count}`);
}

export async function getDovecotLogs(count: number = 50): Promise<unknown[]> {
  return mailApi(`/api/v1/get/logs/dovecot/${count}`);
}

// ==================== APP PASSWORDS ====================

export async function getAppPasswords(mailbox: string): Promise<unknown[]> {
  return mailApi(`/api/v1/get/app-passwd/all/${mailbox}`);
}

export async function createAppPassword(data: {
  username: string;
  app_name: string;
  app_passwd: string;
  app_passwd2: string;
  active?: string;
  protocols?: string[];
}): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/add/app-passwd",
    "POST",
    {
      active: "1",
      protocols: ["imap_access", "smtp_access", "pop3_access"],
      ...data,
    },
    true
  );
}

export async function deleteAppPassword(ids: number[]): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/delete/app-passwd",
    "POST",
    ids.map(id => id.toString()),
    true
  );
}

// ==================== SPAM SCORE ====================

export async function getSpamScore(mailbox: string): Promise<{ spam_score: string }> {
  return mailApi(`/api/v1/get/spam-score/${mailbox}`);
}

export async function updateSpamScore(
  mailbox: string,
  score: string
): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/edit/spam-score/",
    "POST",
    {
      items: [mailbox],
      attr: { spam_score: score },
    },
    true
  );
}

// ==================== SYNC JOBS ====================

export async function getSyncJobs(): Promise<unknown[]> {
  return mailApi("/api/v1/get/syncjobs/all/no_log");
}

export async function createSyncJob(data: {
  username: string;
  host1: string;
  port1: string;
  user1: string;
  password1: string;
  enc1?: string;
  mins_interval?: string;
  subfolder2?: string;
  maxage?: string;
  delete2duplicates?: string;
  delete1?: string;
  delete2?: string;
  automap?: string;
  active?: string;
}): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/add/syncjob",
    "POST",
    {
      enc1: "TLS",
      mins_interval: "20",
      subfolder2: "",
      maxage: "0",
      maxbytespersecond: "0",
      timeout1: "600",
      timeout2: "600",
      exclude: "(?i)spam|(?i)junk",
      custom_params: "",
      delete2duplicates: "1",
      delete1: "0",
      delete2: "0",
      automap: "1",
      skipcrossduplicates: "0",
      subscribeall: "0",
      active: "1",
      ...data,
    },
    true
  );
}

// ==================== DKIM ====================

export async function getDKIM(domain: string): Promise<unknown> {
  return mailApi(`/api/v1/get/dkim/${domain}`);
}

export async function generateDKIM(data: {
  domains: string;
  dkim_selector?: string;
  key_size?: string;
}): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>(
    "/api/v1/add/dkim",
    "POST",
    {
      dkim_selector: "dkim",
      key_size: "2048",
      ...data,
    },
    true
  );
}

// ==================== MAIL QUEUE ====================

export async function getMailQueue(): Promise<unknown[]> {
  return mailApi("/api/v1/get/mailq/all");
}

export async function flushMailQueue(): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>("/api/v1/edit/mailq", "POST", { action: "flush" }, true);
}

export async function deleteFromQueue(queueIds: string[]): Promise<MailApiResponse[]> {
  return mailApi<MailApiResponse[]>("/api/v1/delete/mailq", "POST", queueIds, true);
}

// ==================== HELPER FUNCTIONS ====================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function isApiSuccess(response: MailApiResponse[]): boolean {
  return response.every(r => r.type === "success");
}

export function getApiErrorMessage(response: MailApiResponse[]): string {
  const errors = response.filter(r => r.type !== "success");
  return errors.map(e => (Array.isArray(e.msg) ? e.msg.join(", ") : e.msg)).join("; ");
}
