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
import { auth } from '@services/firebase'
import { db } from '@services/firebase'

type Role = 'admin' | 'evaluator' | null

type AuthContextType = {
  user: User | null
  role: Role
  loading: boolean
  authError: string | null
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

  // carrega claims/perfil (role) do Firestore
  const loadRoleFromFirestore = async (u: User | null) => {
    if (!u?.email) { setRole(null); return }
    try {
      const s = await getDoc(doc(db, 'users', u.email))
      if (s.exists()) {
        const r = (s.data() as any).role as Role
        setRole(r || 'evaluator')
      } else {
        // se não houver doc, assume evaluator
        setRole('evaluator')
      }
    } catch {
      setRole('evaluator')
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setUser(usr)
      await loadRoleFromFirestore(usr)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const loginWithGoogle = async () => {
    setAuthError(null)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
      // role será carregada no onAuthStateChanged
    } catch (e: any) {
      setAuthError(e?.message || 'Falha no login com Google')
      throw e
    }
  }

  const loginWithPassword = async (email: string, password: string) => {
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // role será carregada no onAuthStateChanged
    } catch (e: any) {
      setAuthError(e?.message || 'Falha no login')
      throw e
    }
  }

  const registerWithPassword = async (name: string, email: string, password: string) => {
    setAuthError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (name) {
        await updateProfile(cred.user, { displayName: name })
      }
      // cria/atualiza perfil no Firestore
      await setDoc(doc(db, 'users', email), {
        name: name || cred.user.displayName || '',
        email,
        role: 'evaluator',                 // ajuste se quiser outra regra
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      await loadRoleFromFirestore(cred.user)
    } catch (e: any) {
      setAuthError(e?.message || 'Falha no cadastro')
      throw e
    }
  }

  const logout = async () => {
    await signOut(auth)
    setRole(null)
  }

  const value = useMemo<AuthContextType>(() => ({
    user, role, loading, authError,
    loginWithGoogle, loginWithPassword, registerWithPassword, logout,
  }), [user, role, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
