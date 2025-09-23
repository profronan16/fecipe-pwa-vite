// src/screens/Admin/EvaluatorsPerformanceReport.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, TextField, Button, LinearProgress, Alert,
  Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody,
  TableSortLabel, Chip
} from '@mui/material'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@services/firebase'

type EvalDoc = {
  trabalhoId: string
  avaliadorId?: string
  evaluatorEmail?: string
  notas: Record<string, number>
}

type UserDoc = {
  name?: string
  email?: string
  role?: 'evaluator'|'admin'
  active?: boolean
}

type ProjectDoc = {
  titulo: string
  categoria: string
  turma?: string
  orientador?: string
}

type Row = {
  email: string
  name: string
  role: string
  active: boolean
  evalCount: number
  avgTotal: number
  projectsCount: number
  categories: Record<string, number>
}

type OrderBy = 'evalCount' | 'avgTotal' | 'name'
type Order = 'asc' | 'desc'

export default function EvaluatorsPerformanceReport(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [orderBy, setOrderBy] = useState<OrderBy>('evalCount')
  const [order, setOrder] = useState<Order>('desc')

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try{
      // 1) cache de users (nome, role, ativo)
      const usersSnap = await getDocs(collection(db,'users'))
      const users: Record<string, UserDoc> = {}
      usersSnap.docs.forEach(d=>{
        const u = d.data() as any
        users[d.id] = {
          name: u.name || '',
          email: u.email || d.id,
          role: u.role || 'evaluator',
          active: u.active !== false,
        }
      })

      // 2) cache de projetos -> categoria (para agrupar por área)
      const projSnap = await getDocs(collection(db,'trabalhos'))
      const projCat: Record<string, ProjectDoc> = {}
      projSnap.docs.forEach(d=>{
        projCat[d.id] = d.data() as any
      })

      // 3) avaliações (todas) agrupadas por avaliador
      const evalSnap = await getDocs(collection(db,'avaliacoes'))
      const groups: Record<string, EvalDoc[]> = {}
      evalSnap.docs.forEach(d=>{
        const e = d.data() as any as EvalDoc
        const key = (e.evaluatorEmail || e.avaliadorId || 'desconhecido').toLowerCase()
        groups[key] = groups[key] || []
        groups[key].push(e)
      })

      // 4) monta linhas
      const result: Row[] = []
      for (const email of Object.keys(groups)){
        const list = groups[email]
        const totals = list.map(e => Object.values<number>(e.notas || {}).reduce((a,b)=>a+b,0))
        const avgTotal = totals.length ? (totals.reduce((a,b)=>a+b,0) / totals.length) : 0
        const projectsSet = new Set(list.map(e=>e.trabalhoId))
        const categories: Record<string, number> = {}
        projectsSet.forEach(pid=>{
          const cat = projCat[pid]?.categoria || '—'
          categories[cat] = (categories[cat] || 0) + 1
        })
        const u = users[email] || { name:'', email, role:'evaluator', active:true }
        result.push({
          email,
          name: u.name || email,
          role: u.role || 'evaluator',
          active: u.active !== false,
          evalCount: list.length,
          avgTotal,
          projectsCount: projectsSet.size,
          categories,
        })
      }

      // inclui avaliadores sem avaliações (opcional, útil para auditoria)
      Object.keys(users).forEach(email=>{
        if(!result.find(r=>r.email.toLowerCase()===email.toLowerCase())){
          const u = users[email]
          result.push({
            email,
            name: u.name || email,
            role: u.role || 'evaluator',
            active: u.active !== false,
            evalCount: 0,
            avgTotal: 0,
            projectsCount: 0,
            categories: {},
          })
        }
      })

      setRows(result)
    }catch(e:any){
      setError(e?.message || 'Erro ao carregar relatório')
    }finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{ load() }, [load])

  const handleSort = (key: OrderBy) => {
    if (orderBy === key) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setOrderBy(key); setOrder('desc') }
  }

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    const arr = rows.filter(r =>
      !q ||
      r.email.toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q)
    )
    const sorted = [...arr].sort((a,b)=>{
      const dir = order === 'asc' ? 1 : -1
      if(orderBy==='name') return a.name.localeCompare(b.name) * dir
      if(orderBy==='avgTotal') return (a.avgTotal - b.avgTotal) * dir
      return (a.evalCount - b.evalCount) * dir
    })
    return sorted
  }, [rows, search, order, orderBy])

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📑 Desempenho dos Avaliadores</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <TextField
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            size="small"
          />
          <Button onClick={load} variant="outlined">Recarregar</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }} />}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p:0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sortDirection={orderBy==='name'?order:false as any}>
                  <TableSortLabel
                    active={orderBy==='name'}
                    direction={orderBy==='name'?order:'asc'}
                    onClick={()=>handleSort('name')}
                  >
                    Avaliador
                  </TableSortLabel>
                </TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Ativo</TableCell>
                <TableCell align="right" sortDirection={orderBy==='evalCount'?order:false as any}>
                  <TableSortLabel
                    active={orderBy==='evalCount'}
                    direction={orderBy==='evalCount'?order:'desc'}
                    onClick={()=>handleSort('evalCount')}
                  >
                    Avaliações
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={orderBy==='avgTotal'?order:false as any}>
                  <TableSortLabel
                    active={orderBy==='avgTotal'}
                    direction={orderBy==='avgTotal'?order:'desc'}
                    onClick={()=>handleSort('avgTotal')}
                  >
                    Média (total)
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Projetos distintos</TableCell>
                <TableCell>Por categoria</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(r=>(
                <TableRow key={r.email}>
                  <TableCell>{r.name || '—'}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.active ? 'Sim' : 'Não'}</TableCell>
                  <TableCell align="right">{r.evalCount}</TableCell>
                  <TableCell align="right">{r.avgTotal.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.projectsCount}</TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {Object.keys(r.categories).length
                        ? Object.entries(r.categories).map(([cat, n])=>(
                            <Chip key={cat} size="small" label={`${cat}: ${n}`} />
                          ))
                        : <Chip size="small" label="—" />}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && !loading && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Alert severity="info">Nenhum avaliador encontrado.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  )
}
