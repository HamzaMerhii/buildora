import { z } from 'zod';
import { requiredText, optionalText, date, taskStatus } from './common';
export const stageSchema = z.object({ projectId: requiredText, name: requiredText, description: optionalText, order: z.coerce.number().int().positive(), startDate: date, endDate: date, status: taskStatus }).refine(v=>v.endDate>=v.startDate,{message:'Due date must be on or after start date',path:['endDate']});
// Real API schema: no order_index input (backend auto-assigns max+1),
// dates optional (backend nullable). Relationship check kept.
const optionalDate = z.union([z.literal(''), date]).transform(v=>v||undefined).optional();
export const stageApiSchema = z.object({ projectId: requiredText, name: requiredText.max(200), description: optionalText, startDate: optionalDate, endDate: optionalDate, status: taskStatus }).refine(v=>!v.startDate||!v.endDate||v.endDate>=v.startDate,{message:'Due date must be on or after start date',path:['endDate']});
