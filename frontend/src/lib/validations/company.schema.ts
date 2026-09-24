import { z } from 'zod';
import { requiredText, companyRole } from './common';
export const companySchema = z.object({ name: requiredText, email: z.string().trim().email('Enter a valid email address'), phone: requiredText, address: requiredText, category: requiredText });
export const companySetupSchema = z.object({
  name: requiredText.max(200, 'Company name must be 200 characters or fewer'),
  email: z.string().trim().optional().refine(v => !v || /.+@.+\..+/.test(v), 'Enter a valid email address'),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});
export const memberSchema = z.object({ name: requiredText, email: z.string().trim().email('Enter a valid email address'), role: companyRole, active: z.boolean() });
