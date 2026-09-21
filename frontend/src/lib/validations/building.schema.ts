import { z } from 'zod';
import { requiredText } from './common';
// Caps mirror the backend: create allows name ≤ 200, update allows
// name ≤ 100 and description ≤ 500, so 100/500 keeps both flows valid.
export const buildingSchema = z.object({ name: requiredText.max(100, 'Building name must be 100 characters or fewer'), description: z.string().trim().max(500, 'Description must be 500 characters or fewer').optional().transform((v) => v || undefined), projectId: requiredText });
