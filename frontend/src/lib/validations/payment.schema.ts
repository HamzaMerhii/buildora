import { z } from 'zod';
import { requiredText, optionalText, positive, date, currency } from './common';
export const paymentSchema = z.object({ projectId: requiredText, partyId: requiredText, categoryId: requiredText, amount: positive, currency, date, reference: requiredText, description: optionalText });
