// src/screens/Evaluation/EvaluationScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Button,
  TextField, LinearProgress, ToggleButton, ToggleButtonGroup, Stack, Alert
} from '@mui/material'
import {
  doc, getDoc, getDocs, query, where, addDoc, updateDoc, collection, serverTimestamp
} from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'

type Criterion = { label: string; values: number[] }
type Params = { projectId: string }

// ====== helpers de normalização ======
const stripNbsp = (s: string) => (s || '').replace(/\u00A0/g, ' ')
const clean = (s: any) => stripNbsp(String(s ?? '')).replace(/\s+/g, ' ').trim()
const normalize = (s: string) =>
  clean(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

// ================= CRITÉRIOS (completos) =================
const CRI_ENSINO: Criterion[] = [
  { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
  { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
  { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
  { label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Contribuição para ensino e aprendizagem.', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Metodologia inovadora/ressignificativa.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Contribuição para a formação integral/ sociedade.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Articulação entre ensino, pesquisa e extensão.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  { label: 'Relevância social do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
]

const CRI_PESQ: Criterion[] = [
  { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
  { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
  { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
  { label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Conhecimento de metodologia proposta.', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Fundamentação teórica (literatura científica).', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Resultados x objetivos.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Relevância/implementação/impacto social.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  { label: 'Interdisciplinaridade.', values: [0, 0.2, 0.3, 0.4, 0.6] },
]

const CRI_EXTEN: Criterion[] = [
  { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
  { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
  { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
  { label: 'Elaboração do banner (visuais, diagramação, qualidade do texto).', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Participação da comunidade externa.', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Potencial de transformação social/cultural/econômica.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Resultados x demandas da comunidade.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Resultados x objetivos.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  { label: 'Interdisciplinaridade.', values: [0, 0.2, 0.3, 0.4, 0.6] },
]

const CRI_COMORAL: Criterion[] = [
  { label: 'Domínio do(a) estudante (com fundamentação).', values: [0, 0.4, 0.9, 1.4, 1.8] },
  { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
  { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
  { label: 'Qualidade dos slides (visuais, diagramação, texto).', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Contribuição para experiência acadêmica/profissional.', values: [0, 0.3, 0.6, 0.9, 1.2] },
  { label: 'Desenvoltura na apresentação.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Resultados x objetivos.', values: [0, 0.2, 0.4, 0.6, 0.8] },
  { label: 'Relevância/impacto social/educacional.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  { label: 'Domínio de recursos audiovisuais.', values: [0, 0.2, 0.3, 0.4, 0.6] },
]

const CRI_IFTECH: Criterion[] = [
  { label: 'Objetivos e métodos bem definidos (tema da feira).', values: [0, 0.25, 0.5, 1.0, 1.5] },
  { label: 'Solução para problemas locais/regionais (impacto).', values: [0, 0.5, 1.0, 1.5, 2.0] },
  { label: 'Sustentabilidade e responsabilidade social.', values: [0, 0.25, 0.5, 0.75, 1.0] },
  { label: 'Inserção em pesquisa/desenvolvimento/ inovação.', values: [0, 0.5, 1.0, 1.5, 2.0] },
  { label: 'Desempenho ao explicar aplicabilidade do protótipo.', values: [0, 0.25, 0.5, 1.0, 1.5] },
  { label: 'Apresenta protótipo?', values: [0, 0.5, 1.0, 1.5, 2.0] },
]

const CRI_FEIRA: Criterion[] = [
  { label: 'Objetivos e métodos (diário de bordo e resumo).', values: [0, 0.25, 0.5, 1.0, 1.5] },
  { label: 'Solução para problemas locais/regionais (impacto).', values: [0, 0.5, 1.0, 1.5, 2.0] },
  { label: 'Sustentabilidade e responsabilidade social.', values: [0, 0.25, 0.5, 1.0, 1.5] },
  { label: 'Inserção em pesquisa/tecnologia/inovação.', values: [0, 0.5, 1.0, 1.5, 2.0] },
  { label: 'Desempenho ao explicar o protótipo.', values: [0, 0.25, 0.5, 1.0, 1.5] },
  { label: 'Interdisciplinaridade do projeto.', values: [0, 0.25, 0.5, 1.0, 1.5] },
]

// Decide critérios com base em categoria/subcategoria
function selectCriteria(categoria: string, subcategoria: string): Criterion[] | null {
  const cat = normalize(categoria)
  const sub = normalize(subcategoria)

  if (cat === 'iftech') return CRI_IFTECH
  if (cat === 'feira de ciencias') return CRI_FEIRA
  if (cat === 'comunicacao oral') return CRI_COMORAL
  if (cat === 'banner') {
    if (sub === 'ensino') return CRI_ENSINO
    if (sub === 'extensao') return CRI_EXTEN
    if (sub === 'pesquisa/inovacao' || sub === 'pesquisa/inovacao') return CRI_PESQ
    // fallback: se banner sem subcategoria válida, não deixa avaliar
    return null
  }
  // categoria desconhecida
  return null
}

const formatScore = (v: number) => v.toFixed(2).replace(/\.?0+$/, '')

export default function EvaluationScreen() {
  const nav = useNavigate()
  const { projectId } = useParams<Params>()
  const [qs] = useSearchParams()
  const titulo = qs.get('titulo') || 'Projeto'

  const { user, role } = useAuth()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [notas, setNotas] = useState<Array<number | null>>([])
  const [comentarios, setComentarios] = useState('')

  const [assigned, setAssigned] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setErro(null)
        const s = await getDoc(doc(db, 'trabalhos', projectId!))
        if (!s.exists()) throw new Error('Projeto não encontrado')

        const data = s.data() as any
        const categoria = clean(data.categoria)
        const subcategoria = clean(data.subcategoria)

        const defs = selectCriteria(categoria, subcategoria)
        if (!defs) {
          const hint = normalize(categoria) === 'banner'
            ? 'Banner requer subcategoria: Ensino, Extensão ou Pesquisa/Inovação.'
            : 'Categoria inválida ou não suportada.'
          throw new Error(`${hint} (categoria: "${categoria}"${subcategoria ? `, sub: "${subcategoria}"` : ''})`)
        }

        if (!alive) return
        setCriteria(defs)
        setNotas(Array(defs.length).fill(null))

        const vis = Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : ['ALL']
        setAssigned(vis)
      } catch (err: any) {
        console.error(err)
        if (alive) setErro(err?.message || 'Erro ao carregar dados')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [projectId])

  const canSee = useMemo(() => {
    if (!assigned) return false
    if (role === 'admin') return true
    if (assigned.includes('ALL')) return true
    const email = user?.email?.toLowerCase()
    return email ? assigned.includes(email) : false
  }, [assigned, role, user])

  const handlePick = (idx: number, value: number) => {
    const copy = [...notas]
    copy[idx] = value
    setNotas(copy)
  }

  const allFilled = useMemo(() => notas.length > 0 && notas.every((n) => n != null), [notas])

  const handleSubmit = async () => {
    if (!allFilled) {
      alert('Preencha todos os critérios antes de salvar.')
      return
    }
    try {
      setLoading(true)
      const notasObj: Record<string, number> = {}
      notas.forEach((n, i) => (notasObj[`C${i + 1}`] = n!))

      // 1 avaliação por avaliador por projeto
      const q = query(
        collection(db, 'avaliacoes'),
        where('trabalhoId', '==', projectId),
        where('avaliadorId', '==', user!.uid)
      )
      const snap = await getDocs(q)
      const payload = {
        trabalhoId: projectId,
        avaliadorId: user!.uid,
        evaluatorEmail: user!.email,
        notas: notasObj,
        comentarios,
        timestamp: serverTimestamp(),
      }

      if (!snap.empty) {
        await updateDoc(doc(db, 'avaliacoes', snap.docs[0].id), payload)
      } else {
        await addDoc(collection(db, 'avaliacoes'), payload)
      }

      nav('/evaluator/evaluations')
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar avaliação')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LinearProgress />
  if (erro) return <Alert severity="error">{erro}</Alert>
  if (!canSee) return <Navigate to="/unauthorized" replace />

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>{titulo}</Typography>

      <Stack spacing={2}>
        {criteria.map((c, idx) => (
          <Card key={idx} variant="outlined">
            <CardContent>
              <Typography fontWeight={600} mb={1}>{c.label}</Typography>
              <ToggleButtonGroup
                exclusive
                value={notas[idx]}
                onChange={(_, v) => v != null && handlePick(idx, v)}
              >
                {c.values.map((v) => (
                  <ToggleButton
                    key={`${idx}-${v}`}
                    value={v}
                    sx={{
                      '&.Mui-selected': {
                        bgcolor: 'success.main',
                        color: '#fff',
                        '&:hover': { bgcolor: 'success.dark' },
                      },
                    }}
                  >
                    {formatScore(v)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </CardContent>
          </Card>
        ))}

        <Card variant="outlined">
          <CardContent>
            <Typography fontWeight={600} mb={1}>Comentários (opcional)</Typography>
            <TextField
              multiline minRows={3} fullWidth
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />
          </CardContent>
        </Card>

        <Stack direction="row" gap={1} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => nav(-1)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleSubmit} disabled={!allFilled}>
            Salvar avaliação
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
