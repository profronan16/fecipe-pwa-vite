import { useEffect, useState } from 'react'
import { Box, Typography, Button, Card, CardContent, LinearProgress, Stack, Divider } from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'
import { exportElementToPDF } from '@utils/pdf'

export default function EvaluatorsPerformanceReport(){
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])

  useEffect(()=>{
    ;(async()=>{
      setLoading(true)
      // users
      const usersSnap = await getDocs(collection(db,'users'))
      const users = usersSnap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))
      // avaliacoes
      const evalSnap = await getDocs(collection(db,'avaliacoes'))
      const evals = evalSnap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))
      // trabalhos
      const trabSnap = await getDocs(collection(db,'trabalhos'))
      const projMap: Record<string,string> = {}
      trabSnap.docs.forEach(d=>{ projMap[d.id] = (d.data() as any).titulo })

      const byEval: Record<string, any> = {}
      for(const u of users){
        if(u.role === 'admin') continue
        byEval[u.id] = { name: u.name || u.id, email: u.id, count:0, totals:[], projects:new Set<string>() }
      }
      for(const e of evals){
        const uid = e.evaluatorEmail || e.avaliadorId
        if(!uid) continue
        const notas = Object.values<number>(e.notas || {})
        const total = notas.reduce((a,b)=>a+b,0)
        if(!byEval[uid]) byEval[uid] = { name: uid, email: uid, count:0, totals:[], projects:new Set<string>() }
        byEval[uid].count++
        byEval[uid].totals.push(total)
        if(e.trabalhoId) byEval[uid].projects.add(projMap[e.trabalhoId] || e.trabalhoId)
      }
      const data = Object.values(byEval).map((x:any)=>({
        ...x,
        avg: x.totals.length ? (x.totals.reduce((a:number,b:number)=>a+b,0)/x.totals.length) : 0,
        projects: Array.from(x.projects)
      }))
      setRows(data)
      setLoading(false)
    })()
  },[])

  const exportPDF = ()=>{
    const el = document.getElementById('report-root')!
    exportElementToPDF(el, 'desempenho-avaliadores.pdf')
  }

  return (
    <Box p={2}>
      <Typography variant="h5" fontWeight={800}>📋 Desempenho dos Avaliadores</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Total de avaliadores: {rows.length}
      </Typography>
      <Button variant="contained" onClick={exportPDF} sx={{mb:2}}>Exportar em PDF</Button>
      {loading && <LinearProgress/>}
      <Stack id="report-root" spacing={2}>
        {rows.map((r:any)=>(
          <Card key={r.email} variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">{r.name}</Typography>
              <Typography variant="body2" color="text.secondary">{r.email}</Typography>
              <Divider sx={{my:1}}/>
              <Typography variant="body2">Total de avaliações: {r.count}</Typography>
              <Typography variant="body2">Média de pontuação: {r.avg.toFixed(2)}</Typography>
              {r.projects.length>0 && (
                <Typography variant="body2" sx={{mt:1}}>
                  <strong>Projetos avaliados:</strong> {r.projects.join(', ')}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
