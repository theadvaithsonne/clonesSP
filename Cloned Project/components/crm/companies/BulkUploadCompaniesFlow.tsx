/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, CheckCircle, Download, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";
import * as XLSX from "xlsx";
import { useTheme } from "next-themes";

const TEMPLATE_URL =
  "https://nela-app.s3.us-east-1.amazonaws.com/uploads/1762609291360-companies_bulk_upload_template.xlsx";

interface CompanyRow {
  companyName: string;
  website?: string;
  phoneNumber?: string;
  email?: string;
  industry?: string;
  revenue?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  ownerEmail?: string;
}

interface UploadSummary {
  message: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  successfulCompanies: Array<{
    row: number;
    name?: string;
    companyId?: string;
  }>;
  failedCompanies: Array<{
    row: number;
    error: string;
    data?: Partial<CompanyRow>;
  }>;
}

interface BulkUploadCompaniesFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

const normalizeKey = (key: string): string =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const safeString = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const mapRowToCompany = (row: Record<string, any>): CompanyRow => {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), safeString(value)])
  );

  const pickValue = (...keywords: string[]) => {
    for (const key of keywords) {
      if (normalized[key]) {
        return normalized[key];
      }
    }
    const normalizedKeys = Object.keys(normalized);
    for (const normalizedKey of normalizedKeys) {
      for (const keyword of keywords) {
        if (normalizedKey.includes(keyword) && normalized[normalizedKey]) {
          return normalized[normalizedKey];
        }
      }
    }
    return "";
  };

  return {
    companyName: pickValue("companyname", "name", "organization", "account") || "",
    website: pickValue("website", "web"),
    phoneNumber: pickValue("phonenumber", "phone", "contactnumber", "mobile"),
    email: pickValue("email", "companyemail"),
    industry: pickValue("industry", "sector"),
    revenue: pickValue("revenue", "annualrevenue", "turnover"),
    address: pickValue("address", "street"),
    city: pickValue("city", "town"),
    state: pickValue("state", "region", "province"),
    country: pickValue("country"),
    pinCode: pickValue("pincode", "zip", "zipcode", "postalcode"),
    ownerEmail: pickValue("owneremail", "owner", "assignedto"),
  };
};

const parseExcelFile = async (file: File): Promise<CompanyRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("No worksheets found.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(mapRowToCompany).filter((row) => Object.values(row).some((value) => value));
};

const parseCSV = (csvText: string): CompanyRow[] => {
  const [headerLine, ...dataLines] = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!headerLine) return [];
  const headers = headerLine
    .split(",")
    .map((header) => header.trim().replace(/^"(.*)"$/, "$1"))
    .map(normalizeKey);

  const companies: CompanyRow[] = [];
  dataLines.forEach((line) => {
    const values = line
      .split(",")
      .map((value) => value.trim().replace(/^"(.*)"$/, "$1"));
    if (values.length !== headers.length) {
      return;
    }
    const raw: Record<string, any> = {};
    headers.forEach((header, index) => {
      raw[header] = values[index];
    });
    companies.push(mapRowToCompany(raw));
  });
  return companies;
};

const REQUIRED_FIELDS: Array<keyof CompanyRow> = ["companyName"];

const validateCompany = (company: CompanyRow): string[] => {
  const errors: string[] = [];
  REQUIRED_FIELDS.forEach((field) => {
    if (!company[field] || company[field]!.toString().trim().length === 0) {
      errors.push(`${field} is required`);
    }
  });
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
    errors.push("Email is invalid");
  }
  if (company.website && !/^https?:\/\//i.test(company.website)) {
    errors.push("Website should start with http:// or https://");
  }
  return errors;
};

