// src/screens/Reports/ReportsScreen.tsx
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Stack, Tabs, Tab, Typography, Card, CardContent
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import TableChartIcon from '@mui/icons-material/TableChart'

import WinnersReport from './WinnersReport'
import GeneralReport from './GeneralReport'
import RecomputeButton from '@components/RecomputeButton'

type TabDef = {
  value: 'winners' | 'general'
  label: string
  icon: React.ReactElement
  path: string
}

// dentro do ReportsScreen.tsx
const TABS: TabDef[] = [
  { value: 'winners', label: 'Vencedores (Top 3)', icon: <EmojiEventsIcon fontSize="small" />, path: '/admin/reports/winners' },
  { value: 'general', label: 'Relatório Geral',   icon: <TableChartIcon fontSize="small" />,  path: '/admin/reports/general' },
]

export default function ReportsScreen() {
  const nav = useNavigate()
  const { pathname } = useLocation()

  const current = useMemo<TabDef>(() => {
    const t = TABS.find(t => pathname.startsWith(t.path))
    return t || TABS[0]
  }, [pathname])

  const handleChange = (_: any, value: TabDef['value']) => {
    const t = TABS.find(t => t.value === value) || TABS[0]
    nav(t.path)
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Relatórios</Typography>
        <RecomputeButton />
      </Stack>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 0 }}>
          <Tabs
            value={current.value}
            onChange={handleChange}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {TABS.map((t) => (
              <Tab
                key={t.value}
                value={t.value}
                label={t.label}
                icon={t.icon}
                iconPosition="start"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {current.value === 'winners' ? <WinnersReport /> : <GeneralReport />}
    </Box>
  )
}
