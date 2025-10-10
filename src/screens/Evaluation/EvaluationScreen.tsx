// src/screens/Evaluation/EvaluationScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Button,
  TextField, LinearProgress, ToggleButton, ToggleButtonGroup, Stack, Alert
} from '@mui/material'
import {
  doc, getDoc, getDocs, query, where,
  addDoc, updateDoc, collection, serverTimestamp
} from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'

// ---------- Tipos ----------
type Criterion = { label: string; values: number[] }
type Params = { projectId: string }

// ====== helpers de normalização ======
const stripNbsp = (s: string) => (s || '').replace(/\u00A0/g, ' ')
const normalize = (s: string) =>
  stripNbsp(String(s || ''))
    .normalize('NFD')              // separa acentos
    .replace(/\p{Diacritic}/gu, '')// remove acentos
    .replace(/\s+/g, ' ')          // colapsa espaços
    .trim()
    .toLowerCase()

const CATEGORY_CANON = {
  'ensino': 'Ensino',
  'pesquisa/inovacao': 'Pesquisa/Inovação',
  'pesquisa inovacao': 'Pesquisa/Inovação',
  'extensao': 'Extensão',
  'comunicacao oral': 'Comunicação Oral',
  'iftech': 'IFTECH',
  'feira de ciencias': 'Feira de Ciências',
} as const
type CanonKey = typeof CATEGORY_CANON[keyof typeof CATEGORY_CANON]

// ========= TODOS OS CRITÉRIOS =========
const CRITERIA_DEFS: Record<CanonKey, Criterion[]> = {
  Ensino: [
    { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação, qualidade das imagens e do texto - uso da norma culta, coesão e coerência textual).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Contribuição do projeto para a melhoria do processo de ensino e aprendizagem.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Metodologia inovadora e ressignificativa para o processo de ensino e aprendizagem.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Contribuição do projeto para a sociedade, para a formação integral do estudante e para o processo de ensino e aprendizagem.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Articulação entre ensino, pesquisa e extensão.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Relevância social do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  'Pesquisa/Inovação': [
    { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação, qualidade das imagens e do texto - uso da norma culta, coesão e coerência textual).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Conhecimento do(a) estudante em relação à metodologia proposta.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Domínio do(a) estudante sobre o trabalho, considerando a fundamentação teórica baseada em literatura científica.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre os resultados (esperados ou obtidos) e os objetivos do projeto.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relevância da pesquisa e/ou inovação em relação à implementação e contribuição direta ou indireta para a sociedade.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Interdisciplinaridade do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  Extensão: [
    { label: 'Domínio do(a) estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação, qualidade das imagens e do texto - uso da norma culta, coesão e coerência textual).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Participação evidente da comunidade externa nas ações de extensão.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Potencial de alterações sociais/políticas/culturais/econômicas na comunidade local/regional.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Resultados esperados e/ou ações obtidas com relação às demandas e problemas da comunidade local/regional.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre os resultados (esperados ou obtidos) e os objetivos do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Interdisciplinaridade do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  'Comunicação Oral': [
    { label: 'Domínio do(a) estudante sobre o trabalho considerando a fundamentação teórica.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração dos slides (aspectos visuais, diagramação, qualidade das imagens e do texto - uso da norma culta, coesão e coerência textual).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Contribuição do projeto para a experiência acadêmica e profissional do(a) estudante envolvido(a).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Domínio e desenvoltura do aluno na apresentação do trabalho.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre os resultados (esperados ou obtidos) e os objetivos do projeto.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relevância do projeto em relação à implementação e contribuição direta ou indireta para a sociedade, para formação integral do estudante e para o processo de ensino e aprendizagem.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Domínio no uso dos recursos audiovisuais.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  IFTECH: [
    { label: 'Os objetivos e os métodos do projeto são bem definidos, de acordo com o tema da feira?', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'O protótipo e/ou modelo desenvolvido visa solucionar problemas regionais e/ou locais, impactando positivamente na realidade da comunidade?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'O protótipo e/ou modelo apresentado preza pela sustentabilidade e pela responsabilidade social?', values: [0, 0.25, 0.5, 0.75, 1.0] },
    { label: 'O projeto garante a iniciação e inserção dos estudantes em atividades de pesquisa em desenvolvimento tecnológico e de inovação?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Desempenho do estudante durante a explicação sobre o funcionamento/aplicabilidade do protótipo e/ou modelo inovador', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'O projeto apresenta protótipo?', values: [0, 0.5, 1.0, 1.5, 2.0] },
  ],
  'Feira de Ciências': [
    { label: 'Os objetivos e os métodos do projeto são bem definidos, incluindo diário de bordo e resumo expandido', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'O projeto possui o objetivo de solucionar problemas regionais e/ou locais, impactando positivamente na realidade da comunidade?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'O projeto preza pela sustentabilidade e pela responsabilidade social?', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'O projeto garante a iniciação e inserção dos estudantes em atividades de pesquisa em desenvolvimento tecnológico e de inovação?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Desempenho dos estudantes durante a explicação do protótipo', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'Interdisciplinariedade do projeto apresentado', values: [0, 0.25, 0.5, 1.0, 1.5] },
  ],
}

// ---------- Helpers ----------
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

  // Para checar visibilidade sem depender do service
  const [assigned, setAssigned] = useState<string[] | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setErro(null)
        const s = await getDoc(doc(db, 'trabalhos', projectId!))
        if (!s.exists()) throw new Error('Projeto não encontrado')

        const data = s.data() as any
        const categoriaRaw = String(data.categoria || '')
        const canonKey = (CATEGORY_CANON as any)[normalize(categoriaRaw)]
        const defs = canonKey ? (CRITERIA_DEFS as any)[canonKey] : undefined
        if (!defs) throw new Error(`Categoria inválida ou não suportada: ${categoriaRaw}`)

        if (!active) return
        setCriteria(defs)
        setNotas(Array(defs.length).fill(null))
        setAssigned(Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : ['ALL'])
      } catch (err: any) {
        console.error(err)
        if (active) setErro(err?.message || 'Erro ao carregar dados')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
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
    } catch (e:any) {
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