const normalizeUploadSummary = (raw: any, fallbackTotal: number): UploadSummary => {
  const summarySource = raw?.summary || raw?.results || raw || {};
  const successful =
    summarySource.successfulCompanies ||
    summarySource.successful ||
    summarySource.successfulRows ||
    summarySource.successfulRecords ||
    [];
  const failed =
    summarySource.failedCompanies ||
    summarySource.failed ||
    summarySource.failedRows ||
    summarySource.failedRecords ||
    [];

  const successfulCount =
    summarySource.successfulCount ??
    summarySource.successful ??
    summarySource.successfulImports ??
    (Array.isArray(successful) ? successful.length : 0);

  const failedCount =
    summarySource.failedCount ??
    summarySource.failed ??
    summarySource.failedImports ??
    (Array.isArray(failed) ? failed.length : 0);

  const totalProcessed =
    summarySource.totalProcessed ??
    summarySource.totalCompanies ??
    summarySource.total ??
    summarySource.processed ??
    summarySource.count ??
    fallbackTotal;

  return {
    message:
      summarySource.message ||
      raw?.message ||
      `Bulk upload completed! ${successfulCount || 0} ${successfulCount === 1 ? "company" : "companies"
      } created successfully.`,
    totalProcessed: typeof totalProcessed === "number" && totalProcessed > 0 ? totalProcessed : fallbackTotal,
    successful: successfulCount || 0,
    failed: failedCount || 0,
    successfulCompanies: Array.isArray(successful) ? successful : [],
    failedCompanies: Array.isArray(failed) ? failed : [],
  };
};

