// src/screens/Admin/BulkUploadScreen.tsx
import { useMemo, useRef, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Button, Stack, Alert,
  LinearProgress, Table, TableHead, TableRow, TableCell, TableBody, Chip, Link as MLink
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import Papa from 'papaparse'
import { saveProject } from '@services/firestore/projects'

// =================== Domínio (listas) ===================

const CATEGORIAS = ['IFTECH', 'Feira de Ciências', 'Comunicação Oral', 'Banner'] as const
type Categoria = typeof CATEGORIAS[number]

const SUBCATEGORIAS = ['Ensino', 'Extensão', 'Pesquisa/Inovação'] as const
type Subcategoria = typeof SUBCATEGORIAS[number] | ''

// Regras finais:
// - IFTECH           → sem tipo
// - Feira de Ciências→ Fundamental | Ensino Médio | Superior (sem Servidor)
// - Comunicação Oral → Ensino Médio | Superior | Pós-graduação | Servidor
// - Banner           → Ensino Médio | Superior | Servidor
const TIPOS_FEIRA     = ['Fundamental', 'Ensino Médio', 'Superior'] as const
const TIPOS_COM_ORAL  = ['Ensino Médio', 'Superior', 'Pós-graduação', 'Servidor'] as const
const TIPOS_BANNER    = ['Ensino Médio', 'Superior', 'Servidor'] as const

// =================== Normalização ===================

const stripNbsp = (s: string) => (s || '').replace(/\u00A0/g, ' ')
const clean = (s: any) => stripNbsp(String(s ?? '')).replace(/\s+/g, ' ').trim()

function normCategoria(s: string): Categoria | '' {
  const v = clean(s).toLowerCase()
  if (v === 'iftech') return 'IFTECH'
  if (v === 'feira de ciencias' || v === 'feira de ciências') return 'Feira de Ciências'
  if (v === 'comunicacao oral' || v === 'comunicação oral') return 'Comunicação Oral'
  if (v === 'banner') return 'Banner'
  return ''
}

function normSubcategoria(s: string): Subcategoria {
  const v = clean(s).toLowerCase()
  if (v === 'ensino') return 'Ensino'
  if (v === 'extensao' || v === 'extensão') return 'Extensão'
  if (v === 'pesquisa' || v === 'pesquisa/inovacao' || v === 'pesquisa/inovação' || v === 'inovacao' || v === 'inovação') return 'Pesquisa/Inovação'
  return ''
}

function normTipoFeira(s: string) {
  const v = clean(s).toLowerCase()
  if (v === 'fundamental') return 'Fundamental'
  if (v === 'ensino medio' || v === 'ensino médio' || v === 'medio' || v === 'médio') return 'Ensino Médio'
  if (v === 'superior') return 'Superior'
  // Feira NÃO aceita Servidor
  return ''
}

function normTipoComOral(s: string) {
  const v = clean(s).toLowerCase()
  if (v === 'ensino medio' || v === 'ensino médio' || v === 'medio' || v === 'médio') return 'Ensino Médio'
  if (v === 'superior') return 'Superior'
  if (v === 'pos-graduacao' || v === 'pós-graduação' || v === 'pos' || v === 'pós' || v === 'pos graduacao' || v === 'pos-graduação') return 'Pós-graduação'
  if (v === 'servidor') return 'Servidor'
  return ''
}

function normTipoBanner(s: string) {
  const v = clean(s).toLowerCase()
  if (v === 'ensino medio' || v === 'ensino médio' || v === 'medio' || v === 'médio') return 'Ensino Médio'
  if (v === 'superior') return 'Superior'
  if (v === 'servidor') return 'Servidor'
  return ''
}

function normalizeAssigned(input?: string[]): string[] {
  const raw = Array.isArray(input) ? input : []
  if (raw.length === 0) return ['ALL']
  const hasAll = raw.some(s => String(s || '').trim().toUpperCase() === 'ALL')
  if (hasAll) return ['ALL']
  const emails = raw.map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
  return emails.length ? Array.from(new Set(emails)) : ['ALL']
}

// =================== Tipos ===================

type CsvRow = {
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
  areaOutro?: string
  apresentador?: string
  autores?: string
  avaliadores?: string
}

type PreparedRow = {
  index: number
  raw: CsvRow
  titulo: string
  categoria: Categoria | ''
  subcategoria: Subcategoria
  tipo: string
  area: string
  areaOutro: string
  apresentador: string
  autores: string[]
  assignedEvaluators: string[]
  errors: string[]
}

type ImportResult = {
  ok: boolean
  id?: string
  error?: string
}

// =================== Modelo CSV (download) ===================

const CSV_HEADER = [
  'titulo', 'categoria', 'subcategoria', 'tipo',
  'area', 'areaOutro', 'apresentador', 'autores', 'avaliadores'
]

// inclui linhas com “Servidor” em Com. Oral e Banner
const CSV_EXAMPLE_ROWS: CsvRow[] = [
  // IFTECH
  {
    titulo: 'Protótipo de irrigação automatizada',
    categoria: 'IFTECH',
    subcategoria: '',
    tipo: '',
    area: 'Tecnologia e Produção',
    areaOutro: '',
    apresentador: 'Ana Santos',
    autores: 'Ana Santos; Bruno Silva',
    avaliadores: '' // vazio = ALL
  },
  // Feira (sem Servidor)
  {
    titulo: 'Ciências na escola: experiências simples',
    categoria: 'Feira de Ciências',
    subcategoria: '',
    tipo: 'Fundamental',
    area: 'Educação',
    areaOutro: '',
    apresentador: 'Carlos Pereira',
    autores: 'Carlos Pereira; Denise Alves',
    avaliadores: 'prof1@ifpr.edu.br; prof2@ifpr.edu.br'
  },
  // Comunicação Oral com Servidor
  {
    titulo: 'Oficina de leitura crítica (Servidor)',
    categoria: 'Comunicação Oral',
    subcategoria: 'Ensino',
    tipo: 'Servidor',
    area: 'Linguística, Letras e Artes',
    areaOutro: '',
    apresentador: 'Elisa Rocha',
    autores: 'Elisa Rocha',
    avaliadores: ''
  },
  // Banner com Servidor
  {
    titulo: 'Aplicativo para coleta seletiva (Servidor)',
    categoria: 'Banner',
    subcategoria: 'Extensão',
    tipo: 'Servidor',
    area: 'Meio Ambiente',
    areaOutro: '',
    apresentador: 'Fabio Nogueira',
    autores: 'Fabio Nogueira; Gabi Souza',
    avaliadores: 'avaliador@ifpr.edu.br'
  }
]

function buildCsvExample(): string {
  const rows = [CSV_HEADER.join(',')]
  for (const r of CSV_EXAMPLE_ROWS) {
    const vals = [
      r.titulo,
      r.categoria ?? '',
      r.subcategoria ?? '',
      r.tipo ?? '',
      r.area ?? '',
      r.areaOutro ?? '',
      r.apresentador ?? '',
      r.autores ?? '',
      r.avaliadores ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
    rows.push(vals.join(','))
  }
  return rows.join('\n')
}

// =================== Preparação & Validação ===================

function prepareRow(raw: CsvRow, index: number): PreparedRow {
  const titulo = clean(raw.titulo)
  const categoria = normCategoria(raw.categoria || '')
  const subcategoria = normSubcategoria(raw.subcategoria || '')
  let tipo = clean(raw.tipo)

  // normalizar tipo conforme categoria (com Servidor apenas onde permitido)
  if (categoria === 'Feira de Ciências') {
    tipo = normTipoFeira(tipo) || ''
  } else if (categoria === 'Comunicação Oral') {
    tipo = normTipoComOral(tipo) || ''
  } else if (categoria === 'Banner') {
    tipo = normTipoBanner(tipo) || ''
  } else {
    // IFTECH
    tipo = ''
  }

  const area = clean(raw.area)
  const areaOutro = clean(raw.areaOutro)
  const apresentador = clean(raw.apresentador)
  const autores = clean(raw.autores)
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)

  const assignedEvaluators = normalizeAssigned(
    clean(raw.avaliadores)
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
  )

  const errors: string[] = []

  if (!titulo) errors.push('Título é obrigatório.')

  // Regras de combinação:
  // IFTECH → sem subcategoria/tipo obrigatórios
  // Feira de Ciências → exige tipo (Fundamental / Ensino Médio / Superior); ignora subcategoria
  // Comunicação Oral → exige subcategoria (Ensino/Extensão/Pesquisa/Inovação) e tipo (Médio/Superior/Pós-graduação/Servidor)
  // Banner → exige subcategoria (Ensino/Extensão/Pesquisa/Inovação) e tipo (Médio/Superior/Servidor)
  if (!categoria) {
    // categoria opcional; se quiser torná-la obrigatória, transforme em erro aqui.
  } else if (categoria === 'Feira de Ciências') {
    if (!tipo) errors.push('Feira de Ciências requer "tipo" (Fundamental/Ensino Médio/Superior).')
    // se vier “Servidor” por engano, normTipoFeira já terá zerado
  } else if (categoria === 'Comunicação Oral') {
    if (!subcategoria) errors.push('Comunicação Oral requer "subcategoria" (Ensino/Extensão/Pesquisa/Inovação).')
    if (!tipo) errors.push('Comunicação Oral requer "tipo" (Ensino Médio/Superior/Pós-graduação/Servidor).')
  } else if (categoria === 'Banner') {
    if (!subcategoria) errors.push('Banner requer "subcategoria" (Ensino/Extensão/Pesquisa/Inovação).')
    if (!tipo) errors.push('Banner requer "tipo" (Ensino Médio/Superior/Servidor).')
  }

  return {
    index,
    raw,
    titulo,
    categoria,
    subcategoria,
    tipo,
    area,
    areaOutro,
    apresentador,
    autores,
    assignedEvaluators,
    errors,
  }
}

// =================== UI ===================

export default function BulkUploadScreen() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<PreparedRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [globalMsg, setGlobalMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [importResults, setImportResults] = useState<Record<number, ImportResult>>({})

  const hasErrors = useMemo(() => rows.some(r => r.errors.length), [rows])

  const handleDownloadTemplate = () => {
    const csv = buildCsvExample()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_trabalhos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePickFile = () => {
    fileRef.current?.click()
  }

  const parseCsv = (file: File) => {
    setParsing(true)
    setGlobalMsg(null)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => clean(h).toLowerCase(),
      complete: (res) => {
        const data = (res.data || []).map((r, i) => prepareRow(r, i))
        setRows(data)
        if (!data.length) {
          setGlobalMsg({ type: 'info', text: 'Nenhuma linha encontrada no CSV.' })
        } else if (data.some(r => r.errors.length)) {
          setGlobalMsg({ type: 'error', text: 'Há linhas com erro. Corrija antes de importar.' })
        } else {
          setGlobalMsg({ type: 'success', text: 'CSV validado. Pronto para importar.' })
        }
        setParsing(false)
      },
      error: (err) => {
        setGlobalMsg({ type: 'error', text: `Erro ao ler CSV: ${err.message}` })
        setParsing(false)
      }
    })
  }

  const handleImport = async () => {
    if (!rows.length) {
      setGlobalMsg({ type: 'error', text: 'Nenhuma linha para importar.' })
      return
    }
    if (hasErrors) {
      setGlobalMsg({ type: 'error', text: 'Corrija os erros antes de importar.' })
      return
    }

    setImporting(true)
    setImportResults({})
    setGlobalMsg(null)

    const results: Record<number, ImportResult> = {}

    for (const r of rows) {
      const payload: any = {
        titulo: r.titulo,
        categoria: r.categoria || '',
        subcategoria: r.subcategoria || '',
        tipo: r.tipo || '',
        area: r.area || '',
        areaOutro: r.areaOutro || '',
        apresentador: r.apresentador || '',
        autores: r.autores,
        assignedEvaluators: normalizeAssigned(r.assignedEvaluators),
        updatedAt: new Date(),
      }

      try {
        await saveProject(payload)
        results[r.index] = { ok: true }
      } catch (e: any) {
        results[r.index] = { ok: false, error: e?.message || 'Falha ao salvar.' }
      }
    }

    setImportResults(results)
    const okCount = Object.values(results).filter(x => x.ok).length
    const failCount = Object.values(results).length - okCount
    if (failCount > 0) {
      setGlobalMsg({ type: 'error', text: `Importação concluída com erros. Sucesso: ${okCount}, Falhas: ${failCount}.` })
    } else {
      setGlobalMsg({ type: 'success', text: `Importação concluída. Sucesso: ${okCount}.` })
    }
    setImporting(false)
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={2} gap={2}>
        <Typography variant="h5" fontWeight={800}>Upload em Lote de Projetos</Typography>
        <Stack direction="row" gap={1}>
          <Button startIcon={<DownloadIcon />} variant="outlined" onClick={handleDownloadTemplate}>
            Baixar modelo CSV
          </Button>
          <Button startIcon={<UploadIcon />} variant="contained" onClick={handlePickFile}>
            Selecionar arquivo CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) parseCsv(f)
          }} />
        </Stack>
      </Stack>

      {parsing && <LinearProgress sx={{ mb: 2 }} />}
      {globalMsg && <Alert severity={globalMsg.type} sx={{ mb: 2 }}>{globalMsg.text}</Alert>}

      {!!rows.length && (
        <Card>
          <CardContent>
            <Typography fontWeight={700} mb={2}>Pré-visualização</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Título</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Subcategoria</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Área</TableCell>
                  <TableCell>Apresentador</TableCell>
                  <TableCell>Autores</TableCell>
                  <TableCell>Avaliadores</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const result = importResults[r.index]
                  const status =
                    r.errors.length
                      ? <Chip color="error" label="Erro de validação" size="small" />
                      : result
                        ? (result.ok ? <Chip color="success" label="Importado" size="small" /> : <Chip color="error" label="Falha" size="small" />)
                        : <Chip label="Pendente" size="small" />

                  const av = r.assignedEvaluators.length === 1 && r.assignedEvaluators[0] === 'ALL'
                    ? 'Todos'
                    : r.assignedEvaluators.join('; ')

                  return (
                    <TableRow key={r.index}>
                      <TableCell>{r.index + 1}</TableCell>
                      <TableCell>{r.titulo}</TableCell>
                      <TableCell>{r.categoria}</TableCell>
                      <TableCell>{r.subcategoria}</TableCell>
                      <TableCell>{r.tipo}</TableCell>
                      <TableCell>{r.area === 'Outro' ? r.areaOutro || 'Outro' : r.area}</TableCell>
                      <TableCell>{r.apresentador}</TableCell>
                      <TableCell>{r.autores.join('; ')}</TableCell>
                      <TableCell>{av}</TableCell>
                      <TableCell>
                        {status}
                        {!r.errors.length && result?.error && (
                          <Typography variant="caption" color="error" display="block">{result.error}</Typography>
                        )}
                        {!!r.errors.length && (
                          <Typography variant="caption" color="error" display="block">
                            {r.errors.join(' | ')}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Stack direction="row" justifyContent="flex-end" mt={2}>
              <Button variant="contained" onClick={handleImport} disabled={importing || hasErrors || !rows.length}>
                {importing ? 'Importando…' : 'Importar projetos'}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Dica: se “avaliadores” estiver vazio, o projeto ficará visível para todos.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!rows.length && (
        <Alert severity="info">
          Use o botão <strong>“Selecionar arquivo CSV”</strong> para carregar os projetos.&nbsp;
          Você pode baixar um <MLink component="button" onClick={handleDownloadTemplate}>modelo de CSV</MLink> para preencher.
        </Alert>
      )}
    </Box>
  )
}
