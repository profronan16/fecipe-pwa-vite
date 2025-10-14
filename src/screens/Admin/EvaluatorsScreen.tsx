// src/screens/Admin/EvaluatorsScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Button, Card, CardContent, CardActions,
  TextField, IconButton, Chip, LinearProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Tooltip
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import BlockIcon from '@mui/icons-material/Block'
import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@services/firebase'
import { initializeApp, deleteApp, getApps } from 'firebase/app'
import { getAuth as getAuthPrimary } from 'firebase/auth'
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { useAuth } from '@contexts/AuthContext'

type Profile = {
  uid: string
  email: string
  displayName?: string
  role?: 'evaluator' | 'admin'
  active?: boolean
  updatedAt?: any
}

function parseCSV(text: string): Array<{ name: string; email: string; password: string }> {
  // Aceita separador ; ou , — com ou sem aspas
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const rows: Array<{ name: string; email: string; password: string }> = []
  for (const raw of lines) {
    // quebra por ; preferencialmente, senão por ,
    const parts = raw.includes(';') ? raw.split(';') : raw.split(',')
    const [name, email, password] = parts.map(s => (s ?? '').trim().replace(/^"(.*)"$/, '$1'))
    if (!email || !password) continue
    rows.push({ name: name || email.split('@')[0], email, password })
  }
  return rows
}

export default function EvaluatorsScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filter, setFilter] = useState('')

  // Dialog CSV
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importLog, setImportLog] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const qRef = query(collection(db, 'profiles'), orderBy('displayName', 'asc'))
        const snap = await getDocs(qRef)
        const arr: Profile[] = snap.docs.map(d => {
          const data = d.data() as any
          return {
            uid: d.id,
            email: data.email,
            displayName: data.displayName || '',
            role: data.role || 'evaluator',
            active: data.active !== false,
            updatedAt: data.updatedAt
          }
        })
        if (alive) setProfiles(arr)
      } catch (e: any) {
        if (alive) setError(e?.message || 'Falha ao carregar avaliadores.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const t = filter.trim().toLowerCase()
    if (!t) return profiles
    return profiles.filter(p =>
      (p.displayName || '').toLowerCase().includes(t) ||
      (p.email || '').toLowerCase().includes(t)
    )
  }, [profiles, filter])

  const handleToggleActive = async (p: Profile, next: boolean) => {
    try {
      await updateDoc(doc(db, 'profiles', p.uid), { active: next, updatedAt: new Date() as any })
      // compat com /users
      await setDoc(doc(db, 'users', p.email.toLowerCase()), {
        email: p.email,
        name: p.displayName || '',
        role: p.role || 'evaluator',
        active: next,
        updatedAt: new Date() as any
      }, { merge: true })
      setProfiles(s => s.map(it => it.uid === p.uid ? { ...it, active: next } : it))
    } catch (e: any) {
      alert('Falha ao atualizar: ' + (e?.message || 'erro'))
    }
  }

  // ---------- Importação em lote ----------
  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCsvFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result || ''))
    reader.readAsText(f, 'utf-8')
  }

  const runImport = async () => {
    const rows = parseCSV(csvText)
    if (!rows.length) {
      alert('CSV vazio ou inválido. Use: Nome,Email,Senha')
      return
    }
    setImporting(true)
    setImportLog([])

    try {
      // Instância secundária para não afetar o login do admin
      const primary = getAuthPrimary()
      const appName = 'admin-bulk'
      const secondaryApp = getApps().find(a => a.name === appName) ||
        initializeApp(primary.app.options, appName)
      const secondaryAuth = getAuthSecondary(secondaryApp)

      for (const [i, row] of rows.entries()) {
        const idx = i + 1
        try {
          // cria auth user
          const cred = await createUserWithEmailAndPassword(secondaryAuth, row.email, row.password)
          await updateProfile(cred.user, { displayName: row.name })
          // grava perfil
          await setDoc(doc(db, 'profiles', cred.user.uid), {
            uid: cred.user.uid,
            email: row.email.toLowerCase(),
            displayName: row.name,
            role: 'evaluator',
            active: true,
            updatedAt: new Date() as any
          }, { merge: true })
          // compat: /users
          await setDoc(doc(db, 'users', row.email.toLowerCase()), {
            email: row.email.toLowerCase(),
            name: row.name,
            role: 'evaluator',
            active: true,
            updatedAt: new Date() as any
          }, { merge: true })

          setImportLog(s => [...s, `✔ [${idx}] ${row.email} criado`])
        } catch (e: any) {
          setImportLog(s => [...s, `✖ [${idx}] ${row.email} — ${e?.message || 'erro'}`])
        }
      }

      // encerra sessão da instância secundária
      await signOut(secondaryAuth)
      if (getApps().find(a => a.name === appName)) await deleteApp(secondaryApp)

      // reload
      const snap = await getDocs(query(collection(db, 'profiles'), orderBy('displayName', 'asc')))
      setProfiles(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) })))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Typography variant="h5" fontWeight={800}>Avaliadores</Typography>
        <Box flex={1} />
        <TextField size="small" placeholder="Buscar por nome ou e-mail" value={filter} onChange={e => setFilter(e.target.value)} />
        <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => setCsvOpen(true)}>
          Importar CSV
        </Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack gap={2}>
        {filtered.map(p => (
          <Card key={p.uid} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                <Typography variant="subtitle1" fontWeight={700}>{p.displayName || '—'}</Typography>
                <Typography variant="body2" color="text.secondary">{p.email}</Typography>
                <Chip size="small" label={p.role === 'admin' ? 'Admin' : 'Avaliador'} />
                <Chip size="small" color={p.active !== false ? 'success' : 'default'} label={p.active !== false ? 'Ativo' : 'Desativado'} />
              </Stack>
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
              <Tooltip title={p.active !== false ? 'Desativar' : 'Ativar'}>
                <IconButton onClick={() => handleToggleActive(p, !(p.active !== false))} color={p.active !== false ? 'warning' : 'success'}>
                  {p.active !== false ? <BlockIcon /> : <HowToRegIcon />}
                </IconButton>
              </Tooltip>
              {/* Excluir totalmente (opcional) — se quiser, implemente regras extras de segurança
              <Tooltip title="Remover">
                <IconButton color="error" onClick={() => alert('Remoção total: implementar se necessário')}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip> */}
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Dialog Importação */}
      <Dialog open={csvOpen} onClose={() => setCsvOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Importar avaliadores via CSV</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2}>
            <Alert severity="info">
              Formato: <strong>Nome,Email,Senha</strong> (uma linha por avaliador).<br />
              Exemplo:<br />
              João da Silva,joao@ifpr.edu.br,senha123<br />
              Maria Souza,maria@ifpr.edu.br,senh@456
            </Alert>

            <Stack direction="row" gap={1} alignItems="center">
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Carregar CSV
                <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={handlePickFile} />
              </Button>
              <Typography variant="body2" color="text.secondary">{csvFileName || 'Nenhum arquivo selecionado'}</Typography>
            </Stack>

            <TextField
              label="Conteúdo CSV"
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              fullWidth multiline minRows={8}
            />

            {!!importLog.length && (
              <Box sx={{ bgcolor: '#0b1020', color: '#d6e2ff', p: 2, borderRadius: 1, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace', fontSize: 13 }}>
                {importLog.map((l, i) => <div key={i}>{l}</div>)}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvOpen(false)}>Fechar</Button>
          <Button onClick={runImport} variant="contained" disabled={importing}>Importar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
