// Firestore service: users & claims (read-only usage here)
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@services/firebase'

export async function getUserProfile(uid:string){
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}
