"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users2,
  Loader2,
  Edit3,
  Save,
  X,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import * as XLSX from "xlsx";
import { Country, State } from "country-state-city";

interface CSVLead {
  firstName: string;
  lastName: string;
  email?: string;
  leadName?: string;
  phoneNumber?: string;
  dob?: string;
  companyName?: string;
  industry?: string;
  website?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pinCode?: string;
  productName?: string;
  quantity?: string;
  pricing?: string;
  negotiatedPricing?: string;
  MaxDiscPrice?: string;
  salesFunnel?: string;
  stage?: string;
  estRevenue?: string;
  assignedTo?: string;
  notes?: string;
  nextFollowUp?: string;
}

interface UploadResult {
  row: number;
  leadId?: string;
  name?: string;
  email?: string;
  data?: CSVLead;
  error?: string;
}

interface BulkUploadResponse {
  message: string;
  results: {
    totalProcessed: number;
    successful: number;
    failed: number;
    successfulLeads: UploadResult[];
    failedLeads: UploadResult[];
  };
}

interface UploadSummaryData {
  message: string;
  details: {
    totalLeads: number;
    successfulImports: number;
    failedImports: number;
    successPercentage: number;
  };
  successfulLeads: Array<{
    row: number;
    name: string;
    email: string;
    leadId?: string;
  }>;
  failedLeads: Array<{
    row: number;
    error: string;
    data?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  }>;
  hasMoreSuccessful?: boolean;
  hasMoreFailed?: boolean;
}

interface BulkUploadLeadsFlowProps {
  mode?: "page" | "dialog";
  onClose?: () => void;
  onUploadComplete?: () => void;
}

type BulkUploadStep = "upload" | "sheet" | "mapping" | "review";

type ParsedSheet = {
  name: string;
  headers: string[];
  rows: any[][];
};

const MAPPABLE_FIELDS: Array<{ key: keyof CSVLead; label: string; required?: boolean }> = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email" },
  { key: "phoneNumber", label: "Phone Number" },
  { key: "dob", label: "Date of Birth" },
  { key: "companyName", label: "Company Name" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "pinCode", label: "Pin Code" },
  { key: "productName", label: "Product Name" },
  { key: "quantity", label: "Quantity" },
  { key: "pricing", label: "Pricing" },
  { key: "negotiatedPricing", label: "Negotiated Pricing" },
  { key: "MaxDiscPrice", label: "Max Disc Price" },
  { key: "salesFunnel", label: "Sales Funnel" },
  { key: "stage", label: "Stage" },
  { key: "estRevenue", label: "Estimated Revenue" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "notes", label: "Notes" },
  { key: "nextFollowUp", label: "Next Follow Up" },
];

const BULK_UPLOAD_MAPPING_STORAGE_KEY = "bulk-upload-leads-mapping-v1";

const deriveLeadName = (lead: Partial<CSVLead>): string => {
  const first = lead.firstName?.trim() ?? "";
  const last = lead.lastName?.trim() ?? "";
  const combined = `${first} ${last}`.replace(/\s+/g, " ").trim();
  if (combined) {
    return combined;
  }
  const existing = lead.leadName?.trim();
  if (existing) {
    return existing;
  }
  return first || last || "";
};

/** Map header labels (e.g. from Google Sheets "First Name", "Email") to our canonical CSVLead keys */
const HEADER_ALIASES: Record<string, string> = {
  "first name": "firstName",
  "firstname": "firstName",
  "first-name": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "last-name": "lastName",
  "last_name": "lastName",
  "email": "email",
  "email address": "email",
  "phone": "phoneNumber",
  "phone number": "phoneNumber",
  "phonenumber": "phoneNumber",
  "mobile": "phoneNumber",
  "company": "companyName",
  "company name": "companyName",
  "companyname": "companyName",
  "dob": "dob",
  "date of birth": "dob",
  "industry": "industry",
  "website": "website",
  "address": "address",
  "country": "country",
  "state": "state",
  "city": "city",
  "pin code": "pinCode",
  "pincode": "pinCode",
  "zip": "pinCode",
  "postal code": "pinCode",
  "product name": "productName",
  "productname": "productName",
  "product": "productName",
  "quantity": "quantity",
  "pricing": "pricing",
  "price": "pricing",
  "negotiated pricing": "negotiatedPricing",
  "negotiatedpricing": "negotiatedPricing",
  "negotiated price": "negotiatedPricing",
  "max disc price": "MaxDiscPrice",
  "maxdiscprice": "MaxDiscPrice",
  "sales funnel": "salesFunnel",
  "salesfunnel": "salesFunnel",
  "funnel": "salesFunnel",
  "stage": "stage",
  "est revenue": "estRevenue",
  "estimated revenue": "estRevenue",
  "estrevenue": "estRevenue",
  "assigned to": "assignedTo",
  "assignedto": "assignedTo",
  "notes": "notes",
  "next follow up": "nextFollowUp",
  "nextfollowup": "nextFollowUp",
  "follow up date": "nextFollowUp",
  "followupdate": "nextFollowUp",
};

function normalizeHeader(header: string): string {
  // Normalize header to be very forgiving:
  // - Trim
  // - Lowercase
  // - Replace any non-alphanumeric sequence (spaces, underscores, hyphens, punctuation) with a single space
  //   so "First Name", "first_name", "FIRST-NAME" all normalize to "first name"
  const cleaned = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  // First try alias map using the space-normalized key
  if (HEADER_ALIASES[cleaned]) {
    return HEADER_ALIASES[cleaned];
  }

  // Fallback: remove spaces entirely for camelCase-style matches like "firstName"
  return cleaned.replace(/\s+/g, "");
}