const BulkUploadCompaniesFlow = ({ open, onOpenChange, onUploadComplete }: BulkUploadCompaniesFlowProps) => {
  const { theme } = useTheme();
  const isInlineDealsMode =
    typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
  const resolvedTheme =
    theme === "color" ? "color" : theme === "dark" || isInlineDealsMode ? "dark" : "light";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [, setSessionId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setSessionId(null);
  }, []);

  const resetState = useCallback(() => {
    setCompanies([]);
    setValidationErrors({});
    setIsUploading(false);
    setUploadProgress(0);
    setSummary(null);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailCount(0);
    setTotalToUpload(0);
    setIsPreviewOpen(false);
    stopPolling();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [stopPolling]);

  const handleClose = useCallback(
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

  const validateAll = useCallback((rows: CompanyRow[]) => {
    const errors: Record<number, string[]> = {};
    rows.forEach((row, index) => {
      const rowErrors = validateCompany(row);
      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
      }
    });
    setValidationErrors(errors);
    return errors;
  }, []);

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
      let parsed: CompanyRow[] = [];

      if (isExcel) {
        parsed = await parseExcelFile(file);
        toast.success(`Parsed ${parsed.length} companies from Excel file`);
      } else {
        const reader = new FileReader();
        parsed = await new Promise<CompanyRow[]>((resolve, reject) => {
          reader.onload = (e) => {
            try {
              const csvText = e.target?.result as string;
              resolve(parseCSV(csvText));
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read CSV file"));
          reader.readAsText(file);
        });
        toast.success(`Parsed ${parsed.length} companies from CSV file`);
      }

      setCompanies(parsed);
      setIsPreviewOpen(true);
      const errors = validateAll(parsed);
      if (Object.keys(errors).length > 0) {
        toast.warning(`Found ${Object.keys(errors).length} rows with validation issues`);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error(
        `Error parsing file: ${error instanceof Error ? error.message : "Unknown parsing error occurred"}`
      );
      resetState();
    } finally {
      setIsParsing(false);
    }
  };

  const updateCompanyField = (index: number, field: keyof CompanyRow, value: string) => {
    let updatedRow: CompanyRow | null = null;
    setCompanies((prev) => {
      const next = [...prev];
      const currentRow =
        next[index] ??
        ({
          companyName: "",
        } as CompanyRow);
      updatedRow = {
        ...currentRow,
        [field]: value,
      };
      next[index] = updatedRow;
      return next;
    });
    setValidationErrors((prev) => {
      const rowErrors = validateCompany(updatedRow ?? companies[index]);
      const next = { ...prev };
      if (rowErrors.length > 0) {
        next[index] = rowErrors;
      } else {
        delete next[index];
      }
      return next;
    });
  };

  const startFakeProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
    }
    progressTimer.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = Math.max(1, Math.round(100 / Math.max(companies.length, 10)));
        return Math.min(90, prev + increment);
      });
      setProcessedCount((prev) => Math.min(companies.length, prev + 1));
    }, 600);
  }, [companies.length]);

  const stopFakeProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopFakeProgress();
      stopPolling();
    };
  }, [stopFakeProgress, stopPolling]);

  const finalizeUpload = useCallback(
    (rawResults: any, fallbackTotal: number) => {
      const normalized = normalizeUploadSummary(rawResults, fallbackTotal);
      stopFakeProgress();
      stopPolling();
      setIsUploading(false);
      setUploadProgress(100);
      setSummary(normalized);
      setProcessedCount(normalized.totalProcessed);
      setSuccessCount(normalized.successful);
      setFailCount(normalized.failed);
      setTotalToUpload(normalized.totalProcessed || fallbackTotal);
      setCompanies([]);
      setValidationErrors({});
      setIsPreviewOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast.success(normalized.message);
      onUploadComplete?.();
    },
    [onUploadComplete, stopFakeProgress, stopPolling]
  );

  const startProgressPolling = useCallback(
    (id: string, fallbackTotal: number) => {
      setTotalToUpload((prev) => (prev > 0 ? prev : fallbackTotal));
      const poll = async () => {
        try {
          const progressResponse = await authenticatedFetch(
            buildExternalUrl(`/crm/companies/bulk-upload/progress/${id}`),
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!progressResponse.ok) {
            pollingIntervalRef.current = setTimeout(poll, 1000);
            return;
          }

          const progressData = await progressResponse.json();

          if (typeof progressData.percentage === "number") {
            setUploadProgress(progressData.percentage);
          } else if (
            typeof progressData.processed === "number" &&
            typeof progressData.total === "number" &&
            progressData.total > 0
          ) {
            setUploadProgress(Math.min(99, (progressData.processed / progressData.total) * 100));
          }

          if (typeof progressData.processed === "number") {
            setProcessedCount(progressData.processed);
          }
          if (typeof progressData.successful === "number") {
            setSuccessCount(progressData.successful);
          }
          if (typeof progressData.failed === "number") {
            setFailCount(progressData.failed);
          }

          const status = typeof progressData.status === "string" ? progressData.status.toLowerCase() : "";
          if (status === "completed" || status === "finished") {
            const payload = progressData.summary || progressData.results || progressData;
            const fallback =
              progressData.summary?.totalProcessed ??
              progressData.summary?.totalCompanies ??
              progressData.totalProcessed ??
              progressData.totalCompanies ??
              fallbackTotal;
            finalizeUpload(payload, fallback);
            return;
          }

          pollingIntervalRef.current = setTimeout(poll, 1000);
        } catch (error) {
          console.error("Companies bulk upload polling error:", error);
          pollingIntervalRef.current = setTimeout(poll, 1500);
        }
      };

      poll();
    },
    [finalizeUpload]
  );

  const handleUpload = async () => {
    if (companies.length === 0) {
      toast.error("Please upload a file with companies first");
      return;
    }
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please resolve all validation issues before uploading");
      return;
    }

    setIsPreviewOpen(false);
    setIsUploading(true);
    setUploadProgress(5);
    setProcessedCount(0);
    setSummary(null);
    setSuccessCount(0);
    setFailCount(0);

    const totalToProcess = companies.length;
    setTotalToUpload(totalToProcess);
    startFakeProgress();

    try {
      const payload = {
        companies,
        streamProgress: true,
        usePolling: true,
      };

      const response = await authenticatedFetch(buildExternalUrl("/crm/companies/bulk-upload"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Bulk upload failed");
      }

      const result = await response.json();
      if (result.sessionId) {
        setSessionId(result.sessionId);
        startProgressPolling(result.sessionId, totalToProcess);
      } else {
        finalizeUpload(result.results ?? result, totalToProcess);
      }
    } catch (error) {
      console.error("Bulk upload companies error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload companies");
      stopFakeProgress();
      stopPolling();
      setIsUploading(false);
      setIsPreviewOpen(true);
    }
  };

  const successfulCompanies = useMemo(() => summary?.successfulCompanies ?? [], [summary]);
  const failedCompanies = useMemo(() => summary?.failedCompanies ?? [], [summary]);

  const handleDownloadTemplate = () => {
    try {
      const link = document.createElement("a");
      link.href = TEMPLATE_URL;
      link.download = "companies_bulk_upload_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Template download error:", error);
      window.open(TEMPLATE_URL, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={
        resolvedTheme === "dark"
          ? "max-w-5xl max-h-[90vh] overflow-hidden bg-[#0f0f10] border-[#27272a] text-[#e5e7eb] dark"
          : "max-w-5xl max-h-[90vh] overflow-hidden"
      }>
        <DialogHeader>
          <DialogTitle className={resolvedTheme === "dark" ? "text-[#f3f4f6]" : ""}>Bulk Upload Companies</DialogTitle>
          <DialogDescription className={resolvedTheme === "dark" ? "text-[#9ca3af]" : ""}>Review the data, fix any issues, then upload your companies.</DialogDescription>
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
                variant="outline"
                className={
                  resolvedTheme === "dark"
                    ? "w-full justify-center gap-2 h-11 bg-[#27272a] border-[#3f3f46] text-[#f3f4f6] cursor-pointer transition-all duration-200 hover:bg-[#3f3f46] hover:border-[#52525b] hover:scale-[1.01] active:scale-[0.99]"
                    : "w-full justify-center gap-2 h-11 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                }
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
              <p className={
                resolvedTheme === "dark"
                  ? "text-xs text-[#9ca3af]"
                  : "text-xs text-gray-500"
              }>
                Includes the required columns for company name, industry, and other key fields.
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
                  Drag and drop your Excel or CSV file here, or click to select a file from your computer.
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
                      : "mt-4 cursor-pointer text-sm text-gray-700"
                  }
                  onChange={handleFileUpload}
                  disabled={isParsing || isUploading}
                />
              </div>
            </div>
          </div>
          <Dialog open={isPreviewOpen} onOpenChange={(open) => setIsPreviewOpen(open && companies.length > 0)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <Upload className="h-5 w-5" />
                  Preview Companies ({companies.length})
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Review parsed companies, edit any row, or re-upload before starting the bulk upload.
                </DialogDescription>
              </DialogHeader>

              {companies.length > 0 ? (
                <div className="space-y-4 overflow-auto max-h-[65vh] pr-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <Badge variant="secondary" className="gap-1">
                      {companies.length} total
                    </Badge>
                    {Object.keys(validationErrors).length > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {Object.keys(validationErrors).length} errors
                      </Badge>
                    )}
                    <Button
                      onClick={() => {
                        resetState();
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isUploading}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reupload
                    </Button>
                  </div>

                  <div className="border rounded-lg bg-white">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>Company Name *</TableHead>
                          <TableHead>Website</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Industry</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Pincode</TableHead>
                          <TableHead>Owner Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companies.map((company, index) => {
                          const rowErrors = validationErrors[index];
                          const hasErrors = rowErrors && rowErrors.length > 0;
                          return (
                            <TableRow key={`company-${index}`} className={hasErrors ? "bg-red-50" : undefined}>
                              <TableCell className="text-center text-xs text-gray-500">{index + 1}</TableCell>
                              <TableCell>
                                <Input
                                  value={company.companyName}
                                  onChange={(e) => updateCompanyField(index, "companyName", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.website || ""}
                                  onChange={(e) => updateCompanyField(index, "website", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.phoneNumber || ""}
                                  onChange={(e) => updateCompanyField(index, "phoneNumber", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.email || ""}
                                  onChange={(e) => updateCompanyField(index, "email", e.target.value)}
                                  className="h-8"
                                  type="email"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.industry || ""}
                                  onChange={(e) => updateCompanyField(index, "industry", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.revenue || ""}
                                  onChange={(e) => updateCompanyField(index, "revenue", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.address || ""}
                                  onChange={(e) => updateCompanyField(index, "address", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.city || ""}
                                  onChange={(e) => updateCompanyField(index, "city", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.state || ""}
                                  onChange={(e) => updateCompanyField(index, "state", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.country || ""}
                                  onChange={(e) => updateCompanyField(index, "country", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.pinCode || ""}
                                  onChange={(e) => updateCompanyField(index, "pinCode", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={company.ownerEmail || ""}
                                  onChange={(e) => updateCompanyField(index, "ownerEmail", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

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
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No companies to preview.</div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    resetState();
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  className="!bg-[#8b7aff] !hover:bg-[#7b6aee] text-white"
                  disabled={companies.length === 0 || isUploading || Object.keys(validationErrors).length > 0}
                  onClick={handleUpload}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : Object.keys(validationErrors).length > 0 ? (
                    <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Fix {Object.keys(validationErrors).length} Errors First
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {companies.length} Companies
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {isUploading && (
            <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-blue-800">Upload Progress</Label>
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {processedCount} / {totalToUpload || companies.length} companies
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2 w-full" />
                <div className="flex justify-between text-xs text-blue-600">
                  <span>{uploadProgress.toFixed(1)}% complete</span>
                  <span>
                    Success: {successCount} | Failed: {failCount}
                  </span>
                  <span>
                    {Math.max(0, (totalToUpload || companies.length) - processedCount)} remaining
                  </span>
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">{summary.message}</span>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-green-700 sm:grid-cols-4">
                <div className="rounded border border-green-200 bg-white p-3 text-center">
                  <p className="text-xs uppercase text-green-500">Total Processed</p>
                  <p className="text-lg font-semibold text-green-600">{summary.totalProcessed}</p>
                </div>
                <div className="rounded border border-green-200 bg-white p-3 text-center">
                  <p className="text-xs uppercase text-green-500">Successful</p>
                  <p className="text-lg font-semibold text-green-600">{summary.successful}</p>
                </div>
                <div className="rounded border border-green-200 bg-white p-3 text-center">
                  <p className="text-xs uppercase text-green-500">Failed</p>
                  <p className="text-lg font-semibold text-green-600">{summary.failed}</p>
                </div>
                <div className="rounded border border-green-200 bg-white p-3 text-center">
                  <p className="text-xs uppercase text-green-500">Success Rate</p>
                  <p className="text-lg font-semibold text-green-600">
                    {summary.totalProcessed > 0
                      ? Math.round((summary.successful / summary.totalProcessed) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              {failedCompanies.length > 0 && (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <XCircle className="h-4 w-4" />
                    Failed Rows
                  </div>
                  <ul className="mt-2 list-disc pl-5">
                    {failedCompanies.slice(0, 10).map((row: any, index: number) => (
                      <li key={`failed-${index}`}>
                        Row {row.row ?? index + 1}: {row.error || "Unknown error"}
                      </li>
                    ))}
                    {failedCompanies.length > 10 && (
                      <li>...and {failedCompanies.length - 10} more rows failed. Check backend logs for details.</li>
                    )}
                  </ul>
                </div>
              )}

              {successfulCompanies.length > 0 && (
                <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle className="h-4 w-4" />
                    Successfully Imported Rows
                  </div>
                  <ul className="mt-2 list-disc pl-5">
                    {successfulCompanies.slice(0, 10).map((row: any, index: number) => (
                      <li key={`success-${index}`}>
                        Row {row.row ?? index + 1}: {row.name || "Company"}
                      </li>
                    ))}
                    {successfulCompanies.length > 10 && (
                      <li>...and {successfulCompanies.length - 10} more rows imported successfully.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={isUploading}
              onClick={() => {
                if (isUploading) return;
                resetState();
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
              disabled={companies.length === 0 || isUploading || Object.keys(validationErrors).length > 0}
              onClick={handleUpload}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {companies.length > 0 ? `${companies.length} Companies` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadCompaniesFlow;