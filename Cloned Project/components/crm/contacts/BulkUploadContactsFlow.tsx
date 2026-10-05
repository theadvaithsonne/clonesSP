"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users2,
  Loader2,
  Edit3,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import * as XLSX from "xlsx";
import { useTheme } from "next-themes";

const CONTACT_TEMPLATE_URL =
  "https://nela-app.s3.us-east-1.amazonaws.com/uploads/1762608244262-contacts_bulk_upload_template.xlsx";

interface CSVContact {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role?: string;
  companyName?: string;
  ownerEmail?: string;
}

interface UploadResult {
  row: number;
  contactId?: string;
  name?: string;
  email?: string;
  data?: CSVContact;
  error?: string;
}

interface BulkUploadResponse {
  message: string;
  results: {
  totalProcessed: number;
  successful: number;
  failed: number;
    successfulContacts: UploadResult[];
    failedContacts: UploadResult[];
  };
}

interface UploadSummaryData {
  message: string;
  details: {
    totalContacts: number;
    successfulImports: number;
    failedImports: number;
    successPercentage: number;
  };
  successfulContacts: Array<{
    row: number;
    name: string;
    email: string;
    contactId?: string;
  }>;
  failedContacts: Array<{
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

interface BulkUploadContactsFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

function UploadSummary({ summaryData }: { summaryData: UploadSummaryData }) {
  const { details, successfulContacts, failedContacts, hasMoreSuccessful, hasMoreFailed } = summaryData;

  return (
    <div className="upload-summary space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{summaryData.message}</h2>
      </div>

      <div className="summary-stats">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-item bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{details.totalContacts}</div>
            <div className="text-sm text-blue-600 font-medium">Total Contacts</div>
          </div>
          <div className="stat-item bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{details.successfulImports}</div>
            <div className="text-sm text-green-600 font-medium">Successful</div>
          </div>
          <div className="stat-item bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{details.failedImports}</div>
            <div className="text-sm text-red-600 font-medium">Failed</div>
          </div>
          <div className="stat-item bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{details.successPercentage}%</div>
            <div className="text-sm text-purple-600 font-medium">Success Rate</div>
          </div>
        </div>
      </div>

      {successfulContacts.length > 0 && (
        <div className="successful-section">
          <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Successfully Imported ({successfulContacts.length}
            {hasMoreSuccessful ? "+" : ""})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {successfulContacts.map((contact, index) => (
                  <TableRow key={index} className="bg-green-50">
                    <TableCell className="font-medium text-center">{contact.row}</TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-gray-600">{contact.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {failedContacts.length > 0 && (
        <div className="failed-section">
          <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Failed Imports ({failedContacts.length}
            {hasMoreFailed ? "+" : ""})
          </h3>
          <div className="border rounded-lg overflow-hidden">
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
                {failedContacts.map((contact, index) => (
                  <TableRow key={index} className="bg-red-50">
                    <TableCell className="font-medium text-center">{contact.row}</TableCell>
                    <TableCell className="font-medium">
                      {contact.data ? `${contact.data.firstName || ""} ${contact.data.lastName || ""}`.trim() : "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-600">{contact.data?.email || "N/A"}</TableCell>
                    <TableCell className="text-sm text-red-600">{contact.error}</TableCell>
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

const normalizeKey = (key: string): string =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const mapRowToContact = (row: Record<string, any>): CSVContact => {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), typeof value === "string" ? value.trim() : value])
  );

  const safeString = (value: any) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  };

  const pickValue = (...keywords: string[]) => {
    for (const key of keywords) {
      if (key in normalized) {
        return safeString(normalized[key]);
      }
    }
    const normalizedKeys = Object.keys(normalized);
    for (const normalizedKey of normalizedKeys) {
      for (const keyword of keywords) {
        if (
          normalizedKey.includes(keyword) &&
          normalized[normalizedKey] !== undefined &&
          normalized[normalizedKey] !== null
        ) {
          const value = normalized[normalizedKey];
          if (value !== "") {
            return safeString(value);
          }
        }
      }
    }
    return "";
  };

  return {
    firstName: pickValue("firstname", "first", "givenname", "contactfirstname"),
    lastName: pickValue("lastname", "last", "surname", "contactlastname"),
    email: pickValue("email", "emailaddress", "primaryemail", "emailid"),
    phoneNumber: pickValue("phonenumber", "phone", "mobile", "contactnumber", "mobilenumber", "phone1"),
    role: pickValue("role", "designation", "position", "title"),
    companyName: pickValue("companyname", "company", "organization", "account", "businessname"),
    ownerEmail: pickValue("owneremail", "owner", "assignedto", "accountowner"),
  };
};

const parseExcelFile = (file: File): Promise<CSVContact[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        const contacts = rows.map(mapRowToContact).filter((row) => Object.values(row).some((value) => value));
        resolve(contacts);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });

const parseCSV = (csvText: string): CSVContact[] => {
  const [headerLine, ...dataLines] = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (!headerLine) return [];

  const headers = headerLine
    .split(",")
    .map((header) => header.trim().replace(/^"(.*)"$/, "$1"))
    .map(normalizeKey);

  const contacts: CSVContact[] = [];
  dataLines.forEach((line) => {
    const values = line
      .split(",")
      .map((value) => value.trim().replace(/^"(.*)"$/, "$1"));
    if (values.length !== headers.length) return;
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    contacts.push(mapRowToContact(row));
  });
  return contacts;
};

const REQUIRED_FIELDS: Array<keyof CSVContact> = ["firstName", "lastName", "email"];

const validateContact = (contact: CSVContact): string[] => {
  const errors: string[] = [];
  REQUIRED_FIELDS.forEach((field) => {
    if (!contact[field] || contact[field]!.toString().trim().length === 0) {
      errors.push(`${field} is required`);
    }
  });
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push("Valid email address is required");
  }
  return errors;
};

const normalizeUploadResults = (raw: any, fallbackTotal: number): BulkUploadResponse["results"] => {
  const source = raw?.summary || raw?.results || raw || {};

  const successfulContacts = Array.isArray(source.successfulContacts)
    ? source.successfulContacts
    : Array.isArray(raw?.successfulContacts)
    ? raw.successfulContacts
    : Array.isArray(source.successfulRows)
    ? source.successfulRows
    : Array.isArray(source.successfulLeads)
    ? source.successfulLeads
    : [];

  const failedContacts = Array.isArray(source.failedContacts)
    ? source.failedContacts
    : Array.isArray(raw?.failedContacts)
    ? raw.failedContacts
    : Array.isArray(source.failedRows)
    ? source.failedRows
    : Array.isArray(source.failedLeads)
    ? source.failedLeads
    : [];

  const resolvedTotal =
    source.totalProcessed ??
    source.totalContacts ??
    source.total ??
    source.processed ??
    source.count ??
    fallbackTotal;

  const resolvedSuccessful =
    source.successful ??
    source.successfulImports ??
    source.successfulCount ??
    source.success ??
    source.results?.successful ??
    (Array.isArray(successfulContacts) ? successfulContacts.length : undefined);

  const resolvedFailed =
    source.failed ??
    source.failedImports ??
    source.failedCount ??
    source.failure ??
    source.results?.failed ??
    (Array.isArray(failedContacts) ? failedContacts.length : undefined);

  return {
    totalProcessed:
      typeof resolvedTotal === "number" && resolvedTotal > 0 ? resolvedTotal : fallbackTotal,
    successful:
      typeof resolvedSuccessful === "number" ? resolvedSuccessful : successfulContacts.length,
    failed: typeof resolvedFailed === "number" ? resolvedFailed : failedContacts.length,
    successfulContacts,
    failedContacts,
  };
};

const transformToSummaryData = (data: BulkUploadResponse, fallbackTotal: number): UploadSummaryData => {
  const total = data.results.totalProcessed || fallbackTotal;
  const successfulContacts = data.results.successfulContacts || [];
  const failedContacts = data.results.failedContacts || [];

  return {
    message: data.message || "Bulk upload completed",
    details: {
      totalContacts: total,
      successfulImports: data.results.successful || successfulContacts.length,
      failedImports: data.results.failed || failedContacts.length,
      successPercentage:
        total > 0
          ? Math.round(((data.results.successful || successfulContacts.length) / total) * 100)
          : 0,
    },
    successfulContacts: successfulContacts.map((contact) => ({
      row: contact.row,
      name: contact.name || `${contact.data?.firstName || ""} ${contact.data?.lastName || ""}`.trim(),
      email: contact.email || contact.data?.email || "",
      contactId: contact.contactId,
    })),
    failedContacts: failedContacts.map((contact) => ({
      row: contact.row,
      error: contact.error || "Unknown error",
      data: contact.data,
    })),
    hasMoreSuccessful: successfulContacts.length > 50,
    hasMoreFailed: failedContacts.length > 50,
  };
};

const BulkUploadContactsFlow = ({ open, onOpenChange, onUploadComplete }: BulkUploadContactsFlowProps) => {
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<CSVContact[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<CSVContact>({} as CSVContact);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [currentContact, setCurrentContact] = useState<{ name: string; email: string } | null>(null);
  const [uploadResults, setUploadResults] = useState<BulkUploadResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [uploadSummaryData, setUploadSummaryData] = useState<UploadSummaryData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const csvDataRef = useRef<CSVContact[]>([]);
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

  const resetState = useCallback(() => {
    setCsvData([]);
        setValidationErrors({});
    setEditingRow(null);
    setEditedData({} as CSVContact);
        setIsUploading(false);
        setUploadProgress(0);
        setProcessedCount(0);
    setTotalContacts(0);
    setCurrentContact(null);
    setUploadResults(null);
    setShowResults(false);
    setIsStreamingMode(false);
    setSessionId(null);
        setSuccessCount(0);
        setFailCount(0);
    setUploadSummaryData(null);
    setIsParsing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
  }, []);

  const handleDialogChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetState();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetState]
  );

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

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
        if (!meta.active || meta.total <= 0) return;
        const idleDuration = Date.now() - meta.lastActualTimestamp;
        if (idleDuration < 1200) return;

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

          const contactsSnapshot = csvDataRef.current;
          const contactIndex = Math.min(next - 1, contactsSnapshot.length - 1);
          if (contactIndex >= 0 && contactsSnapshot[contactIndex]) {
            const contact = contactsSnapshot[contactIndex];
            setCurrentContact({
              name: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
              email: contact.email ?? "",
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
      if (pollingIntervalId) {
        clearTimeout(pollingIntervalId);
      }
    };
  }, [pollingIntervalId, stopFallbackProgress]);

  const validateAllRows = useCallback(
    (rows: CSVContact[]) => {
      const errors: Record<number, string[]> = {};
      rows.forEach((row, index) => {
        const rowErrors = validateContact(row);
        if (rowErrors.length > 0) {
          errors[index] = rowErrors;
        }
      });
      setValidationErrors(errors);
      return errors;
    },
    []
  );

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
      setIsParsing(true);
      let contacts: CSVContact[] = [];
      if (isExcel) {
        contacts = await parseExcelFile(file);
        toast.success(`Successfully parsed ${contacts.length} contacts from Excel file`);
      } else {
        const reader = new FileReader();
        contacts = await new Promise<CSVContact[]>((resolve, reject) => {
          reader.onload = (e) => {
            try {
              const csvText = e.target?.result as string;
              const parsed = parseCSV(csvText);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read CSV file"));
          reader.readAsText(file);
        });
        toast.success(`Successfully parsed ${contacts.length} contacts from CSV file`);
      }

      setCsvData(contacts);
      setIsPreviewOpen(true);
      const errors = validateAllRows(contacts);
      if (Object.keys(errors).length > 0) {
        toast.warning(
          `Found ${Object.keys(errors).length} row${Object.keys(errors).length === 1 ? "" : "s"} with validation issues. Please review before uploading.`
        );
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error(`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`);
    setCsvData([]);
    setIsPreviewOpen(false);
      setValidationErrors({});
    } finally {
      setIsParsing(false);
    }
  };

  const startEdit = (index: number) => {
    setEditingRow(index);
    setEditedData({ ...csvData[index] });
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({} as CSVContact);
  };

  const saveEdit = () => {
    if (editingRow === null) return;
    const index = editingRow;
    const newData = [...csvData];
    newData[index] = editedData;
    setCsvData(newData);
    const errors = { ...validationErrors };
    const rowErrors = validateContact(editedData);
      if (rowErrors.length > 0) {
      errors[index] = rowErrors;
      } else {
      delete errors[index];
    }
    setValidationErrors(errors);
    setEditingRow(null);
    setEditedData({} as CSVContact);
    toast.success("Row updated successfully");
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
      const params = new URLSearchParams(window.location.search);
      if (params.get("polling") === "true") return true;
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

  const finalizeUpload = useCallback(
    (message: string | undefined, rawResults: any, fallbackTotal: number) => {
      const normalized = normalizeUploadResults(rawResults, fallbackTotal);
      const successCountResolved =
        typeof normalized.successful === "number"
          ? normalized.successful
          : normalized.successfulContacts.length;
      const finalMessage =
        message ||
        `Bulk upload completed! ${successCountResolved || 0} ${
          successCountResolved === 1 ? "contact" : "contacts"
        } created successfully.`;

      stopFallbackProgress();
      registerRealProgressUpdate(normalized.totalProcessed, normalized.totalProcessed || fallbackTotal);
      setUploadProgress(100);
      setProcessedCount(normalized.totalProcessed);
      setTotalContacts(normalized.totalProcessed);
      setSuccessCount(successCountResolved || 0);
      setFailCount(
        typeof normalized.failed === "number" ? normalized.failed : normalized.failedContacts.length
      );
      setCurrentContact(null);
      const payload: BulkUploadResponse = { message: finalMessage, results: normalized };
      setUploadResults(payload);
      setShowResults(true);
      setCsvData([]);
      setValidationErrors({});
      setEditingRow(null);
      setEditedData({} as CSVContact);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploading(false);
      setIsStreamingMode(false);
      if (pollingIntervalId) {
        clearTimeout(pollingIntervalId);
        setPollingIntervalId(null);
      }
      toast.success(finalMessage);
      onUploadComplete?.();
    },
    [onUploadComplete, pollingIntervalId, registerRealProgressUpdate, stopFallbackProgress]
  );

  const bulkUploadWithPolling = async (contactsData: CSVContact[]) => {
    try {
      const requestPayload = {
        contacts: contactsData,
        streamProgress: true,
        usePolling: true,
      };
      const response = await authenticatedFetch(buildExternalUrl("/crm/contacts/bulk-upload"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to start upload");
      }
      const result = await response.json();
      if (result.sessionId) {
        setSessionId(result.sessionId);
        startProgressPolling(result.sessionId);
        return result.sessionId;
      } else {
        finalizeUpload(result.message, result.results ?? result, contactsData.length);
        return "completed";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  };

  const handleProgressUpdate = useCallback(
    (progressData: any) => {
      if (!progressData || !isUploading) return;

      if (progressData.percentage !== undefined) {
        setUploadProgress(progressData.percentage);
      } else if (progressData.progress !== undefined) {
        setUploadProgress(progressData.progress);
      }

      let processedForRegister: number | undefined;
      if (progressData.processed !== undefined) {
        const nextProcessed = Number(progressData.processed) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      } else if (progressData.processedCount !== undefined) {
        const nextProcessed = Number(progressData.processedCount) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      } else if (progressData.results?.totalProcessed !== undefined) {
        const nextProcessed = Number(progressData.results.totalProcessed) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      } else if (progressData.summary?.totalProcessed !== undefined) {
        const nextProcessed = Number(progressData.summary.totalProcessed) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      } else if (progressData.uploadedCount !== undefined) {
        const nextProcessed = Number(progressData.uploadedCount) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      } else if (progressData.completedCount !== undefined) {
        const nextProcessed = Number(progressData.completedCount) || 0;
        setProcessedCount(nextProcessed);
        processedForRegister = nextProcessed;
      }

      const successFromData =
        typeof progressData.successful === "number"
          ? progressData.successful
          : typeof progressData.results?.successful === "number"
          ? progressData.results.successful
          : progressData.results?.successfulContacts?.length ??
            progressData.successfulContacts?.length;
      if (typeof successFromData === "number") {
        setSuccessCount(successFromData);
      }

      const failedFromData =
        typeof progressData.failed === "number"
          ? progressData.failed
          : typeof progressData.results?.failed === "number"
          ? progressData.results.failed
          : progressData.results?.failedContacts?.length ??
            progressData.failedContacts?.length;
      if (typeof failedFromData === "number") {
        setFailCount(failedFromData);
      }

      let totalForRegister: number | undefined;
      if (progressData.totalContacts !== undefined) {
        const nextTotal = Number(progressData.totalContacts) || 0;
        setTotalContacts(nextTotal);
        totalForRegister = nextTotal;
      } else if (progressData.total !== undefined) {
        const nextTotal = Number(progressData.total) || 0;
        setTotalContacts(nextTotal);
        totalForRegister = nextTotal;
      } else if (progressData.results?.totalProcessed !== undefined) {
        const nextTotal = Number(progressData.results.totalProcessed) || 0;
        setTotalContacts(nextTotal);
        totalForRegister = nextTotal;
      } else if (progressData.summary?.details?.totalContacts !== undefined) {
        const nextTotal = Number(progressData.summary.details.totalContacts) || 0;
        setTotalContacts(nextTotal);
        totalForRegister = nextTotal;
      } else if (progressData.summary?.totalContacts !== undefined) {
        const nextTotal = Number(progressData.summary.totalContacts) || 0;
        setTotalContacts(nextTotal);
        totalForRegister = nextTotal;
      }

      const fallbackTotalFromState = totalContacts > 0 ? totalContacts : csvData.length;

      registerRealProgressUpdate(
        processedForRegister,
        typeof totalForRegister === "number" && totalForRegister > 0
          ? totalForRegister
          : fallbackTotalFromState > 0
          ? fallbackTotalFromState
          : undefined
      );

      if (progressData.currentContact) {
        setCurrentContact(progressData.currentContact);
      } else if (progressData.current) {
        setCurrentContact(progressData.current);
      } else if (progressData.currentRowData) {
        const c = progressData.currentRowData;
        setCurrentContact({
          name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
          email: c.email ?? "",
        });
      }

      const status = typeof progressData.status === "string" ? progressData.status.toLowerCase() : "";
      const fallbackTotal =
        progressData.totalContacts ??
        progressData.totalProcessed ??
        progressData.processed ??
        progressData.summary?.totalContacts ??
        progressData.summary?.totalProcessed ??
        (totalContacts > 0 ? totalContacts : csvData.length);

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
          progressData.summary.totalContacts ??
          progressData.summary.totalProcessed ??
          progressData.summary.details?.totalContacts ??
          fallbackTotal;
        const summaryProcessed =
          progressData.summary.totalProcessed ??
          progressData.summary.processed ??
          progressData.summary.details?.totalContacts ??
          summaryTotal;

        if (
          summaryStatus === "completed" ||
          summaryStatus === "finished" ||
          (typeof summaryProcessed === "number" &&
            typeof summaryTotal === "number" &&
            summaryProcessed >= summaryTotal)
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
    },
    [
      csvData.length,
      finalizeUpload,
      isUploading,
      registerRealProgressUpdate,
      totalContacts,
    ]
  );

  const startProgressPolling = (sessionIdParam: string) => {
    const pollProgress = async () => {
      try {
        const progressResponse = await authenticatedFetch(
          buildExternalUrl(`crm/contacts/bulk-upload/progress/${sessionIdParam}`),
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
            progressData.totalContacts ??
            progressData.totalProcessed ??
            progressData.processed ??
            progressData.summary?.totalContacts ??
            (totalContacts > 0 ? totalContacts : csvData.length);
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

  const bulkUploadWithStreaming = async (contactsData: CSVContact[]) => {
    setIsStreamingMode(true);
    try {
      const response = await authenticatedFetch(buildExternalUrl("/crm/contacts/bulk-upload"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: contactsData,
          streamProgress: true,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload contacts: ${errorText}`);
      }
      if (!response.body) {
      const result = await response.json();
        finalizeUpload(result.message, result.results ?? result, contactsData.length);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const totalCount = contactsData.length;
      const readStream = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read();
          if (done) {
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
                    setTotalContacts(data.data?.totalContacts || contactsData.length);
                    break;
                  case "progress":
                    if (data.data) {
                      const progressPayload = data.data;
                      if (progressPayload.percentage !== undefined) {
                        setUploadProgress(progressPayload.percentage);
                      }
                      if (progressPayload.processed !== undefined) {
                        setProcessedCount(progressPayload.processed);
                      }
                      if (progressPayload.currentContact) {
                        setCurrentContact(progressPayload.currentContact);
                      }
                      if (progressPayload.totalContacts !== undefined) {
                        setTotalContacts(progressPayload.totalContacts);
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
                    const isPerContactEvent =
                      (nested?.row !== undefined ||
                        nested?.contactId !== undefined ||
                        (nested?.name && nested?.email) ||
                        nested?.success === true ||
                        nested?.error !== undefined) &&
                      !nested?.summary;
                    if (isPerContactEvent) {
                      setProcessedCount((prev) => {
                        const next = Math.min(totalCount, prev + 1);
                        const effectiveTotal = totalCount || totalContacts || csvData.length || 1;
                        setUploadProgress(Math.min(100, (next / effectiveTotal) * 100));
                        registerRealProgressUpdate(next, effectiveTotal);
                        return next;
                      });
                    }
                    if (
                      nested?.summary ||
                      data.type === "summary" ||
                      data.type === "completed" ||
                      statusValue === "completed" ||
                      statusValue === "finished"
                    ) {
                      const fallbackTotal =
                        nested?.totalContacts ??
                        nested?.totalProcessed ??
                        nested?.processed ??
                        nested?.summary?.totalContacts ??
                        (totalContacts > 0 ? totalContacts : csvData.length);
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
      toast.error(error instanceof Error ? error.message : "Failed to upload contacts");
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentContact(null);
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
    setIsPreviewOpen(false);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailCount(0);
    setTotalContacts(csvData.length);
    setCurrentContact(null);
    setUploadResults(null);
    setShowResults(false);
    startFallbackProgress(csvData.length);
    try {
      if (isProduction() || forcePollingMode()) {
        await bulkUploadWithPolling(csvData);
      } else {
        await bulkUploadWithStreaming(csvData);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk upload failed");
      setIsUploading(false);
      stopFallbackProgress();
    }
  };

  useEffect(() => {
    if (uploadResults) {
      setUploadSummaryData(transformToSummaryData(uploadResults, totalContacts || csvData.length));
    } else {
      setUploadSummaryData(null);
    }
  }, [csvData.length, totalContacts, uploadResults]);

  const handleReupload = () => {
    resetState();
    toast.success("Ready for new file upload");
  };

  const closeResults = () => {
    setShowResults(false);
    setUploadResults(null);
    if (pollingIntervalId) {
      clearTimeout(pollingIntervalId);
      setPollingIntervalId(null);
    }
  };

  const downloadTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      const link = document.createElement("a");
      link.href = CONTACT_TEMPLATE_URL;
      link.download = "Contacts_Bulk_Upload_Template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Contact template downloaded!");
    } catch (error) {
      console.error("Template download error:", error);
      window.open(CONTACT_TEMPLATE_URL, "_blank");
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className={
        resolvedTheme === "dark"
          ? "max-w-5xl max-h-[90vh] overflow-hidden bg-[#0f0f10] border-[#27272a] text-[#e5e7eb] dark"
          : "max-w-5xl max-h-[90vh] overflow-hidden"
      }>
        <DialogHeader>
          <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : ""}>Bulk Upload Contacts</DialogTitle>
          <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : ""}>
            Upload an Excel or CSV file, review for issues, and track real-time upload progress.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-y-auto pr-2">
          {/* Step cards - stacked vertically: download template on top, upload file below */}
          <div className={
            resolvedTheme === "dark"
              ? "flex flex-col gap-5 rounded-lg border border-dashed border-[#3f3f46] bg-[#18181b] p-6"
              : "flex flex-col gap-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6"
          }>
            {/* Step 1: Download template */}
            <div className="flex flex-col gap-2">
              <Label className={
                resolvedTheme === "dark"
                  ? "text-sm font-semibold text-[#f3f4f6]"
                  : "text-sm font-semibold text-gray-700"
              }>
                Step 1: Download template
              </Label>
              <Button
                onClick={downloadTemplate}
                variant="outline"
                className={
                  resolvedTheme === "dark"
                    ? "w-full justify-center gap-2 h-11 bg-[#27272a] border-[#3f3f46] text-[#f3f4f6] cursor-pointer transition-all duration-200 hover:bg-[#3f3f46] hover:border-[#52525b] hover:scale-[1.01] active:scale-[0.99]"
                    : "w-full justify-center gap-2 h-11 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                }
                disabled={isGeneratingTemplate}
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
              <p className={
                resolvedTheme === "dark"
                  ? "text-xs text-[#9ca3af]"
                  : "text-xs text-gray-500"
              }>
                Includes required columns for first name, last name, and email.
              </p>
            </div>

            {/* Step 2: Upload completed file */}
            <div className="flex flex-col gap-2">
              <Label className={
                resolvedTheme === "dark"
                  ? "text-sm font-semibold text-[#f3f4f6]"
                  : "text-sm font-semibold text-gray-700"
              }>
                Step 2: Upload completed file
              </Label>
              <div className={
                resolvedTheme === "dark"
                  ? "rounded-lg border-2 border-dashed border-[#3f3f46] bg-[#0f0f10] p-6 text-center transition-colors duration-200 hover:border-[#52525b] hover:bg-[#18181b]"
                  : "rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center transition-colors duration-200 hover:border-gray-400 hover:bg-gray-50"
              }>
                <Upload className={
                  resolvedTheme === "dark"
                    ? "mx-auto mb-3 h-8 w-8 text-[#9ca3af]"
                    : "mx-auto mb-3 h-8 w-8 text-gray-400"
                } />
                <p className={
                  resolvedTheme === "dark"
                    ? "text-sm text-[#d1d5db]"
                    : "text-sm text-gray-600"
                }>
                  Drag and drop your Excel or CSV file here, or click to select it.
                </p>
                <p className={
                  resolvedTheme === "dark"
                    ? "text-xs text-[#9ca3af] mt-1"
                    : "text-xs text-gray-500 mt-1"
                }>
                  Supports .xlsx, .xls, .csv (max 10MB)
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className={
                    resolvedTheme === "dark"
                      ? "mt-4 cursor-pointer bg-[#18181b] border-[#3f3f46] text-[#e5e7eb] file:text-[#e5e7eb]"
                      : "mt-4 cursor-pointer"
                  }
                  onChange={handleFileUpload}
                  disabled={isParsing || isUploading}
                />
              </div>
            </div>
          </div>

          <Dialog open={isPreviewOpen} onOpenChange={(open) => setIsPreviewOpen(open && csvData.length > 0)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <Users2 className="h-5 w-5" />
                  Preview Contacts ({csvData.length})
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Review parsed contacts, fix validation issues, or re-upload the file before starting the bulk upload.
                </DialogDescription>
              </DialogHeader>

              {csvData.length > 0 ? (
                <div className="space-y-4 overflow-auto max-h-[65vh] pr-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Badge variant="secondary" className="gap-1">
                      <Users2 className="h-3 w-3" />
                      {csvData.length} contacts
                    </Badge>
                    {Object.keys(validationErrors).length > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {Object.keys(validationErrors).length} errors
                      </Badge>
                    )}
                    <Button
                      onClick={handleReupload}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isUploading}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reupload
                    </Button>
                </div>

                  <div className="border rounded-lg bg-white dark:bg-[#020617]">
                <Table>
                      <TableHeader className="sticky top-0 bg-white dark:bg-[#020617] z-10">
                    <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>First Name *</TableHead>
                      <TableHead>Last Name *</TableHead>
                      <TableHead>Email *</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Owner Email</TableHead>
                          <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                        {csvData.map((contact, index) => {
                          const rowErrors = validationErrors[index] ?? [];
                          const hasErrors = rowErrors.length > 0;
                          const isEditing = editingRow === index;
                      return (
                            <TableRow
                              key={index}
                              className={hasErrors ? "bg-red-50 dark:bg-red-950" : undefined}
                            >
                          <TableCell className="text-center text-xs text-gray-500 dark:text-gray-400">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.firstName || ""}
                                    onChange={(e) => setEditedData((prev) => ({ ...prev, firstName: e.target.value }))}
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.firstName || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.lastName || ""}
                                    onChange={(e) => setEditedData((prev) => ({ ...prev, lastName: e.target.value }))}
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.lastName || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.email || ""}
                                    onChange={(e) => setEditedData((prev) => ({ ...prev, email: e.target.value }))}
                              className="h-8"
                              type="email"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.email || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.phoneNumber || ""}
                                    onChange={(e) =>
                                      setEditedData((prev) => ({ ...prev, phoneNumber: e.target.value }))
                                    }
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.phoneNumber || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.role || ""}
                                    onChange={(e) => setEditedData((prev) => ({ ...prev, role: e.target.value }))}
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.role || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.companyName || ""}
                                    onChange={(e) =>
                                      setEditedData((prev) => ({ ...prev, companyName: e.target.value }))
                                    }
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.companyName || "-"}
                                  </span>
                                )}
                          </TableCell>
                          <TableCell>
                                {isEditing ? (
                            <Input
                                    value={editedData.ownerEmail || ""}
                                    onChange={(e) =>
                                      setEditedData((prev) => ({ ...prev, ownerEmail: e.target.value }))
                                    }
                              className="h-8"
                            />
                                ) : (
                                  <span className="text-sm text-gray-700 dark:text-gray-100">
                                    {contact.ownerEmail || "-"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button onClick={saveEdit} size="sm" variant="outline" className="h-8 px-2">
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button onClick={cancelEdit} size="sm" variant="outline" className="h-8 px-2">
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      onClick={() => startEdit(index)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                    {hasErrors && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-red-600 hover:text-red-700"
                                        onClick={() => toast.warning(rowErrors.join(", "))}
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

                  {Object.keys(validationErrors).length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        Please fix the following before uploading:
                      </div>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        {Object.entries(validationErrors).map(([index, errors]) => (
                          <li key={index}>
                            Row {Number(index) + 1}: {errors.join(", ")}
                          </li>
                        ))}
                      </ul>
            </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No contacts to preview.</div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                    setCsvData([]);
                    setValidationErrors({});
                    setEditingRow(null);
                    setEditedData({} as CSVContact);
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                  disabled={csvData.length === 0 || isUploading || Object.keys(validationErrors).length > 0}
                  onClick={handleBulkUpload}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading... {isStreamingMode && `(${processedCount}/${totalContacts || csvData.length})`}
                    </>
                  ) : Object.keys(validationErrors).length > 0 ? (
                    <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Fix {Object.keys(validationErrors).length} Errors First
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {csvData.length} Contacts
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {Object.keys(validationErrors).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Please fix the following before uploading:
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {Object.entries(validationErrors).map(([index, errors]) => (
                  <li key={index}>
                    Row {Number(index) + 1}: {errors.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isUploading && (
            <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-blue-800">Upload Progress</Label>
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {processedCount} / {totalContacts || csvData.length} contacts
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full h-2" />
                <div className="flex justify-between text-xs text-blue-600">
                  <span>{uploadProgress.toFixed(1)}% complete</span>
                  <span>Success: {successCount} | Failed: {failCount}</span>
                  <span>{Math.max(0, (totalContacts || csvData.length) - processedCount)} remaining</span>
            </div>
              </div>
              {currentContact && (
                <div className="bg-white border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="font-medium text-gray-700">Currently processing:</span>
                </div>
                  <div className="mt-1 text-sm text-gray-600">
                    <div className="font-medium">{currentContact.name}</div>
                    <div className="text-xs text-gray-500">{currentContact.email}</div>
                </div>
                </div>
              )}
              {!currentContact && processedCount > 0 && (
                <div className="text-sm text-blue-600 text-center">Preparing to process contacts...</div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={isUploading}
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                setCsvData([]);
                setValidationErrors({});
                setEditingRow(null);
                setEditedData({} as CSVContact);
              }}
              className={
                resolvedTheme === "dark"
                  ? "bg-[#27272a] border-[#3f3f46] text-[#f3f4f6] cursor-pointer transition-all duration-200 hover:bg-[#3f3f46] hover:border-[#52525b] hover:scale-[1.02] active:scale-[0.98]"
                  : "cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              }
            >
              Reset Selection
            </Button>

            <Button
              className="!bg-[#8b7aff] text-white cursor-pointer transition-all duration-200 hover:!bg-[#7b6aee] hover:shadow-[0_4px_12px_rgba(139,122,255,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              disabled={csvData.length === 0 || isUploading || Object.keys(validationErrors).length > 0}
              onClick={handleBulkUpload}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading... {isStreamingMode && `(${processedCount}/${totalContacts || csvData.length})`}
                </>
              ) : Object.keys(validationErrors).length > 0 ? (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Fix {Object.keys(validationErrors).length} Errors First
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {csvData.length} Contacts
                </>
              )}
            </Button>
          </div>

          <Dialog open={showResults} onOpenChange={setShowResults}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Bulk Upload Results
                </DialogTitle>
                <DialogDescription className="text-base">
                  Summary of the bulk contact upload process
                </DialogDescription>
              </DialogHeader>
              {uploadSummaryData ? (
                <div className="overflow-auto max-h-[70vh]">
                  <UploadSummary summaryData={uploadSummaryData} />
                  <div className="flex gap-3 justify-end pt-6 border-t mt-6 bg-gray-50 -mx-6 px-6 py-4">
                    <Button variant="outline" onClick={closeResults} className="px-6">
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        closeResults();
                        onUploadComplete?.();
                        onOpenChange(false);
                      }}
                      className="px-6 !bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                    >
                      Done
                    </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadContactsFlow;