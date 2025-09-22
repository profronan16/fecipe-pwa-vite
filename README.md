# FECIPE — PWA (Vite + React + Firebase)

Este boilerplate já vem com:
- Vite + React + TypeScript
- MUI (Material UI)
- React Router v6
- Firebase (Auth + Firestore) com **persistência offline**
- PWA usando `vite-plugin-pwa` (autoUpdate)
- Estrutura de pastas para telas, serviços, hooks, utils e tipos

## Como usar
```bash
npm i
cp .env.example .env.local
# preencha credenciais do Firebase
npm run dev
```

## Rotas base
- `/login`, `/unauthorized`
- `/admin`, `/admin/projects`, `/admin/projects/new`, `/admin/projects/:id`, `/admin/upload`
- `/evaluator`, `/evaluator/works`, `/evaluator/evaluate/:projectId`, `/evaluator/evaluations`, `/evaluator/profile`

## Onde colar seu código existente
Cole o conteúdo dos arquivos que você já tem (os com `.ts`) nas stubs correspondentes abaixo, convertendo para `.tsx` quando houver JSX:

- `admin_dashboard.ts` → `src/screens/Admin/AdminDashboard.tsx`
- `evaluator_dashboard.ts` → `src/screens/Admin/EvaluatorDashboard.tsx`
- `projects_screen.ts` → `src/screens/Projects/ProjectsScreen.tsx`
- `project_form.ts` → `src/screens/Projects/ProjectForm.tsx`
- `bulk_upload_screen.ts` → `src/screens/BulkUpload/BulkUploadScreen.tsx`
- `work_list_screen.ts` → `src/screens/Work/WorkListScreen.tsx`
- `evaluation_screen.ts` → `src/screens/Evaluation/EvaluationScreen.tsx`
- `evaluations_list_screen.ts` → `src/screens/Evaluation/EvaluationsList.tsx`
- `profile_screen.ts` → `src/screens/Profile/ProfileScreen.tsx`
- `auth_context.ts` → compare com `src/contexts/AuthContext.tsx` (já funcional)
- `app_component.ts` → `src/App.tsx` (rotas + tema)
- `toast_component.ts` → `src/components/Toast.tsx`
- `firebase_config.ts` → `src/services/firebase.ts` (usa variáveis `VITE_*`)
- `pdf_utils.ts` → `src/utils/pdf.ts` (modelo incluso)

## Lista de arquivos detectados no seu ZIP
- admin_dashboard.ts
- app_component.ts
- auth_context.ts
- bulk_upload_screen.ts
- dashboard_screen.ts
- env_example.sh
- evaluation_screen.ts
- evaluations_list_screen.ts
- evaluator_dashboard.ts
- firebase_config.ts
- index_html.html
- login_screen.ts
- pdf_utils.ts
- profile_screen.ts
- project_form.ts
- projects_screen.ts
- pwa_manifest.json
- pwa_package.json
- readme.md
- service_worker.js
- toast_component.ts
- unauthorized_screen.ts
- work_list_screen.ts

## O que ainda falta implementar para equiparar ao app RN
- Guards de rota por **papel** (admin/avaliador) — **incluídos** (`ProtectedRoute`, `RoleGuard`); ajuste lógica conforme seus claims.
- Serviços de Firestore (CRUDs) — **stubs inclusos** (`src/services/firestore/*`). Completar consultas, filtros por banca/categoria e transações.
- Fila offline de submissões — **hook incluso** (`useOfflineQueue`) como stub; implementar flush e persistência (ex.: `localforage`).
- Relatórios/PDFs específicos (por categoria/avaliador/projeto) — **stub** em `utils/pdf.ts`.
- Upload em massa (validações e feedback detalhado) — **stub** `utils/csv.ts` + tela `BulkUploadScreen`.
- Dashboard com gráficos e métricas — criar componentes (ex.: `@mui/x-charts`).
- Acessibilidade e responsividade fina — ajustar telas para mobile/desktop.
- (Opcional) Web Push para avisos — requer Firebase Cloud Messaging para Web.

## PWA
O `vite-plugin-pwa` já está configurado com:
- `registerType: 'autoUpdate'`
- `manifest` com ícones
- `workbox.runtimeCaching` básico (pode especializar por rotas e APIs)

## Regras do Firestore
Garanta que suas **Firestore Rules** reflitam os papéis (admin/evaluator) e as coleções:
- `users`, `projects`, `evaluations`, `events` (se houver), etc.

Boa jornada! 💚
