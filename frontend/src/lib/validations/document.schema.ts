import { z } from 'zod';
import { requiredText } from './common';
export const documentSchema = z.object({ projectId: requiredText, name: requiredText, category: z.enum(['Agreement','Plan','Permit','Other']), file: z.custom<FileList>().refine(f=>Boolean(f?.length),'Choose a file').refine(f=>!f?.length || f[0].size<=50*1024*1024,'File must be 50MB or smaller').refine(f=>!f?.length || /\.(pdf|docx|dwg|xlsx|png)$/i.test(f[0].name),'Use PDF, DOCX, DWG, XLSX or PNG') });
