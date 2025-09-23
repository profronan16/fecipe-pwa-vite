// src/screens/Evaluation/EvaluationScreen.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Button,
  TextField, LinearProgress, Alert, ToggleButton, ToggleButtonGroup, Stack
} from '@mui/material'
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'

// ---------- Critérios por categoria (portados do app mobile) ----------
type Criterion = { label: string; values: number[] }

const CRITERIA_DEFS: Record<string, Criterion[]> = {
  Ensino: [
    { label: 'Domínio do estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação, coesão).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Contribuição para melhoria do ensino e aprendizagem.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Metodologia inovadora e ressignificativa.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Contribuição para a sociedade e formação integral.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Articulação entre ensino, pesquisa e extensão.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Relevância social do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  'Pesquisa/Inovação': [
    { label: 'Domínio do estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Conhecimento em relação à metodologia proposta.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Domínio teórico baseado em literatura científica.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre resultados e objetivos.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relevância para a sociedade.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Interdisciplinaridade do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  Extensão: [
    { label: 'Domínio do estudante sobre o trabalho.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração do banner (aspectos visuais, diagramação).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Participação da comunidade externa.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Potencial de impacto social/político/cultural.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Resultados obtidos e demandas atendidas.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre resultados e objetivos.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Interdisciplinaridade do projeto.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  'Comunicação Oral': [
    { label: 'Domínio do tema considerando fundamentação teórica.', values: [0, 0.4, 0.9, 1.4, 1.8] },
    { label: 'Clareza e objetividade da apresentação.', values: [0, 0.4, 0.8, 1.2, 1.6] },
    { label: 'Definição da proposta do projeto.', values: [0, 0.4, 0.7, 1.0, 1.4] },
    { label: 'Elaboração dos slides (visuais, texto, coesão).', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Contribuição para experiência acadêmica e profissional.', values: [0, 0.3, 0.6, 0.9, 1.2] },
    { label: 'Domínio e desenvoltura na apresentação.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relação entre resultados e objetivos.', values: [0, 0.2, 0.4, 0.6, 0.8] },
    { label: 'Relevância e contribuição social.', values: [0, 0.2, 0.3, 0.4, 0.6] },
    { label: 'Domínio no uso de recursos audiovisuais.', values: [0, 0.2, 0.3, 0.4, 0.6] },
  ],
  IFTECH: [
    { label: 'Objetivos e métodos bem definidos?', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'Protótipo visa solucionar problemas locais?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Sustentabilidade e responsabilidade social?', values: [0, 0.25, 0.5, 0.75, 1.0] },
    { label: 'Inovação e criatividade do protótipo?', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Desempenho na explicação do protótipo.', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'Viabilidade técnica e aplicabilidade.', values: [0, 0.5, 1.0, 1.5, 2.0] },
  ],
  Robótica: [
    { label: 'Objetivos e métodos bem definidos?', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'Funcionalidade do robô.', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Sustentabilidade e responsabilidade social?', values: [0, 0.25, 0.5, 0.75, 1.0] },
    { label: 'Inovação e criatividade.', values: [0, 0.5, 1.0, 1.5, 2.0] },
    { label: 'Desempenho na demonstração prática.', values: [0, 0.25, 0.5, 1.0, 1.5] },
    { label: 'Viabilidade técnica.', values: [0, 0.5, 1.0, 1.5, 2.0] },
  ],
}

type Params = { projectId: string }

export default function EvaluationScreen() {
  const nav = useNavigate()
  const { projectId } = useParams<Params>()
  const [qs] = useSearchParams()
  const evaluationId = qs.get('evaluationId')
  const titulo = qs.get('titulo') || 'Projeto'

  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [notas, setNotas] = useState<Array<number | null>>([])
  const [comentarios, setComentarios] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const s = await getDoc(doc(db, 'trabalhos', projectId!))
        if (!s.exists()) throw new Error('Projeto não encontrado')
        const categoria = (s.data() as any).categoria as string
        const defs = CRITERIA_DEFS[categoria]
        if (!defs) throw new Error('Categoria inválida')
        if (!active) return
        setCriteria(defs)
        const baseNotas = Array(defs.length).fill(null) as Array<number | null>
        let baseComent = ''
        if (evaluationId) {
          const e = await getDoc(doc(db, 'avaliacoes', evaluationId))
          if (e.exists()) {
            const data = e.data() as any
            defs.forEach((_, i) => { baseNotas[i] = data.notas?.[`C${i + 1}`] ?? null })
            baseComent = data.comentarios || ''
          }
        }
        if (!active) return
        setNotas(baseNotas)
        setComentarios(baseComent)
      } catch (err) {
        console.error(err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [projectId, evaluationId])

  const handlePick = (idx: number, value: number) => {
    const copy = [...notas]
    copy[idx] = value
    setNotas(copy)
  }

  const handleSubmit = async () => {
    if (notas.some((n) => n == null)) {
      alert('Preencha todos os critérios')
      return
    }
    try {
      setLoading(true)
      const notasObj: Record<string, number> = {}
      notas.forEach((n, i) => (notasObj[`C${i + 1}`] = n!))
      const payload = {
        trabalhoId: projectId,
        avaliadorId: user!.uid,
        evaluatorEmail: user!.email,
        notas: notasObj,
        comentarios,
        timestamp: serverTimestamp(),
      }
      if (evaluationId) {
        await updateDoc(doc(db, 'avaliacoes', evaluationId), payload)
      } else {
        await addDoc(collection(db, 'avaliacoes'), payload)
      }
      nav('/evaluator/evaluations')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LinearProgress />

  return (
    <Box p={2}>
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
                  <ToggleButton key={v} value={v}>{v.toFixed(1)}</ToggleButton>
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
          <Button variant="contained" onClick={handleSubmit}>Salvar avaliação</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
