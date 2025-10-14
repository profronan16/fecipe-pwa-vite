// src/screens/Evaluation/EvaluationScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Alert,
  LinearProgress, Button, ToggleButton, ToggleButtonGroup, TextField, Chip
} from '@mui/material'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@services/firebase'

// ---------------- helpers ----------------
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

const toNumber = (v: any) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

type Projeto = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string // Ensino / Extensão / Pesquisa/Inovação (quando aplicável)
  tipo?: string         // Médio / Superior / Pós / Servidor (quando aplicável)
  area?: string
  autores?: string[]
  apresentador?: string
}

type Criterion = { id: string; label: string; options: number[] }

// --------- Tabelas de critérios por categoria/subcategoria (conforme edital) ---------

// Facilidade: “escadas” usadas muitas vezes
const S_04_18 = [0.0, 0.4, 0.9, 1.4, 1.8]
const S_04_16 = [0.0, 0.4, 0.8, 1.2, 1.6]
const S_04_14 = [0.0, 0.4, 0.7, 1.0, 1.4]
const S_03_12 = [0.0, 0.3, 0.6, 0.9, 1.2]
const S_02_08 = [0.0, 0.2, 0.4, 0.6, 0.8]
const S_02_06 = [0.0, 0.2, 0.3, 0.4, 0.6]

const IF_025_15 = [0.0, 0.25, 0.5, 1.0, 1.5]
const IF_05_20  = [0.0, 0.5, 1.0, 1.5, 2.0]
const IF_025_10 = [0.0, 0.25, 0.5, 0.75, 1.0]

