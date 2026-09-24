import { z } from 'zod';
import { requiredText, optionalText, optionalEmail } from './common';
export const partySchema = z.object({ name: requiredText, type: z.enum(['CONTRACTOR','SUPPLIER','OTHER']), phone: requiredText, email: z.string().trim().email('Enter a valid email address'), address: optionalText, notes: optionalText });
// Real Party flow: backend type is contractor|supplier only (no OTHER),
// phone/email are optional (phone ≤30 chars server-side). Base schema
// above stays for mock compat.
export const partyApiSchema = z.object({
  name: requiredText.max(200, 'Name must be 200 characters or fewer'),
  type: z.enum(['CONTRACTOR','SUPPLIER']),
  phone: z.string().trim().max(30, 'Phone must be 30 characters or fewer').optional().transform((v) => v || undefined),
  email: optionalEmail,
  address: optionalText,
  notes: optionalText,
});
