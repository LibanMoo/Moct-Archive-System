import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Download, FileText, Printer, RefreshCw } from "lucide-react";
import api from "../services/api";
import ministryLogo from "../assets/ministry-logo.png";

const now = new Date();
const pad = n => String(n).padStart(2, "0");
const todayValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const currentYear = now.getFullYear();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const periods = [["daily", "Daily"], ["monthly", "Monthly"], ["annual", "Annual"]];
const emptySummary = { total: 0, pending: 0, processing: 0, completed: 0, archived: 0 };

// Document dates are stored as UTC midnight, so they are always displayed in UTC.
const dateLabel = value => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
// Prevents spreadsheet formula injection when a CSV is opened in Excel.
const safeCell = value => { const text = String(value ?? ""); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; };

export default function Reports({ direction = "IN" }) {
  const isIn = direction === "IN";
  const word = isIn ? "Incoming" : "Outgoing";
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(todayValue);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = { direction, period, ...(period === "daily" ? { date } : period === "monthly" ? { year, month } : { year }) };
    setLoading(true); setError(""); setReport(null);
    api.get("/documents/reports", { params })
      .then(({ data }) => { if (!cancelled) setReport(data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || "Unable to load report. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [direction, period, date, month, year, refreshKey]);

  const summary = report?.summary || emptySummary;
  const documents = report?.documents || [];
  const periodLabel = period === "daily" ? dateLabel(`${date}T00:00:00Z`) : period === "monthly" ? `${monthNames[month - 1]} ${year}` : `Year ${year}`;
  const reportTitle = `${periods.find(p => p[0] === period)[1]} ${word} Report`;
  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => currentYear + 1 - i), []);

  function exportCsv() {
    const rows = [
      [reportTitle], ["Period", periodLabel], ["Direction", direction], ["Total documents", summary.total], [],
      ["#", "Reference Number", "Subject", "Date", "Sender", "Recipient", "Department", "Status"],
      ...documents.map((doc, i) => [i + 1, doc.referenceNumber, doc.subject, dateLabel(doc.documentDate), doc.sender, doc.recipient, doc.department, doc.status])
    ];
    const csv = rows.map(row => row.map(v => `"${safeCell(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const suffix = period === "daily" ? date : period === "monthly" ? `${year}-${pad(month)}` : String(year);
    const link = document.createElement("a");
    link.href = url; link.download = `DMS-${word.toLowerCase()}-${period}-${suffix}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  const cards = [[`${word} documents`, summary.total], ["Pending", summary.pending], ["Processing", summary.processing], ["Completed", summary.completed], ["Archived", summary.archived]];

  return <div className="reports-page">
    <div className="print-header">
      <img src={ministryLogo} alt="" />
      <div><strong>Ministry of Communications</strong><span>Archive & Document Management System</span></div>
      <div className="print-header-meta"><strong>{reportTitle}</strong><span>{periodLabel} · {summary.total} documents</span><span>Printed {new Date().toLocaleString("en-GB")}</span></div>
    </div>

    <div className="page-heading">
      <div><div className="eyebrow">{isIn ? "MINISTRY INCOMING REGISTER" : "MINISTRY OUTGOING REGISTER"}</div><h1>{word} Reports</h1><p>{isIn ? "Documents received by the Ministry." : "Documents sent by the Ministry."} Filtered by the document date.</p></div>
      <div className="report-heading-actions">
        <button className="secondary-button" onClick={() => window.print()} disabled={!report}><Printer size={15}/> Print</button>
        <button className="primary-button" onClick={exportCsv} disabled={!report}><Download size={15}/> Export CSV</button>
      </div>
    </div>

    <div className="report-direction-tabs">
      <NavLink to="/reports/incoming" className={({ isActive }) => `report-direction-tab ${isActive ? "active" : ""}`}><ArrowDownToLine size={16}/> Incoming Reports (IN)</NavLink>
      <NavLink to="/reports/outgoing" className={({ isActive }) => `report-direction-tab ${isActive ? "active" : ""}`}><ArrowUpFromLine size={16}/> Outgoing Reports (OUT)</NavLink>
    </div>

    <div className="panel report-filters">
      <div className="report-filter-title"><span className="report-filter-icon"><CalendarDays size={18}/></span><div><strong>Report period</strong><small>Choose daily, monthly or annual</small></div></div>
      <div className="report-controls">
        <div className="period-switch" role="tablist" aria-label="Report period">{periods.map(([value, label]) => <button key={value} role="tab" aria-selected={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>)}</div>
        {period === "daily" && <input aria-label="Report date" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />}
        {period === "monthly" && <select aria-label="Month" value={month} onChange={e => setMonth(Number(e.target.value))}>{monthNames.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select>}
        {period !== "daily" && <select aria-label="Year" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>}
        <button className="icon-button report-refresh" onClick={() => setRefreshKey(k => k + 1)} title="Refresh report"><RefreshCw size={16}/></button>
      </div>
    </div>

    {error && <div className="alert error">{error}</div>}

    <div className="report-title-row"><div><div className="eyebrow">{reportTitle.toUpperCase()}</div><h2>{periodLabel}</h2></div></div>
    <div className="report-stats-grid five">{cards.map(([label, value]) => <div className="report-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>

    <div className="panel report-chart-panel daily-report-panel">
      <div className="panel-heading"><div><h2><FileText size={17} style={{ verticalAlign: "-3px", marginRight: 7 }}/>{word} document register</h2><p>Reference, subject, date, sender, recipient, department and status</p></div><span className="report-period-tag">{summary.total} records</span></div>
      {loading ? <div className="report-loading">Loading report data…</div>
        : documents.length === 0 ? <div className="report-empty">No {word.toLowerCase()} documents were registered for this period.</div>
        : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>#</th><th>Reference No.</th><th>Subject</th><th>Date</th><th>Sender</th><th>Recipient</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>{documents.map((doc, index) => <tr key={doc._id}><td>{index + 1}</td><td className="report-reference">{doc.referenceNumber}</td><td className="report-subject">{doc.subject}</td><td>{dateLabel(doc.documentDate)}</td><td>{doc.sender || "—"}</td><td>{doc.recipient || "—"}</td><td>{doc.department || "—"}</td><td><span className={`report-status status-${doc.status?.toLowerCase()}`}>{doc.status}</span></td></tr>)}</tbody></table></div>}
    </div>
    <div className="report-note">Generated from the Archive & Document Management System. Figures use the document date recorded for each document.</div>
  </div>;
}
