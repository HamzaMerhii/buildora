import { z } from 'zod';
import { requiredText, optionalText, optionalEmail } from './common';
export const leadSchema = z.object({ status: z.enum(['NEW','CONTACTED','CLOSED']), note: optionalText });
export const noteSchema = z.object({ note: requiredText });
export const enquirySchema = z.object({ name: requiredText, phone: optionalText, email: optionalEmail, contactMethod: z.enum(['phone','whatsapp','email']), message: optionalText }).refine(v=>Boolean(v.phone || v.email),{message:'Please provide a phone number or email address',path:['phone']});
