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
import { humanizeAuthError } from '@utils/authErrors' // se não tiver, remova esses imports e mensagens amigáveis

type Role = 'admin' | 'evaluator' | null

type AuthContextType = {
  user: User | null
  role: Role
  active: boolean | null        // <── novo: status de ativação
  loading: boolean
  authError: string | null
  authErrorCode: string | null
  clearAuthError: () => void
  loginWithGoogle: () => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  registerWithPassword: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [active, setActive] = useState<boolean | null>(null) // <── novo
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null)

  const clearAuthError = () => { setAuthError(null); setAuthErrorCode(null) }

  // garante doc de perfil; retorna role e active
  const ensureUserProfile = async (u: User): Promise<{ role: Role; active: boolean }> => {
    const email = u.email?.toLowerCase()
    if (!email) return { role: 'evaluator', active: false }
    const ref = doc(db, 'users', email)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
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
    const data = snap.data() as any
    const r = (data.role as Role) || 'evaluator'
    const a = data.active !== false
    return { role: r, active: a }
  }

  const loadUserMeta = async (u: User | null) => {
    if (!u?.email) {
      setRole(null)
      setActive(null)
      return
    }
    const { role: r, active: a } = await ensureUserProfile(u)
    setRole(r)
    setActive(a)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setLoading(true)
      setUser(usr)
      try {
        if (usr) {
          await loadUserMeta(usr)
        } else {
          setRole(null)
          setActive(null)
        }
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const loginWithGoogle = async () => {
    clearAuthError()
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      const meta = await ensureUserProfile(cred.user)
      setRole(meta.role); setActive(meta.active)
      // se estiver desativado, apenas mantém logado até o guard barrar e exibir a tela de bloqueio
    } catch (e) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const loginWithPassword = async (email: string, password: string) => {
    clearAuthError()
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const meta = await ensureUserProfile(cred.user)
      setRole(meta.role); setActive(meta.active)
    } catch (e) {
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
      const lower = (email || '').toLowerCase()
      await setDoc(doc(db, 'users', lower), {
        name: name || cred.user.displayName || '',
        email: lower,
        role: 'evaluator',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setRole('evaluator'); setActive(true)
    } catch (e) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
    setRole(null)
    setActive(null)
  }

  const value = useMemo<AuthContextType>(() => ({
    user, role, active, loading,
    authError, authErrorCode, clearAuthError,
    loginWithGoogle, loginWithPassword, registerWithPassword, logout,
  }), [user, role, active, loading, authError, authErrorCode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
