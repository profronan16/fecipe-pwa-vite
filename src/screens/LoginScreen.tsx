// src/screens/LoginScreen.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
  Link,
  Alert,
} from "@mui/material";
import { useAuth } from "@contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

const GoogleIcon = () => (
  // SVG oficial de marca simples (estilizado para 20x20)
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303C33.731 32.91 29.296 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.844 1.154 7.961 3.039l5.657-5.657C34.012 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c10.494 0 19-8.506 19-19 0-1.341-.138-2.65-.389-3.917z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.443 16.092 18.867 12 24 12c3.059 0 5.844 1.154 7.961 3.039l5.657-5.657C34.012 6.053 29.268 4 24 4 15.317 4 7.813 8.99 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.239 0 9.994-1.995 13.57-5.258l-6.262-5.291C29.25 35.031 26.748 36 24 36c-5.27 0-9.714-3.116-11.29-7.447l-6.54 5.037C7.64 39.01 15.096 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-1.077 3.13-3.447 5.648-6.733 6.948l.006-.004 6.262 5.291C36.548 40.387 43 36 43 25c0-1.341-.138-2.65-.389-3.917z"
    />
  </svg>
);

export default function LoginScreen() {
  const {
    user,
    loginWithGoogle,
    loginWithPassword,
    registerWithPassword,
    authError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const from = useMemo(() => location?.state?.from || "/", [location]);

  useEffect(() => {
    if (user) {
      // logou? vai para a rota de origem ou para /
      navigate(from, { replace: true });
    }
  }, [user, from, navigate]);

  const handleEmailSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await loginWithPassword(email.trim(), password);
      } else {
        await registerWithPassword(name.trim(), email.trim(), password);
      }
      // o efeito acima (useEffect) cuidar do redirecionamento quando user mudar
    } catch {
      // erro já tratado via authError
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
      // redireciona no useEffect
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{ minHeight: "100dvh", display: "flex", alignItems: "center" }}
    >
      <Card sx={{ width: "100%", boxShadow: 6, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "16px",
                bgcolor: "primary.main",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              F
            </Box>

            <Box textAlign="center">
              <Typography variant="h4" fontWeight={800}>
                FECIPE — Avaliação
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Acesse com sua conta para iniciar as avaliações
              </Typography>
            </Box>

            {authError && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {authError}
              </Alert>
            )}

            <Stack
              component="form"
              onSubmit={handleEmailSubmit}
              spacing={2}
              sx={{ width: "100%" }}
            >
              {mode === "register" && (
                <TextField
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  required
                />
              )}
              <TextField
                type="email"
                label="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
              />
              <TextField
                type="password"
                label="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
              >
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </Stack>

            <Divider flexItem>ou</Divider>

            <Button
              onClick={handleGoogle}
              variant="outlined"
              size="large"
              startIcon={<GoogleIcon />}
              disabled={submitting}
              sx={{ textTransform: "none", fontWeight: 600, width: "100%" }}
            >
              Entrar com Google
            </Button>

            <Typography variant="body2" color="text.secondary">
              {mode === "login" ? (
                <>
                  Não tem conta?{" "}
                  <Link component="button" onClick={() => setMode("register")}>
                    Criar agora
                  </Link>
                </>
              ) : (
                <>
                  Já possui conta?{" "}
                  <Link component="button" onClick={() => setMode("login")}>
                    Entrar
                  </Link>
                </>
              )}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
