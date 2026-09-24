import { z } from 'zod';
import { requiredText, optionalText, date, taskStatus, progress } from './common';
export const taskSchema = z.object({ title: requiredText.max(90), description: optionalText, stageId: requiredText, assignee: z.enum(['Omar Saleh','Maya Haddad']), startDate: date, endDate: date, progress, status: taskStatus, notes: optionalText }).refine(v=>v.endDate>=v.startDate,{message:'Due date must be on or after start date',path:['endDate']});
// Real Task flow: stage/user/party are backend UUIDs; notes ride along to
// chained task updates (tasks have no notes column). projectId is a
// UI-only routing aid for the create-mode project dropdown.
export const taskApiSchema = z.object({ title: requiredText.max(200), description: optionalText, projectId: z.string().optional(), stageId: requiredText, assignedTo: requiredText, partyId: requiredText, startDate: date, endDate: date, progress, status: taskStatus, notes: optionalText }).refine(v=>v.endDate>=v.startDate,{message:'Due date must be on or after start date',path:['endDate']});
