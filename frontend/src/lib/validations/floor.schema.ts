import { z } from 'zod';
import { requiredText, optionalText, requiredNumber } from './common';
export const floorSchema = z.object({ name: requiredText.max(40), number: requiredNumber.pipe(z.number().int('Enter a whole floor number')), description: optionalText, buildingId: requiredText });
// Real Floor flow: backend name is optional (≤100) and description ≤500,
// unlike the mock schema above which requires a short name. Floor number
// stays a required whole number (backend create takes any int, update
// requires ge=0 — out-of-range values surface as backend 422/409).
const floorNumber = requiredNumber.pipe(z.number().int('Enter a whole floor number'));
export const floorApiSchema = z.object({ name: z.string().trim().max(100, 'Floor name must be 100 characters or fewer').optional().transform((v) => v || undefined), number: floorNumber, description: z.string().trim().max(500, 'Description must be 500 characters or fewer').optional().transform((v) => v || undefined), buildingId: requiredText });
