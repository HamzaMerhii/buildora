import { z } from 'zod';
import { optionalText, progress, optionalPhoto } from './common';
export const taskUpdateSchema = z.object({ progress, notes: optionalText, photo: optionalPhoto });
