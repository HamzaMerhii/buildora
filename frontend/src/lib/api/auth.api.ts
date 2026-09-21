import { apiForm, apiJson, apiUrlEncoded } from './client';

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterResult {
  message: string;
  id: string;
}

export interface TokenResult {
  access_token: string;
  token_type: string;
}

export interface MessageResult {
  message: string;
}

export interface SessionMembership {
  company_id: string;
  company_name: string;
  role: string;
}

export interface SessionContext {
  id: string;
  name: string;
  email: string;
  platform_role: string;
  memberships: SessionMembership[];
}

export async function getSessionContext(): Promise<SessionContext> {
  return apiJson<SessionContext>('/auth/me', {
    method: 'GET',
  });
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  return apiJson<RegisterResult>('/auth/register', {
    method: 'POST',
    auth: false,
    body: payload,
  });
}

export async function loginUser(email: string, password: string): Promise<TokenResult> {
  // Backend uses OAuth2PasswordRequestForm: username=<email>&password=<password>
  return apiUrlEncoded<TokenResult>('/auth/login', {
    username: email.trim().toLowerCase(),
    password,
  });
}

export async function requestPasswordReset(email: string): Promise<MessageResult> {
  return apiJson<MessageResult>('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase() },
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<MessageResult> {
  return apiJson<MessageResult>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: { token, new_password: newPassword },
  });
}

export { apiForm };
