import { z } from "zod";
import { requiredText, optionalText, positive, currency } from "./common";
export const apartmentSchema = z.object({
  projectId: requiredText,
  buildingId: requiredText,
  floorId: requiredText,
  number: requiredText,
  description: optionalText,
  area: positive,
  bedrooms: z.coerce.number().int().min(1),
  bathrooms: z.coerce.number().int().min(1),
  price: positive,
  currency,
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]),
  isPublic: z.boolean(),
});
export type ApartmentFormValues = z.output<typeof apartmentSchema>;
// Real Apartment flows: the backend has no currency column, so currency is
// omitted here (base schema keeps it for mock compat). Backend create
// accepts any number of `images` files (jpeg/png/webp, no count limit
// defined) and embeds them in the response. PATCH cannot touch images
// at all, so the edit schema omits that field as well.
export const apartmentImagesSchema = z
  .custom<FileList | undefined>()
  .optional()
  .refine((f) => !f?.length || Array.from(f).every((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)), 'Use JPEG, PNG or WEBP images');
export const apartmentApiSchema = apartmentSchema.omit({ currency: true }).extend({ images: apartmentImagesSchema });
export type ApartmentApiFormValues = z.output<typeof apartmentApiSchema>;
export const apartmentEditSchema = apartmentSchema.omit({ currency: true });
export type ApartmentEditFormValues = z.output<typeof apartmentEditSchema>;
export function apartmentSchemaForStructure(
  buildings: readonly {id:string;projectId:string}[],
  floors: readonly {id:string;buildingId:string}[],
) {
  return apartmentSchema.superRefine((value, context) => {
    if (!buildings.some(building => building.id === value.buildingId && building.projectId === value.projectId)) {
      context.addIssue({code:'custom',path:['buildingId'],message:'Choose a building in the selected project'});
    }
    if (!floors.some(floor => floor.id === value.floorId && floor.buildingId === value.buildingId)) {
      context.addIssue({code:'custom',path:['floorId'],message:'Choose a floor in the selected building'});
    }
  });
}
