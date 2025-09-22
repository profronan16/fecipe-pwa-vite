import { useEffect, useRef } from 'react'

// Minimal stub: in a real implementation, enqueue writes when offline and replay when online.
export default function useOfflineQueue(){
  const queue = useRef<any[]>([])
  useEffect(()=>{
    const online = ()=>{
      // TODO: flush queue with Firestore writes
    }
    window.addEventListener('online', online)
    return ()=>window.removeEventListener('online', online)
  },[])
  return { enqueue: (op:any)=>queue.current.push(op) }
}
