import { z } from 'zod';
import { requiredText } from './common';

/**
 * Real Settings schemas, mirroring the backend Pydantic contracts.
 * Mock-era fields (company category, OTHER member role) are gone:
 * the backend has no category column and its CompanyRole enum has
 * no OTHER value.
 */

// PATCH /companies/{id}: name 1-200, phone <=30, email <=200 plain
// string, address <=500. All optional (partial update).
export const companySettingsSchema = z.object({
  name: requiredText.max(200, 'Name must be 200 characters or fewer'),
  email: z
    .string()
    .trim()
    .max(200, 'Email must be 200 characters or fewer')
    .optional()
    .transform((v) => v || undefined),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone must be 30 characters or fewer')
    .optional()
    .transform((v) => v || undefined),
  address: z
    .string()
    .trim()
    .max(500, 'Address must be 500 characters or fewer')
    .optional()
    .transform((v) => v || undefined),
});

// PATCH /users/me: name 1-200, valid email, phone ^\+?[0-9]{8,15}$.
export const profileSettingsSchema = z.object({
  name: requiredText.max(200, 'Name must be 200 characters or fewer'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Enter a valid phone number'),
});

// POST /auth/change-password takes {current_password, new_password}
// (both >= 8). Confirm stays frontend-only and is never sent.
export const changePasswordSchema = z
  .object({
    currentPassword: requiredText.min(8, 'Enter your current password'),
    newPassword: requiredText.min(8, 'New password must be at least 8 characters'),
    confirmPassword: requiredText.min(1, 'Please confirm your password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// POST /companies/{id}/members: creates a User + membership.
// name 1-200, EmailStr email, phone ^\+?[0-9]{8,15}$, password >= 8.
// The CompanyRole enum has no OTHER — it is not offered. Confirm
// password stays frontend-only and is never sent.
export const memberAddSchema = z
  .object({
    name: requiredText.max(200, 'Name must be 200 characters or fewer'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, 'Enter a valid phone number'),
    password: requiredText.min(8, 'Password must be at least 8 characters'),
    confirmPassword: requiredText.min(1, 'Please confirm the password'),
    role: z.enum(['OWNER', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SALES', 'FINANCE']),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// PATCH /companies/{id}/members/{membership_id}: role and/or active.
export const memberUpdateSchema = z.object({
  role: z.enum(['OWNER', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SALES', 'FINANCE']),
});
