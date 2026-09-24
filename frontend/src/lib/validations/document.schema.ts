import { z } from 'zod';
import { requiredText } from './common';
export const documentSchema = z.object({ projectId: requiredText, name: requiredText, category: z.enum(['Agreement','Plan','Permit','Other']), file: z.custom<FileList>().refine(f=>Boolean(f?.length),'Choose a file').refine(f=>!f?.length || f[0].size<=50*1024*1024,'File must be 50MB or smaller').refine(f=>!f?.length || /\.(pdf|docx|dwg|xlsx|png)$/i.test(f[0].name),'Use PDF, DOCX, DWG, XLSX or PNG') });
// Real Document flow: project is a backend UUID, category is free optional
// text (≤100 chars, NOT an enum), and the file is a single File object.
// The 50MB cap below is a FRONTEND-ONLY guard (no backend limit exists).
// Backend accepts PDF/DOC/DOCX/XLS/XLSX/JPEG/PNG/WEBP — DWG rejected.
const FRONTEND_UPLOAD_GUARD_BYTES = 50 * 1024 * 1024;
const BACKEND_MIME_ALLOWLIST = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp'];
export const documentApiSchema = z.object({
  projectId: requiredText,
  name: requiredText.max(200, 'Name must be 200 characters or fewer'),
  category: z.string().trim().max(100, 'Category must be 100 characters or fewer').optional().transform((v) => v || undefined),
  file: z
    .custom<File | undefined>()
    .refine((f) => f instanceof File, 'Choose a file')
    .refine((f) => !(f instanceof File) || f.size > 0, 'The selected file is empty')
    .refine((f) => !(f instanceof File) || f.size <= FRONTEND_UPLOAD_GUARD_BYTES, 'File must be 50MB or smaller (frontend upload guard)'),
}).refine((v) => !(v.file instanceof File) || BACKEND_MIME_ALLOWLIST.includes((v.file.type || '').toLowerCase()), { message: 'Use PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG or WEBP', path: ['file'] });
