import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { BranchDashboardPage } from './pages/BranchDashboardPage';
import { ExecutiveDashboardPage } from './pages/ExecutiveDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SourceRegistryPage } from './pages/knowledge/SourceRegistryPage';
import { IngestionRunsPage } from './pages/knowledge/IngestionRunsPage';
import { QuarantineQueuePage } from './pages/knowledge/QuarantineQueuePage';
import { DocumentViewerPage } from './pages/knowledge/DocumentViewerPage';
import { CandidateClaimsReviewPage } from './pages/knowledge/CandidateClaimsReviewPage';
import { StructuredFactsReviewPage } from './pages/knowledge/StructuredFactsReviewPage';
import { ConflictQueuePage } from './pages/knowledge/ConflictQueuePage';
import { ApprovalQueuePage } from './pages/knowledge/ApprovalQueuePage';
import { PublishedKnowledgeSearchPage } from './pages/knowledge/PublishedKnowledgeSearchPage';
import { SnapshotStatusPage } from './pages/knowledge/SnapshotStatusPage';
import { EvaluationResultsPage } from './pages/knowledge/EvaluationResultsPage';
import { AuditHistoryPage } from './pages/knowledge/AuditHistoryPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<ExecutiveDashboardPage />} />
        <Route path="branches" element={<BranchDashboardPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="system-health" element={<SystemHealthPage />} />
        <Route path="knowledge/sources" element={<SourceRegistryPage />} />
        <Route path="knowledge/ingestion-runs" element={<IngestionRunsPage />} />
        <Route path="knowledge/quarantine" element={<QuarantineQueuePage />} />
        <Route path="knowledge/documents" element={<DocumentViewerPage />} />
        <Route path="knowledge/claims" element={<CandidateClaimsReviewPage />} />
        <Route path="knowledge/structured-facts" element={<StructuredFactsReviewPage />} />
        <Route path="knowledge/conflicts" element={<ConflictQueuePage />} />
        <Route path="knowledge/approvals" element={<ApprovalQueuePage />} />
        <Route path="knowledge/search" element={<PublishedKnowledgeSearchPage />} />
        <Route path="knowledge/snapshot" element={<SnapshotStatusPage />} />
        <Route path="knowledge/evaluation-results" element={<EvaluationResultsPage />} />
        <Route path="knowledge/audit" element={<AuditHistoryPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
