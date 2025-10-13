// src/screens/Admin/AdminDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Box, Grid, Card, CardContent, Typography, Chip, Button,
    Dialog, DialogTitle, DialogContent, DialogActions, Divider, Stack, LinearProgress, Alert
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useNavigate } from 'react-router-dom'
import RecomputeButton from '@components/RecomputeButton'

// Pesos/constante conforme app mobile (Dashboard/Reports)
const WEIGHTS = [0.9, 0.8, 0.7, 0.6, 0.6, 0.4, 0.4, 0.3, 0.3] // 9 critérios padrão
const Z = 2.5

type Project = {
    id: string
    titulo: string
    categoria: string
    turma?: string
    orientador?: string
}
type Evaluation = {
    trabalhoId: string
    avaliadorId?: string
    evaluatorEmail?: string
    notas: Record<string, number>
}

type ProjectDetail = {
    id: string
    titulo: string
    categoria: string
    turma?: string
    orientador?: string
    evaluations: Array<{ email: string; total: number }>
    finalScore: number
}

export default function AdminDashboard() {
    const nav = useNavigate()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [evaluatorsCount, setEvaluatorsCount] = useState(0)
    const [projectsCount, setProjectsCount] = useState(0)
    const [perCategory, setPerCategory] = useState<Record<string, number>>({})
    const [top3ByCategory, setTop3ByCategory] = useState<Record<string, ProjectDetail[]>>({})
    const [selectedCat, setSelectedCat] = useState<string>('Todos')
    const [detail, setDetail] = useState<ProjectDetail | null>(null)

    const categories = useMemo(
        () => ['Todos', ...Object.keys(perCategory)],
        [perCategory]
    )

    const computeFinalScore = (project: Project, evals: Evaluation[]) => {
        if (!evals.length) return 0
        const k = (project.categoria === 'IFTECH' || project.categoria === 'Robótica') ? 6 : 9
        // monta arrays de notas por critério (C1..Ck)
        const perCriterion: number[][] = Array.from({ length: k }, () => [])
        evals.forEach(e => {
            for (let i = 1; i <= k; i++) {
                const key = `C${i}`
                perCriterion[i - 1].push(e.notas?.[key] ?? 0)
            }
        })
        // normaliza e aplica pesos para cada avaliação
        const scoresPerEval = Array(evals.length).fill(0)
        for (let i = 0; i < k; i++) {
            const arr = perCriterion[i]
            const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
            const sd =
                Math.sqrt(arr.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (arr.length || 1)) || 1
            arr.forEach((v, idx) => {
                const norm = (v - mean) / sd + Z
                const w = WEIGHTS[i] ?? 1
                scoresPerEval[idx] += norm * w
            })
        }
        return scoresPerEval.reduce((a, b) => a + b, 0) / scoresPerEval.length
    }

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            // users (conta avaliadores/admin)
            const usersSnap = await getDocs(collection(db, 'users'))
            const evalsCount = usersSnap.docs.filter(d => {
                const r = (d.data() as any).role
                return r === 'evaluator' || r === 'admin' || !r
            }).length
            setEvaluatorsCount(evalsCount)

            // projetos
            const projSnap = await getDocs(collection(db, 'trabalhos'))
            const projects: Project[] = projSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
            setProjectsCount(projects.length)

            // distribuição por categoria
            const byCat: Record<string, number> = {}
            projects.forEach(p => { byCat[p.categoria] = (byCat[p.categoria] || 0) + 1 })
            setPerCategory(byCat)

            // avaliações (uma vez)
            const evalSnap = await getDocs(collection(db, 'avaliacoes'))
            const allEvals: Evaluation[] = evalSnap.docs.map(d => (d.data() as any))

            // Top 3 por categoria (com padding de até 3 avaliadores)
            const top: Record<string, ProjectDetail[]> = {}
            for (const cat of Object.keys(byCat)) {
                const projs = projects.filter(p => p.categoria === cat)
                const details: ProjectDetail[] = projs.map(p => {
                    const eForProj = allEvals.filter(e => e.trabalhoId === p.id)
                    const evaluations = eForProj
                        .map(e => {
                            const total = Object.values<number>(e.notas || {}).reduce((a, b) => a + b, 0)
                            return { email: e.evaluatorEmail || e.avaliadorId || 'Sem avaliador', total }
                        })
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 3)

                    while (evaluations.length < 3) evaluations.push({ email: 'Sem avaliador', total: 0 })

                    return {
                        id: p.id,
                        titulo: p.titulo,
                        categoria: cat,
                        turma: p.turma,
                        orientador: p.orientador,
                        evaluations,
                        finalScore: computeFinalScore(p, eForProj),
                    }
                })
                top[cat] = details.sort((a, b) => b.finalScore - a.finalScore).slice(0, 3)
            }
            setTop3ByCategory(top)
        } catch (e: any) {
            setError(e?.message || 'Erro ao carregar painel')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 2 }}
            >
                <Typography variant="h5" fontWeight={800}>📊 Painel do Administrador</Typography>

                <Stack direction="row" gap={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={load}>Recarregar</Button>
                    <RecomputeButton />
                    <Button variant="contained" onClick={() => nav('/admin/projects')}>Projetos</Button>
                    <Button variant="contained" onClick={() => nav('/admin/evaluators')}>Avaliadores</Button>
                    <Button variant="contained" onClick={() => nav('/admin/reports')}>Relatórios</Button>
                </Stack>
            </Stack>

            {loading && <LinearProgress />}
            {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

            <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="center">
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Avaliadores</Typography>
                            <Typography variant="h4" fontWeight={800}>{evaluatorsCount}</Typography>
                        </CardContent></Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>

                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Projetos</Typography>
                            <Typography variant="h4" fontWeight={800}>{projectsCount}</Typography>
                        </CardContent></Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>

                        <CardContent>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Distribuição por Categoria</Typography>
                            <Stack direction="row" gap={1} flexWrap="wrap">
                                {Object.entries(perCategory).map(([cat, n]) => (
                                    <Chip key={cat} label={`${cat}: ${n}`} />
                                ))}
                                {!Object.keys(perCategory).length && <Typography variant="body2">Sem dados</Typography>}
                            </Stack>
                        </CardContent></Card>
                </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" gap={1} flexWrap="wrap" mb={1}>
                {categories.map(cat => (
                    <Chip
                        key={cat}
                        color={selectedCat === cat ? 'primary' : 'default'}
                        label={cat}
                        onClick={() => setSelectedCat(cat)}
                    />
                ))}
            </Stack>

            {(selectedCat === 'Todos' ? Object.keys(top3ByCategory) : [selectedCat]).map(cat => (
                <Box key={cat} sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>Top 3 — {cat}</Typography>
                    <Grid container spacing={2}>
                        {top3ByCategory[cat]?.map((pd) => (
                            <Grid item xs={12} md={4} key={pd.id}>
                                <Card
                                    onClick={() => setDetail(pd)}
                                    sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }}
                                >
                                    <CardContent>
                                        <Typography variant="subtitle1" fontWeight={700} noWrap>{pd.titulo}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Turma: {pd.turma || '—'} • Orientador: {pd.orientador || '—'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Nota Final: <b>{pd.finalScore.toFixed(2)}</b>
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Avaliadores: {pd.evaluations.map(e => e.email).join(', ')}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                        {!top3ByCategory[cat]?.length && (
                            <Grid item xs={12}><Alert severity="info">Sem projetos nesta categoria.</Alert></Grid>
                        )}
                    </Grid>
                </Box>
            ))}

            <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
                <DialogTitle>Detalhes do Projeto</DialogTitle>
                <DialogContent dividers>
                    {detail && (
                        <Stack spacing={1}>
                            <Typography variant="h6">{detail.titulo}</Typography>
                            <Typography variant="body2">Categoria: {detail.categoria}</Typography>
                            <Typography variant="body2">Turma: {detail.turma || '—'}</Typography>
                            <Typography variant="body2">Orientador: {detail.orientador || '—'}</Typography>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2">Avaliadores (top 3 pelo total):</Typography>
                            {detail.evaluations.map((e, i) => (
                                <Typography key={i} variant="body2">
                                    {i + 1}. {e.email} — Total: {e.total.toFixed(2)}
                                </Typography>
                            ))}
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="body2">Nota Final: <b>{detail.finalScore.toFixed(2)}</b></Typography>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetail(null)}>Fechar</Button>
                    <Button variant="contained" onClick={() => { setDetail(null) }}>Ok</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
