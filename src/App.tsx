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
import AccountDisabled from "@screens/Auth/AccountDisabled";

import AppShell from '@components/AppShell'


const theme = createTheme({
  palette: { primary: { main: "#2f9e41" } },
});

function HomeRedirect() {
  const { role, loading } = useAuth()
  if (loading || role === null) return null // espere o role
  return <Navigate to={role === 'admin' ? '/admin' : '/evaluator'} replace />
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
      {/* públicas */}
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/account-disabled" element={<AccountDisabled />} />


      {/* raiz protegida: decide destino */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
      </Route>

      {/* ÁREA LOGADA COM LAYOUT (avaliador + admin) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Avaliador */}
          <Route path="/evaluator" element={<EvaluatorDashboard />} />
          <Route path="/evaluator/works" element={<WorkListScreen />} />
          <Route path="/evaluator/evaluations" element={<EvaluationsList />} />
          <Route path="/evaluator/evaluate/:projectId" element={<EvaluationScreen />} />
          <Route path="/evaluator/profile" element={<ProfileScreen />} />
          <Route path="/evaluator/reset-password" element={<ResetPasswordScreen />} />

          {/* Admin (protege com RoleGuard dentro do layout) */}
          <Route element={<RoleGuard allow={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/projects" element={<ProjectsScreen />} />
            <Route path="/admin/projects/new" element={<ProjectForm />} />
            <Route path="/admin/projects/:id/edit" element={<ProjectForm />} />
            <Route path="/admin/projects/bulk" element={<BulkUploadScreen />} />
            <Route path="/admin/evaluators" element={<EvaluatorsScreen />} />
            <Route path="/admin/evaluators/new" element={<EvaluatorForm />} />
            <Route path="/admin/evaluators/:id/edit" element={<EvaluatorForm />} />
            <Route path="/admin/reports" element={<ReportsScreen />} />
            <Route path="/admin/reports/general" element={<GeneralReport />} />
            <Route path="/admin/reports/winners" element={<WinnersReport />} />
            <Route path="/admin/reports/charts" element={<ChartsReport />} />
            <Route path="/admin/reports/evaluators" element={<EvaluatorsPerformanceReport />} />
          </Route>
        </Route>
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
