import { z } from "zod";
import { requiredText } from "./common";
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Enter a valid email address"),
});
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean(),
});
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number");
export const registerSchema = signInSchema
  .omit({ remember: true })
  .extend({
    name: requiredText,
    phone: phoneSchema,
    confirmPassword: requiredText,
    terms: z
      .boolean()
      .refine((v) => v, "Accept the workspace terms to continue"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