// ---------- Banner — Ensino ----------
const BANNER_ENSINO: Criterion[] = [
  { id: 'c1', label: 'Domínio do(a) estudante sobre o trabalho.', options: S_04_18 },
  { id: 'c2', label: 'Clareza e objetividade da apresentação.', options: S_04_16 },
  { id: 'c3', label: 'Definição da proposta do projeto.', options: S_04_14 },
  { id: 'c4', label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', options: S_03_12 },
  { id: 'c5', label: 'Contribuição para o processo de ensino e aprendizagem.', options: S_03_12 },
  { id: 'c6', label: 'Metodologia inovadora e ressignificativa.', options: S_02_08 },
  { id: 'c7', label: 'Contribuição para a sociedade e formação integral.', options: S_02_08 },
  { id: 'c8', label: 'Articulação entre ensino, pesquisa e extensão.', options: S_02_06 },
  { id: 'c9', label: 'Relevância social do projeto.', options: S_02_06 },
]

// ---------- Banner — Pesquisa/Inovação ----------
const BANNER_PESQ: Criterion[] = [
  { id: 'c1', label: 'Domínio do(a) estudante sobre o trabalho.', options: S_04_18 },
  { id: 'c2', label: 'Clareza da apresentação.', options: S_04_16 },
  { id: 'c3', label: 'Definição da proposta do projeto.', options: S_04_14 },
  { id: 'c4', label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', options: S_03_12 },
  { id: 'c5', label: 'Conhecimento do(a) estudante sobre a metodologia proposta.', options: S_03_12 },
  { id: 'c6', label: 'Domínio considerando a fundamentação teórica baseada em literatura científica.', options: S_02_08 },
  { id: 'c7', label: 'Relação entre resultados (esperados/obtidos) e objetivos.', options: S_02_08 },
  { id: 'c8', label: 'Relevância e contribuição (direta/indireta) para a sociedade.', options: S_02_06 },
  { id: 'c9', label: 'Interdisciplinaridade do projeto.', options: S_02_06 },
]

// ---------- Banner — Extensão ----------
const BANNER_EXT: Criterion[] = [
  { id: 'c1', label: 'Domínio do(a) estudante sobre o trabalho.', options: S_04_18 },
  { id: 'c2', label: 'Clareza da apresentação.', options: S_04_16 },
  { id: 'c3', label: 'Definição da proposta do projeto.', options: S_04_14 },
  { id: 'c4', label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', options: S_03_12 },
  { id: 'c5', label: 'Participação evidente da comunidade externa nas ações.', options: S_03_12 },
  { id: 'c6', label: 'Potencial de alterações sociais/políticas/culturais/econômicas.', options: S_02_08 },
  { id: 'c7', label: 'Resultados esperados/obtidos x demandas da comunidade.', options: S_02_08 },
  { id: 'c8', label: 'Relação entre resultados (esperados/obtidos) e objetivos.', options: S_02_06 },
  { id: 'c9', label: 'Interdisciplinaridade do projeto.', options: S_02_06 },
]

// ---------- Comunicação Oral (comum a todas as “subcategorias”) ----------
const COM_ORAL: Criterion[] = [
  { id: 'c1', label: 'Domínio sobre o trabalho considerando a fundamentação teórica.', options: S_04_18 },
  { id: 'c2', label: 'Clareza e objetividade da apresentação.', options: S_04_16 },
  { id: 'c3', label: 'Definição da proposta do projeto.', options: S_04_14 },
  { id: 'c4', label: 'Elaboração dos slides (visuais, diagramação, qualidade do texto).', options: S_03_12 },
  { id: 'c5', label: 'Contribuição para a experiência acadêmica e profissional do(a) estudante.', options: S_03_12 },
  { id: 'c6', label: 'Domínio e desenvoltura na apresentação.', options: S_02_08 },
  { id: 'c7', label: 'Relação entre resultados (esperados/obtidos) e objetivos.', options: S_02_08 },
  { id: 'c8', label: 'Relevância e contribuição para sociedade/formação/processo de ensino.', options: S_02_06 },
  { id: 'c9', label: 'Domínio no uso de recursos audiovisuais.', options: S_02_06 },
]

// ---------- IFTECH ----------
const IFTECH: Criterion[] = [
  { id: 'c1', label: 'Objetivos e métodos bem definidos (tema da feira).', options: IF_025_15 },
  { id: 'c2', label: 'Protótipo/modelo visa solucionar problemas locais/regionais.', options: IF_05_20 },
  { id: 'c3', label: 'Sustentabilidade e responsabilidade social.', options: IF_025_10 },
  { id: 'c4', label: 'Inserção em pesquisa/desenvolvimento/ inovação.', options: IF_05_20 },
  { id: 'c5', label: 'Desempenho ao explicar aplicabilidade do protótipo.', options: IF_025_15 },
  { id: 'c6', label: 'Apresenta protótipo?', options: IF_05_20 },
]

// ---------- Feira de Ciências ----------
const FEIRA: Criterion[] = [
  { id: 'c1', label: 'Objetivos e métodos (diário de bordo e resumo expandido).', options: IF_025_15 },
  { id: 'c2', label: 'Solução de problemas locais/regionais.', options: IF_05_20 },
  { id: 'c3', label: 'Sustentabilidade e responsabilidade social.', options: IF_025_15 },
  { id: 'c4', label: 'Inserção em pesquisa/desenvolvimento/ inovação.', options: IF_05_20 },
  { id: 'c5', label: 'Desempenho durante a explicação do protótipo.', options: IF_025_15 },
  { id: 'c6', label: 'Interdisciplinaridade do projeto apresentado.', options: IF_025_15 },
]

// Monta critérios pela categoria/subcategoria
function buildCriteria(p?: Projeto): Criterion[] {
  const cat = norm(p?.categoria || '')
  const sub = norm(p?.subcategoria || '')
  if (cat.includes('iftech')) return IFTECH
  if (cat.includes('feira de ciencias')) return FEIRA
  if (cat.includes('comunicacao oral')) return COM_ORAL
  if (cat.includes('banner')) {
    if (sub.includes('ensino')) return BANNER_ENSINO
    if (sub.includes('extensao')) return BANNER_EXT
    // default para Pesquisa/Inovação
    return BANNER_PESQ
  }
  // fallback: comunicação oral
  return COM_ORAL
}

// ---------------- compat e firestore helpers ----------------
const detEvalId = (trabalhoId: string, avaliadorId: string) => `${trabalhoId}_${avaliadorId}`

type AvaliacaoRaw = {
  id?: string
  trabalhoId?: string
  avaliadorId?: string
  scores?: Record<string, any>
  notas?: Record<string, any>
  answers?: Record<string, any>
  criterios?: Array<{ id?: string; label?: string; score?: any; nota?: any; value?: any }>
  observacoes?: string
}

function extractScoresFlexible(raw: AvaliacaoRaw, crits: Criterion[]): Record<string, number> {
  const out: Record<string, number> = {}
  const byId = new Map(crits.map(c => [c.id, c]))
  const byLabel = new Map(crits.map(c => [norm(c.label), c.id]))

  for (const obj of [raw.scores, raw.notas, raw.answers]) {
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        const id = byId.has(k) ? k : byLabel.get(norm(k))
        const n = toNumber(v)
        if (id && typeof n === 'number') out[id] = n
      }
    }
  }
  if (Array.isArray(raw.criterios)) {
    for (const it of raw.criterios) {
      const id =
        (it.id && byId.has(it.id)) ? it.id :
        (it.label ? byLabel.get(norm(it.label)) : undefined)
      const v = it.score ?? it.nota ?? it.value
      const n = toNumber(v)
      if (id && typeof n === 'number') out[id] = n
    }
  }
  return out
}

// ---------------- Componente ----------------
export default function EvaluationScreen() {
  // aceita /:id ou ?id= como fallback
  const { id: idFromParam } = useParams<{ id: string }>()
  const [sp] = useSearchParams()
  const idFromQuery = sp.get('id') || undefined
  const trabalhoId = idFromParam ?? idFromQuery

  const tituloFromQuery = sp.get('titulo') || ''
  const nav = useNavigate()
  const { user, authReady } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const criterios = useMemo(() => buildCriteria(projeto), [projeto])

  const [avaliacaoId, setAvaliacaoId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [observacoes, setObservacoes] = useState('')

  if (!authReady) return <LinearProgress />
  if (!user) return <Alert severity="error">Faça login para continuar.</Alert>
  if (!trabalhoId) return <Alert severity="error">Trabalho não informado na rota.</Alert>

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setError(null)
      try {
        // Projeto
        const pRef = doc(db, 'trabalhos', trabalhoId!)
        const pSnap = await getDoc(pRef)
        if (!pSnap.exists()) throw new Error('Trabalho não encontrado.')
        const d = pSnap.data() as any
        const proj: Projeto = {
          id: pSnap.id,
          titulo: d.titulo || tituloFromQuery || 'Projeto',
          categoria: d.categoria || '',
          subcategoria: d.subcategoria || '',
          tipo: d.tipo || '',
          area: d.area || '',
          autores: Array.isArray(d.autores) ? d.autores : [],
          apresentador: d.apresentador || ''
        }
        if (!alive) return
        setProjeto(proj)

        // Avaliação do avaliador atual
        const detId = detEvalId(trabalhoId!, user.uid)
        const detRef = doc(db, 'avaliacoes', detId)
        const detSnap = await getDoc(detRef)

        let raw: AvaliacaoRaw | null = null
        let currentId: string | null = null

        if (detSnap.exists()) {
          raw = { id: detSnap.id, ...(detSnap.data() as any) }
          currentId = detSnap.id
        } else {
          const qOld = query(
            collection(db, 'avaliacoes'),
            where('trabalhoId', '==', trabalhoId),
            where('avaliadorId', '==', user.uid)
          )
          const oldSnap = await getDocs(qOld)
          if (!oldSnap.empty) {
            const docOld = oldSnap.docs[0]
            raw = { id: docOld.id, ...(docOld.data() as any) }
            currentId = docOld.id
          }
        }

        if (raw) {
          const mapped = extractScoresFlexible(raw, buildCriteria(proj))
          if (!alive) return
          setScores(mapped)
          setObservacoes(raw.observacoes || '')
          setAvaliacaoId(currentId)
        } else {
          if (!alive) return
          setScores({})
          setObservacoes('')
          setAvaliacaoId(null)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Erro ao carregar avaliação.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [authReady, user.uid, trabalhoId, tituloFromQuery])

  const handleSetNota = (criterioId: string, valor: number) => {
    setScores(s => ({ ...s, [criterioId]: valor }))
  }

  const handleSalvar = async () => {
  if (!projeto || !user?.uid) return
  setLoading(true); setError(null)
  try {
    const idFinal = `${projeto.id}_${user.uid}`
    await setDoc(doc(db, 'avaliacoes', idFinal), {
      id: idFinal,
      trabalhoId: projeto.id,
      avaliadorId: user.uid,
      scores,
      notas: scores,
      criterios: criterios.map(c => ({ id: c.id, label: c.label, value: scores[c.id] ?? null })),
      observacoes: observacoes || '',
      updatedAt: serverTimestamp(),
      ...(avaliacaoId ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true })
    // redireciona para a lista de trabalhos após salvar
    nav('/evaluator/works', { replace: true })
  } catch (e: any) {
    setError(e?.message || 'Falha ao salvar avaliação.')
  } finally {
    setLoading(false)
  }
}

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={800}>Avaliar Trabalho</Typography>
        <Button variant="outlined" onClick={() => nav(-1)}>Voltar</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {projeto && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>{projeto.titulo}</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                {projeto.categoria && <Chip size="small" label={projeto.categoria} />}
                {projeto.subcategoria && <Chip size="small" label={projeto.subcategoria} />}
                {projeto.tipo && <Chip size="small" label={projeto.tipo} />}
                {projeto.area && <Chip size="small" label={projeto.area} />}
              </Stack>
              {!!projeto.autores?.length && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Autores:</strong> {projeto.autores.join('; ')}
                </Typography>
              )}
              {projeto.apresentador && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Apresentador(a):</strong> {projeto.apresentador}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Box mt={2}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>Notas por critério</Typography>
        <Stack gap={1.5}>
          {criterios.map((c) => {
            const val = toNumber(scores[c.id])
            return (
              <Card key={c.id} variant="outlined">
                <CardContent>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">{c.label}</Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={val}
                      onChange={(_, v) => typeof v === 'number' && handleSetNota(c.id, v)}
                      sx={{
                        '& .MuiToggleButton-root.Mui-selected': {
                          bgcolor: 'success.light',
                          color: 'success.contrastText',
                        }
                      }}
                    >
                      {c.options.map(n => (
                        <ToggleButton key={n} value={n}>{n}</ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      </Box>

      <Box mt={2}>
        <TextField
          label="Comentários (opcional)"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          fullWidth
          multiline
          minRows={3}
        />
      </Box>

      <Stack direction="row" justifyContent="flex-end" mt={2} gap={1}>
        <Button variant="outlined" onClick={() => nav(-1)}>Cancelar</Button>
        <Button variant="contained" onClick={handleSalvar} disabled={loading}>
          {avaliacaoId ? 'Salvar alterações' : 'Salvar avaliação'}
        </Button>
      </Stack>
    </Box>
  )
}
