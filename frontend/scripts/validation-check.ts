import assert from "node:assert/strict";
import { projectSchema, projectCreateSchema, projectEditSchema, landRecordSchema } from "../src/lib/validations/project.schema";
import { buildingSchema } from "../src/lib/validations/building.schema";
import { floorApiSchema } from "../src/lib/validations/floor.schema";
import { stageApiSchema } from "../src/lib/validations/construction-stage.schema";
import { apartmentApiSchema, apartmentEditSchema, apartmentImagesSchema } from "../src/lib/validations/apartment.schema";
import {
  mapBuildingFormToCreate,
  mapBuildingFormToUpdate,
  mapBuildingResponseToFrontend,
} from "../src/lib/api/building.api";
import {
  fromBackendStageStatus,
  mapApiStageToFormValues,
  mapStageFormToCreate,
  mapStageFormToUpdate,
  mapStageOrderToReorderPayload,
  mapStageResponseToFrontend,
  toBackendStageStatus,
} from "../src/lib/api/construction-stage.api";
import {
  mapApiFloorToFormValues,
  mapFloorFormToCreate,
  mapFloorFormToUpdate,
  mapFloorResponseToFrontend,
} from "../src/lib/api/floor.api";
import {
  fromBackendApartmentStatus,
  mapApartmentFormToCreate,
  mapApartmentFormToUpdate,
  mapApartmentResponseToFrontend,
  toBackendApartmentStatus,
} from "../src/lib/api/apartment.api";
import {
  mapLandRecordFormToUpdate,
  mapLandRecordResponseToFrontend,
} from "../src/lib/api/land-record.api";
import { mapProjectFormToCreate, mapProjectFormToUpdate } from "../src/lib/api/project.api";
import { apartmentSchema, apartmentSchemaForStructure } from "../src/lib/validations/apartment.schema";
import { floorSchema } from "../src/lib/validations/floor.schema";
import { taskSchema } from "../src/lib/validations/task.schema";
import { paymentSchema } from "../src/lib/validations/payment.schema";
import {
  registerSchema,
  signInSchema,
} from "../src/lib/validations/auth.schema";
import { enquirySchema, leadSchema } from "../src/lib/validations/lead.schema";
import { documentSchema } from "../src/lib/validations/document.schema";
import { taskUpdateSchema } from "../src/lib/validations/task-update.schema";
import {
  companySchema,
  memberSchema,
  platformRoleSchema,
} from "../src/lib/validations/company.schema";
import { passwordSchema } from "../src/lib/validations/profile.schema";
import { initialData } from "../src/lib/mock-data/workspace";
let count = 0;
function check(condition: boolean, label: string) {
  assert.ok(condition, label);
  count++;
  console.log("PASS", label);
}
const project = initialData.projects[0];
check(projectSchema.safeParse(project).success, "prefilled project is valid");
check(
  projectCreateSchema.safeParse({
    name: project.name,
    description: project.description,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    status: project.status,
  }).success,
  "project create valid without currency",
);
check(
  !projectCreateSchema.safeParse({
    name: project.name,
    description: project.description,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    status: project.status,
    image: { length: 1, 0: { type: "image/gif" } },
  }).success,
  "project create rejects non-jpeg/png/webp image",
);
check(
  mapProjectFormToUpdate({
    name: project.name,
    description: project.description,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    currency: 'USD',
    status: project.status,
  }).image === undefined,
  "project update omits image when none selected (existing preserved)",
);
check(
  buildingSchema.safeParse({ name: 'Building A', description: '', projectId: 'p1' }).success,
  "building accepts valid values",
);
check(
  !buildingSchema.safeParse({ name: '  ', description: '', projectId: 'p1' }).success,
  "building rejects blank name",
);
check(
  !buildingSchema.safeParse({ name: 'x'.repeat(101), description: '', projectId: 'p1' }).success,
  "building name capped at backend update limit",
);
check(
  mapBuildingResponseToFrontend({
    id: 'b1', project_id: 'p1', name: ' A ', description: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).projectId === 'p1',
  "building response maps project_id",
);
check(
  JSON.stringify(mapBuildingFormToCreate({ name: ' N ', description: '  ', projectId: 'p1' })) === '{"name":"N"}',
  "building create strips blanks (projectId stays in URL)",
);
check(
  JSON.stringify(mapBuildingFormToUpdate({ name: 'N', description: '', projectId: 'p1' })) === '{"name":"N"}',
  "building update omits blank description (preserved server-side)",
);
check(
  floorApiSchema.safeParse({ name: '', number: 3, description: '', buildingId: 'b1' }).success,
  "floor api accepts optional name with required number",
);
check(
  floorApiSchema.safeParse({ number: 0, buildingId: 'b1' }).success,
  "floor api accepts ground floor zero",
);
check(
  !floorApiSchema.safeParse({ number: '', buildingId: 'b1' }).success,
  "floor api rejects empty number",
);
check(
  !floorApiSchema.safeParse({ number: 1.5, buildingId: 'b1' }).success,
  "floor api rejects fractional number",
);
check(
  mapFloorResponseToFrontend({
    id: 'f1', building_id: 'b1', name: null, floor_number: 2, description: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).number === 2,
  "floor response maps floor_number",
);
check(
  JSON.stringify(mapFloorFormToCreate({ number: 2, buildingId: 'b1' })) === '{"number":2}',
  "floor create sends number with buildingId in URL",
);
check(
  JSON.stringify(mapFloorFormToUpdate({ name: '', number: 2, description: '', buildingId: 'b1' })) === '{"number":2}',
  "floor update omits blank name/description",
);
check(
  mapApiFloorToFormValues(
    { id: 'f1', buildingId: 'b1', number: 2 },
    'b1',
  ).number === 2,
  "floor prefill works without optional fields",
);
check(
  toBackendStageStatus('IN_PROGRESS') === 'in_progress' &&
    fromBackendStageStatus('completed') === 'COMPLETED',
  "stage status maps both directions",
);
check(
  stageApiSchema.safeParse({
    projectId: 'p1', name: 'Structure', description: '',
    startDate: '', endDate: '', status: 'NOT_STARTED',
  }).success,
  "stage api accepts empty optional dates",
);
check(
  !('order' in stageApiSchema.shape) && !('order_index' in stageApiSchema.shape),
  "stage api schema sends no order (backend auto-assigns)",
);
check(
  !stageApiSchema.safeParse({
    projectId: 'p1', name: 'Structure', description: '',
    startDate: '2026-09-19', endDate: '2026-01-01', status: 'NOT_STARTED',
  }).success,
  "stage api rejects end before start",
);
check(
  mapStageResponseToFrontend({
    id: 's1', project_id: 'p1', name: 'Structure', description: null,
    order_index: 0, start_date: null, due_date: '2027-01-01', status: 'in_progress',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).order === 0,
  "stage response maps order_index (0-based preserved)",
);
check(
  JSON.stringify(mapStageFormToCreate({
    projectId: 'p1', name: ' N ', description: '  ',
    startDate: '', endDate: '', status: 'NOT_STARTED',
  })) === '{"name":"N","status":"NOT_STARTED"}',
  "stage create strips blanks (status mapped at request time)",
);
check(
  mapApiStageToFormValues(
    {
      id: 's1', projectId: 'p1', name: 'Structure', order: 2,
      startDate: undefined, endDate: undefined, status: 'COMPLETED',
    },
    'p1',
  ).status === 'COMPLETED',
  "stage prefill works without optional dates",
);
check(
  JSON.stringify(
    mapStageOrderToReorderPayload([{ id: 's3' }, { id: 's1' }, { id: 's2' }]),
  ) ===
    '{"stages":[{"stage_id":"s3","order_index":0},{"stage_id":"s1","order_index":1},{"stage_id":"s2","order_index":2}]}',
  "reorder payload is zero-based with backend field names",
);
check(
  toBackendApartmentStatus('SOLD') === 'sold' && fromBackendApartmentStatus('reserved') === 'RESERVED',
  "apartment status maps both directions",
);
check(
  apartmentApiSchema.safeParse({
    projectId: 'p1', buildingId: 'b1', floorId: 'f1', number: '201',
    description: '', area: 120, bedrooms: 3, bathrooms: 2, price: 150000,
    status: 'AVAILABLE', isPublic: false,
  }).success,
  "apartment api accepts imageless create values",
);
check(
  apartmentEditSchema.safeParse({
    projectId: 'p1', buildingId: 'b1', floorId: 'f1', number: '201',
    description: '', area: 120, bedrooms: 3, bathrooms: 2, price: 150000,
    status: 'RESERVED', isPublic: true,
  }).success && !('currency' in apartmentEditSchema.shape) && !('images' in apartmentEditSchema.shape),
  "apartment edit schema has no currency or images",
);
check(
  apartmentImagesSchema.safeParse({
    length: 3,
    0: { type: 'image/jpeg' },
    1: { type: 'image/png' },
    2: { type: 'image/webp' },
  }).success,
  "apartment images accept multiple jpeg/png/webp",
);
check(
  !apartmentApiSchema.safeParse({
    projectId: 'p1', buildingId: 'b1', floorId: 'f1', number: '201',
    description: '', area: 120, bedrooms: 3, bathrooms: 2, price: 150000,
    currency: 'USD', status: 'AVAILABLE', isPublic: false,
    images: { length: 1, 0: { type: 'image/gif' } },
  }).success,
  "apartment api rejects non-jpeg/png/webp image",
);
check(
  mapApartmentResponseToFrontend({
    id: 'a1', floor_id: 'f1', unit_number: '201', area_sqm: '120.50',
    bedrooms: 3, bathrooms: 2, price: '150000.00', status: 'sold',
    is_public: true, description: null, images: [{ id: 'i1', image_url: 'https://img/u1' }],
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).images[0]?.url === 'https://img/u1',
  "apartment response embeds image urls",
);
check(
  !('currency' in mapApartmentFormToCreate({
    projectId: 'p1', buildingId: 'b1', floorId: 'f1', number: '201',
    description: '', area: 120, bedrooms: 3, bathrooms: 2, price: 150000,
    status: 'AVAILABLE', isPublic: true,
  })),
  "apartment create drops currency",
);
check(
  JSON.stringify(mapApartmentFormToUpdate({
    projectId: 'p1', buildingId: 'b1', floorId: 'f1', number: '201',
    description: '', area: '', bedrooms: 3, bathrooms: 2, price: '',
    status: 'RESERVED', isPublic: false,
  })) === '{"unitNumber":"201","bedrooms":3,"bathrooms":2,"status":"RESERVED","isPublic":false}',
  "apartment update omits blank numerics (preserved server-side)",
);
check(
  landRecordSchema.safeParse({ area: '', parcel: '', maxHeight: '', ratio: '', constraints: '', notes: '' }).success,
  "land record accepts empty optionals",
);
check(
  landRecordSchema.safeParse({ area: 1000, parcel: 'LB-1', maxHeight: 20, ratio: 60 }).success,
  "land record accepts valid values",
);
check(
  !landRecordSchema.safeParse({ area: 0 }).success,
  "land area must be greater than 0",
);
check(
  !landRecordSchema.safeParse({ area: 'abc' }).success,
  "land area rejects non-numeric input",
);
check(
  !landRecordSchema.safeParse({ ratio: -5 }).success,
  "land ratio rejects negatives",
);
check(
  landRecordSchema.safeParse({ ratio: 150 }).success,
  "land ratio has no backend upper cap",
);
check(
  mapLandRecordResponseToFrontend({
    id: 'l1', project_id: 'p1', area_sqm: '1000.00', parcel_number: null,
    max_height_m: 20, building_ratio: null, constraints: null, notes: 'n',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).area === 1000,
  "land response decimal strings become numbers",
);
check(
  JSON.stringify(mapLandRecordFormToUpdate({ area: '', parcel: '  ', maxHeight: '', ratio: '', constraints: '', notes: '' })) === '{}',
  "land update omits blank inputs (never NaN)",
);
check(
  projectEditSchema.safeParse({
    name: project.name,
    description: project.description,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    currency: 'USD',
    status: project.status,
  }).success,
  "project edit valid without new image",
);
check(
  !projectEditSchema.safeParse({
    name: project.name,
    description: project.description,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    currency: 'USD',
    status: project.status,
    image: { length: 1, 0: { type: "image/gif" } },
  }).success,
  "project edit rejects non-jpeg/png/webp image",
);
check(
  mapProjectFormToUpdate({
    name: ' N ',
    description: '  ',
    location: '',
    startDate: '',
    endDate: '',
    budget: '',
    currency: 'USD',
    status: 'PLANNING',
    image: { length: 1, 0: { type: 'image/png', name: 'p.png' } } as unknown as FileList,
  }).image?.type === 'image/png',
  "project update passes selected image file through",
);
check(
  !projectSchema.safeParse({ ...project, name: "  " }).success,
  "whitespace name rejected",
);
check(
  !projectSchema.safeParse({ ...project, budget: -1 }).success,
  "negative budget rejected",
);
check(
  !projectSchema.safeParse({ ...project, budget: 0 }).success,
  "zero budget rejected",
);
check(
  !projectSchema.safeParse({ ...project, budget: "abc" }).success,
  "nonnumeric budget rejected",
);
check(
  projectSchema.parse({ ...project, budget: "25000" }).budget === 25000,
  "number input coerced",
);
check(
  !projectSchema.safeParse({ ...project, endDate: "2020-01-01" }).success,
  "end before start rejected",
);
check(
  !projectSchema.safeParse({ ...project, startDate: "2026-02-30" }).success,
  "invalid calendar date rejected",
);
check(
  !projectSchema.safeParse({ ...project, status: "UNKNOWN" }).success,
  "project enum rejected",
);
const task = initialData.tasks[0];
for (const progress of [-1, 101, "bad"])
  check(
    !taskSchema.safeParse({ ...task, progress }).success,
    "invalid task progress " + progress,
  );
for (const progress of [0, 100])
  check(
    taskSchema.safeParse({ ...task, progress }).success,
    "progress boundary " + progress,
  );
check(
  !taskSchema.safeParse({ ...task, status: "PAUSED" }).success,
  "task status enum rejected",
);
check(
  !taskSchema.safeParse({ ...task, assignee: "Unknown External Contractor" })
    .success,
  "external task assignee rejected",
);
check(
  !taskSchema.safeParse({ ...task, endDate: "2020-01-01" }).success,
  "invalid task dates rejected",
);
for (const amount of [-1, 0, "bad"])
  check(
    !paymentSchema.safeParse({ ...initialData.payments[0], amount }).success,
    "invalid payment amount " + amount,
  );
check(
  paymentSchema.safeParse(initialData.payments[0]).success,
  "valid payment accepted",
);
check(
  apartmentSchema.safeParse(initialData.apartments[0]).success,
  "prefilled apartment accepted",
);
check(
  !apartmentSchema.safeParse({ ...initialData.apartments[0], status: "LEASED" })
    .success,
  "apartment enum rejected",
);
check(
  !apartmentSchema.safeParse({ ...initialData.apartments[0], bedrooms: 1.5 })
    .success,
  "fractional bedroom count rejected",
);
const register = {
  name: "Test User",
  email: "test@example.com",
  phone: "+96170123456",
  password: "password123",
  confirmPassword: "password123",
  terms: true,
};
check(registerSchema.safeParse(register).success, "valid registration");
check(
  !registerSchema.safeParse({ ...register, email: "bad" }).success,
  "invalid email rejected",
);
check(
  !registerSchema.safeParse({ ...register, password: "short" }).success,
  "short password rejected",
);
check(
  !registerSchema.safeParse({ ...register, confirmPassword: "mismatch" })
    .success,
  "password mismatch rejected",
);
check(
  !registerSchema.safeParse({ ...register, terms: false }).success,
  "terms acceptance required",
);
check(
  !signInSchema.safeParse({ email: "", password: "", remember: false }).success,
  "empty sign-in rejected",
);
const enquiry = {
  name: "Test Buyer",
  phone: "",
  email: "",
  contactMethod: "phone",
  message: "",
};
check(!enquirySchema.safeParse(enquiry).success, "enquiry requires contact");
check(
  enquirySchema.safeParse({ ...enquiry, phone: "+961 70 111 222" }).success,
  "phone-only enquiry accepted",
);
check(
  enquirySchema.safeParse({ ...enquiry, email: "buyer@example.com" }).success,
  "email-only enquiry accepted",
);
check(
  !enquirySchema.safeParse({ ...enquiry, email: "bad" }).success,
  "invalid enquiry email rejected",
);
check(
  enquirySchema.parse({ ...enquiry, email: "buyer@example.com" }).phone ===
    undefined,
  "empty optional value normalized",
);
check(
  !leadSchema.safeParse({ status: "QUALIFIED", note: "" }).success,
  "lead enum rejected",
);
check(
  !memberSchema.safeParse({
    name: "A",
    email: "a@b.com",
    role: "ADMIN",
    active: true,
  }).success,
  "company role enum rejected",
);
check(
  !platformRoleSchema.safeParse({ role: "OWNER" }).success,
  "platform role enum rejected",
);
check(
  companySchema.safeParse(initialData.companies[0]).success,
  "prefilled company accepted",
);
check(
  !passwordSchema.safeParse({
    currentPassword: "old",
    password: "password123",
    confirmPassword: "different",
  }).success,
  "password change mismatch rejected",
);
const doc = {
  projectId: "cedar-residence",
  name: "Test",
  category: "Plan",
  file: [],
};
check(!documentSchema.safeParse(doc).success, "document file required");
check(
  !documentSchema.safeParse({ ...doc, file: [{ name: "file.exe", size: 10 }] })
    .success,
  "unsupported file rejected",
);
check(
  !documentSchema.safeParse({
    ...doc,
    file: [{ name: "file.pdf", size: 51 * 1024 * 1024 }],
  }).success,
  "oversized document rejected",
);
check(
  documentSchema.safeParse({ ...doc, file: [{ name: "file.pdf", size: 1000 }] })
    .success,
  "valid document accepted",
);
check(
  !taskUpdateSchema.safeParse({
    progress: 50,
    notes: "",
    photo: [{ type: "text/plain", size: 10 }],
  }).success,
  "invalid site photo rejected",
);
check(!taskSchema.safeParse({...task,progress:''}).success,'empty progress is required rather than zero');
check(!taskSchema.safeParse({...task,progress:'  '}).success,'whitespace progress rejected');
check(!floorSchema.safeParse({...initialData.floors[0],number:''}).success,'empty floor number rejected');
check(floorSchema.safeParse({...initialData.floors[0],number:'0'}).success,'explicit ground floor zero accepted');
check(projectSchema.safeParse({...project,description:undefined}).success,'missing optional description accepted');
check(enquirySchema.safeParse({...enquiry,email:'   ',phone:'+961 70 123 456'}).success,'whitespace optional email normalized');
const hierarchy=apartmentSchemaForStructure(initialData.buildings,initialData.floors);
check(hierarchy.safeParse(initialData.apartments[0]).success,'valid apartment hierarchy');
check(!hierarchy.safeParse({...initialData.apartments[0],projectId:'harbor-view'}).success,'building in wrong project rejected');
check(!hierarchy.safeParse({...initialData.apartments[0],floorId:'harbor-floor-1'}).success,'floor in wrong building rejected');
console.log(`${count} validation checks passed.`);
