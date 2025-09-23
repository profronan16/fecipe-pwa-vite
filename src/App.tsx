import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import LoginScreen from "@screens/LoginScreen";
import Unauthorized from "@screens/Auth/Unauthorized";
import AdminDashboard from "@screens/Admin/AdminDashboard";
import EvaluatorDashboard from "@screens/Admin/EvaluatorDashboard";
import ProjectsScreen from "@screens/Admin/ProjectsScreen";
import ProjectForm from "@screens/Admin/ProjectForm";
import BulkUploadScreen from "@screens/Admin/BulkUploadScreen";
import WorkListScreen from "@screens/Work/WorkListScreen";
import EvaluationScreen from "@screens/Evaluation/EvaluationScreen";
import EvaluationsList from "@screens/Evaluation/EvaluationsList";

import ProfileScreen from "@screens/Profile/ProfileScreen";
import ResetPasswordScreen from "@screens/Profile/ResetPasswordScreen";

import EvaluatorsScreen from "@screens/Admin/EvaluatorsScreen";
import EvaluatorForm from "@screens/Admin/EvaluatorForm";
import EvaluatorsPerformanceReport from "@screens/Admin/EvaluatorsPerformanceReport";

// ✅ IMPORTES QUE ESTAVAM FALTANDO
import { AuthProvider, useAuth } from "@contexts/AuthContext";
import ProtectedRoute from "@components/ProtectedRoute";
import RoleGuard from "@components/RoleGuard";
import ForgotPassword from "@screens/Auth/ForgotPassword";
import ReportsScreen from "@screens/Admin/ReportsScreen";
import GeneralReport from "@screens/Admin/GeneralReport";
import WinnersReport from "@screens/Admin/WinnersReport";
import ChartsReport from "@screens/Admin/ChartsReport";

const theme = createTheme({
  palette: { primary: { main: "#2f9e41" } },
});

function HomeRedirect() {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/evaluator" replace />;
}

export default function App() {
  useEffect(() => {
    // pwa auto-update handled by plugin
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          {/* público */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/unauthorized" element={<Unauthorized />} />


          {/* protegido (usuário logado) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />

            {/* admin-only */}
            <Route element={<RoleGuard allow={["admin"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/projects" element={<ProjectsScreen />} />
              <Route path="/admin/projects/new" element={<ProjectForm />} />
              <Route path="/admin/projects/:id" element={<ProjectForm />} />
              <Route path="/admin/upload" element={<BulkUploadScreen />} />

              {/* ✅ gestão de avaliadores + relatório (faltavam as rotas) */}
              <Route path="/admin/evaluators" element={<EvaluatorsScreen />} />
              <Route path="/admin/evaluators/new" element={<EvaluatorForm />} />
              <Route path="/admin/evaluators/:email" element={<EvaluatorForm />} />
              <Route path="/evaluator/evaluate/:projectId" element={<EvaluationScreen />} />

              <Route path="/admin/projects" element={<ProjectsScreen />} />
              <Route path="/admin/projects/new" element={<ProjectForm />} />
              <Route path="/admin/projects/:id/edit" element={<ProjectForm />} />
              <Route path="/admin/reports/evaluators" element={<EvaluatorsPerformanceReport />} />

              <Route path="/admin/reports" element={<ReportsScreen />} />
              <Route path="/admin/reports/general" element={<GeneralReport />} />
              <Route path="/admin/reports/winners" element={<WinnersReport />} />
              <Route path="/admin/reports/charts" element={<ChartsReport />} />
              <Route path="/admin/reports/evaluators" element={<EvaluatorsPerformanceReport />} />
            </Route>

            {/* evaluator/admin */}
            <Route element={<RoleGuard allow={["evaluator", "admin"]} />}>
              <Route path="/evaluator" element={<EvaluatorDashboard />} />
              <Route path="/evaluator/works" element={<WorkListScreen />} />
              <Route
                path="/evaluator/evaluate/:projectId"
                element={<EvaluationScreen />}
              />
              <Route path="/evaluator/evaluations" element={<EvaluationsList />} />
              <Route path="/evaluator/profile" element={<ProfileScreen />} />

              {/* ✅ rota de redefinição de senha (faltava) */}
              <Route path="/evaluator/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

            </Route>
          </Route>

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
