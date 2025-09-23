// src/screens/Admin/ProjectForm.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, TextField,
  MenuItem, Button, Stack, LinearProgress, Alert
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addDoc, updateDoc, doc, collection, getDoc
} from 'firebase/firestore'
import { db } from '@services/firebase'

type FormState = {
  titulo: string
  alunos: string        // no input: "nome1; nome2; ..."
  orientador: string
  turma: string
  anoSemestre: string
  categoria: string
}

const CATEGORIES = [
  'Ensino',
  'Pesquisa/Inovação',
  'Extensão',
  'Comunicação Oral',
  'IFTECH',
  'Robótica',
]

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>()           // /new não tem id; /:id/edit tem
  const isEdit = Boolean(id)
  const nav = useNavigate()

  const [loading, setLoading] = useState<boolean>(!!id)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [form, setForm] = useState<FormState>({
    titulo: '',
    alunos: '',
    orientador: '',
    turma: '',
    anoSemestre: '',
    categoria: '',
  })

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!id) return
      try {
        const s = await getDoc(doc(db, 'trabalhos', id))
        if (alive && s.exists()) {
          const d = s.data() as any
          setForm({
            titulo: d.titulo || '',
            alunos: Array.isArray(d.alunos) ? d.alunos.join('; ') : '',
            orientador: d.orientador || '',
            turma: d.turma || '',
            anoSemestre: d.anoSemestre || '',
            categoria: d.categoria || '',
          })
        }
      } catch (e: any) {
        setMsg({ type: 'error', text: e?.message || 'Erro ao carregar projeto' })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [id])

  const valid = useMemo(() => {
    const f = form
    return f.titulo.trim()
      && f.alunos.trim()
      && f.orientador.trim()
      && f.turma.trim()
      && f.anoSemestre.trim()
      && f.categoria
  }, [form])

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }))

  const handleSubmit = async () => {
    if (!valid) {
      setMsg({ type: 'error', text: 'Preencha todos os campos obrigatórios' })
      return
    }
    setSaving(true)
    setMsg(null)
    const payload = {
      titulo: form.titulo.trim(),
      alunos: form.alunos
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      orientador: form.orientador.trim(),
      turma: form.turma.trim(),
      anoSemestre: form.anoSemestre.trim(),
      categoria: form.categoria,
    }
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'trabalhos', id!), payload)
      } else {
        await addDoc(collection(db, 'trabalhos'), payload)
      }
      setMsg({ type: 'success', text: 'Projeto salvo com sucesso' })
      nav('/admin/projects')
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Erro ao salvar projeto' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box p={2} maxWidth={760} mx="auto">
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={2}>
        <Typography variant="h5" fontWeight={800}>
          {isEdit ? 'Editar Projeto' : 'Novo Projeto'}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" onClick={() => nav(-1)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving || !valid}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Título"
              value={form.titulo}
              onChange={handleChange('titulo')}
              required
              fullWidth
            />

            <TextField
              label='Alunos (separados por ";")'
              value={form.alunos}
              onChange={handleChange('alunos')}
              required
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              label="Orientador"
              value={form.orientador}
              onChange={handleChange('orientador')}
              required
              fullWidth
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                label="Turma"
                value={form.turma}
                onChange={handleChange('turma')}
                required
                fullWidth
              />
              <TextField
                label="Ano/Semestre"
                value={form.anoSemestre}
                onChange={handleChange('anoSemestre')}
                required
                fullWidth
              />
            </Stack>

            <TextField
              select
              label="Categoria"
              value={form.categoria}
              onChange={handleChange('categoria')}
              required
              fullWidth
            >
              <MenuItem value="">Selecione...</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