function UploadSummary({ summaryData }: { summaryData: UploadSummaryData }) {
  const { details, successfulLeads, failedLeads, hasMoreSuccessful, hasMoreFailed } = summaryData;

  return (
    <div className="upload-summary space-y-6 text-gray-900 dark:text-gray-100">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          {summaryData.message}
        </h2>
      </div>

      <div className="summary-stats">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-item rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-600/60">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-300">
              {details.totalLeads}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-300 font-medium">
              Total Leads
            </div>
          </div>
          <div className="stat-item rounded-lg p-4 text-center bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-600/60">
            <div className="text-3xl font-bold text-green-600 dark:text-green-300">
              {details.successfulImports}
            </div>
            <div className="text-sm text-green-600 dark:text-green-300 font-medium">
              Successful
            </div>
          </div>
          <div className="stat-item rounded-lg p-4 text-center bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-600/60">
            <div className="text-3xl font-bold text-red-600 dark:text-red-300">
              {details.failedImports}
            </div>
            <div className="text-sm text-red-600 dark:text-red-300 font-medium">
              Failed
            </div>
          </div>
          <div className="stat-item rounded-lg p-4 text-center bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-600/60">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-300">
              {details.successPercentage}%
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-300 font-medium">
              Success Rate
            </div>
          </div>
        </div>
      </div>

      {successfulLeads.length > 0 && (
        <div className="successful-section">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Successfully Imported ({successfulLeads.length}
            {hasMoreSuccessful ? "+" : ""})
          </h3>
          <div className="border border-green-200 dark:border-green-700 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {successfulLeads.map((lead, index) => (
                  <TableRow
                    key={index}
                    className="bg-green-50 dark:bg-green-950 text-gray-900 dark:text-gray-100"
                  >
                    <TableCell className="font-medium text-center">{lead.row}</TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-300">
                      {lead.email}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {failedLeads.length > 0 && (
        <div className="failed-section">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Failed Imports ({failedLeads.length}
            {hasMoreFailed ? "+" : ""})
          </h3>
          <div className="border border-red-200 dark:border-red-700 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedLeads.map((lead, index) => (
                  <TableRow
                    key={index}
                    className="bg-red-50 dark:bg-red-950 text-gray-900 dark:text-gray-100"
                  >
                    <TableCell className="font-medium text-center">{lead.row}</TableCell>
                    <TableCell className="font-medium">
                      {lead.data
                        ? `${lead.data.firstName || ""} ${lead.data.lastName || ""}`.trim()
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-300">
                      {lead.data?.email || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-red-600 dark:text-red-300">
                      {lead.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Normalise a date value that may arrive as:
 *  - An Excel serial-date number  (e.g. 32888 -> 1990-01-15)
 *  - A JS Date object              (XLSX cellDates mode)
 *  - A text string in common formats (MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD, etc.)
 *  - Already valid YYYY-MM-DD       (pass-through)
 *
 * Returns a YYYY-MM-DD string, or the original value if conversion fails.
 */
function normalizeDateValue(raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "";

  // 1. Handle JS Date objects (from XLSX cellDates option)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return formatDateParts(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  const str = String(raw).trim();
  if (!str) return "";

  // 2. Already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return str;

  // 3. Pure number → treat as Excel serial date
  const num = Number(str);
  if (!isNaN(num) && isFinite(num) && num > 0 && num < 2958466) {
    // 2958466 = 31-12-9999 in Excel serial (9999-12-31)
    return excelSerialToDate(num);
  }

  // 4. Try common text formats
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const isoLike = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (isoLike) {
    return formatDateParts(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
  }

  // MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY  or  DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const mdyOrDmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mdyOrDmy) {
    const a = Number(mdyOrDmy[1]);
    const b = Number(mdyOrDmy[2]);
    const year = Number(mdyOrDmy[3]);
    // If first part > 12, it must be DD/MM/YYYY
    if (a > 12 && b <= 12) {
      return formatDateParts(year, b, a);
    }
    // If second part > 12, it must be MM/DD/YYYY
    if (b > 12 && a <= 12) {
      return formatDateParts(year, a, b);
    }
    // Ambiguous case (both <= 12) — assume DD/MM/YYYY (Template convention)
    // Previously assumed MM/DD/YYYY, but user template uses DD-MM-YYYY
    return formatDateParts(year, b, a);
  }

  // 5. Last resort: try native Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // Could not normalise — return as-is so validation can flag it
  return str;
}

/** Convert an Excel serial-date number to YYYY-MM-DD */
function excelSerialToDate(serial: number): string {
  // Excel incorrectly treats 1900 as a leap year (the "Lotus 1-2-3 bug").
  // Serial 1 = 1900-01-01.  Serial 60 = 1900-02-29 (the phantom day).
  // We adjust for serials > 60.
  const adjustedSerial = serial > 60 ? serial - 1 : serial;
  // JS epoch offset: 1900-01-01 is day 1, so day 0 = 1899-12-31
  const msPerDay = 86400000;
  const epoch = new Date(Date.UTC(1899, 11, 31)); // Dec 31, 1899
  const date = new Date(epoch.getTime() + adjustedSerial * msPerDay);
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Zero-pad and format as DD-MM-YYYY */
function formatDateParts(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
}

const BulkUploadLeadsFlow = ({
  mode = "page",
  onClose,
  onUploadComplete,
}: BulkUploadLeadsFlowProps) => {
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<CSVLead[]>([]);
  const [bulkUploadStep, setBulkUploadStep] = useState<BulkUploadStep>("upload");
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<Partial<Record<keyof CSVLead, string>>>({});
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<CSVLead>({} as CSVLead);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentLead, setCurrentLead] = useState<{ name: string; email: string } | null>(null);
  const [uploadResults, setUploadResults] = useState<BulkUploadResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const [bulkUploadProducts, setBulkUploadProducts] = useState<{ name: string }[]>([]);
  const [bulkUploadFunnels, setBulkUploadFunnels] = useState<{ funnelName: string }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [uploadSummaryData, setUploadSummaryData] = useState<UploadSummaryData | null>(null);
  const csvDataRef = useRef<CSVLead[]>([]);
  const fallbackProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackProgressMetaRef = useRef({
    active: false,
    total: 0,
    lastActualTimestamp: 0,
    lastRealProcessed: 0,
    lastFallbackProcessed: 0,
  });

  useEffect(() => {
    csvDataRef.current = csvData;
  }, [csvData]);

  useEffect(() => {
    if (csvData.length > 0) {
      setBulkUploadStep("review");
    } else if (parsedSheets.length === 0) {
      setBulkUploadStep("upload");
    }
  }, [csvData.length, parsedSheets.length]);

  const selectedSheet = useMemo(
    () => parsedSheets.find((sheet) => sheet.name === selectedSheetName),
    [parsedSheets, selectedSheetName]
  );

  const getHeaderSignature = useCallback((headers: string[]): string => {
    return headers.map((header) => normalizeHeader(header)).join("|");
  }, []);

  const readSavedMappings = useCallback((): Record<string, Partial<Record<keyof CSVLead, string>>> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(BULK_UPLOAD_MAPPING_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Partial<Record<keyof CSVLead, string>>>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const saveMappingPreset = useCallback(
    (headers: string[], mapping: Partial<Record<keyof CSVLead, string>>) => {
      if (typeof window === "undefined") return;
      const signature = getHeaderSignature(headers);
      if (!signature) return;

      const sanitizedMapping: Partial<Record<keyof CSVLead, string>> = {};
      MAPPABLE_FIELDS.forEach(({ key }) => {
        const selected = mapping[key];
        if (selected) sanitizedMapping[key] = selected;
      });

      const existing = readSavedMappings();
      existing[signature] = sanitizedMapping;
      window.localStorage.setItem(BULK_UPLOAD_MAPPING_STORAGE_KEY, JSON.stringify(existing));
    },
    [getHeaderSignature, readSavedMappings]
  );

  const stopFallbackProgress = useCallback(() => {
    if (fallbackProgressIntervalRef.current) {
      clearInterval(fallbackProgressIntervalRef.current);
      fallbackProgressIntervalRef.current = null;
    }
    fallbackProgressMetaRef.current = {
      active: false,
      total: 0,
      lastActualTimestamp: 0,
      lastRealProcessed: 0,
      lastFallbackProcessed: 0,
    };
  }, []);

  const registerRealProgressUpdate = useCallback((processed?: number, total?: number) => {
    const meta = fallbackProgressMetaRef.current;
    if (!meta.active) return;
    const hasMeaningfulUpdate =
      (typeof processed === "number" && Number.isFinite(processed)) ||
      (typeof total === "number" && Number.isFinite(total) && total > 0);
    if (!hasMeaningfulUpdate) return;

    meta.lastActualTimestamp = Date.now();
    if (typeof processed === "number" && Number.isFinite(processed)) {
      meta.lastRealProcessed = Math.max(meta.lastRealProcessed, Math.floor(processed));
      meta.lastFallbackProcessed = Math.max(meta.lastFallbackProcessed, meta.lastRealProcessed);
    }
    if (typeof total === "number" && Number.isFinite(total) && total > 0) {
      meta.total = Math.max(meta.total, Math.floor(total));
    }
  }, []);

  const startFallbackProgress = useCallback(
    (total: number) => {
      if (!Number.isFinite(total) || total <= 0) return;
      stopFallbackProgress();
      fallbackProgressMetaRef.current = {
        active: true,
        total: Math.floor(total),
        lastActualTimestamp: Date.now(),
        lastRealProcessed: 0,
        lastFallbackProcessed: 0,
      };

      fallbackProgressIntervalRef.current = setInterval(() => {
        const meta = fallbackProgressMetaRef.current;
        if (!meta.active || meta.total <= 0) {
          return;
        }

        const now = Date.now();
        const idleDuration = now - meta.lastActualTimestamp;
        // Only kick in the fallback animation if we haven't received real progress updates recently
        if (idleDuration < 1200) {
          return;
        }

        setProcessedCount((prev) => {
          const baseline = Math.max(prev, meta.lastRealProcessed, meta.lastFallbackProcessed);
          if (baseline >= meta.total) {
            return baseline;
          }

          const step = Math.max(1, Math.round(meta.total * 0.03));
          const next = Math.min(meta.total, baseline + step);
          meta.lastFallbackProcessed = Math.max(meta.lastFallbackProcessed, next);

          setUploadProgress((prevProgress) => {
            const computed = Math.min(95, (next / meta.total) * 100);
            return prevProgress < computed ? computed : prevProgress;
          });

          const leadsSnapshot = csvDataRef.current;
          const leadIndex = Math.min(next - 1, leadsSnapshot.length - 1);
          if (leadIndex >= 0 && leadsSnapshot[leadIndex]) {
            const lead = leadsSnapshot[leadIndex];
            setCurrentLead({
              name: deriveLeadName(lead),
              email: lead.email ?? "",
            });
          }

          return next;
        });
      }, 800);
    },
    [stopFallbackProgress]
  );

  useEffect(() => {
    return () => {
      stopFallbackProgress();
    };
  }, [stopFallbackProgress]);

  const normalizeUploadResults = (
    raw: any,
    fallbackTotal: number
  ): BulkUploadResponse["results"] => {
    const source = raw?.summary || raw?.results || raw || {};
    const successfulLeads = Array.isArray(source?.successfulLeads)
      ? source.successfulLeads
      : Array.isArray(raw?.successfulLeads)
        ? raw.successfulLeads
        : [];
    const failedLeads = Array.isArray(source?.failedLeads)
      ? source.failedLeads
      : Array.isArray(raw?.failedLeads)
        ? raw.failedLeads
        : [];

    const resolvedTotal =
      source?.totalProcessed ??
      source?.totalLeads ??
      source?.processed ??
      source?.details?.totalLeads ??
      source?.count ??
      fallbackTotal;

    const resolvedSuccessful =
      source?.successful ??
      source?.successfulImports ??
      source?.details?.successfulImports ??
      source?.results?.successful ??
      (typeof source?.success === "number" ? source.success : undefined) ??
      (typeof raw?.successful === "number" ? raw.successful : undefined);

    const resolvedFailed =
      source?.failed ??
      source?.failedImports ??
      source?.details?.failedImports ??
      source?.results?.failed ??
      (typeof source?.failure === "number" ? source.failure : undefined) ??
      (typeof raw?.failed === "number" ? raw.failed : undefined);

    return {
      totalProcessed:
        typeof resolvedTotal === "number" && resolvedTotal > 0 ? resolvedTotal : fallbackTotal,
      successful:
        typeof resolvedSuccessful === "number"
          ? resolvedSuccessful
          : successfulLeads.length,
      failed: typeof resolvedFailed === "number" ? resolvedFailed : failedLeads.length,
      successfulLeads,
      failedLeads,
    };
  };

  const finalizeUpload = useCallback(
    (message: string | undefined, rawResults: any, fallbackTotal: number) => {
      const normalized = normalizeUploadResults(rawResults, fallbackTotal);
      const successCount =
        typeof normalized.successful === "number"
          ? normalized.successful
          : normalized.successfulLeads.length;
      const derivedMessage =
        message ||
        `Bulk upload completed! ${successCount || 0} ${successCount === 1 ? "lead" : "leads"} created successfully.`;

      stopFallbackProgress();
      registerRealProgressUpdate(normalized.totalProcessed, normalized.totalProcessed || fallbackTotal);
      setUploadProgress(100);
      setProcessedCount(normalized.totalProcessed);
      setTotalLeads(normalized.totalProcessed);
      setSuccessCount(successCount || 0);
      setFailCount(
        typeof normalized.failed === "number" ? normalized.failed : normalized.failedLeads.length
      );
      setCurrentLead(null);
      setUploadResults({ message: derivedMessage, results: normalized });
      setShowResults(true);
      setCsvData([]);
      setValidationErrors({});
      setEditingRow(null);
      setEditedData({} as CSVLead);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploading(false);
      setIsStreamingMode(false);
      if (pollingIntervalId) {
        clearTimeout(pollingIntervalId);
        setPollingIntervalId(null);
      }

      toast.success(derivedMessage);
    },
    [pollingIntervalId, registerRealProgressUpdate, stopFallbackProgress]
  );

  useEffect(() => {
    if (showResults) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [showResults]);

  useEffect(() => {
    fetchBulkUploadProducts();
    fetchBulkUploadFunnels();
  }, []);

  const commonIndustries = [
    "Technology",
    "Software",
    "Consulting",
    "Finance",
    "Healthcare",
    "Retail",
    "Manufacturing",
    "Education",
    "Automotive",
    "Telecommunications",
  ];

  const commonSalesFunnels = [
    "Inbound Marketing",
    "Outbound Sales",
    "Referral",
    "Event Follow-up",
    "Email Campaign",
    "Website Lead",
    "Cold Call",
  ];

  const commonStages = ["Prospect", "Contacted", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];

  const fetchBulkUploadProducts = async () => {
    try {
      const response = await authenticatedFetch(buildExternalUrl("/crm/products?skip=0&limit=100"), {
        method: "GET",
      });
      if (response.ok) {
        const data = await response.json();
        const products = data.products || data.data || data || [];
        setBulkUploadProducts(products.map((product: any) => ({ name: product.productName || product.name || "" })));
      }
    } catch (error) {
      console.error("Error fetching bulk upload products:", error);
    }
  };

  const fetchBulkUploadFunnels = async () => {
    try {
      const response = await authenticatedFetch(buildExternalUrl("/crm/funnels?skip=0&limit=100"), {
        method: "GET",
      });
      if (response.ok) {
        const data = await response.json();
        const funnels = data.funnels || data.data || data || [];
        setBulkUploadFunnels(
          funnels.map((funnel: any) => ({
            funnelName: funnel.funnelName || funnel.name || funnel.salesFunnel || "",
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching bulk upload funnels:", error);
    }
  };

  const validateLead = (lead: CSVLead, index: number): string[] => {
    const errors: string[] = [];
    if (!lead.firstName || !lead.lastName) {
      errors.push("First Name and Last Name are required");
    }

    // Check if either email OR phone number is present
    if (!lead.email && !lead.phoneNumber) {
      errors.push("Either Email or Phone Number is required");
    }

    // Validate email if present
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      errors.push("Valid email address is required");
    }

    if (lead.dob && !/^\d{2}-\d{2}-\d{4}$/.test(lead.dob)) {
      errors.push("Date of Birth must be in DD-MM-YYYY format");
    }
    if (lead.nextFollowUp && !/^\d{2}-\d{2}-\d{4}$/.test(lead.nextFollowUp)) {
      errors.push("Next Follow-up Date must be in DD-MM-YYYY format");
    }
    if (lead.quantity && isNaN(Number(lead.quantity))) {
      errors.push("Quantity must be a number");
    }
    if (lead.pricing && isNaN(Number(lead.pricing))) {
      errors.push("Pricing must be a number");
    }
    if (lead.negotiatedPricing && isNaN(Number(lead.negotiatedPricing))) {
      errors.push("Negotiated Pricing must be a number");
    }
    if (lead.MaxDiscPrice && isNaN(Number(lead.MaxDiscPrice))) {
      errors.push("Max Discount Price must be a number");
    }
    if (lead.estRevenue && isNaN(Number(lead.estRevenue))) {
      errors.push("Estimated Revenue must be a number");
    }
    if (lead.country) {
      const countries = Country.getAllCountries();
      const countryNames = countries.map((country) => country.name.toLowerCase());
      if (!countryNames.includes(lead.country.toLowerCase())) {
        errors.push(`Country "${lead.country}" is not valid`);
      }
    }
    if (lead.state && lead.country) {
      const country = Country.getAllCountries().find((c) => c.name.toLowerCase() === lead.country?.toLowerCase());
      if (country) {
        const states = State.getStatesOfCountry(country.isoCode);
        const stateNames = states.map((state) => state.name.toLowerCase());
        if (!stateNames.includes(lead.state.toLowerCase())) {
          errors.push(`State "${lead.state}" is not valid for ${lead.country}`);
        }
      }
    }
    return errors;
  };

  const parseFileIntoSheets = (file: File): Promise<ParsedSheet[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const extractedSheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
            const rows = jsonData.filter(
              (row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== "")
            );

            const headerRow = rows[0] || [];
            const headers = headerRow.map((header) => String(header || "").trim()).filter(Boolean);

            return {
              name: sheetName,
              headers,
              rows: rows.slice(1),
            };
          }).filter((sheet) => sheet.headers.length > 0);

          if (extractedSheets.length === 0) {
            throw new Error("File is empty or missing headers");
          }

          resolve(extractedSheets);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const buildInitialColumnMapping = useCallback((headers: string[]): Partial<Record<keyof CSVLead, string>> => {
    const mapping: Partial<Record<keyof CSVLead, string>> = {};
    const canonicalToHeader = new Map<string, string>();

    headers.forEach((header) => {
      const normalized = normalizeHeader(header);
      if (!canonicalToHeader.has(normalized)) {
        canonicalToHeader.set(normalized, header);
      }
    });

    MAPPABLE_FIELDS.forEach((field) => {
      const directMatch = canonicalToHeader.get(field.key);
      if (directMatch) {
        mapping[field.key] = directMatch;
      }
    });

    return mapping;
  }, []);

  const resolveColumnMappingForHeaders = useCallback(
    (headers: string[]): Partial<Record<keyof CSVLead, string>> => {
      const suggested = buildInitialColumnMapping(headers);
      const signature = getHeaderSignature(headers);
      const saved = readSavedMappings()[signature];
      if (!saved) return suggested;

      const headerSet = new Set(headers);
      const merged: Partial<Record<keyof CSVLead, string>> = { ...suggested };
      MAPPABLE_FIELDS.forEach(({ key }) => {
        const savedHeader = saved[key];
        if (savedHeader && headerSet.has(savedHeader)) {
          merged[key] = savedHeader;
        }
      });
      return merged;
    },
    [buildInitialColumnMapping, getHeaderSignature, readSavedMappings]
  );

  const applyColumnMapping = (
    sheet: ParsedSheet,
    mapping: Partial<Record<keyof CSVLead, string>>
  ) => {
      const headerIndex = new Map<string, number>();
      sheet.headers.forEach((header, idx) => {
        headerIndex.set(header, idx);
      });

      const leads: CSVLead[] = [];
      const dateFields = new Set<keyof CSVLead>(["dob", "nextFollowUp"]);

      for (const row of sheet.rows) {
        const hasAnyValue = row.some((cell) => String(cell ?? "").trim() !== "");
        if (!hasAnyValue) continue;

        const lead: Partial<CSVLead> = {};

        MAPPABLE_FIELDS.forEach(({ key }) => {
          const sourceHeader = mapping[key];
          if (!sourceHeader) return;
          const idx = headerIndex.get(sourceHeader);
          if (idx === undefined) return;
          const rawValue = row[idx];
          if (dateFields.has(key)) {
            lead[key] = normalizeDateValue(rawValue) as any;
          } else {
            lead[key] = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : "";
          }
        });

        if (!lead.firstName && !lead.lastName) continue;

        const leadWithName: CSVLead = {
          ...(lead as CSVLead),
          leadName: deriveLeadName(lead),
        };
        leads.push(leadWithName);
      }

      return leads;
    };

  const finalizeParsedLeads = (leads: CSVLead[]) => {
    const normalizedLeads = leads.map((lead) => {
      let cleanedEmail = lead.email;
      if (cleanedEmail && (cleanedEmail.includes("/") || cleanedEmail.includes(","))) {
        cleanedEmail = cleanedEmail.split(/[\/,]/)[0].trim();
      }

      return {
        ...lead,
        email: cleanedEmail,
        leadName: lead.leadName || deriveLeadName(lead),
      };
    });

    setCsvData(normalizedLeads as CSVLead[]);

    const errors: Record<number, string[]> = {};
    normalizedLeads.forEach((lead, index) => {
      const leadErrors = validateLead(lead, index);
      if (leadErrors.length > 0) {
        errors[index] = leadErrors;
      }
    });

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.warning(
        `Found ${Object.keys(errors).length} rows with validation errors. Please review and fix them before uploading.`
      );
    } else {
      toast.success(`Successfully loaded ${normalizedLeads.length} leads`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel =
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.type.includes("spreadsheetml") ||
      file.type.includes("excel");
    const isCSV = file.type === "text/csv" || file.name.endsWith(".csv");

    if (!isExcel && !isCSV) {
      toast.error("Please upload an Excel (.xlsx) or CSV (.csv) file");
      return;
    }

    try {
      const sheets = await parseFileIntoSheets(file);
      setUploadedFileName(file.name);
      setParsedSheets(sheets);

      const preferredSheet =
        sheets.find((sheet) => sheet.name.trim().toLowerCase() === "lead data") || sheets[0];

      if (!preferredSheet) {
        throw new Error("No usable sheet found in file.");
      }

      setSelectedSheetName(preferredSheet.name);
      setColumnMapping(resolveColumnMappingForHeaders(preferredSheet.headers));

      if (sheets.length > 1 && isExcel) {
        setBulkUploadStep("sheet");
      } else {
        setBulkUploadStep("mapping");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message.startsWith("Row ") || message.includes("Missing required") ? message : `Could not read file: ${message}`);
      console.error("File parsing error:", error);
    }
  };

  const handleContinueToMapping = () => {
    if (!selectedSheet) {
      toast.error("Please select a sheet to continue.");
      return;
    }
    setColumnMapping(resolveColumnMappingForHeaders(selectedSheet.headers));
    setBulkUploadStep("mapping");
  };

  const handlePrepareMappedData = () => {
    if (!selectedSheet) {
      toast.error("Please select a sheet first.");
      return;
    }

    if (!columnMapping.firstName || !columnMapping.lastName) {
      toast.error("Please map required fields: First Name and Last Name.");
      return;
    }

    const leads = applyColumnMapping(selectedSheet, columnMapping);
    if (leads.length === 0) {
      toast.error("No valid rows found for selected mapping.");
      return;
    }

    saveMappingPreset(selectedSheet.headers, columnMapping);
    finalizeParsedLeads(leads);
  };

  const isProduction = () => {
    if (typeof window !== "undefined") {
      return (
        window.location.hostname.includes("uatapi.garage.app") ||
        window.location.hostname.includes("my.garage.app") ||
        window.location.hostname.includes("localhost")
      );
    }
    return false;
  };

  const forcePollingMode = () => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pollingParam = urlParams.get("polling");
      if (pollingParam === "true") return true;
    }
    if (typeof process !== "undefined") {
      const envFlag =
        process.env.NEXT_PUBLIC_FORCE_BULK_UPLOAD_POLLING ?? process.env.NEXT_PUBLIC_FORCE_POLLING ?? "";
      if (typeof envFlag === "string" && envFlag.toLowerCase() === "true") {
        return true;
      }
    }
    return false;
  };

  const bulkUploadWithPolling = async (leadsData: CSVLead[]) => {
    try {
      const requestPayload = {
        leads: leadsData,
        streamProgress: true,
        usePolling: true,
      };
      const apiUrl = buildExternalUrl("/crm/leads/bulk-upload");
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      };
      const response = await authenticatedFetch(apiUrl, requestOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.userMessage ??
          errorData.friendlyMessage ??
          errorData.message ??
          errorData.error ??
          (typeof errorData.details === "string" ? errorData.details : null) ??
          (Array.isArray(errorData.errors) ? errorData.errors[0] : null) ??
          `Upload failed (${response.status})`;
        throw new Error(typeof msg === "string" ? msg : "Failed to start upload");
      }
      const result = await response.json();
      if (result.sessionId) {
        setSessionId(result.sessionId);
        startProgressPolling(result.sessionId);
        return result.sessionId;
      } else {
        finalizeUpload(result.message, result.results ?? result, leadsData.length);
        return "completed";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  };

  const startProgressPolling = (sessionId: string) => {
    const pollProgress = async () => {
      try {
        const progressResponse = await authenticatedFetch(
          buildExternalUrl(`crm/leads/bulk-upload/progress/${sessionId}`),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (!progressResponse.ok) {
          console.error("Failed to fetch progress");
          return;
        }
        const progressData = await progressResponse.json();

        const statusValue =
          typeof progressData?.status === "string" ? progressData.status.toLowerCase() : "";
        if (statusValue === "completed" || statusValue === "finished") {
          const fallbackTotal =
            progressData.totalLeads ??
            progressData.totalProcessed ??
            progressData.processed ??
            progressData.summary?.totalLeads ??
            (totalLeads > 0 ? totalLeads : csvData.length);
          finalizeUpload(
            progressData.message || progressData.summary?.message,
            progressData.summary || progressData.results || progressData,
            fallbackTotal
          );
          return;
        }

        handleProgressUpdate(progressData);
        if (progressData.status !== "completed" && progressData.status !== "finished") {
          const interval = setTimeout(pollProgress, 1000);
          setPollingIntervalId(interval);
        }
      } catch (error) {
        console.error("Progress polling error:", error);
      }
    };
    pollProgress();
  };

  const handleProgressUpdate = (progressData: any) => {
    if (!progressData) return;
    if (progressData.percentage !== undefined) {
      setUploadProgress(progressData.percentage);
    } else if (progressData.progress !== undefined) {
      setUploadProgress(progressData.progress);
    }
    let nextProcessed: number | undefined;
    let processedForRegister: number | undefined;
    if (progressData.processed !== undefined) {
      nextProcessed = Number(progressData.processed) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.processedCount !== undefined) {
      nextProcessed = Number(progressData.processedCount) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.results?.totalProcessed !== undefined) {
      nextProcessed = Number(progressData.results.totalProcessed) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.summary?.totalProcessed !== undefined) {
      nextProcessed = Number(progressData.summary.totalProcessed) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.uploadedCount !== undefined) {
      nextProcessed = Number(progressData.uploadedCount) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.completedCount !== undefined) {
      nextProcessed = Number(progressData.completedCount) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    } else if (progressData.processedRows !== undefined) {
      nextProcessed = Number(progressData.processedRows) || 0;
      setProcessedCount(nextProcessed);
      processedForRegister = nextProcessed;
    }
    // Derive processed count from per-user arrays when explicit counts are absent
    if (nextProcessed === undefined) {
      const successfulLen =
        (progressData.results?.successfulLeads?.length ?? progressData.successfulLeads?.length ?? 0);
      const failedLen =
        (progressData.results?.failedLeads?.length ?? progressData.failedLeads?.length ?? 0);
      const fallbackDerivedProcessed = successfulLen + failedLen;
      if (fallbackDerivedProcessed > 0) {
        nextProcessed = fallbackDerivedProcessed;
        setProcessedCount(fallbackDerivedProcessed);
        processedForRegister = fallbackDerivedProcessed;
      }
    }
    // Track success and failure counts for better UI feedback
    const derivedSuccess =
      typeof progressData.successful === "number"
        ? progressData.successful
        : typeof progressData.results?.successful === "number"
          ? progressData.results.successful
          : (progressData.results?.successfulLeads?.length ?? progressData.successfulLeads?.length ?? undefined);
    if (typeof derivedSuccess === "number") {
      setSuccessCount(derivedSuccess);
    }
    const derivedFailed =
      typeof progressData.failed === "number"
        ? progressData.failed
        : typeof progressData.results?.failed === "number"
          ? progressData.results.failed
          : (progressData.results?.failedLeads?.length ?? progressData.failedLeads?.length ?? undefined);
    if (typeof derivedFailed === "number") {
      setFailCount(derivedFailed);
    }
    let nextTotal: number | undefined;
    let totalForRegister: number | undefined;
    if (progressData.totalLeads !== undefined) {
      nextTotal = Number(progressData.totalLeads) || 0;
      setTotalLeads(nextTotal);
      totalForRegister = nextTotal;
    } else if (progressData.total !== undefined) {
      nextTotal = Number(progressData.total) || 0;
      setTotalLeads(nextTotal);
      totalForRegister = nextTotal;
    } else if (progressData.results?.totalLeads !== undefined) {
      nextTotal = Number(progressData.results.totalLeads) || 0;
      setTotalLeads(nextTotal);
      totalForRegister = nextTotal;
    } else if (progressData.summary?.details?.totalLeads !== undefined) {
      nextTotal = Number(progressData.summary.details.totalLeads) || 0;
      setTotalLeads(nextTotal);
      totalForRegister = nextTotal;
    }
    // Try to infer total leads from nested structures if not provided directly
    if (nextTotal === undefined) {
      const derivedTotal =
        (typeof progressData.results?.totalLeads === "number" && progressData.results.totalLeads > 0)
          ? progressData.results.totalLeads
          : (typeof progressData.summary?.details?.totalLeads === "number" && progressData.summary.details.totalLeads > 0)
            ? progressData.summary.details.totalLeads
            : (typeof progressData.summary?.totalLeads === "number" && progressData.summary.totalLeads > 0)
              ? progressData.summary.totalLeads
              : undefined;
      if (derivedTotal !== undefined) {
        nextTotal = derivedTotal;
        setTotalLeads(derivedTotal);
        totalForRegister = derivedTotal;
      }
    }
    const effectiveProcessedCandidate =
      typeof processedForRegister === "number"
        ? processedForRegister
        : typeof progressData.processed === "number"
          ? Number(progressData.processed)
          : typeof progressData.processedCount === "number"
            ? Number(progressData.processedCount)
            : typeof progressData.completedCount === "number"
              ? Number(progressData.completedCount)
              : undefined;

    const effectiveTotalCandidate =
      typeof totalForRegister === "number" && totalForRegister > 0
        ? totalForRegister
        : typeof progressData.totalLeads === "number"
          ? Number(progressData.totalLeads)
          : typeof progressData.total === "number"
            ? Number(progressData.total)
            : typeof progressData.totalProcessed === "number"
              ? Number(progressData.totalProcessed)
              : typeof progressData.summary?.details?.totalLeads === "number"
                ? Number(progressData.summary.details.totalLeads)
                : typeof progressData.summary?.totalLeads === "number"
                  ? Number(progressData.summary.totalLeads)
                  : typeof progressData.results?.totalLeads === "number"
                    ? Number(progressData.results.totalLeads)
                    : undefined;

    if (progressData.percentage === undefined && progressData.progress === undefined) {
      if (
        typeof effectiveProcessedCandidate === "number" &&
        typeof effectiveTotalCandidate === "number" &&
        effectiveTotalCandidate > 0
      ) {
        const computedPercentage = Math.min(
          100,
          (effectiveProcessedCandidate / effectiveTotalCandidate) * 100
        );
        setUploadProgress(computedPercentage);
      }
    }

    const percentDerivedProcessed =
      typeof effectiveTotalCandidate === "number" &&
        typeof progressData.percentage === "number"
        ? Math.round((progressData.percentage / 100) * effectiveTotalCandidate)
        : undefined;
    const fallbackTotalFromState = totalLeads > 0 ? totalLeads : csvData.length;

    registerRealProgressUpdate(
      typeof effectiveProcessedCandidate === "number"
        ? effectiveProcessedCandidate
        : percentDerivedProcessed,
      typeof effectiveTotalCandidate === "number" && effectiveTotalCandidate > 0
        ? effectiveTotalCandidate
        : fallbackTotalFromState > 0
          ? fallbackTotalFromState
          : undefined
    );

    if (progressData.currentLead) {
      setCurrentLead(progressData.currentLead);
    } else if (progressData.current) {
      setCurrentLead(progressData.current);
    } else if (progressData.currentRowData) {
      const c = progressData.currentRowData;
      setCurrentLead({
        name: deriveLeadName(c),
        email: c.email ?? "",
      });
    }

    const status = typeof progressData.status === "string" ? progressData.status.toLowerCase() : "";
    const fallbackTotal =
      progressData.totalLeads ??
      progressData.totalProcessed ??
      progressData.processed ??
      progressData.summary?.totalLeads ??
      progressData.summary?.totalProcessed ??
      (totalLeads > 0 ? totalLeads : csvData.length);

    if (status === "completed" || status === "finished") {
      finalizeUpload(
        progressData.message || progressData.summary?.message || progressData.results?.message,
        progressData.summary || progressData.results || progressData,
        fallbackTotal
      );
      return;
    }

    if (progressData.summary) {
      const normalizedSummary = normalizeUploadResults(progressData.summary, fallbackTotal);
      setUploadResults({
        message: progressData.summary.message || "Upload completed",
        results: normalizedSummary,
      });

      const summaryStatus =
        typeof progressData.summary.status === "string"
          ? progressData.summary.status.toLowerCase()
          : "";
      const summaryTotal =
        progressData.summary.totalLeads ??
        progressData.summary.totalProcessed ??
        progressData.summary.details?.totalLeads ??
        fallbackTotal;
      const summaryProcessed =
        progressData.summary.totalProcessed ??
        progressData.summary.processed ??
        progressData.summary.details?.totalLeads ??
        summaryTotal;

      if (
        summaryStatus === "completed" ||
        summaryStatus === "finished" ||
        (typeof summaryProcessed === "number" && typeof summaryTotal === "number" && summaryProcessed >= summaryTotal)
      ) {
        finalizeUpload(
          progressData.summary.message || progressData.message,
          progressData.summary,
          summaryTotal ?? fallbackTotal
        );
      }
      return;
    }

    if (progressData.results && (progressData.results.status || status)) {
      const resultsStatus =
        typeof progressData.results.status === "string"
          ? progressData.results.status.toLowerCase()
          : status;
      if (resultsStatus === "completed" || resultsStatus === "finished") {
        finalizeUpload(
          progressData.results.message || progressData.message,
          progressData.results,
          fallbackTotal
        );
      }
    }
  };

  const transformToSummaryData = (data: BulkUploadResponse): UploadSummaryData => {
    const successfulLeads = data.results.successfulLeads || [];
    const failedLeads = data.results.failedLeads || [];
    const apiMessage =
      data.message ??
      (data.results as any)?.message ??
      (data.results as any)?.summaryMessage ??
      (data.results as any)?.userMessage;
    return {
      message: apiMessage || "Bulk upload completed",
      details: {
        totalLeads: data.results.totalProcessed || csvData.length,
        successfulImports: data.results.successful || successfulLeads.length,
        failedImports: data.results.failed || failedLeads.length,
        successPercentage:
          data.results.totalProcessed && data.results.totalProcessed > 0
            ? Math.round(((data.results.successful || 0) / data.results.totalProcessed) * 100)
            : 0,
      },
      successfulLeads: successfulLeads.map((lead) => ({
        row: lead.row,
        name: lead.name || `${lead.data?.firstName || ""} ${lead.data?.lastName || ""}`.trim(),
        email: lead.email || lead.data?.email || "",
        leadId: lead.leadId,
      })),
      failedLeads: failedLeads.map((lead) => ({
        row: lead.row,
        error: lead.error || "Unknown error",
        data: lead.data,
      })),
      hasMoreSuccessful: successfulLeads.length > 50,
      hasMoreFailed: failedLeads.length > 50,
    };
  };

  useEffect(() => {
    if (uploadResults) {
      setUploadSummaryData(transformToSummaryData(uploadResults));
    } else {
      setUploadSummaryData(null);
    }
  }, [uploadResults]);

  const bulkUploadWithStreaming = async (leadsData: CSVLead[]) => {
    setIsStreamingMode(true);
    try {
      const requestPayload = {
        leads: leadsData,
        streamProgress: true,
      };
      const response = await authenticatedFetch(buildExternalUrl("/crm/leads/bulk-upload"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let userMessage = "Failed to upload leads.";
        try {
          const errorData = JSON.parse(errorText);
          userMessage =
            errorData.userMessage ??
            errorData.friendlyMessage ??
            errorData.message ??
            errorData.error ??
            (typeof errorData.details === "string" ? errorData.details : null) ??
            (Array.isArray(errorData.errors) ? errorData.errors[0] : null) ??
            userMessage;
        } catch {
          if (errorText && errorText.length < 200) userMessage = errorText;
        }
        throw new Error(typeof userMessage === "string" ? userMessage : "Failed to upload leads.");
      }
      if (!response.body) {
        const result = await response.json();
        finalizeUpload(result.message, result.results ?? result, leadsData.length);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const totalCount = leadsData.length;
      const readStream = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            console.log("Stream reading completed");
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              if (line.startsWith("data:")) {
                const jsonData = line.replace(/^data:\s*/, "");
                if (!jsonData || jsonData.trim() === "set") continue;
                const data = JSON.parse(jsonData);
                if (!data) continue;
                switch (data.type) {
                  case "start":
                    setUploadProgress(0);
                    setProcessedCount(0);
                    setTotalLeads(data.data?.totalLeads || leadsData.length);
                    break;
                  case "progress":
                    if (data.data) {
                      const progressData = data.data;
                      if (progressData.percentage !== undefined) {
                        setUploadProgress(progressData.percentage);
                      }
                      if (progressData.processed !== undefined) {
                        setProcessedCount(progressData.processed);
                      }
                      if (progressData.currentLead) {
                        setCurrentLead(progressData.currentLead);
                      }
                      if (progressData.totalLeads !== undefined) {
                        setTotalLeads(progressData.totalLeads);
                      }
                    }
                    break;
                  case "error":
                    throw new Error(data.data?.message || data.data || "Upload failed");
                  default: {
                    const nested = data.data || data.summary || data;
                    const statusValue =
                      typeof nested?.status === "string" ? nested.status.toLowerCase() : "";
                    handleProgressUpdate(nested);
                    // Heuristic: if the server emits per-lead events without explicit percentage,
                    // increment processed count to animate the loader.
                    const isPerLeadEvent = (
                      nested?.row !== undefined ||
                      nested?.leadId !== undefined ||
                      (nested?.name && nested?.email) ||
                      nested?.success === true ||
                      nested?.error !== undefined
                    ) && !nested?.summary;
                    if (isPerLeadEvent) {
                      setProcessedCount((prev) => {
                        const next = Math.min(totalCount, prev + 1);
                        const effectiveTotal = totalCount || totalLeads || csvData.length || 1;
                        setUploadProgress(Math.min(100, (next / effectiveTotal) * 100));
                        registerRealProgressUpdate(next, effectiveTotal);
                        return next;
                      });
                    }
                    if (nested?.summary || data.type === "summary" || data.type === "completed" || statusValue === "completed" || statusValue === "finished") {
                      const fallbackTotal =
                        nested?.totalLeads ??
                        nested?.totalProcessed ??
                        nested?.processed ??
                        nested?.summary?.totalLeads ??
                        (totalLeads > 0 ? totalLeads : csvData.length);
                      finalizeUpload(
                        nested?.message || nested?.summary?.message || data.message,
                        nested?.summary || nested,
                        fallbackTotal
                      );
                      return;
                    }
                    break;
                  }
                }
              }
            } catch (parseError) {
              console.error("Error parsing stream data:", parseError);
            }
          }
          readStream();
        } catch (error) {
          console.error("Stream reading error:", error);
          setIsUploading(false);
          throw error;
        }
      };
      readStream();
    } catch (error) {
      console.error("Bulk upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload leads");
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentLead(null);
      setProcessedCount(0);
      stopFallbackProgress();
    }
  };

  const handleBulkUpload = async () => {
    if (csvData.length === 0) {
      toast.error("Please upload a file first");
      return;
    }
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix all validation errors before uploading");
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailCount(0);
    // Build payload: omit empty email so backend can treat it as optional (allow leads with only phone/name)
    const leadsForUpload = csvData.map((lead) => {
      const base = {
        ...lead,
        leadName: lead.leadName || deriveLeadName(lead),
      };
      const email = base.email?.trim();
      if (!email) {
        const { email: _e, ...rest } = base;
        return rest as CSVLead;
      }
      return base;
    });
    setTotalLeads(leadsForUpload.length);
    setCurrentLead(null);
    setUploadResults(null);
    setShowResults(false);
    const shouldUsePolling = isProduction() || forcePollingMode();
    if (shouldUsePolling) {
      stopFallbackProgress();
    } else {
      startFallbackProgress(leadsForUpload.length);
    }
    try {
      // Initiate a session and poll progress by default (per-upload session API)
      if (shouldUsePolling) {
        await bulkUploadWithPolling(leadsForUpload as CSVLead[]);
      } else {
        await bulkUploadWithStreaming(leadsForUpload as CSVLead[]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Bulk upload failed";
      toast.error(msg);
      setIsUploading(false);
      stopFallbackProgress();
    }
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearTimeout(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  const startEdit = (index: number) => {
    setEditingRow(index);
    setEditedData({ ...csvData[index] });
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({} as CSVLead);
  };

  const saveEdit = () => {
    if (editingRow !== null) {
      const newData = [...csvData];
      const updatedLead = {
        ...editedData,
        leadName: deriveLeadName(editedData),
      };
      newData[editingRow] = updatedLead;
      setCsvData(newData);
      const errors = { ...validationErrors };
      const leadErrors = validateLead(updatedLead, editingRow);
      if (leadErrors.length > 0) {
        errors[editingRow] = leadErrors;
      } else {
        delete errors[editingRow];
      }
      setValidationErrors(errors);
      setEditingRow(null);
      setEditedData({} as CSVLead);
      toast.success("Row updated successfully");
    }
  };

  const updateField = (field: keyof CSVLead, value: string) => {
    setEditedData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "firstName" || field === "lastName") {
        updated.leadName = deriveLeadName(updated);
      }
      return updated;
    });
  };

  const handleReupload = () => {
    setBulkUploadStep("upload");
    setUploadedFileName("");
    setParsedSheets([]);
    setSelectedSheetName("");
    setColumnMapping({});
    setCsvData([]);
    setValidationErrors({});
    setEditingRow(null);
    setEditedData({} as CSVLead);
    setUploadProgress(0);
    setCurrentLead(null);
    setProcessedCount(0);
    setTotalLeads(0);
    stopFallbackProgress();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.success("Ready for new file upload");
  };

  const handleMapAgain = () => {
    if (!selectedSheet) {
      toast.error("Original sheet data is not available. Please reupload the file.");
      return;
    }

    setCsvData([]);
    setValidationErrors({});
    setEditingRow(null);
    setEditedData({} as CSVLead);
    setUploadProgress(0);
    setCurrentLead(null);
    setProcessedCount(0);
    setTotalLeads(0);
    stopFallbackProgress();

    setColumnMapping(resolveColumnMappingForHeaders(selectedSheet.headers));
    setBulkUploadStep("mapping");
  };

  const closeResults = () => {
    setShowResults(false);
    setUploadResults(null);
    if (pollingIntervalId) {
      clearTimeout(pollingIntervalId);
      setPollingIntervalId(null);
    }
  };

  const DownloadTemplateButton = () => (
    <Button
      onClick={downloadTemplate}
      disabled={isGeneratingTemplate}
      variant="outline"
      className="w-full justify-center gap-2 h-12"
    >
      {isGeneratingTemplate ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating Template...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download Excel Template
        </>
      )}
    </Button>
  );

  const downloadTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl("/crm/leads/bulk-upload/template"),
        { method: "GET" }
      );
      if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Lead_Bulk_Upload_Template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Lead template downloaded!");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error(`Failed to download template: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleClose = () => {
    handleReupload();
    onClose?.();
  };

  const containerClass =
    mode === "page"
      ? "min-h-screen bg-gray-50"
      : isInlineDealsMode
        ? "bg-[#14141b] rounded-lg shadow-sm border border-[#3a3a3a] px-2 sm:px-4 py-4 max-h-[70vh] overflow-y-auto text-[#e5e5e5]"
        : "bg-white rounded-lg shadow-sm border px-2 sm:px-4 py-4 max-h-[70vh] overflow-y-auto";

  return (
    <div className={`bulk-upload-leads-shell ${isInlineDealsMode ? "dark" : ""} ${containerClass}`}>
      {mode === "page" && (
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/leads"
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  <Users2 className="h-5 w-5 text-gray-600" />
                  <h1 className="text-xl font-semibold">Bulk Upload Leads</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={mode === "page" ? "p-6" : ""}>
        <div className={`${csvData.length > 0 ? "max-w-7xl" : "max-w-4xl"} mx-auto`}>
          {mode === "page" && csvData.length === 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-50">
                <FileText className="h-5 w-5" />
                Upload Instructions
              </h2>
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">Download Excel template</p>
                    <p>Get the Excel file with two tabs: Instructions and Lead Data with dropdowns</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">Fill in lead data</p>
                    <p>Use dropdowns in Excel for industries, sales funnels, stages, and countries</p>
                    <p className="text-xs mt-1 text-amber-600">Required: First Name, Last Name; and either Email or Phone. Supports &quot;First Name&quot; / &quot;firstName&quot; style headers (e.g. from Google Sheets).</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">Upload the completed Excel file</p>
                    <p>Upload the same Excel file with your lead data filled in</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {csvData.length === 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {bulkUploadStep === "upload" && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Step 1: Download Excel Template</Label>
                    <DownloadTemplateButton />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Step 2: Upload Your Excel File</Label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                      <Upload className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-300 mb-4" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Choose an Excel or CSV file to upload</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Supports .xlsx, .xls, and .csv files | Maximum size: 10MB</p>
                      </div>
                      <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="mt-4 w-full max-w-sm mx-auto" />
                    </div>
                  </div>
                </div>
              )}

              {bulkUploadStep === "sheet" && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium block">Step 3: Select Sheet to Import</Label>
                  <p className="text-xs text-muted-foreground">
                    File: <span className="font-medium">{uploadedFileName || "Uploaded file"}</span>
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Sheet Name</TableHead>
                          <TableHead className="text-right">Rows</TableHead>
                          <TableHead className="text-right">Columns</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedSheets.map((sheet) => (
                          <TableRow key={sheet.name}>
                            <TableCell>
                              <input
                                type="radio"
                                checked={selectedSheetName === sheet.name}
                                onChange={() => setSelectedSheetName(sheet.name)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{sheet.name}</TableCell>
                            <TableCell className="text-right">{sheet.rows.length}</TableCell>
                            <TableCell className="text-right">{sheet.headers.length}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={handleReupload}>
                      Back
                    </Button>
                    <Button onClick={handleContinueToMapping} className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white">
                      Continue to Column Mapping
                    </Button>
                  </div>
                </div>
              )}

              {bulkUploadStep === "mapping" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm font-medium block">Step 4: Map Columns</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sheet: <span className="font-medium">{selectedSheetName}</span>. For each field, choose a source column.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setBulkUploadStep(parsedSheets.length > 1 ? "sheet" : "upload")}>
                      Back
                    </Button>
                  </div>
                  <div className="max-h-[430px] overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white dark:bg-[#020617] z-10">
                        <TableRow>
                          <TableHead className="min-w-48">CRM Field</TableHead>
                          <TableHead className="min-w-56">File Column</TableHead>
                          <TableHead className="min-w-80">Top 10 Unique Values Preview</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MAPPABLE_FIELDS.map((field) => {
                          const selectedColumn = columnMapping[field.key] || "";
                          const columnIndex = selectedSheet?.headers.findIndex((header) => header === selectedColumn) ?? -1;
                          const previewValues: string[] =
                            columnIndex >= 0 && selectedSheet
                              ? Array.from(
                                  new Set(
                                    selectedSheet.rows
                                      .map((row) => String(row[columnIndex] ?? "").trim())
                                      .filter(Boolean)
                                  )
                                ).slice(0, 10)
                              : [];

                          return (
                            <TableRow key={field.key}>
                              <TableCell className="font-medium">
                                {field.label}
                                {field.required ? <span className="text-red-500 ml-1">*</span> : null}
                              </TableCell>
                              <TableCell>
                                <select
                                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                  value={selectedColumn}
                                  onChange={(event) =>
                                    setColumnMapping((prev) => ({
                                      ...prev,
                                      [field.key]: event.target.value || undefined,
                                    }))
                                  }
                                >
                                  <option value="">-- Skip --</option>
                                  {(selectedSheet?.headers || []).map((header) => (
                                    <option key={`${field.key}-${header}`} value={header}>
                                      {header}
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell>
                                {previewValues.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {previewValues.map((value, index) => (
                                      <Badge key={`${field.key}-${index}`} variant="secondary" className="max-w-[220px] truncate">
                                        {value}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No preview values</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handlePrepareMappedData} className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white">
                      Step 5: Load Mapped Data
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {csvData.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-gray-900 dark:text-gray-50">Lead Data</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Review the lead data, edit rows if needed, then click Upload when ready.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users2 className="h-3 w-3" />
                    {csvData.length} leads
                  </Badge>
                  {Object.keys(validationErrors).length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {Object.keys(validationErrors).length} errors
                    </Badge>
                  )}
                  <Button onClick={handleReupload} variant="outline" size="sm" className="ml-2 gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Reupload
                  </Button>
                  <Button
                    onClick={handleMapAgain}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!selectedSheet || isUploading}
                  >
                    <Edit3 className="h-3 w-3" />
                    Map Again
                  </Button>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#020617] max-h-96 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white dark:bg-[#020617] z-10">
                    <TableRow>
                      <TableHead className="w-12 text-gray-700 dark:text-gray-200">#</TableHead>
                      <TableHead className="min-w-36 text-gray-700 dark:text-gray-200">Lead Name</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">First Name*</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">Last Name*</TableHead>
                      <TableHead className="min-w-48 text-gray-700 dark:text-gray-200">Email / Phone*</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Phone</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Date of Birth</TableHead>
                      <TableHead className="min-w-36 text-gray-700 dark:text-gray-200">Company Name</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Industry</TableHead>
                      <TableHead className="min-w-48 text-gray-700 dark:text-gray-200">Website</TableHead>
                      <TableHead className="min-w-48 text-gray-700 dark:text-gray-200">Address</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Country</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">State</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">City</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">Pin Code</TableHead>
                      <TableHead className="min-w-36 text-gray-700 dark:text-gray-200">Product Name</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">Quantity</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">Pricing</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Negotiated Price</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Max Disc Price</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Sales Funnel</TableHead>
                      <TableHead className="min-w-24 text-gray-700 dark:text-gray-200">Stage</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Est Revenue</TableHead>
                      <TableHead className="min-w-48 text-gray-700 dark:text-gray-200">Notes</TableHead>
                      <TableHead className="min-w-36 text-gray-700 dark:text-gray-200">Next Follow-up</TableHead>
                      <TableHead className="min-w-32 text-gray-700 dark:text-gray-200">Assigned To</TableHead>
                      <TableHead className="w-20 text-gray-700 dark:text-gray-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.map((lead, index) => {
                      const hasErrors = validationErrors[index]?.length > 0;
                      const isEditing = editingRow === index;
                      return (
                        <TableRow
                          key={index}
                          className={`${hasErrors ? "bg-red-50 dark:bg-red-950" : ""} text-gray-900 dark:text-gray-100`}
                        >
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            {deriveLeadName(isEditing ? editedData : lead)}
                          </TableCell>
                          <TableCell className={hasErrors && !lead.firstName ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.firstName || ""} onChange={(e) => updateField("firstName", e.target.value)} className="h-8" />
                            ) : (
                              lead.firstName || ""
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && !lead.lastName ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.lastName || ""} onChange={(e) => updateField("lastName", e.target.value)} className="h-8" />
                            ) : (
                              lead.lastName || ""
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && (!lead.email && !lead.phoneNumber) ? "bg-red-100" : hasErrors && lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.email || ""} onChange={(e) => updateField("email", e.target.value)} className="h-8" type="email" placeholder="Optional if phone present" />
                            ) : (
                              lead.email || "-"
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && (!lead.email && !lead.phoneNumber) ? "bg-red-100" : ""}>{isEditing ? <Input value={editedData.phoneNumber || ""} onChange={(e) => updateField("phoneNumber", e.target.value)} className="h-8" placeholder="Optional if email present" /> : lead.phoneNumber || "-"}</TableCell>
                          <TableCell className={hasErrors && lead.dob && !/^\d{4}-\d{2}-\d{2}$/.test(lead.dob) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.dob || ""} onChange={(e) => updateField("dob", e.target.value)} className="h-8" placeholder="YYYY-MM-DD" />
                            ) : (
                              lead.dob || ""
                            )}
                          </TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.companyName || ""} onChange={(e) => updateField("companyName", e.target.value)} className="h-8" /> : lead.companyName || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.industry || ""} onChange={(e) => updateField("industry", e.target.value)} className="h-8" /> : lead.industry || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.website || ""} onChange={(e) => updateField("website", e.target.value)} className="h-8" /> : lead.website || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.address || ""} onChange={(e) => updateField("address", e.target.value)} className="h-8" /> : lead.address || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.country || ""} onChange={(e) => updateField("country", e.target.value)} className="h-8" /> : lead.country || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.state || ""} onChange={(e) => updateField("state", e.target.value)} className="h-8" /> : lead.state || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.city || ""} onChange={(e) => updateField("city", e.target.value)} className="h-8" /> : lead.city || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.pinCode || ""} onChange={(e) => updateField("pinCode", e.target.value)} className="h-8" /> : lead.pinCode || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.productName || ""} onChange={(e) => updateField("productName", e.target.value)} className="h-8" /> : lead.productName || ""}</TableCell>
                          <TableCell className={hasErrors && lead.quantity && isNaN(Number(lead.quantity)) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.quantity || ""} onChange={(e) => updateField("quantity", e.target.value)} className="h-8" />
                            ) : (
                              lead.quantity || ""
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && lead.pricing && isNaN(Number(lead.pricing)) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.pricing || ""} onChange={(e) => updateField("pricing", e.target.value)} className="h-8" />
                            ) : (
                              lead.pricing || ""
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && lead.negotiatedPricing && isNaN(Number(lead.negotiatedPricing)) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.negotiatedPricing || ""} onChange={(e) => updateField("negotiatedPricing", e.target.value)} className="h-8" />
                            ) : (
                              lead.negotiatedPricing || ""
                            )}
                          </TableCell>
                          <TableCell className={hasErrors && lead.MaxDiscPrice && isNaN(Number(lead.MaxDiscPrice)) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.MaxDiscPrice || ""} onChange={(e) => updateField("MaxDiscPrice", e.target.value)} className="h-8" />
                            ) : (
                              lead.MaxDiscPrice || ""
                            )}
                          </TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.salesFunnel || ""} onChange={(e) => updateField("salesFunnel", e.target.value)} className="h-8" /> : lead.salesFunnel || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.stage || ""} onChange={(e) => updateField("stage", e.target.value)} className="h-8" /> : lead.stage || ""}</TableCell>
                          <TableCell className={hasErrors && lead.estRevenue && isNaN(Number(lead.estRevenue)) ? "bg-red-100" : ""}>
                            {isEditing ? (
                              <Input value={editedData.estRevenue || ""} onChange={(e) => updateField("estRevenue", e.target.value)} className="h-8" />
                            ) : (
                              lead.estRevenue || ""
                            )}
                          </TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.notes || ""} onChange={(e) => updateField("notes", e.target.value)} className="h-8" /> : lead.notes || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.nextFollowUp || ""} onChange={(e) => updateField("nextFollowUp", e.target.value)} className="h-8" placeholder="YYYY-MM-DD" /> : lead.nextFollowUp || ""}</TableCell>
                          <TableCell>{isEditing ? <Input value={editedData.assignedTo || ""} onChange={(e) => updateField("assignedTo", e.target.value)} className="h-8" /> : lead.assignedTo || ""}</TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button onClick={saveEdit} size="sm" variant="outline" className="h-8 px-2">
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button onClick={cancelEdit} size="sm" variant="outline" className="h-8 px-2">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button onClick={() => startEdit(index)} size="sm" variant="ghost" className="h-8 px-2">
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {Object.keys(validationErrors).length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <div className="font-semibold mb-1">Please fix the following errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(validationErrors).map(([index, errors]) => (
                      <li key={index}>
                        Row {Number(index) + 1}: {errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isUploading && (
                <div className="space-y-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-blue-800">Upload Progress</Label>
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {processedCount} / {totalLeads} leads
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="w-full h-2" />
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>{uploadProgress.toFixed(1)}% complete</span>
                      <span>Success: {successCount} | Failed: {failCount}</span>
                      <span>{Math.max(0, totalLeads - processedCount)} remaining</span>
                    </div>
                  </div>
                  {currentLead && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="font-medium text-gray-700">Currently processing:</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <div className="font-medium">{currentLead.name}</div>
                        <div className="text-xs text-gray-500">{currentLead.email}</div>
                      </div>
                    </div>
                  )}
                  {!currentLead && processedCount > 0 && (
                    <div className="text-sm text-blue-600 text-center">Preparing to process leads...</div>
                  )}
                </div>
              )}

              <Button
                onClick={handleBulkUpload}
                disabled={csvData.length === 0 || isUploading || Object.keys(validationErrors).length > 0}
                className={`w-full h-12 mt-4 ${
                  Object.keys(validationErrors).length > 0
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading... {isStreamingMode && `(${processedCount}/${totalLeads})`}
                  </>
                ) : Object.keys(validationErrors).length > 0 ? (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Fix {Object.keys(validationErrors).length} Errors First
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {csvData.length} Leads
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden bg-white dark:bg-[#020617]">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl text-gray-900 dark:text-gray-50">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Bulk Upload Results
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 dark:text-gray-300">
              Summary of the bulk lead upload process
            </DialogDescription>
          </DialogHeader>
          {uploadSummaryData ? (
            <div className="overflow-auto max-h-[70vh]">
              <UploadSummary summaryData={uploadSummaryData} />
              <div className="flex gap-3 justify-end pt-6 border-t border-gray-200 dark:border-gray-700 mt-6 bg-gray-50 dark:bg-[#020617] -mx-6 px-6 py-4">
                <Button variant="outline" onClick={closeResults} className="px-6">
                  Close
                </Button>
                {mode === "page" ? (
                  <Button
                    onClick={() => {
                      closeResults();
                      router.push("/leads");
                    }}
                    className="px-6"
                  >
                    View All Leads
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      closeResults();
                      onUploadComplete?.();
                      onClose?.();
                    }}
                    className="px-6 bg-yellow-500 text-black hover:bg-yellow-600"
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Loading results...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {mode === "dialog" && csvData.length === 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            className={isInlineDealsMode ? "border-[#3a3a3a] bg-[#1f1f1f] text-[#e5e5e5] hover:bg-[#2a2a2a]" : ""}
          >
            Cancel
          </Button>
        </div>
      )}
      {isInlineDealsMode && (
        <style jsx global>{`
          .bulk-upload-leads-shell .bg-white {
            background-color: #1a1a22 !important;
            color: #e5e5e5 !important;
          }
          .bulk-upload-leads-shell .text-gray-900 {
            color: #e5e5e5 !important;
          }
          .bulk-upload-leads-shell .text-gray-700,
          .bulk-upload-leads-shell .text-gray-600,
          .bulk-upload-leads-shell .text-gray-500 {
            color: #9ca3af !important;
          }
          .bulk-upload-leads-shell .border-gray-200,
          .bulk-upload-leads-shell .border-gray-300 {
            border-color: #3a3a3a !important;
          }
          .bulk-upload-leads-shell input,
          .bulk-upload-leads-shell textarea,
          .bulk-upload-leads-shell select {
            background-color: #1f1f1f !important;
            border-color: #3a3a3a !important;
            color: #e5e5e5 !important;
          }
        `}</style>
      )}
    </div>
  );
};

export default BulkUploadLeadsFlow;

