// src/screens/Admin/MaintenanceScreen.tsx
import { useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, TextField, Button,
  Alert, LinearProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { useAuth } from '@contexts/AuthContext'
import { wipeDatabaseKeepAdmin, migrateProjectsToNewSchema } from '@services/admin/maintenance'

export default function MaintenanceScreen() {
  const { role, user } = useAuth()
  const [adminEmail, setAdminEmail] = useState(user?.email || '')

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)

  if (role !== 'admin') {
    return <Alert severity="error">Acesso negado. Somente administradores.</Alert>
  }

  const handleWipe = async () => {
    setConfirmOpen(false)
    setMsg(null)
    setBusy(true)
    try {
      const res = await wipeDatabaseKeepAdmin(adminEmail)
      setMsg({
        type: 'success',
        text: `Base zerada. trabalhos: ${res.trabalhosApagados}, avaliações: ${res.avaliacoesApagadas}, usuários mantidos: ${res.usuariosMantidos}, usuários apagados: ${res.usuariosApagados}.`,
      })
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Falha ao zerar a base.' })
    } finally {
      setBusy(false)
    }
  }

  const handleMigrate = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const res = await migrateProjectsToNewSchema()
      setMsg({
        type: 'success',
        text: `Migração concluída. Projetos atualizados: ${res.migrated}.`,
      })
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'Falha na migração.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={2}>Manutenção / Zona de Risco</Typography>
      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>Zerar base (manter apenas o Admin)</Typography>
              <Typography variant="body2" color="text.secondary">
                Esta ação é <strong>irreversível</strong>. Todos os documentos de <code>trabalhos</code>, <code>avaliacoes</code> e os usuários de <code>usuarios</code> serão apagados,
                exceto o usuário **admin** informado abaixo.
              </Typography>

              <TextField
                label="E-mail do admin a manter"
                value={adminEmail}
                onChange={(e)=>setAdminEmail(e.target.value)}
                fullWidth
              />

              <Stack direction="row" gap={1} justifyContent="flex-end">
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<DeleteForeverIcon />}
                  disabled={!adminEmail || busy}
                  onClick={() => setConfirmOpen(true)}
                >
                  Zerar base (perigoso)
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>Migrar projetos para o novo schema</Typography>
              <Typography variant="body2" color="text.secondary">
                Reescreve cada documento de <code>trabalhos</code> mantendo <strong>apenas</strong> os campos do novo modelo
                (titulo, categoria, subcategoria, tipo, area, apresentador, autores, assignedEvaluators, updatedAt),
                removendo chaves antigas.
              </Typography>
              <Stack direction="row" gap={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<AutoFixHighIcon />}
                  disabled={busy}
                  onClick={handleMigrate}
                >
                  Migrar projetos
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Confirmação wipe */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmar limpeza total</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja APAGAR toda a base (trabalhos, avaliações e usuários) e manter APENAS o admin
            com e-mail <strong>{adminEmail || '(não informado)'}</strong>? Essa ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setConfirmOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleWipe} disabled={!adminEmail}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
