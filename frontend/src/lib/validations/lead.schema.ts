import { z } from 'zod';
import { requiredText, optionalText, optionalEmail } from './common';
export const leadStatusSchema = z.object({ status: z.enum(['NEW','CONTACTED','CLOSED']) });
export const leadMessageSchema = z.object({ message: optionalText });
export const enquirySchema = z.object({ name: requiredText, phone: optionalText, email: optionalEmail, contactMethod: z.enum(['phone','whatsapp','email']), message: optionalText }).refine(v=>Boolean(v.phone || v.email),{message:'Please provide a phone number or email address',path:['phone']});
