import { z } from "zod";
export const requiredText = z.string().trim().min(1, "This field is required");
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined);
export const optionalEmail = z
  .string()
  .trim()
  .pipe(z.union([z.literal(""),z.email("Enter a valid email address")]))
  .optional()
  .transform((v) => v || undefined);
export const date = z.iso.date("Enter a valid date");
export const requiredNumber = z
  .union([z.string().trim().min(1, "This field is required"), z.number()])
  .pipe(z.coerce.number({error: "Enter a valid number"}));
export const positive = requiredNumber
  .pipe(z.number()
  .positive("Value must be greater than 0"));
export const progress = requiredNumber.pipe(z.number()
  .min(0, "Progress cannot be less than 0")
  .max(100, "Progress cannot exceed 100"));
export const currency = z.enum(["USD", "EUR", "LBP", "GBP", "AED", "SAR"]);
export const taskStatus = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
export const companyRole = z.enum([
  "OWNER",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "SALES",
  "FINANCE",
  "OTHER",
]);
export const optionalPhoto = z
  .custom<FileList | undefined>()
  .refine(
    (f) => !f?.length || ["image/jpeg", "image/png"].includes(f[0].type),
    "Choose a JPG or PNG image",
  )
  .refine(
    (f) => !f?.length || f[0].size <= 10 * 1024 * 1024,
    "Photo must be 10MB or smaller",
  );
