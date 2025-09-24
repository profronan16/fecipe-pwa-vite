// src/utils/authErrors.ts
export type AuthErrorInfo = { code?: string; message: string }

const MESSAGES: Record<string, string> = {
  // Auth
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/user-disabled': 'Usuário desativado.',
  'auth/weak-password': 'A senha é muito fraca (mínimo 6 caracteres).',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled-popup-request': 'Outra janela de login já está aberta.',
  'auth/operation-not-allowed': 'Método de login desabilitado.',
  // Firestore/Storage (caso apareça)
  'permission-denied': 'Sem permissão para executar esta ação.',
  'unavailable': 'Serviço indisponível no momento. Tente novamente.',
  // genérico
  'default': 'Ocorreu um erro. Tente novamente.',
}

export function humanizeAuthError(e: unknown): AuthErrorInfo {
  const err = e as { code?: string; message?: string }
  const code = err?.code || ''
  const key = MESSAGES[code] ? code : 'default'
  return { code, message: MESSAGES[key] }
}
