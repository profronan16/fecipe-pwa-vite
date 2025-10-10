// src/screens/Admin/ProjectForm.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, TextField,
  MenuItem, Button, Stack, LinearProgress, Alert,
  Autocomplete, Chip, FormControlLabel, Switch
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, doc as fsDoc } from 'firebase/firestore'
import { db } from '@services/firebase'

import { listUsers, UserRecord } from '@services/firestore/users'
import { saveProject, getProject, Project } from '@services/firestore/projects'

type FormState = {
  titulo: string
  alunos: string        // input em linha: "nome1; nome2; ..."
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
  'Feira de Ciências',
]

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>() // /new (sem id) | /:id/edit (com id)
  const isEdit = Boolean(id)
  const nav = useNavigate()

  // --- estado base do formulário ---
  const [form, setForm] = useState<FormState>({
    titulo: '',
    alunos: '',
    orientador: '',
    turma: '',
    anoSemestre: '',
    categoria: '',
  })

  const [loading, setLoading] = useState<boolean>(!!id)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // --- estado dos avaliadores / visibilidade ---
  const [allEvaluators, setAllEvaluators] = useState<UserRecord[]>([])
  const [isPublic, setIsPublic] = useState(true) // true => ['ALL']
  const [selectedEvaluators, setSelectedEvaluators] = useState<UserRecord[]>([])

  // ===== Carregar avaliadores (admin/evaluator) =====
  useEffect(() => {
    (async () => {
      try {
        const users = await listUsers()
        const evals = users.filter(u => u.role === 'evaluator' || u.role === 'admin')
        setAllEvaluators(evals)
      } catch (e) {
        // silencioso; a UI ainda funciona (apenas sem autocomplete)
      }
    })()
  }, [])

  // ===== Se edição, carregar projeto e preencher o formulário =====
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!id) return
      try {
        const p = await getProject(id)
        if (!p) {
          if (alive) setMsg({ type: 'error', text: 'Projeto não encontrado' })
          return
        }
        if (!alive) return

        setForm({
          titulo: p.titulo || '',
          alunos: Array.isArray(p.alunos) ? p.alunos.join('; ') : '',
          orientador: p.orientador || '',
          turma: p.turma || '',
          anoSemestre: p.anoSemestre || '',
          categoria: p.categoria || '',
        })

        // visibilidade
        const assigned = p.assignedEvaluators || ['ALL']
        const pub = assigned.length === 1 && assigned[0] === 'ALL'
        setIsPublic(pub)
        if (!pub) {
          const map = new Map(allEvaluators.map(u => [u.email.toLowerCase(), u]))
          const chosen = assigned
            .map(e => map.get(String(e || '').toLowerCase()))
            .filter(Boolean) as UserRecord[]
          setSelectedEvaluators(chosen)
        } else {
          setSelectedEvaluators([])
        }
      } catch (e: any) {
        if (alive) setMsg({ type: 'error', text: e?.message || 'Erro ao carregar projeto' })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allEvaluators])

  // ===== Validação simples =====
  const valid = useMemo(() => {
    const f = form
    return Boolean(
      f.titulo.trim()
      && f.orientador.trim()
      && f.turma.trim()
      && f.anoSemestre.trim()
      && f.categoria
    )
  }, [form])

  const handleChange =
    (key: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(s => ({ ...s, [key]: e.target.value }))

  // ===== Submit =====
  const handleSubmit = async () => {
    if (!valid) {
      setMsg({ type: 'error', text: 'Preencha todos os campos obrigatórios' })
      return
    }
    setSaving(true)
    setMsg(null)

    const assigned = isPublic
      ? ['ALL']
      : Array.from(new Set(selectedEvaluators.map(u => u.email.toLowerCase())))

    const payload: Project = {
      id: isEdit && id ? id : generateProjectId(),
      titulo: form.titulo.trim(),
      alunos: form.alunos
        .split(';')
        .map(s => s.trim())
        .filter(Boolean),
      orientador: form.orientador.trim(),
      turma: form.turma.trim(),
      anoSemestre: form.anoSemestre.trim(),
      categoria: form.categoria,
      assignedEvaluators: assigned,
    }

    try {
      await saveProject(payload)
      setMsg({ type: 'success', text: 'Projeto salvo com sucesso' })
      nav('/admin/projects')
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Erro ao salvar projeto' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box maxWidth={760} mx="auto">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        mb={2} gap={2}
      >
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

            {/* Visibilidade */}
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
              }
              label="Disponível para todos os avaliadores"
            />

            {!isPublic && (
              <Autocomplete
                multiple
                options={allEvaluators}
                value={selectedEvaluators}
                onChange={(_, value) => setSelectedEvaluators(value)}
                getOptionLabel={(o) => o.name ? `${o.name} (${o.email})` : o.email}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.email}
                      label={option.name ? `${option.name} (${option.email})` : option.email}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Avaliadores vinculados"
                    placeholder="Selecione avaliadores"
                    helperText="Se nenhum avaliador for selecionado, o projeto ficará visível para todos."
                  />
                )}
              />
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

/** Gera um id de projeto quando criando novo (usa Firestore para manter padrão) */
function generateProjectId(): string {
  // cria uma referência vazia para obter um id consistente com o Firestore
  return fsDoc(collection(db, 'trabalhos')).id
}
