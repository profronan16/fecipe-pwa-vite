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

import { humanizeAuthError } from '@utils/authErrors'


type Role = 'admin' | 'evaluator' | null

type AuthContextType = {
  user: User | null
  role: Role
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
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null)

    const clearAuthError = () => { setAuthError(null); setAuthErrorCode(null) }

    
  // Garante que o doc users/{email} exista e retorna o role
  const ensureUserProfile = async (u: User): Promise<Role> => {
    const email = u.email?.toLowerCase()
    if (!email) return 'evaluator'
    const ref = doc(db, 'users', email)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      // cria perfil básico (ajuste se quiser default = 'admin' para seeds)
      await setDoc(ref, {
        name: u.displayName || '',
        email,
        role: 'evaluator',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true,
      }, { merge: true })
      return 'evaluator'
    }
    const r = (snap.data() as any).role as Role
    return r || 'evaluator'
  }

  const loadRoleFromFirestore = async (u: User | null) => {
    if (!u?.email) { setRole(null); return }
    const email = u.email.toLowerCase()
    const ref = doc(db, 'users', email)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const r = (snap.data() as any).role as Role
      setRole(r || 'evaluator')
    } else {
      // se não houver doc, cria um básico e assume evaluator
      await setDoc(ref, {
        name: u.displayName || '',
        email,
        role: 'evaluator',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true,
      }, { merge: true })
      setRole('evaluator')
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setLoading(true)
      setUser(usr)
      if (usr) {
        // garante doc + pega role
        const r = await ensureUserProfile(usr)
        setRole(r)
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const loginWithGoogle = async () => {
    clearAuthError()
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await ensureUserProfile(cred.user)
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
      await ensureUserProfile(cred.user)
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true,
      }, { merge: true })
      setRole('evaluator')
    } catch (e) {
      const { code, message } = humanizeAuthError(e)
      setAuthError(message); setAuthErrorCode(code)
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
    setRole(null)
  }

  const value = useMemo<AuthContextType>(() => ({
    user, role, loading,
    authError, authErrorCode, clearAuthError,
    loginWithGoogle, loginWithPassword, registerWithPassword, logout,
  }), [user, role, loading, authError, authErrorCode])


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
