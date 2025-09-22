import { Container, Typography } from '@mui/material'
export default function Unauthorized(){
  return (
    <Container sx={{py:8}}>
      <Typography variant="h5">Acesso não autorizado</Typography>
      <Typography>Você não possui permissão para acessar esta área.</Typography>
    </Container>
  )
}
