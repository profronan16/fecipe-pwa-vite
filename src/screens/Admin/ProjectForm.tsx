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

const TIPOS_COM_ORAL = [
  'Ensino Médio',
  'Superior',
  'Pós-graduação',
] as const

const TIPOS_BANNER = [
  'Ensino Médio',
  'Superior',
] as const

const AREA_OPCOES = [
  'Área', // (mantido a seu pedido)
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

// =================== Form / Types locais ===================

type FormState = {
  titulo: string

  categoria: Categoria | ''
  subcategoria: Subcategoria
  tipo: string // usa listas acima conforme categoria

  area: string
  areaOutro: string

  apresentador: string
  autores: string // "autor1; autor2; ..."
}

// =================== Helpers ===================

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

// =================== Componente ===================

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

  // avaliadores / visibilidade
  const [allEvaluators, setAllEvaluators] = useState<UserRecord[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [selectedEvaluators, setSelectedEvaluators] = useState<UserRecord[]>([])

  // ui state
  const [loading, setLoading] = useState<boolean>(!!id)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ------- carregar avaliadores -------
  useEffect(() => {
    (async () => {
      try {
        const users = await listUsers()
        const evals = users.filter(u => u.role === 'evaluator' || u.role === 'admin')
        setAllEvaluators(evals)
      } catch {
        // silencioso
      }
    })()
  }, [])

  // ------- carregar projeto (edição) -------
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

        // mapeia dados existentes para o novo form (mantendo compatibilidade)
        const autores = Array.isArray(p.autores) ? p.autores.join('; ') : ''
        const categoria = (p.categoria || '') as Categoria | ''
        const subcategoria = (p.subcategoria || '') as Subcategoria
        const tipo = (p.tipo || '')
        const apresentador = p.apresentador || ''

        // área/areaOutro: se a área salva não está na lista, abrimos como "Outro"
        let area = p.area || 'Área'
        let areaOutro = ''
        if (!isAreaInList(area) && area) {
          areaOutro = area
          area = 'Outro'
        } else if (area === 'Outro') {
          // se alguém salvou literalmente "Outro", deixar areaOutro vazio
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

        // visibilidade
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

  // ------- validação: só título obrigatório -------
  const valid = useMemo(() => !!form.titulo.trim(), [form.titulo])

  const handleChange =
    (key: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(s => ({ ...s, [key]: e.target.value }))

  // ------- opções de "tipo" conforme categoria -------
  const tipoOptions = useMemo(() => {
    switch (form.categoria) {
      case 'Feira de Ciências': return TIPOS_FEIRA
      case 'Comunicação Oral': return TIPOS_COM_ORAL
      case 'Banner': return TIPOS_BANNER
      default: return [] // IFTECH não exige tipo
    }
  }, [form.categoria])

  // Quando muda a categoria, limpamos subcampo se ficar inválido
  useEffect(() => {
    // IFTECH → zera subcategoria e tipo
    if (form.categoria === 'IFTECH') {
      setForm(s => ({ ...s, subcategoria: '', tipo: '' }))
      return
    }

    // Feira de Ciências → sem subcategoria; tipo deve estar em TIPOS_FEIRA
    if (form.categoria === 'Feira de Ciências') {
      setForm(s => ({ ...s, subcategoria: '' }))
      if (form.tipo && !TIPOS_FEIRA.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }

    // Comunicação Oral → usa subcategoria + tipo (médio/superior/pós)
    if (form.categoria === 'Comunicação Oral') {
      if (form.tipo && !TIPOS_COM_ORAL.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }

    // Banner → usa subcategoria + tipo (médio/superior)
    if (form.categoria === 'Banner') {
      if (form.tipo && !TIPOS_BANNER.includes(form.tipo as any)) {
        setForm(s => ({ ...s, tipo: '' }))
      }
      return
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria, form.tipo])

  // ------- salvar -------
  const handleSubmit = async () => {
    if (!valid) {
      setMsg({ type: 'error', text: 'Informe o título do trabalho.' })
      return
    }
    setSaving(true); setMsg(null)

    const assigned = isPublic
      ? ['ALL']
      : Array.from(new Set(selectedEvaluators.map(u => u.email.toLowerCase())))

    // monta autores a partir da string
    const autoresArr = form.autores
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)

    // resolve área final (com “Outro”)
    const areaFinal = form.area === 'Outro'
      ? (form.areaOutro || 'Outro').trim()
      : form.area

    // payload **apenas com os novos campos**
    const payload: any = {
      id: isEdit && id ? id : generateProjectId(),
      titulo: form.titulo.trim(),

      categoria: (form.categoria || '').trim(),          // Banner | Comunicação Oral | IFTECH | Feira de Ciências
      subcategoria: (form.subcategoria || '').trim(),    // Ensino | Extensão | Pesquisa/Inovação (quando aplicável)
      tipo: (form.tipo || '').trim(),                    // Fundamental | Ensino Médio | Superior | Pós-graduação (quando aplicável)

      area: areaFinal || '',                             // valor direto ou "Outro" preenchido
      apresentador: (form.apresentador || '').trim(),
      autores: autoresArr,

      // visibilidade
      assignedEvaluators: normalizeAssigned(assigned),
      updatedAt: new Date(),
    }

    try {
      await saveProject(payload) // service salva apenas campos novos
      setMsg({ type: 'success', text: 'Projeto salvo com sucesso' })
      nav('/admin/projects')
    } catch (e:any) {
      setMsg({ type: 'error', text: e?.message || 'Erro ao salvar projeto' })
    } finally {
      setSaving(false)
    }
  }

  // ------- UI -------
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
// =================== Fim do componente ===================