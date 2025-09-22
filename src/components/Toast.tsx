import { Snackbar, Alert } from '@mui/material'
import { useState } from 'react'

export default function Toast(){
  const [open,setOpen] = useState(false)
  const [msg,setMsg] = useState('')
  const [severity,setSeverity] = useState<'success'|'info'|'warning'|'error'>('info')
  // TODO: conectar com contexto/global events
  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={()=>setOpen(false)}>
      <Alert severity={severity} onClose={()=>setOpen(false)}>{msg}</Alert>
    </Snackbar>
  )
}
