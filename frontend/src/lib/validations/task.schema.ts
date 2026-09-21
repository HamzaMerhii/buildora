import { z } from 'zod';
import { requiredText, optionalText, date, taskStatus, progress } from './common';
export const taskSchema = z.object({ title: requiredText.max(90), description: optionalText, stageId: requiredText, assignee: z.enum(['Omar Saleh','Maya Haddad']), startDate: date, endDate: date, progress, status: taskStatus, notes: optionalText }).refine(v=>v.endDate>=v.startDate,{message:'Due date must be on or after start date',path:['endDate']});
