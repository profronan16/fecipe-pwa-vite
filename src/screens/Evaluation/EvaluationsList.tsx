// src/screens/Evaluation/EvaluationsList.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack,
  TextField, MenuItem, Chip, Button, LinearProgress, Alert, Grid, Tooltip
} from '@mui/material'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'

// ===== Constantes de domínio =====
const CATEGORIAS = ['IFTECH', 'Feira de Ciências', 'Comunicação Oral', 'Banner'] as const
type Categoria = typeof CATEGORIAS[number] | ''

const SUBCATEGORIAS = ['Ensino', 'Extensão', 'Pesquisa/Inovação'] as const
type Subcategoria = typeof SUBCATEGORIAS[number] | ''

const TIPOS_FEIRA   = ['Fundamental', 'Ensino Médio', 'Superior'] as const
const TIPOS_COMORAL = ['Ensino Médio', 'Superior', 'Pós-graduação'] as const
const TIPOS_BANNER  = ['Ensino Médio', 'Superior'] as const
type Tipo = '' | 'Fundamental' | 'Ensino Médio' | 'Superior' | 'Pós-graduação'

// ===== Helpers =====
const stripNbsp = (s: string) => (s || '').replace(/\u00A0/g, ' ')
const clean = (s: any) => stripNbsp(String(s ?? '')).replace(/\s+/g, ' ').trim().replace(/\s{2,}/g, ' ')
const normalize = (s: string) =>
  clean(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

type Project = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
  apresentador?: string
  autores?: string[]
  assignedEvaluators?: string[]
}

type Evaluation = {
  id: string
  trabalhoId: string
  avaliadorId: string
  notas?: Record<string, number>
  comentarios?: string
}

function canSee(project: Project, email?: string, role?: string) {
  if (role === 'admin') return true
  const assigned = Array.isArray(project.assignedEvaluators) ? project.assignedEvaluators : ['ALL']
  if (assigned.includes('ALL')) return true
  const e = (email || '').toLowerCase()
  return e ? assigned.includes(e) : false
}

function calcTotal(notas?: Record<string, number>): number | null {
  if (!notas) return null
  let s = 0
  let count = 0
  Object.values(notas).forEach(v => {
    if (typeof v === 'number') { s += v; count++ }
  })
  return count ? s : null
}

function optionsTipoFor(categoria: Categoria): readonly string[] {
  if (categoria === 'Feira de Ciências') return TIPOS_FEIRA
  if (categoria === 'Comunicação Oral') return TIPOS_COMORAL
  if (categoria === 'Banner') return TIPOS_BANNER
  return []
}

