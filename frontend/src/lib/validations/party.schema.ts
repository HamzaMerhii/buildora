import { z } from 'zod';
import { requiredText, optionalText } from './common';
export const partySchema = z.object({ name: requiredText, type: z.enum(['CONTRACTOR','SUPPLIER','OTHER']), phone: requiredText, email: z.string().trim().email('Enter a valid email address'), address: optionalText, notes: optionalText });
