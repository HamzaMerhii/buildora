import { z } from 'zod';
import { requiredText, optionalText, positive, date, currency } from './common';
export const paymentSchema = z.object({ projectId: requiredText, partyId: requiredText, categoryId: requiredText, amount: positive, currency, date, reference: requiredText, description: optionalText });
// Real Payment flow: project/party/category are backend UUIDs, amount is a
// positive number (Numeric(14,2)), reference is a free optional string.
// There is NO currency (removed backend-wide) and NO edit/delete.
export const paymentApiSchema = z.object({ projectId: requiredText, partyId: requiredText, categoryId: requiredText, amount: positive, paymentDate: date, reference: optionalText, description: optionalText });
