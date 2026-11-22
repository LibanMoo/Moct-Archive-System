import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import DocumentManager from "./components/DocumentManager";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Reports from "./pages/Reports";
import Correspondents from "./pages/Correspondents";

function ArchivePage() { return <DocumentManager archived />; }

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/reports" element={<Navigate to="/reports/incoming" replace />} />
        <Route path="/reports/incoming" element={<Reports direction="IN" />} />
        <Route path="/reports/outgoing" element={<Reports direction="OUT" />} />
        <Route path="/incoming" element={<DocumentManager direction="IN" />} />
        <Route path="/outgoing" element={<DocumentManager direction="OUT" />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/correspondents" element={<Correspondents />} />
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/users" element={<Users />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
