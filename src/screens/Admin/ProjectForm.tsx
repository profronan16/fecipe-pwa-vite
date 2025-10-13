// src/screens/Admin/ProjectForm.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, TextField,
  MenuItem, Button, Stack, LinearProgress, Alert,
  Autocomplete, Chip, FormControlLabel, Switch, Divider
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, doc as fsDoc } from 'firebase/firestore'
import { db } from '@services/firebase'

import { listUsers, UserRecord } from '@services/firestore/users'
import { saveProject, getProject } from '@services/firestore/projects'

// =================== Constantes de domínio ===================

const CATEGORIAS = [
  'IFTECH',
  'Feira de Ciências',
  'Comunicação Oral',
  'Banner',
] as const
type Categoria = typeof CATEGORIAS[number]

const SUBCATEGORIAS = [
  'Ensino',
  'Extensão',
  'Pesquisa/Inovação',
] as const
type Subcategoria = typeof SUBCATEGORIAS[number] | ''

const TIPOS_FEIRA = [
  'Fundamental',
  'Ensino Médio',
  'Superior',
] as const

// >>> Atualizado com "Servidor"
const TIPOS_COM_ORAL = [
  'Ensino Médio',
  'Superior',
  'Pós-graduação',
  'Servidor',
] as const

// >>> Atualizado com "Servidor"
const TIPOS_BANNER = [
  'Ensino Médio',
  'Superior',
  'Servidor',
] as const

const AREA_OPCOES = [
  'Área',
  'Ciências Agrárias',
  'Engenharias',
  'Inclusão',
  'Meio Ambiente',
  'Ciências Biológicas',
  'Ciências Exatas e da Terra',
  'Direitos Humanos e Justiça',
  'Educação',
  'Linguística, Letras e Artes',
  'Tecnologia e Produção',
  'Cultura',
  'Ciências da Saúde',
  'Ciências Humanas',
  'Multidisciplinar',
  'Feira de Ciências',
  'Outro',
] as const

// =================== Form / Types ===================

type FormState = {
  titulo: string
  categoria: Categoria | ''
  subcategoria: Subcategoria
  tipo: string
  area: string
  areaOutro: string
  apresentador: string
  autores: string
}

function generateProjectId(): string {
  return fsDoc(collection(db, 'trabalhos')).id
}

function normalizeAssigned(input?: string[]): string[] {
  const raw = Array.isArray(input) ? input : []
  if (raw.length === 0) return ['ALL']
  const hasAll = raw.some(s => String(s || '').trim().toUpperCase() === 'ALL')
  if (hasAll) return ['ALL']
  const emails = raw.map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
  return emails.length ? Array.from(new Set(emails)) : ['ALL']
}

