import { z } from 'zod';
export const assistantSchema=z.object({query:z.string().trim().min(1,'Enter a question about your workspace'),projectId:z.string()});
