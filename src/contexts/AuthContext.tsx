// src/contexts/AuthContext.tsx
import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@services/firebase'

/* ---------------------------------------------------------
   Helper de mensagens de erro amigáveis (inline)
   - Se você já tiver @utils/authErrors, remova isto e importe.
--------------------------------------------------------- */
function humanizeAuthError(e: any): { code: string; message: string } {
  const code = typeof e?.code === 'string' ? e.code : 'auth/unknown'
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Usuário desativado.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/popup-blocked': 'Popup bloqueado pelo navegador.',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
  }
  return { code, message: map[code] || (e?.message || 'Erro de autenticação.') }
}

/* ---------------------------------------------------------
   Tipos
--------------------------------------------------------- */
type Role = 'admin' | 'evaluator' | null

type AuthContextType = {
  user: User | null
  role: Role
  active: boolean | null
  loading: boolean
  /** true quando já sabemos se existe user (onAuthStateChanged rodou) */
  authReady: boolean
  authError: string | null
  authErrorCode: string | null
  clearAuthError: () => void
  loginWithGoogle: () => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  registerWithPassword: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/* ---------------------------------------------------------
   Helpers de perfil:
   - users/{email}    => registro “administrativo” (onde você gerencia role/active)
   - profiles/{uid}   => registro “público” para resolver nomes por UID
--------------------------------------------------------- */

/** Garante que exista users/{email} com role/active. Retorna meta. */
async function ensureUsersDocForEmail(u: User): Promise<{ role: Role; active: boolean }> {
  const email = u.email?.toLowerCase()
  if (!email) return { role: 'evaluator', active: false }

  const ref = doc(db, 'users', email)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    // cria com defaults
    await setDoc(ref, {
      name: u.displayName || '',
      email,
      role: 'evaluator',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
    return { role: 'evaluator', active: true }
  }

  const d = snap.data() as any
  const role: Role = (d.role as Role) || 'evaluator'
  const active = d.active !== false
  return { role, active }
}

/** Atualiza/insere profiles/{uid} com nome/e-mail e role/active. */
async function upsertPublicProfile(u: User, role: Role, active: boolean) {
  const profRef = doc(db, 'profiles', u.uid)
  await setDoc(profRef, {
    uid: u.uid,
    email: u.email ?? '',
    displayName: u.displayName ?? '',
    role,
    active,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [active, setActive] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null)

  const clearAuthError = () => { setAuthError(null); setAuthErrorCode(null) }

  /** Carrega e sincroniza meta (users + profiles). */
  const loadAndSyncMeta = async (u: User) => {
    // pega meta no users/{email}
    const { role: r, active: a } = await ensureUsersDocForEmail(u)
    // sincroniza profiles/{uid}
    await upsertPublicProfile(u, r, a)
    setRole(r)
    setActive(a)
    // se desativado, derruba sessão e informa
    if (a === false) {
      const msg = 'Avaliador desativado. Contate o administrador do sistema.'
      setAuthError(msg)
      setAuthErrorCode('auth/user-disabled')
      await signOut(auth)
      setUser(null)
      setRole(null)
      setActive(null)
      throw Object.assign(new Error(msg), { code: 'auth/user-disabled' })
    }
  }

  /* -------------------------------------------------------
     Listener de sessão
  ------------------------------------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setLoading(true)
      try {
        setUser(usr)
        if (usr) {
          await loadAndSyncMeta(usr)
        } else {
          setRole(null)
          setActive(null)
        }
      } finally {
        setLoading(false)
        setAuthReady(true)
      }
    })
    return () => unsub()
  }, [])

  /* -------------------------------------------------------
     Ações de autenticação
  ------------------------------------------------------- */
  const loginWithGoogle = async () => {
    clearAuthError()
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await loadAndSyncMeta(cred.user)
    } catch (e: any) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const loginWithPassword = async (email: string, password: string) => {
    clearAuthError()
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await loadAndSyncMeta(cred.user)
    } catch (e: any) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const registerWithPassword = async (name: string, email: string, password: string) => {
    clearAuthError()
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (name) await updateProfile(cred.user, { displayName: name })

      // cria/garante users/{email} com defaults e sincroniza profiles/{uid}
      const meta = await ensureUsersDocForEmail(cred.user)
      await upsertPublicProfile(cred.user, meta.role, meta.active)

      setRole(meta.role)
      setActive(meta.active)
    } catch (e: any) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setRole(null)
    setActive(null)
  }

  const value = useMemo<AuthContextType>(() => ({
    user, role, active, loading, authReady,
    authError, authErrorCode, clearAuthError,
    loginWithGoogle, loginWithPassword, registerWithPassword, logout,
  }), [user, role, active, loading, authReady, authError, authErrorCode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
