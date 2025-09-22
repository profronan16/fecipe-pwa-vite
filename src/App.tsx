import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import LoginScreen from "@screens/LoginScreen";
import Unauthorized from "@screens/Unauthorized";
import AdminDashboard from "@screens/Admin/AdminDashboard";
import EvaluatorDashboard from "@screens/Admin/EvaluatorDashboard";
import ProjectsScreen from "@screens/Projects/ProjectsScreen";
import ProjectForm from "@screens/Projects/ProjectForm";
import BulkUploadScreen from "@screens/BulkUpload/BulkUploadScreen";
import WorkListScreen from "@screens/Work/WorkListScreen";
import EvaluationScreen from "@screens/Evaluation/EvaluationScreen";

// deixe APENAS UM:
import EvaluationsList from "@screens/Evaluation/EvaluationsList"; // ✅

import ProfileScreen from "@screens/Profile/ProfileScreen";
import ResetPasswordScreen from "@screens/Profile/ResetPasswordScreen";

import EvaluatorsScreen from "@screens/Admin/EvaluatorsScreen";
import EvaluatorForm from "@screens/Admin/EvaluatorForm";
import EvaluatorsPerformanceReport from "@screens/Admin/EvaluatorsPerformanceReport";

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
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<RoleGuard allow={["admin"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/projects" element={<ProjectsScreen />} />
              <Route path="/admin/projects/new" element={<ProjectForm />} />
              <Route path="/admin/projects/:id" element={<ProjectForm />} />
              <Route path="/admin/upload" element={<BulkUploadScreen />} />
            </Route>

            <Route element={<RoleGuard allow={["evaluator", "admin"]} />}>
              <Route path="/evaluator" element={<EvaluatorDashboard />} />
              <Route path="/evaluator/works" element={<WorkListScreen />} />
              <Route
                path="/evaluator/evaluate/:projectId"
                element={<EvaluationScreen />}
              />
              <Route
                path="/evaluator/evaluations"
                element={<EvaluationsList />}
              />
              <Route path="/evaluator/profile" element={<ProfileScreen />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
