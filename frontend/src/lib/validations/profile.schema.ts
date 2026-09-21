import { z } from 'zod';
import { requiredText, optionalText } from './common';
export const profileSchema = z.object({ name: requiredText, email: z.string().trim().email('Enter a valid email address'), phone: optionalText });
export const passwordSchema = z.object({ currentPassword: requiredText, password: z.string().min(8,'Password must be at least 8 characters'), confirmPassword: requiredText }).refine(v=>v.password===v.confirmPassword,{message:'Passwords do not match',path:['confirmPassword']});