// ===== Componente =====
export default function EvaluationsList() {
  const nav = useNavigate()
  const { user, role } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [myEvals, setMyEvals] = useState<Record<string, Evaluation>>({}) // por trabalhoId

  // Filtros
  const [qTitle, setQTitle] = useState('')
  const [fCategoria, setFCategoria] = useState<Categoria>('')
  const [fSub, setFSub] = useState<Subcategoria>('')
  const [fTipo, setFTipo] = useState<Tipo>('')

  // Carrega projetos e avaliações do usuário
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setError(null); setLoading(true)

        // 1) Carregar todos os projetos (filtraremos no cliente por visibilidade)
        const snap = await getDocs(collection(db, 'trabalhos'))
        const projs: Project[] = snap.docs.map(d => {
          const data = d.data() as any
          return {
            id: d.id,
            titulo: data.titulo || '',
            categoria: data.categoria || '',
            subcategoria: data.subcategoria || '',
            tipo: data.tipo || '',
            area: data.area || '',
            apresentador: data.apresentador || '',
            autores: Array.isArray(data.autores) ? data.autores : [],
            assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : ['ALL'],
          }
        })

        // 2) Avaliações do usuário logado (para exibir status)
        let evalsByWork: Record<string, Evaluation> = {}
        if (user?.uid) {
          const q1 = query(
            collection(db, 'avaliacoes'),
            where('avaliadorId', '==', user.uid)
          )
          const s1 = await getDocs(q1)
          s1.docs.forEach(d => {
            const e = d.data() as any
            const ev: Evaluation = {
              id: d.id,
              trabalhoId: e.trabalhoId,
              avaliadorId: e.avaliadorId,
              notas: e.notas,
              comentarios: e.comentarios,
            }
            if (ev.trabalhoId) evalsByWork[ev.trabalhoId] = ev
          })
        }

        if (!active) return
        setProjects(projs)
        setMyEvals(evalsByWork)
      } catch (e:any) {
        if (active) setError(e?.message || 'Erro ao carregar dados')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user?.uid])

  const visibleProjects = useMemo(() => {
    const email = user?.email?.toLowerCase()
    return projects.filter(p => canSee(p, email, role))
  }, [projects, user?.email, role])

  const filtered = useMemo(() => {
    const ct = normalize(fCategoria)
    const sub = normalize(fSub)
    const tp = normalize(fTipo)
    const q = normalize(qTitle)

    return visibleProjects.filter(p => {
      if (q && !normalize(p.titulo).includes(q)) return false

      if (ct) {
        if (normalize(p.categoria || '') !== normalize(fCategoria)) return false
      }
      if (sub) {
        if (normalize(p.subcategoria || '') !== normalize(fSub)) return false
      }
      if (tp) {
        if (normalize(p.tipo || '') !== normalize(fTipo)) return false
      }
      return true
    })
  }, [visibleProjects, qTitle, fCategoria, fSub, fTipo])

  const tipoOptions = useMemo(() => optionsTipoFor(fCategoria), [fCategoria])

  const handleGo = (p: Project) => {
    // abre tela de avaliação com id e titulo na URL
    nav(`/evaluator/evaluate/${p.id}?titulo=${encodeURIComponent(p.titulo || 'Projeto')}`)
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Trabalhos para avaliar</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
          <TextField
            label="Buscar por título"
            value={qTitle}
            onChange={(e)=>setQTitle(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            select
            label="Categoria"
            value={fCategoria}
            onChange={(e) => { setFCategoria(e.target.value as Categoria); setFSub(''); setFTipo('') }}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">{'Todas'}</MenuItem>
            {CATEGORIAS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          {/* Subcategoria só para Comunicação Oral e Banner (filtro é opcional) */}
          {(fCategoria === 'Comunicação Oral' || fCategoria === 'Banner') && (
            <TextField
              select
              label="Subcategoria"
              value={fSub}
              onChange={(e)=>setFSub(e.target.value as Subcategoria)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">{'Todas'}</MenuItem>
              {SUBCATEGORIAS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          )}

          {/* Tipo para Feira / Com. Oral / Banner */}
          {(fCategoria === 'Feira de Ciências' || fCategoria === 'Comunicação Oral' || fCategoria === 'Banner') && (
            <TextField
              select
              label="Tipo"
              value={fTipo}
              onChange={(e)=>setFTipo(e.target.value as Tipo)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">{'Todos'}</MenuItem>
              {tipoOptions.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          )}
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">Nenhum trabalho encontrado com os filtros atuais.</Alert>
      )}

      <Grid container spacing={2}>
        {filtered.map((p) => {
          const ev = myEvals[p.id]
          const total = calcTotal(ev?.notas)
          const already = Boolean(ev)
          const chips: JSX.Element[] = []

          if (p.categoria) chips.push(<Chip key="c" size="small" label={p.categoria} />)
          if (p.subcategoria) chips.push(<Chip key="s" size="small" label={p.subcategoria} />)
          if (p.tipo) chips.push(<Chip key="t" size="small" label={p.tipo} />)
          if (p.area) chips.push(<Chip key="a" size="small" label={p.area} />)

          return (
            <Grid item xs={12} md={6} lg={4} key={p.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                      {p.titulo || 'Sem título'}
                    </Typography>

                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {chips}
                    </Stack>

                    {p.apresentador && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Apresentador(a):</strong> {p.apresentador}
                      </Typography>
                    )}

                    {!!p.autores?.length && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Autores:</strong> {p.autores.join('; ')}
                      </Typography>
                    )}

                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5}>
                      {already ? (
                        <Tooltip title="Você já enviou avaliação para este trabalho. Reabrir permite atualizar as notas.">
                          <Chip color="success" label={total != null ? `Avaliado • Nota ${total.toFixed(2)}` : 'Avaliado'} />
                        </Tooltip>
                      ) : (
                        <Chip label="Não avaliado" />
                      )}

                      <Button variant="contained" onClick={() => handleGo(p)}>
                        {already ? 'Reabrir avaliação' : 'Avaliar'}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
