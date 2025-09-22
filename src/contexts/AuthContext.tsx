// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  getIdTokenResult,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@services/firebase";

type Role = "admin" | "evaluator" | null;

type Ctx = {
  user: any;
  role: Role;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>({
  user: null,
  role: null,
  loading: true,
  authError: null,
  loginWithGoogle: async () => {},
  loginWithPassword: async () => {},
  registerWithPassword: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: any }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await getIdTokenResult(u, true);
          const r = token.claims.role as Role;
          setRole(r === "admin" || r === "evaluator" ? r : "evaluator");
        } catch {
          setRole("evaluator");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithPassword = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err?.message || "Falha ao entrar.");
      throw err;
    }
  };

  const registerWithPassword = async (
    name: string,
    email: string,
    password: string
  ) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
    } catch (err: any) {
      setAuthError(err?.message || "Falha ao registrar.");
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        role,
        loading,
        authError,
        loginWithGoogle,
        loginWithPassword,
        registerWithPassword,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
