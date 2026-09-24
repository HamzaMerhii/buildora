import { apiJson } from './client';

/**
 * Personal profile endpoints (verified against backend/app/routers/users.py
 * and backend/app/routers/auth.py, both mounted in main.py). All JSON.
 *
 * Only existing backend endpoints are implemented here:
 * - PATCH /users/me (UserUpdateSchema partial: name 1-200, valid
 *   email, phone matching ^\+?[0-9]{8,15}$; 409 on email/phone clash
 *   with another active user; any authenticated user)
 * - POST  /auth/change-password ({current_password >= 8,
 *   new_password >= 8}; 400 on wrong current password or when the new
 *   password equals the current one; any authenticated user)
 *
 * Session reads reuse the existing /auth/me fetch in the auth store;
 * nothing here duplicates session logic.
 */

/** Raw wire shape (subset of UserOutSchema used by settings). */
export interface BackendUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  platform_role: string;
  is_active: boolean;
}

/** Frontend-shaped profile built only from real backend fields. */
export interface ApiUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export function mapUserProfileResponseToFrontend(u: BackendUserProfile): ApiUserProfile {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone };
}

export interface UpdateMyProfileInput {
  name?: string;
  email?: string;
  phone?: string;
}

/** JSON PATCH payload. Blank optionals are omitted (preserved server-side). */
export function mapProfileFormToUpdate(v: {
  name: string;
  email: string;
  phone: string;
}): UpdateMyProfileInput {
  const clean = (value: string): string | undefined => {
    const cleaned = value.trim();
    return cleaned ? cleaned : undefined;
  };
  return {
    name: v.name.trim() || undefined,
    email: clean(v.email),
    phone: clean(v.phone),
  };
}

export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<ApiUserProfile> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.email !== undefined) body.email = input.email;
  if (input.phone !== undefined) body.phone = input.phone;
  const raw = await apiJson<BackendUserProfile>('/users/me', {
    method: 'PATCH',
    body,
  });
  return mapUserProfileResponseToFrontend(raw);
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<{ message: string }> {
  return apiJson<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: {
      current_password: input.currentPassword,
      new_password: input.newPassword,
    },
  });
}