function isAreaInList(area?: string) {
  return area ? AREA_OPCOES.includes(area as any) : false
}

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const nav = useNavigate()

  const [form, setForm] = useState<FormState>({
    titulo: '',
    categoria: '',
    subcategoria: '',
    tipo: '',
    area: 'Área',
    areaOutro: '',
    apresentador: '',
    autores: '',
  })

  const [allEvaluators, setAllEvaluators] = useState<UserRecord[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [selectedEvaluators, setSelectedEvaluators] = useState<UserRecord[]>([])

  const [loading, setLoading] = useState<boolean>(!!id)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // carregar avaliadores
  useEffect(() => {
    (async () => {
      try {
        const users = await listUsers()
        const evals = users.filter(u => u.role === 'evaluator' || u.role === 'admin')
        setAllEvaluators(evals)
      } catch {}
    })()
  }, [])

  // carregar projeto em edição
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

        const autores = Array.isArray(p.autores) ? p.autores.join('; ') : ''
        const categoria = (p.categoria || '') as Categoria | ''
        const subcategoria = (p.subcategoria || '') as Subcategoria
        const tipo = (p.tipo || '')
        const apresentador = p.apresentador || ''

        let area = p.area || 'Área'
        let areaOutro = ''
        if (!isAreaInList(area) && area) {
          areaOutro = area
          area = 'Outro'
        } else if (area === 'Outro') {
          areaOutro = ''
        }

        if (!alive) return
        setForm({
          titulo: p.titulo || '',
          categoria,
          subcategoria,
          tipo,
          area,
          areaOutro,
          apresentador,
          autores,
        })

        const assigned = normalizeAssigned(p.assignedEvaluators)
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
      } catch (e:any) {
        if (alive) setMsg({ type: 'error', text: e?.message || 'Erro ao carregar projeto' })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allEvaluators])

  const valid = useMemo(() => !!form.titulo.trim(), [form.titulo])

  const handleChange =
    (key: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(s => ({ ...s, [key]: e.target.value }))

  const tipoOptions = useMemo(() => {
    switch (form.categoria) {
      case 'Feira de Ciências': return TIPOS_FEIRA
      case 'Comunicação Oral': return TIPOS_COM_ORAL // inclui Servidor
      case 'Banner': return TIPOS_BANNER             // inclui Servidor
      default: return []
    }
  }, [form.categoria])

  // coerência ao mudar categoria/tipo
  useEffect(() => {
    if (form.categoria === 'IFTECH') {
      setForm(s => ({ ...s, subcategoria: '', tipo: '' }))
      return
    }
    if (form.categoria === 'Feira de Ciências') {
      setForm(s => ({ ...s, subcategoria: '' }))
      if (form.tipo && !TIPOS_FEIRA.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }
    if (form.categoria === 'Comunicação Oral') {
      if (form.tipo && !TIPOS_COM_ORAL.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }
    if (form.categoria === 'Banner') {
      if (form.tipo && !TIPOS_BANNER.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria, form.tipo])

  const handleSubmit = async () => {
    if (!valid) {
      setMsg({ type: 'error', text: 'Informe o título do trabalho.' })
      return
    }
    setSaving(true); setMsg(null)

    const assigned = isPublic
      ? ['ALL']
      : Array.from(new Set(selectedEvaluators.map(u => u.email.toLowerCase())))

    const autoresArr = form.autores
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)

    const areaFinal = form.area === 'Outro'
      ? (form.areaOutro || 'Outro').trim()
      : form.area

    const payload: any = {
      id: isEdit && id ? id : generateProjectId(),
      titulo: form.titulo.trim(),
      categoria: (form.categoria || '').trim(),
      subcategoria: (form.subcategoria || '').trim(),
      tipo: (form.tipo || '').trim(), // agora inclui "Servidor" onde permitido
      area: areaFinal || '',
      apresentador: (form.apresentador || '').trim(),
      autores: autoresArr,
      assignedEvaluators: normalizeAssigned(assigned),
      updatedAt: new Date(),
    }

    try {
      await saveProject(payload)
      setMsg({ type: 'success', text: 'Projeto salvo com sucesso' })
      nav('/admin/projects')
    } catch (e:any) {
      setMsg({ type: 'error', text: e?.message || 'Erro ao salvar projeto' })
    } finally {
      setSaving(false)
    }
  }

  const showSubcategoria =
    form.categoria === 'Comunicação Oral' || form.categoria === 'Banner'
  const showTipo =
    form.categoria === 'Comunicação Oral' ||
    form.categoria === 'Banner' ||
    form.categoria === 'Feira de Ciências'
  const showAreaOutro = form.area === 'Outro'

  return (
    <Box maxWidth={860} mx="auto">
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
              label="Título do trabalho"
              value={form.titulo}
              onChange={handleChange('titulo')}
              required
              fullWidth
            />

            <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
              <TextField
                select
                label="Categoria"
                value={form.categoria}
                onChange={handleChange('categoria')}
                fullWidth
              >
                <MenuItem value="">— (opcional) —</MenuItem>
                {CATEGORIAS.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>

              {showSubcategoria && (
                <TextField
                  select
                  label="Subcategoria"
                  value={form.subcategoria}
                  onChange={handleChange('subcategoria')}
                  fullWidth
                >
                  <MenuItem value="">— (opcional) —</MenuItem>
                  {SUBCATEGORIAS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              )}

              {showTipo && (
                <TextField
                  select
                  label="Tipo"
                  value={form.tipo}
                  onChange={handleChange('tipo')}
                  fullWidth
                >
                  <MenuItem value="">— (opcional) —</MenuItem>
                  {tipoOptions.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            <Divider flexItem />

            <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
              <TextField
                select
                label="Área"
                value={form.area}
                onChange={handleChange('area')}
                fullWidth
              >
                {AREA_OPCOES.map((a) => (
                  <MenuItem key={a} value={a}>{a}</MenuItem>
                ))}
              </TextField>

              {showAreaOutro && (
                <TextField
                  label="Área (Outro)"
                  value={form.areaOutro}
                  onChange={handleChange('areaOutro')}
                  fullWidth
                />
              )}
            </Stack>

            <TextField
              label="Apresentador(a)"
              value={form.apresentador}
              onChange={handleChange('apresentador')}
              fullWidth
            />

            <TextField
              label='Autores (separe com ";")'
              value={form.autores}
              onChange={handleChange('autores')}
              fullWidth
              multiline
              minRows={2}
            />

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
