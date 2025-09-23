// src/screens/Admin/BulkUploadScreen.tsx
import { useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Button, Stack,
  Alert, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody,
  Chip
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '@services/firebase'

type Row = {
  titulo: string
  alunos: string
  orientador: string
  turma: string
  anoSemestre: string
  categoria: string
  _err?: string
}

const CATEGORIES = [
  'Ensino',
  'Pesquisa/Inovação',
  'Extensão',
  'Comunicação Oral',
  'IFTECH',
  'Robótica',
] // mesmas opções do formulário individual :contentReference[oaicite:1]{index=1}

export default function BulkUploadScreen() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{type:'success'|'error'|'info', text:string} | null>(null)

  const validCount = useMemo(()=> rows.filter(r => !r._err).length, [rows])

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    const text = await file.text()

    // Tenta detectar delimitador: ; tem prioridade (muito comum em BR), senão ,
    const delim = text.indexOf(';') !== -1 ? ';' : ','
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean)

    if(!lines.length){ setMsg({type:'error', text:'Arquivo vazio'}); return }

    // Cabeçalho esperado
    const header = lines[0].split(delim).map(h=>h.trim().toLowerCase())
    const expected = ['titulo','alunos','orientador','turma','anosemestre','categoria']
    const missing = expected.filter(h => !header.includes(h))
    if(missing.length){
      setMsg({type:'error', text:`Cabeçalho inválido. Faltando: ${missing.join(', ')}`})
      return
    }

    const idx = (name:string) => header.indexOf(name)

    const parsed: Row[] = lines.slice(1).map((ln, i) => {
      const cols = splitRow(ln, delim)
      const row: Row = {
        titulo: (cols[idx('titulo')] || '').trim(),
        alunos: (cols[idx('alunos')] || '').trim(),
        orientador: (cols[idx('orientador')] || '').trim(),
        turma: (cols[idx('turma')] || '').trim(),
        anoSemestre: (cols[idx('anosemestre')] || '').trim(),
        categoria: (cols[idx('categoria')] || '').trim(),
      }
      row._err = validateRow(row)
      return row
    })

    setRows(parsed)
    setMsg({type:'info', text:`${parsed.length} linha(s) carregadas. Revise antes de importar.`})
    // limpa input pra permitir reupload do mesmo arquivo
    e.target.value = ''
  }

  const validateRow = (r: Row): string | undefined => {
    if(!r.titulo || !r.alunos || !r.orientador || !r.turma || !r.anoSemestre || !r.categoria)
      return 'Campos obrigatórios faltando'
    if(!CATEGORIES.includes(r.categoria)) return `Categoria inválida: ${r.categoria}`
    return undefined
  }

  const handleClear = () => {
    setRows([])
    setMsg(null)
  }

  const handleImport = async () => {
    if(!rows.length){ setMsg({type:'error', text:'Nenhum dado para importar'}); return }
    const invalid = rows.filter(r => r._err)
    if(invalid.length){
      setMsg({type:'error', text:`Corrija ${invalid.length} linha(s) com erro antes de importar.`})
      return
    }
    setLoading(true)
    setMsg(null)
    try{
      const batch = rows.map(async r=>{
        const payload = {
          titulo: r.titulo,
          alunos: r.alunos.split(';').map(s=>s.trim()).filter(Boolean),
          orientador: r.orientador,
          turma: r.turma,
          anoSemestre: r.anoSemestre,
          categoria: r.categoria,
        }
        await addDoc(collection(db,'trabalhos'), payload)
      })
      await Promise.all(batch)
      setMsg({type:'success', text:`Importação concluída: ${rows.length} projeto(s) criados.`})
      setRows([])
    }catch(e:any){
      setMsg({type:'error', text: e?.message || 'Erro ao importar'})
    }finally{
      setLoading(false)
    }
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📥 Importação em Lote</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            component="label"
            startIcon={<CloudUploadIcon/>}
            variant="contained"
          >
            Selecionar arquivo
            <input type="file" accept=".csv,.txt,text/csv" hidden onChange={handlePick}/>
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon/>} onClick={handleClear} disabled={!rows.length}>
            Limpar
          </Button>
          <Button variant="contained" onClick={handleImport} disabled={!rows.length || loading || validCount===0}>
            Importar {rows.length ? `(${validCount}/${rows.length})` : ''}
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }} />}
      {msg && <Alert severity={msg.type==='error'?'error':msg.type==='success'?'success':'info'} sx={{ mb:2 }}>{msg.text}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Pré-visualização</Typography>
          {!rows.length ? (
            <Alert severity="info">Nenhum arquivo carregado ainda. O CSV deve conter as colunas: <code>titulo, alunos, orientador, turma, anoSemestre, categoria</code>.</Alert>
          ) : (
            <Box sx={{ overflowX:'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Título</TableCell>
                    <TableCell>Alunos</TableCell>
                    <TableCell>Orientador</TableCell>
                    <TableCell>Turma</TableCell>
                    <TableCell>Ano/Semestre</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i)=>(
                    <TableRow key={i}>
                      <TableCell>{r.titulo}</TableCell>
                      <TableCell sx={{ maxWidth: 280, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{r.alunos}</TableCell>
                      <TableCell>{r.orientador}</TableCell>
                      <TableCell>{r.turma}</TableCell>
                      <TableCell>{r.anoSemestre}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.categoria} color={CATEGORIES.includes(r.categoria) ? 'default':'warning'} />
                      </TableCell>
                      <TableCell>
                        {r._err ? <Chip size="small" color="error" label={r._err}/> : <Chip size="small" color="success" label="OK" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Box mt={2}>
        <Typography variant="subtitle2" gutterBottom>Exemplo de CSV (delimitador `;` ou `,`):</Typography>
        <Box component="pre" sx={{ p:1.5, bgcolor:'#f7f7f9', borderRadius:1, overflow:'auto' }}>
{`titulo;alunos;orientador;turma;anoSemestre;categoria
Aplicativo de Energia;Ana Silva;Prof. João;3A;2025/1;Ensino
Robô Seguidor de Linha;Pedro Souza;Profa. Carla;2B;2025/1;Robótica`}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * splitRow: separa respeitando campos entre aspas ("valor, com vírgula")
 * Implementação simples para evitar dependência extra.
 */
function splitRow(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i=0; i<line.length; i++){
    const ch = line[i]
    if(ch === '"'){
      // toggle (ou escapa "")
      if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
      else inQuotes = !inQuotes
    }else if(ch === delim && !inQuotes){
      out.push(cur); cur=''
    }else{
      cur += ch
    }
  }
  out.push(cur)
  return out
}
