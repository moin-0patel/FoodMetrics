import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useExportHistory } from "./hooks";
import { useBrands } from "@/features/brands/hooks";
import { useRoles } from "@/features/roles/hooks";
import { brandLabel } from "@/lib/data/brandCache";
import { roleLabel } from "@/lib/auth/roleCache";

const fmtIST = (iso: string, part: "date" | "time") =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    ...(part === "date"
      ? { year: "numeric", month: "short", day: "numeric" }
      : { hour: "2-digit", minute: "2-digit" }),
  });

/** §10 Export History — every successful export (who / what / brand / format / when,
 *  IST). Rendered inside the Reports "Export History" tab (no PageHeader). */
export function ExportHistoryPanel() {
  const { data: rows = [], isLoading, isError } = useExportHistory();
  const { data: brands = [] } = useBrands();
  const { data: roles = [] } = useRoles();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [format, setFormat] = useState("all");
  const [type, setType] = useState("all");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const types = useMemo(() => [...new Set(rows.map((r) => r.export_type))].sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (role !== "all" && r.exporter_role_snapshot !== role) return false;
        if (format !== "all" && r.file_format !== format) return false;
        if (type !== "all" && r.export_type !== type) return false;
        if (brand !== "all" && (r.brand_id ?? "") !== brand) return false;
        if (status !== "all" && r.status !== status) return false;
        const day = r.exported_at.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        if (search) {
          const hay = `${r.exporter_name_snapshot} ${r.exporter_email_snapshot ?? ""} ${r.recipe_name_snapshot ?? ""} ${r.report_name ?? ""}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, role, format, type, brand, status, from, to, search],
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Every PDF / Excel / CSV export — who exported it, what, and when (IST).
      </p>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search name / email / recipe / report…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Export Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="xlsx">XLSX</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <Card>
        {isError ? (
          <div className="py-12 text-center text-sm text-destructive">Unable to load export history. Please refresh.</div>
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No exports yet"
            description="Exported PDFs and Excel reports will be logged here with the exporter and timestamp."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exporter</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Date (IST)</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.exporter_name_snapshot}</div>
                    {r.exporter_email_snapshot && <div className="text-xs text-muted-foreground">{r.exporter_email_snapshot}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{roleLabel(r.exporter_role_snapshot)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.export_type}</TableCell>
                  <TableCell>{r.recipe_name_snapshot ?? r.report_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{brandLabel(r.brand_id)}</TableCell>
                  <TableCell className="uppercase">{r.file_format}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtIST(r.exported_at, "date")}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtIST(r.exported_at, "time")}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "success" : "danger"}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
