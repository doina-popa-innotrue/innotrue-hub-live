import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  Check,
  X,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface ParsedRow {
  name: string;
  email: string;
  role?: string;
  plan?: string;
  is_placeholder?: boolean;
  real_email?: string;
  _error?: string;
}

interface ImportResult {
  email: string;
  status: "created" | "error";
  error?: string;
  userId?: string;
}

type Step = "upload" | "preview" | "importing" | "results";

interface BulkUserImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function BulkUserImport({
  open,
  onOpenChange,
  onImportComplete,
}: BulkUserImportProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setResults([]);
    setImporting(false);
    setProgress(0);
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset();
      onOpenChange(isOpen);
    },
    [onOpenChange, reset],
  );

  function validateRow(row: ParsedRow, idx: number, allRows: ParsedRow[]): string | undefined {
    if (!row.name?.trim()) return "Name is required";
    if (!row.is_placeholder && !row.email?.trim()) return "Email is required";
    if (
      !row.is_placeholder &&
      row.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())
    ) {
      return "Invalid email format";
    }

    // Check for duplicates within the CSV
    if (
      row.email &&
      allRows.filter(
        (r, i) => i !== idx && r.email?.trim().toLowerCase() === row.email?.trim().toLowerCase(),
      ).length > 0
    ) {
      return "Duplicate email in file";
    }

    if (row.role) {
      const validRoles = ["admin", "client", "coach", "instructor"];
      const roles = row.role
        .split(",")
        .map((r) => r.trim().toLowerCase());
      const invalid = roles.filter((r) => !validRoles.includes(r));
      if (invalid.length > 0) {
        return `Invalid role(s): ${invalid.join(", ")}`;
      }
    }

    return undefined;
  }

  function handleFileSelect(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const parsed: ParsedRow[] = (result.data as Record<string, string>[]).map(
          (row) => ({
            name: row.name?.trim() || "",
            email: row.email?.trim() || "",
            role: row.role?.trim() || "client",
            plan: row.plan?.trim() || "free",
            is_placeholder:
              row.is_placeholder?.trim().toLowerCase() === "true" ||
              row.is_placeholder?.trim() === "1",
            real_email: row.real_email?.trim() || "",
          }),
        );

        // Validate all rows
        const validated = parsed.map((row, idx) => ({
          ...row,
          _error: validateRow(row, idx, parsed),
        }));

        setRows(validated);
        setStep("preview");
      },
      error: (err) => {
        toast.error(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => !r._error);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    setStep("importing");
    setProgress(0);

    // Process in batches of 50
    const batchSize = 50;
    const allResults: ImportResult[] = [];
    const totalBatches = Math.ceil(validRows.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const batch = validRows.slice(i * batchSize, (i + 1) * batchSize);

      try {
        const { data, error } = await supabase.functions.invoke("bulk-create-users", {
          body: {
            users: batch.map((r) => ({
              name: r.name,
              email: r.email,
              role: r.role || "client",
              plan: r.plan || "free",
              is_placeholder: r.is_placeholder || false,
              real_email: r.real_email || undefined,
            })),
          },
        });

        if (error) {
          // All rows in this batch failed
          batch.forEach((r) =>
            allResults.push({ email: r.email, status: "error", error: "Batch request failed" }),
          );
        } else if (data?.results) {
          allResults.push(...data.results);
        }
      } catch (err: any) {
        batch.forEach((r) =>
          allResults.push({ email: r.email, status: "error", error: err.message }),
        );
      }

      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setResults(allResults);
    setImporting(false);
    setStep("results");

    const created = allResults.filter((r) => r.status === "created").length;
    const errors = allResults.filter((r) => r.status === "error").length;

    if (created > 0) {
      toast.success(`${created} user(s) created successfully${errors > 0 ? `, ${errors} failed` : ""}`);
      onImportComplete();
    } else {
      toast.error("No users were created. Check the results for errors.");
    }
  }

  function downloadResultsCsv() {
    const csv = Papa.unparse(
      results.map((r) => ({
        email: r.email,
        status: r.status,
        error: r.error || "",
        user_id: r.userId || "",
      })),
    );

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const template = "name,email,role,plan,is_placeholder,real_email\nJane Doe,jane@example.com,client,free,,\nJohn Smith,,coach,base,true,john@company.com";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.filter((r) => r._error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Users"}
            {step === "preview" && "Preview Import"}
            {step === "importing" && "Importing Users..."}
            {step === "results" && "Import Results"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV file to bulk create users. Required columns: name, email. Optional: role, plan, is_placeholder, real_email."}
            {step === "preview" &&
              `${validCount} valid row(s), ${errorCount} error(s). Review below and click Import.`}
            {step === "importing" && "Please wait while users are being created..."}
            {step === "results" &&
              `Import complete. ${results.filter((r) => r.status === "created").length} created, ${results.filter((r) => r.status === "error").length} errors.`}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop a CSV file here, or click to browse
              </p>
              <label>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <FileText className="mr-2 h-4 w-4" />
                    Choose File
                  </span>
                </Button>
              </label>
            </div>

            <Button variant="link" size="sm" onClick={downloadTemplate} className="text-xs">
              <Download className="mr-1 h-3 w-3" />
              Download CSV template
            </Button>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>CSV columns:</strong> name (required), email (required unless placeholder),
                role (client/coach/instructor/admin — comma-separated for multiple), plan
                (free/base/pro/advanced/elite), is_placeholder (true/false), real_email (for
                placeholders).
                <br />
                Maximum 200 users per import.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div className="space-y-4">
            {errorCount > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {errorCount} row(s) have errors and will be skipped during import.
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={row._error ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      <TableCell className="text-sm">
                        {row.is_placeholder ? (
                          <span className="text-muted-foreground italic">
                            Placeholder{row.real_email ? ` (${row.real_email})` : ""}
                          </span>
                        ) : (
                          row.email
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.role || "client"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.plan || "free"}</TableCell>
                      <TableCell>
                        {row._error ? (
                          <Badge variant="destructive" className="text-xs">
                            {row._error}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600 border-green-600"
                          >
                            Ready
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Import {validCount} User{validCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Creating users... {progress}%
              </span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-semibold text-green-700">
                    {results.filter((r) => r.status === "created").length}
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1">Users created</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-red-600" />
                  <span className="text-lg font-semibold text-red-700">
                    {results.filter((r) => r.status === "error").length}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">Errors</p>
              </div>
            </div>

            {results.filter((r) => r.status === "error").length > 0 && (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results
                      .filter((r) => r.status === "error")
                      .map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{r.email}</TableCell>
                          <TableCell className="text-sm text-destructive">
                            {r.error}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={downloadResultsCsv}>
                <Download className="mr-2 h-4 w-4" />
                Download Results CSV
              </Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
