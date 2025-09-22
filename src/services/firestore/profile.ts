import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@services/firebase'

export async function getProfile(email: string){
  const s = await getDoc(doc(db, 'users', email))
  return s.exists() ? s.data() as any : null
}
export async function updateProfileName(email: string, name: string){
  await updateDoc(doc(db, 'users', email), { name })
}
