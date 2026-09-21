import { z } from 'zod';
import { requiredText, optionalText, date, positive, currency, progress } from './common';
export const projectSchema = z.object({ name: requiredText, description: optionalText, location: requiredText, startDate: date, endDate: date, budget: positive, currency, status: z.enum(['PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED']) }).refine(v=>v.endDate>=v.startDate,{message:'End date must be on or after start date',path:['endDate']});
export type ProjectFormValues = z.output<typeof projectSchema>;
export const projectStatusEnum = z.enum(['PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED']);
// Backend POST /companies/{company_id}/projects/ accepts JPEG, PNG and WEBP
// (see imagekit ALLOWED_IMAGE_MIME_TYPES) with no explicit size limit, so the
// frontend validates the MIME type only and does not invent a size cap.
export const projectImageSchema = z
  .custom<FileList | undefined>()
  .optional()
  .refine((f) => !f?.length || f.length === 1, 'Choose one project image')
  .refine(
    (f) => !f?.length || ['image/jpeg', 'image/png', 'image/webp'].includes(f[0].type),
    'Use a JPEG, PNG or WEBP image',
  );
// Real Create Project flow: no backend currency column, plus one optional image.
// projectSchema itself is intentionally left unchanged for the edit form and
// other mock-driven pages that still use currency.
export const projectCreateSchema = z.object({ name: requiredText, description: optionalText, location: requiredText, startDate: date, endDate: date, budget: positive, status: projectStatusEnum, image: projectImageSchema }).refine(v=>v.endDate>=v.startDate,{message:'End date must be on or after start date',path:['endDate']});
export type ProjectCreateFormValues = z.output<typeof projectCreateSchema>;
// Edit Project flow: same fields as projectSchema (currency UI kept) plus an
// optional replacement image (FileList, never a URL — the current image URL
// is displayed separately, never placed into the File input).
export const projectEditSchema = projectSchema.extend({ image: projectImageSchema });
export type ProjectEditFormValues = z.output<typeof projectEditSchema>;
export const landSchema = z.object({ area: positive, parcel: requiredText, maxHeight: positive, ratio: progress, constraints: optionalText, notes: optionalText });
// Real Land Record flow (GET/PATCH land-record/): every backend field is
// optional, so unlike the mock landSchema nothing is required here.
// Bounds mirror the backend exactly: area gt 0, max_height ge 0,
// building_ratio ge 0 with no upper cap. Blank inputs become undefined
// (omitted from PATCH) — NaN is rejected and never sent.
const optionalLandNumber = z
  .union([z.string().trim(), z.number(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === '' || v === undefined || v === null) return undefined;
    const parsed = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((v) => v === undefined || !Number.isNaN(v), { message: 'Enter a valid number' })
  .optional();
export const landRecordSchema = z.object({
  area: optionalLandNumber.refine((v) => v === undefined || v > 0, 'Area must be greater than 0'),
  parcel: optionalText,
  maxHeight: optionalLandNumber.refine((v) => v === undefined || v >= 0, 'Max height cannot be negative'),
  ratio: optionalLandNumber.refine((v) => v === undefined || v >= 0, 'Building ratio cannot be negative'),
  constraints: optionalText,
  notes: optionalText,
});
export type LandRecordFormValues = z.output<typeof landRecordSchema>;
