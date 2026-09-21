import { z } from 'zod';
import { requiredText, optionalText } from './common';
export const categorySchema = z.object({ name: requiredText, description: optionalText });
