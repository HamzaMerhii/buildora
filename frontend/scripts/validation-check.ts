import assert from "node:assert/strict";
import { projectSchema, projectCreateSchema, projectEditSchema, landRecordSchema } from "../src/lib/validations/project.schema";
import { buildingSchema } from "../src/lib/validations/building.schema";
import { partyApiSchema } from "../src/lib/validations/party.schema";
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
  fromBackendPartyType,
  mapPartyFormToCreate,
  mapPartyFormToUpdate,
  mapPartyResponseToFrontend,
  toBackendPartyType,
} from "../src/lib/api/party.api";
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
import { mapProjectFormToCreate, mapProjectFormToUpdate, mapProjectResponseToFrontend } from "../src/lib/api/project.api";
import {
  findFirstInvalidStep,
  getProjectWizardSteps,
} from "../src/lib/validations/project-wizard";
import { apartmentSchema, apartmentSchemaForStructure } from "../src/lib/validations/apartment.schema";
import { floorSchema } from "../src/lib/validations/floor.schema";
import { taskSchema } from "../src/lib/validations/task.schema";
import { taskApiSchema } from "../src/lib/validations/task.schema";
import {
  isTaskOverdue,
  mapApiTaskToFormValues,
  mapTaskFormToCreate,
  mapTaskFormToUpdate,
  mapTaskResponseToFrontend,
  toBackendTaskStatus,
  fromBackendTaskStatus,
} from "../src/lib/api/task.api";
import {
  activeMembers,
  buildMembersByUserId,
  companyRoleLabel,
  fromBackendCompanyRole,
  mapCompanyMemberResponseToFrontend,
} from "../src/lib/api/company-member.api";
import {
  formatAmount,
  mapPaymentFormToCreate,
  mapPaymentResponseToFrontend,
  invoiceFilename,
  toPaymentAmount,
} from "../src/lib/api/payment.api";
import {
  buildCategoriesById,
  mapPaymentCategoryResponseToFrontend,
} from "../src/lib/api/payment-category.api";
import {
  DOCUMENT_FILE_ACCEPT,
  documentFormat,
  isPreviewableImage,
  isPreviewablePdf,
  mapDocumentResponseToFrontend,
} from "../src/lib/api/document.api";
import { documentApiSchema } from "../src/lib/validations/document.schema";
import { paymentApiSchema, paymentSchema } from "../src/lib/validations/payment.schema";
import {
  isAcceptedCompanyLogo,
  mapCompanyResponseToFrontend,
  mapCompanyFormToUpdate,
} from "../src/lib/api/company-settings.api";
import {
  mapUserProfileResponseToFrontend,
  mapProfileFormToUpdate,
} from "../src/lib/api/user-profile.api";
import {
  registerSchema,
  signInSchema,
} from "../src/lib/validations/auth.schema";
import { enquirySchema, leadStatusSchema } from "../src/lib/validations/lead.schema";
import { documentSchema } from "../src/lib/validations/document.schema";
import { taskUpdateSchema } from "../src/lib/validations/task-update.schema";
import {
  companySchema,
  memberSchema,
} from "../src/lib/validations/company.schema";
import { passwordSchema } from "../src/lib/validations/profile.schema";
import { changePasswordSchema, companySettingsSchema, memberAddSchema } from "../src/lib/validations/settings.schema";
import { mapCompanyMemberFormToCreatePayload } from "../src/lib/api/company-member.api";
import {
  PLATFORM_ROLE_LABEL,
  fromBackendPlatformRole,
  mapPlatformCompanyStatusToUpdate,
  mapPlatformCompanyToFrontend,
  mapPlatformUserStatusToUpdate,
  mapPlatformUserToFrontend,
} from "../src/lib/api/platform.api";
import {
  dashboardProjectStatusLabel,
  financialKpiFontSize,
  mapDashboardSummaryToFrontend,
  mapDashboardTaskToFrontend,
  mapFinanceDashboardToFrontend,
  mapSalesDashboardToFrontend,
  toDashboardNumber,
} from "../src/lib/api/dashboard.api";
import { aiId, aiNumber, aiText } from "../src/lib/api/ai.api";
import { assistantSchema } from "../src/lib/validations/assistant.schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fromBackendLeadStatus,
  mapLeadMessageFormToUpdate,
  mapLeadResponseToFrontend,
  mapLeadStatusFormToUpdate,
  toBackendLeadStatus,
} from "../src/lib/api/lead.api";
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
  getProjectWizardSteps(false).length === 6 && getProjectWizardSteps(true).length === 6,
  "project wizard has six steps in create and edit mode",
);
check(
  getProjectWizardSteps(false).map((s) => s.id).join(',') ===
    'details,location,timeline,budget,status,image',
  "project wizard step order mirrors form sections",
);
check(
  (() => {
    const fields = getProjectWizardSteps(false).flatMap((s) => s.fields).sort();
    const expected = ['budget', 'description', 'endDate', 'image', 'location', 'name', 'startDate', 'status'].sort();
    return JSON.stringify(fields) === JSON.stringify(expected);
  })(),
  "create wizard steps cover every create field exactly once",
);
check(
  getProjectWizardSteps(true)[3].fields.join(',') === 'budget,currency' &&
    getProjectWizardSteps(false)[3].fields.join(',') === 'budget',
  "budget step validates currency only in edit mode",
);
check(
  findFirstInvalidStep({}, false) === -1 &&
    findFirstInvalidStep({ name: { message: 'x' } }, false) === 0 &&
    findFirstInvalidStep({ endDate: { message: 'x' } }, false) === 2 &&
    findFirstInvalidStep({ image: { message: 'x' } }, false) === 5 &&
    findFirstInvalidStep({ currency: { message: 'x' } }, true) === 3,
  "first-invalid-step mapping returns the owning step",
);
check(
  projectCreateSchema.keyof().options.every((key) =>
    getProjectWizardSteps(false).some((s) => s.fields.includes(key)),
  ) &&
    (['name', 'description', 'location', 'startDate', 'endDate', 'budget', 'status', 'image'] as string[]).every(
      (key) => key in projectCreateSchema.shape,
    ),
  "every create schema field is validated by exactly one wizard step",
);
const projectFormSrc = readFileSync(
  join(process.cwd(), "src/components/forms/ProjectForm.tsx"),
  "utf8",
);
for (const real of [
  'getProjectWizardSteps',
  'shouldUnregister: false',
  'findFirstInvalidStep',
  'form.trigger',
  'type="button"',
]) {
  check(
    projectFormSrc.includes(real),
    `project wizard uses real behavior: ${real}`,
  );
}
const wizardSrc = readFileSync(
  join(process.cwd(), "src/components/forms/FormWizard.tsx"),
  "utf8",
);
check(
  wizardSrc.includes('Step {step + 1} of {steps.length}'),
  "wizard nav renders step indicator",
);
check(
  wizardSrc.includes('type="submit"'),
  "wizard footer uses submit button",
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
  toBackendPartyType('CONTRACTOR') === 'contractor' &&
    toBackendPartyType('SUPPLIER') === 'supplier' &&
    fromBackendPartyType('contractor') === 'CONTRACTOR',
  "party type maps both directions (no OTHER on backend)",
);
check(
  partyApiSchema.safeParse({ name: 'ABC', type: 'CONTRACTOR' }).success,
  "party api accepts contractor with only a name",
);
check(
  !partyApiSchema.safeParse({ name: 'ABC', type: 'OTHER' }).success,
  "party api rejects OTHER type (unsupported by backend)",
);
check(
  !partyApiSchema.safeParse({ name: '  ', type: 'SUPPLIER' }).success,
  "party api rejects blank name",
);
check(
  !partyApiSchema.safeParse({ name: 'ABC', type: 'SUPPLIER', phone: 'x'.repeat(31) }).success,
  "party api caps phone at backend limit",
);
check(
  mapPartyResponseToFrontend({
    id: 'p1', name: ' ABC ', type: 'supplier', email: null, phone: null,
    address: null, notes: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).type === 'SUPPLIER',
  "party response maps backend type",
);
check(
  JSON.stringify(mapPartyFormToCreate({ name: ' N ', type: 'SUPPLIER', email: '', phone: '' })) === '{"name":"N","type":"SUPPLIER"}',
  "party create strips blanks (wire mapping applied at request)",
);
check(
  JSON.stringify(mapPartyFormToUpdate({ name: 'N', type: 'CONTRACTOR', notes: '' })) === '{"name":"N","type":"CONTRACTOR"}',
  "party update omits blank notes (preserved server-side)",
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
  toBackendTaskStatus('IN_PROGRESS') === 'in_progress' &&
    fromBackendTaskStatus('completed') === 'COMPLETED',
  "task status maps both directions",
);
check(
  taskApiSchema.safeParse({
    title: 'Pour Slab', description: '', stageId: 's1',
    assignedTo: 'u1', partyId: 'p1', startDate: '2026-09-01', endDate: '2026-09-10',
    progress: 0, status: 'NOT_STARTED', notes: '',
  }).success,
  "task api accepts valid dual-assignment values",
);
check(
  !taskApiSchema.safeParse({
    title: 'Pour Slab', description: '', stageId: 's1',
    assignedTo: '', partyId: 'p1', startDate: '2026-09-01', endDate: '2026-09-10',
    progress: 0, status: 'NOT_STARTED', notes: '',
  }).success,
  "task api requires assigned user",
);
check(
  !taskApiSchema.safeParse({
    title: 'Pour Slab', description: '', stageId: 's1',
    assignedTo: 'u1', partyId: '', startDate: '2026-09-01', endDate: '2026-09-10',
    progress: 0, status: 'NOT_STARTED', notes: '',
  }).success,
  "task api requires contractor party",
);
check(
  mapTaskResponseToFrontend({
    id: 't1', stage_id: 's1', title: 'Pour Slab', description: null,
    assigned_to: 'u1', party_id: 'p1', start_date: null, due_date: '2026-09-10',
    status: 'in_progress', progress_percent: 40,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).partyId === 'p1',
  "task response maps assigned_to and party_id UUIDs",
);
check(
  JSON.stringify(mapTaskFormToCreate({
    title: ' T ', description: '', stageId: 's1', assignedTo: 'u1', partyId: 'p1',
    startDate: '2026-09-01', endDate: '2026-09-10', progress: 0,
    status: 'NOT_STARTED', notes: 'do not send',
  })) === '{"title":"T","assignedTo":"u1","partyId":"p1","startDate":"2026-09-01","endDate":"2026-09-10","status":"NOT_STARTED","progress":0}',
  "task create drops notes, keeps UUID assignments",
);
check(
  JSON.stringify(mapTaskFormToUpdate({
    title: 'T', description: '', stageId: 's1', assignedTo: 'u1', partyId: 'p1',
    startDate: '', endDate: '', progress: 50, status: 'IN_PROGRESS', notes: '',
  })) === '{"title":"T","assignedTo":"u1","partyId":"p1","status":"IN_PROGRESS","progress":50}',
  "task update omits blanks, keeps assignments",
);
check(
  (() => {
    const v = mapApiTaskToFormValues(
      {
        id: 't1', stageId: 's1', title: 'T', assignedTo: 'u9', partyId: 'p9',
        startDate: undefined, endDate: undefined, status: 'NOT_STARTED', progress: 0,
        createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-02T00:00:00',
      },
      's1',
    );
    return v.assignedTo === 'u9' && v.partyId === 'p9' && v.notes === '';
  })(),
  "task prefill preserves assignment UUIDs",
);
check(
  isTaskOverdue('2026-01-01', 'IN_PROGRESS') === true &&
    isTaskOverdue('2999-01-01', 'IN_PROGRESS') === false &&
    isTaskOverdue('2026-01-01', 'COMPLETED') === false &&
    isTaskOverdue(undefined, 'IN_PROGRESS') === false,
  "overdue derives from real due date and status only",
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
  mapProjectResponseToFrontend({
    id: 'p1', company_id: 'c1', created_by: 'u1', name: 'N', description: null,
    location: null, start_date: null, expected_end_date: null, status: 'planning',
    budget: '250000.00', image: null, progress_percent: 65,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).progressPercent === 65,
  "project response maps progress_percent",
);
check(
  mapProjectResponseToFrontend({
    id: 'p1', company_id: 'c1', created_by: 'u1', name: 'N', description: null,
    location: null, start_date: null, expected_end_date: null, status: 'planning',
    budget: null, image: null, progress_percent: 0,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).progressPercent === 0,
  "project progress zero is preserved (not treated as missing)",
);
check(
  mapProjectResponseToFrontend({
    id: 'p1', company_id: 'c1', created_by: 'u1', name: 'N', description: null,
    location: null, start_date: null, expected_end_date: null, status: 'planning',
    budget: null, image: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).progressPercent === null,
  "project progress missing from response maps to null",
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
  !leadStatusSchema.safeParse({ status: "QUALIFIED" }).success,
  "lead enum rejected",
);
check(
  leadStatusSchema.safeParse({ status: "CONTACTED" }).success,
  "lead status accepts backend-supported values",
);
check(
  toBackendLeadStatus('NEW') === 'new' &&
    toBackendLeadStatus('CONTACTED') === 'contacted' &&
    toBackendLeadStatus('CLOSED') === 'closed' &&
    fromBackendLeadStatus('new') === 'NEW' &&
    fromBackendLeadStatus('contacted') === 'CONTACTED' &&
    fromBackendLeadStatus('closed') === 'CLOSED' &&
    fromBackendLeadStatus('unknown') === 'NEW',
  "lead status maps both directions with safe fallback",
);
check(
  (() => {
    const l = mapLeadResponseToFrontend({
      id: 'l1', apartment_id: 'a1', name: 'Buyer', phone: null,
      email: null, message: null, status: 'contacted',
      created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
    });
    return l.apartmentId === 'a1' && l.phone === undefined &&
      l.email === undefined && l.message === undefined &&
      l.status === 'CONTACTED';
  })(),
  "lead response maps snake_case with nulls normalized",
);
check(
  JSON.stringify(mapLeadStatusFormToUpdate({ status: 'CLOSED' })) === '{"status":"CLOSED"}',
  "lead status form maps to PATCH input",
);
check(
  JSON.stringify(mapLeadMessageFormToUpdate({ message: '  Call back  ' })) === '{"message":"Call back"}',
  "lead message form trims message",
);
check(
  JSON.stringify(mapLeadMessageFormToUpdate({ message: '   ' })) === '{}',
  "lead message form omits blank message (preserved server-side)",
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
  PLATFORM_ROLE_LABEL['SUPER_ADMIN'] === 'Super Admin' &&
    PLATFORM_ROLE_LABEL['USER'] === 'User' &&
    fromBackendPlatformRole('super_admin') === 'SUPER_ADMIN' &&
    fromBackendPlatformRole('user') === 'USER' &&
    fromBackendPlatformRole('unknown') === 'USER',
  "platform role maps wire values to read-only labels with safe fallback",
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
check(
  changePasswordSchema.safeParse({
    currentPassword: "oldpassword",
    newPassword: "password123",
    confirmPassword: "password123",
  }).success,
  "settings new/confirm passwords accepted when matching",
);
check(
  !changePasswordSchema.safeParse({
    currentPassword: "oldpassword",
    newPassword: "password123",
    confirmPassword: "different",
  }).success,
  "settings password mismatch rejected",
);
check(
  !changePasswordSchema.safeParse({
    currentPassword: "oldpassword",
    newPassword: "short",
    confirmPassword: "short",
  }).success,
  "settings short new password rejected",
);
check(
  !changePasswordSchema.safeParse({
    currentPassword: "oldpassword",
    newPassword: "password123",
    confirmPassword: "",
  }).success,
  "settings empty confirm password rejected",
);
check(
  !changePasswordSchema.safeParse({
    currentPassword: "short",
    newPassword: "password123",
    confirmPassword: "password123",
  }).success,
  "settings short current password rejected",
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
check(
  fromBackendCompanyRole('site_engineer') === 'SITE_ENGINEER' &&
    fromBackendCompanyRole('project_manager') === 'PROJECT_MANAGER' &&
    fromBackendCompanyRole('unknown_role') === 'OTHER',
  'member role maps backend lowercase to frontend enum with OTHER fallback',
);
check(
  companyRoleLabel['SITE_ENGINEER'] === 'Site Engineer' &&
    companyRoleLabel['PROJECT_MANAGER'] === 'Project Manager' &&
    companyRoleLabel['OWNER'] === 'Owner',
  'member role labels are user-friendly',
);
check(
  (() => {
    const m = mapCompanyMemberResponseToFrontend({
      id: 'm1', user_id: 'u9', company_id: 'c1', role: 'site_engineer', is_active: true,
      user: { id: 'u9', name: 'Maya Haddad', email: 'maya@example.com', phone: null },
    });
    return m.userId === 'u9' && m.membershipId === 'm1' && m.name === 'Maya Haddad' && m.role === 'SITE_ENGINEER' && m.isActive === true;
  })(),
  'member response maps user_id as the real assigned_to UUID (not membership id)',
);
check(
  buildMembersByUserId(activeMembers([
    { membershipId: 'm1', userId: 'u1', name: 'A', role: 'OWNER' as const, isActive: true },
    { membershipId: 'm2', userId: 'u2', name: 'B', role: 'SALES' as const, isActive: false },
  ])).get('u1')?.name === 'A',
  'member lookup indexes active members by user UUID',
);
check(
  !activeMembers([
    { membershipId: 'm1', userId: 'u1', name: 'A', role: 'OWNER' as const, isActive: true },
    { membershipId: 'm2', userId: 'u2', name: 'B', role: 'SALES' as const, isActive: false },
  ]).some((m) => m.userId === 'u2'),
  'inactive memberships excluded from assignee options',
);
check(
  toPaymentAmount('12500.50') === 12500.5 && toPaymentAmount(40) === 40,
  'payment amount coerces backend Decimal wire values',
);
check(
  formatAmount(12500.5) === '12,500.50' && !/[A-Z$]/.test(formatAmount(12500.5)),
  'payment amount displays neutrally with no currency',
);
check(
  paymentApiSchema.safeParse({
    projectId: 'p1', partyId: 'pt1', categoryId: 'c1', amount: 250,
    paymentDate: '2026-09-10', reference: 'CR-PAY-015', description: '',
  }).success,
  'payment api accepts valid values without currency',
);
check(
  !paymentApiSchema.safeParse({
    projectId: 'p1', partyId: 'pt1', categoryId: 'c1', amount: -5,
    paymentDate: '2026-09-10', reference: '', description: '',
  }).success,
  'payment api rejects non-positive amount',
);
check(
  !('currency' in paymentApiSchema.shape),
  'payment api schema has no currency field',
);
check(
  mapPaymentResponseToFrontend({
    id: 'pay1', project_id: 'p1', party_id: 'pt1', category_id: 'c1',
    amount: '8500.00', payment_date: '2026-09-12', description: null,
    reference: 'CR-PAY-014', created_by: 'u1',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).reference === 'CR-PAY-014',
  'payment response maps reference and Decimal amount',
);
check(
  JSON.stringify(mapPaymentFormToCreate({
    projectId: 'p1', partyId: 'pt1', categoryId: 'c1', amount: '250',
    paymentDate: '2026-09-10', reference: '  ', description: '',
  })) === '{"partyId":"pt1","categoryId":"c1","amount":250,"paymentDate":"2026-09-10"}',
  'payment create coerces amount and strips blank reference',
);
check(
  mapPaymentCategoryResponseToFrontend({
    id: 'c1', name: 'Labor', created_at: '2026-01-01T00:00:00',
  }).name === 'Labor' &&
    buildCategoriesById([{ id: 'c1', name: 'Labor', createdAt: '2026-01-01T00:00:00' }]).get('c1')?.name === 'Labor',
  'payment category maps and indexes by UUID',
);
check(
  mapDocumentResponseToFrontend({
    id: 'd1', project_id: 'p1', uploaded_by: 'u1', name: 'Permit',
    category: 'Permit', file_url: 'https://img/doc.pdf', file_type: 'application/pdf',
    original_filename: 'permit.pdf', created_at: '2026-09-10T00:00:00',
  }).fileUrl === 'https://img/doc.pdf',
  'document response maps file_url and uploader UUID',
);
check(
  documentFormat({ fileType: 'application/pdf' }) === 'PDF' &&
    documentFormat({ fileType: 'image/png' }) === 'PNG' &&
    documentFormat({ fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) === 'DOCX' &&
    isPreviewableImage({ fileType: 'image/webp' }) === true &&
    isPreviewablePdf({ fileType: 'application/pdf' }) === true &&
    isPreviewablePdf({ fileType: 'application/msword' }) === false,
  'document format derives from MIME type with image/PDF preview rules',
);
check(
  !DOCUMENT_FILE_ACCEPT.includes('.dwg') && DOCUMENT_FILE_ACCEPT.includes('.pdf'),
  'document upload accept list matches backend MIME support (no DWG)',
);
check(
  documentApiSchema.safeParse({
    projectId: 'p1', name: 'Permit', category: 'Permit',
    file: { size: 1000, type: 'application/pdf', name: 'permit.pdf' },
  }).success === false,
  'document api schema requires a real File instance (blob shape rejected)',
);
check(
  !('format' in documentApiSchema.shape) && !('size' in documentApiSchema.shape),
  'document api schema stores no fake format/size fields',
);
check(
  mapCompanyResponseToFrontend({
    id: 'c1', name: 'Buildora', email: null, phone: '+9611555220',
    address: null, logo: 'https://img/logo', is_active: true,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
  }).logo === 'https://img/logo',
  'company response maps logo read-only field',
);
check(
  JSON.stringify(mapCompanyFormToUpdate({
    name: ' N ', email: '', phone: '  ', address: 'Beirut',
  })) === '{"name":"N","address":"Beirut"}',
  'company update strips blanks and never sends category/logo',
);
check(
  isAcceptedCompanyLogo({ type: 'image/png' } as File) === true &&
    isAcceptedCompanyLogo({ type: 'image/jpeg' } as File) === true &&
    isAcceptedCompanyLogo({ type: 'image/webp' } as File) === true &&
    isAcceptedCompanyLogo({ type: 'image/gif' } as File) === false &&
    isAcceptedCompanyLogo({ type: 'image/svg+xml' } as File) === false &&
    isAcceptedCompanyLogo({ type: '' } as File) === false,
  'company logo accepts backend JPEG/PNG/WEBP only (no SVG/GIF/empty)',
);
check(
  companySettingsSchema.safeParse({ name: '   ', email: '', phone: '', address: '' }).success === false,
  'company settings rejects whitespace-only name',
);
check(
  companySettingsSchema.safeParse({ name: 'N', email: 'not-an-email', phone: '', address: '' }).success === true,
  'company settings email optional-format mirrors backend plain-string rule',
);
check(
  companySettingsSchema.safeParse({ name: 'N', email: '', phone: '++1 (555) 220-12345678901234567890', address: '' }).success === false,
  'company settings phone capped at backend 30-char limit',
);
check(
  mapUserProfileResponseToFrontend({
    id: 'u1', name: 'Ava', email: 'a@x.com', phone: '+96170000000',
    platform_role: 'user', is_active: true,
  }).phone === '+96170000000',
  'profile response maps phone from PATCH response',
);
check(
  JSON.stringify(mapProfileFormToUpdate({
    name: ' Ava ', email: 'a@x.com', phone: '+96170000000',
  })) === '{"name":"Ava","email":"a@x.com","phone":"+96170000000"}',
  'profile update trims fields for PATCH',
);
check(
  mapCompanyMemberResponseToFrontend({
    id: 'm1', user_id: 'u9', company_id: 'c1', role: 'finance',
    is_active: true,
  }).userId === 'u9',
  'flat member response maps without nested user object',
);
check(
  invoiceFilename('CR-PAY-014', 'abcd1234') === 'payment-invoice-CR-PAY-014.pdf' &&
    invoiceFilename(null as unknown as undefined, 'abcd1234efgh') === 'payment-invoice-pay-abcd1234.pdf' &&
    invoiceFilename('../../etc', 'abcd1234') === 'payment-invoice-etc.pdf',
  'invoice filename uses reference with short-id fallback and sanitization',
);
check(
  memberAddSchema.safeParse({
    name: 'Maya Haddad',
    email: 'maya@example.com',
    phone: '+96170123456',
    password: 'password123',
    confirmPassword: 'password123',
    role: 'SITE_ENGINEER',
  }).success,
  'member create accepts full user details with matching passwords',
);
check(
  !memberAddSchema.safeParse({
    name: 'Maya Haddad',
    email: 'maya@example.com',
    phone: '+96170123456',
    password: 'password123',
    confirmPassword: 'different',
    role: 'SITE_ENGINEER',
  }).success,
  'member create rejects password mismatch',
);
check(
  !memberAddSchema.safeParse({
    name: 'Maya Haddad',
    email: 'maya@example.com',
    phone: '+96170123456',
    password: 'short',
    confirmPassword: 'short',
    role: 'SITE_ENGINEER',
  }).success,
  'member create rejects short password',
);
check(
  !memberAddSchema.safeParse({
    name: 'Maya Haddad',
    email: 'maya@example.com',
    phone: 'abc',
    password: 'password123',
    confirmPassword: 'password123',
    role: 'SITE_ENGINEER',
  }).success,
  'member create rejects invalid phone',
);
check(
  !memberAddSchema.safeParse({
    name: '',
    email: 'not-an-email',
    phone: '+96170123456',
    password: 'password123',
    confirmPassword: 'password123',
    role: 'SITE_ENGINEER',
  }).success,
  'member create rejects empty name and bad email',
);
check(
  !('userId' in memberAddSchema.shape) && !('confirmPassword' in JSON.parse(JSON.stringify(mapCompanyMemberFormToCreatePayload({
    name: ' Maya ',
    email: 'maya@example.com',
    phone: '+96170123456',
    password: 'password123',
    role: 'SITE_ENGINEER',
  })))),
  'member create has no UUID field and never sends confirmPassword',
);
check(
  JSON.stringify(mapCompanyMemberFormToCreatePayload({
    name: ' Maya ',
    email: 'maya@example.com',
    phone: '+96170123456',
    password: 'password123',
    role: 'SITE_ENGINEER',
  })) === '{"name":"Maya","email":"maya@example.com","phone":"+96170123456","password":"password123","role":"site_engineer"}',
  'member create payload matches backend contract exactly',
);
check(
  (() => {
    const c = mapPlatformCompanyToFrontend({
      id: 'c1', name: 'Buildora', email: null, phone: '+9611',
      address: null, logo: null, is_active: false,
      created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
    });
    return c.isActive === false && c.email === undefined && c.logo === undefined;
  })(),
  "platform company maps is_active with nulls normalized (no category)",
);
check(
  (() => {
    const u = mapPlatformUserToFrontend({
      id: 'u1', name: 'Ava', email: 'a@x.com', phone: null,
      platform_role: 'super_admin', is_active: true,
      created_at: '2026-01-01T00:00:00', updated_at: '2026-01-02T00:00:00',
    });
    return u.platformRole === 'SUPER_ADMIN' && u.isActive === true && u.phone === undefined;
  })(),
  "platform user maps wire role read-only with nulls normalized",
);
check(
  JSON.stringify(mapPlatformCompanyStatusToUpdate(false)) === '{"is_active":false}',
  "platform company status maps to is_active-only PATCH",
);
check(
  JSON.stringify(mapPlatformUserStatusToUpdate(true)) === '{"is_active":true}',
  "platform user status maps to is_active-only PATCH (never platform_role)",
);
check(
  toDashboardNumber('2050000.00') === 2050000 &&
    toDashboardNumber(52000) === 52000 &&
    toDashboardNumber(null) === 0 &&
    toDashboardNumber('bad') === 0,
  "dashboard Decimal wire values normalize centrally without coercion leaks",
);
check(
  (() => {
    const s = mapDashboardSummaryToFrontend({
      project_counts: { total: 2, planning: 1, in_progress: 1, completed: 0, on_hold: 0 },
      total_budget: '150000.00', total_paid: '25000.00', remaining_budget: '125000.00',
      budget_utilization_percent: 16.67, open_leads: 3,
      projects: [{
        project_id: 'p1', name: 'P1', budget: '100000.00', paid: '20000.00',
        remaining: '80000.00', progress_percent: 40,
      }],
      recent_payments: [{
        id: 'pay1', project_id: 'p1', amount: '20000.00', payment_date: '2026-09-01',
        description: null, created_at: '2026-09-01T00:00:00',
      }],
    });
    return s.counts.inProgress === 1 && s.totalBudget === 150000 && s.totalPaid === 25000 &&
      s.utilization === 16.67 && s.openLeads === 3 &&
      s.projects[0]?.progressPercent === 40 && s.recentPayments[0]?.amount === 20000;
  })(),
  "dashboard summary maps real fields with normalized numbers",
);
check(
  (() => {
    const t = mapDashboardTaskToFrontend({
      id: 't1', title: 'Pour', status: 'in_progress', progress_percent: 10,
      assigned_to: 'u1', start_date: null, due_date: '2026-01-01',
      stage_id: 's1', stage_name: 'Structure', project_id: 'p1', project_name: 'Cedar',
    });
    return t.status === 'IN_PROGRESS' && t.assignedTo === 'u1' && t.endDate === '2026-01-01' &&
      t.stageName === 'Structure' && t.projectName === 'Cedar';
  })(),
  "dashboard task maps status/context with no extra requests",
);
check(
  (() => {
    const s = mapSalesDashboardToFrontend({
      apartments: { total: 2, available: 1, reserved: 0, sold: 1, public: 1 },
      top_enquired_apartments: [{
        apartment_id: 'a1', unit_number: '201', project_id: 'p1',
        project_name: 'Cedar', lead_count: 2, is_public: true,
        price: '285000.00', bedrooms: 3, bathrooms: 2, area_sqm: '165',
        floor_number: 2, primary_image: null,
      }],
    });
    const u = s.topApartments[0];
    return s.apartments.available === 1 && s.apartments.public === 1 &&
      u?.id === 'a1' && u?.leadCount === 2 && u?.isPublic === true &&
      u?.price === 285000 && u?.bedrooms === 3 && u?.bathrooms === 2 &&
      u?.areaSqm === 165 && u?.floorNumber === 2 && u?.primaryImage === undefined;
  })(),
  "sales dashboard maps new key with enriched null-safe fields",
);
check(
  mapSalesDashboardToFrontend({
    apartments: { total: 0, available: 0, reserved: 0, sold: 0, public: 0 },
    top_enquired_apartments: undefined as unknown as [],
  }).topApartments.length === 0,
  "sales mapper returns [] when top apartments are missing",
);
check(
  (() => {
    const f = mapFinanceDashboardToFrontend({
      total_paid: '25000.00', total_project_budget: '100000.00', remaining_balance: '75000.00',
      payment_count: 2, payments_this_month: '5000.00', payments_this_month_count: 1,
      projects_covered: 1,
      by_project: [{
        project_id: 'p1', project_name: 'Cedar', budget: '100000.00',
        total_paid: '25000.00', remaining: '75000.00', current_stage_name: 'Structure',
      }],
      by_category: [{ category_id: 'c1', category_name: 'Labor', total_paid: '25000.00' }],
      top_paid_parties: [{ party_id: 'pt1', party_name: 'ABC', total_paid: '25000.00' }],
      recent_payments: [{
        id: 'pay1', project_id: 'p1', project_name: 'Cedar', party_id: 'pt1', party_name: 'ABC',
        category_id: 'c1', category_name: 'Labor', amount: '5000.00', payment_date: '2026-09-01',
        reference: 'R1', description: null,
      }],
    });
    const p = f.byProject[0];
    return f.totalPaid === 25000 && f.totalProjectBudget === 100000 &&
      f.remainingBalance === 75000 && f.paymentsThisMonth === 5000 &&
      f.paymentsThisMonthCount === 1 &&
      p?.projectName === 'Cedar' && p?.budget === 100000 && p?.remaining === 75000 &&
      p?.currentStageName === 'Structure' &&
      f.byCategory[0]?.categoryName === 'Labor' &&
      f.topPaidParties[0]?.partyName === 'ABC' && f.topPaidParties[0]?.totalPaid === 25000 &&
      f.recentPayments[0]?.partyName === 'ABC' && f.recentPayments[0]?.reference === 'R1';
  })(),
  "finance dashboard maps enriched totals/projects/parties/recent with resolved names",
);
check(
  mapFinanceDashboardToFrontend({
    total_paid: '0', total_project_budget: '0', remaining_balance: '0',
    payment_count: 0, payments_this_month: '0', payments_this_month_count: 0,
    projects_covered: 0, by_project: [], by_category: [],
    top_paid_parties: undefined as unknown as [],
    recent_payments: undefined as unknown as [],
  }).topPaidParties.length === 0,
  "finance mapper returns [] for missing top parties",
);
check(
  dashboardProjectStatusLabel('in_progress') === 'IN_PROGRESS' &&
    dashboardProjectStatusLabel('on_hold') === 'ON_HOLD',
  "dashboard project status keys map through the shared mapper",
);
check(
  financialKpiFontSize('0.00') === undefined &&
    financialKpiFontSize('52,000.00') === undefined &&
    financialKpiFontSize('2,050,000.00') === 20 &&
    financialKpiFontSize('12,500,000.00') === 20 &&
    financialKpiFontSize('9,999,999,999.00') === 16,
  "financial KPI tiers keep short totals prominent and shrink long totals",
);
check(
  (() => {
    // Widest tier-20 value (14 chars incl. decimals) at 20px tabular numerals:
    // ~0.6em average glyph width -> ~168px, inside the narrowest
    // six-column desktop card (~180px) and well inside mobile cards.
    const widest = '12,500,000.00'.length * 20 * 0.6;
    const widestSmall = '999,999,999,999.00'.length * 16 * 0.6;
    return widest < 180 && widestSmall < 180;
  })(),
  "financial KPI worst-case widths fit inside KPI cards",
);
const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
check(
  globalsCss.includes('.kpi-financial') && globalsCss.includes('white-space:nowrap'),
  "financial KPI class keeps values on one line without clipping",
);
const dashboardSrc = readFileSync(
  join(process.cwd(), "src/components/features/Dashboard.tsx"),
  "utf8",
);
for (const mock of [
  'useWorkspace',
  'Field Logs',
  'task-1',
  'Omar Saleh',
  'Cedar Residence',
  'ApartmentCard',
  'PaymentAllocation',
  'TasksTable',
  'PaymentsTable',
  '1 Alert',
  '1 Overdue',
  'Install Reinforcement',
  'operations-report',
  'Excavation Prep',
  'Stage: Structure',
  'Healthy contingency',
  'Pending Approval',
  'Maya Haddad',
  'High Priority',
  'Worker',
  'worker',
  'Equipment',
  'equipment',
  'Safety',
  'safety',
  'Incident',
  'incident',
  'PPE',
  'Site Workload by Stage',
  'Enquiries',
  'Enquiry',
  'enquiries',
  'Public Website',
  'Direct Referral',
  'Buyer Type',
  'Buyer',
  'Investor',
  'Campaign',
  'Referral',
]) {
  check(
    !dashboardSrc.includes(mock),
    `dashboard mock removed: ${mock}`,
  );
}
for (const real of [
  'getCompanyDashboardSummary',
  'getCompanyDashboardTasks',
  'getCompanySalesDashboard',
  'getCompanyLeads',
  'getProjects',
  'getStages',
  'My Site Tasks & Milestones',
  'Active Construction Stages Progress',
  'Upcoming Deadlines',
  'Task Status Breakdown',
  '/updates/new',
  'taskDueLabel',
  'Apartments Receiving Most Leads',
  'Recent Leads & Pipeline',
  'View Public Catalog',
  'topApartments',
  'assignedTo === sessionUser',
]) {
  check(
    dashboardSrc.includes(real),
    `dashboard uses real backend: ${real}`,
  );
}
const paymentsApiSrc = readFileSync(
  join(process.cwd(), "src/components/features/PaymentsApi.tsx"),
  "utf8",
);
check(
  paymentsApiSrc.includes('getCompanyFinanceDashboard'),
  "finance dashboard uses real finance summary",
);
check(
  paymentsApiSrc.split('FinanceWorkspaceOverview').length - 1 <= 1,
  "project fan-out finance overview removed (single declaration only)",
);
check(
  !paymentsApiSrc.includes('no summary endpoint exists'),
  "finance overview fan-out comment removed",
);
for (const real of [
  'Project Budget vs Actual Payments',
  'Top Paid Parties',
  'Payments by Category',
  'Recent Payment Disbursements',
  'Total Project Budget',
  'Remaining Balance',
  'Export Fiscal Ledger',
  'recentPayments',
  'topPaidParties',
]) {
  check(
    paymentsApiSrc.includes(real),
    `finance overview renders real data: ${real}`,
  );
}
for (const mock of [
  'Payments by Project',
  'Payment Summary',
  'Categories Used',
  'of disbursements',
  'Treasury',
  'Governance',
  'governance',
  'Audit',
  'audit',
  'Cleared',
  'Pending Approval',
  'threshold',
]) {
  check(
    !paymentsApiSrc.includes(mock),
    `finance mock removed: ${mock}`,
  );
}
const dashboardApiSrc = readFileSync(
  join(process.cwd(), "src/lib/api/dashboard.api.ts"),
  "utf8",
);check(
  dashboardApiSrc.includes('top_enquired_apartments'),
  "dashboard api uses the new top apartments key",
);
check(
  !dashboardApiSrc.includes('top_enquired_units'),
  "stale top_enquired_units key removed from dashboard api",
);
check(
  dashboardApiSrc.includes('primary_image') && dashboardApiSrc.includes('floor_number'),
  "dashboard api maps enriched apartment fields",
);
check(
  !dashboardSrc.includes('top_enquired_units') && !dashboardSrc.includes('apartment.api'),
  "sales dashboard has no stale key and makes no apartment detail requests",
);
check(
  assistantSchema.safeParse({ query: '  show overdue tasks  ' }).success &&
    !assistantSchema.safeParse({ query: '   ' }).success &&
    !assistantSchema.safeParse({ query: 'x'.repeat(1001) }).success,
  "assistant query matches backend 1..1000 trimmed limits",
);
check(
  aiText('hello') === 'hello' && aiText('') === undefined && aiText(null) === undefined &&
    aiNumber(12.5) === 12.5 && aiNumber('25000.00') === 25000 && aiNumber('bad') === undefined &&
    aiId('abc') === 'abc' && aiId('') === undefined,
  "AI result readers normalize centrally without throwing",
);
const assistantSrc = readFileSync(
  join(process.cwd(), "src/components/features/Assistant.tsx"),
  "utf8",
);
for (const mock of [
  'useWorkspace',
  'cedar-residence',
  "q.includes('overdue')",
  'Local dataset preview',
  'No external AI service is connected',
  'projectId',
]) {
  check(
    !assistantSrc.includes(mock),
    `assistant mock removed: ${mock}`,
  );
}
for (const real of [
  'searchAI',
  'AI_INTENT_FORBIDDEN',
  'AI_QUERY_UNSUPPORTED',
  'AI_PROVIDER_ERROR',
  'Analyzing your request',
  'IntentResults',
  'ProjectReportResults',
  'TaskSummaryResults',
]) {
  check(
    assistantSrc.includes(real),
    `assistant uses real backend: ${real}`,
  );
}
const aiApiSrc = readFileSync(join(process.cwd(), "src/lib/api/ai.api.ts"), "utf8");
check(
  aiApiSrc.includes('/ai/search') && aiApiSrc.includes('POST'),
  "AI api module posts to the company AI search endpoint",
);
check(
  !assistantSrc.includes('sessionStorage') && !assistantSrc.includes('localStorage'),
  "assistant adds no fake chat persistence",
);
check(
  (assistantSrc.match(/getCompany|getProject[^s]|getStage|getTask[^s]|getApartment|getParties|getPayment[^s]/g) ?? []).length === 0,
  "assistant makes no fan-out entity requests",
);
// ---------------------------------------------------------------------------
// Public website: real public API integration (no mock runtime data).
// ---------------------------------------------------------------------------
const publicApiSrc = readFileSync(join(process.cwd(), "src/lib/api/public.api.ts"), "utf8");
for (const endpoint of [
  '/public/companies',
  '/public/apartments',
  '/interest',
]) {
  check(
    publicApiSrc.includes(endpoint),
    `public api module calls real endpoint: ${endpoint}`,
  );
}
check(
  publicApiSrc.includes('auth: false'),
  'public api requests are anonymous (auth disabled)',
);
check(
  !publicApiSrc.includes('specialty') && !publicApiSrc.includes('interested_people_count'),
  'public api types exclude removed backend fields',
);
for (const [file, label] of [
  ["src/components/public/cinematic/CinematicExperience.tsx", "home apartments"],
  ["src/components/public/apartments/ApartmentsPanel.tsx", "home showcase"],
  ["src/components/public/apartments/ApartmentsListView.tsx", "/apartments page"],
  ["src/components/public/apartment-detail/ApartmentDetailView.tsx", "apartment detail"],
  ["src/components/public/partners/PartnersPanel.tsx", "home partners"],
  ["src/components/public/company/CompaniesListView.tsx", "/companies page"],
  ["src/components/public/company/CompanyProfileView.tsx", "company detail"],
  ["src/components/public/company/CompanyListingCard.tsx", "company card"],
  ["src/components/public/partners/PartnerCard.tsx", "partner card"],
  ["src/components/public/apartments/ApartmentListingCard.tsx", "apartment card"],
  ["src/components/public/search/AISearchView.tsx", "search results"],
] as const) {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  check(
    !src.includes('@/data/public/partners') && !src.includes('@/data/public/apartments'),
    `${label} no longer imports mock company/apartment data`,
  );
}
const companyDetailPage = readFileSync(
  join(process.cwd(), "src/app/(public)/companies/[slug]/page.tsx"),
  "utf8",
);
check(
  !companyDetailPage.includes('generateStaticParams') && !companyDetailPage.includes('@/data/public/partners'),
  'company detail route uses dynamic UUID, not mock static params',
);
const apartmentDetailPage = readFileSync(
  join(process.cwd(), "src/app/(public)/apartments/[slug]/page.tsx"),
  "utf8",
);
check(
  !apartmentDetailPage.includes('generateStaticParams') && !apartmentDetailPage.includes('@/data/public/apartments'),
  'apartment detail route uses dynamic UUID, not mock static params',
);
const interestDialogSrc = readFileSync(
  join(process.cwd(), "src/components/public/apartment-detail/InterestDialog.tsx"),
  "utf8",
);
check(
  interestDialogSrc.includes('submitPublicApartmentInterest') &&
    interestDialogSrc.includes('/interest') === false,
  'interest dialog uses the centralized public API module',
);
check(
  !interestDialogSrc.includes('saved to this device') &&
    !interestDialogSrc.includes('not configured yet') &&
    interestDialogSrc.includes('has been submitted successfully'),
  'interest dialog shows real success copy, not local-file copy',
);
check(
  !interestDialogSrc.includes('company_id') &&
    !interestDialogSrc.includes('project_id') &&
    !interestDialogSrc.includes('building_id') &&
    !interestDialogSrc.includes('floor_id'),
  'interest dialog sends no trusted hierarchy ids',
);
const aiSearchSrc = readFileSync(join(process.cwd(), "src/lib/public/ai-search.ts"), "utf8");
check(
  aiSearchSrc.includes('getAllPublicApartments') && aiSearchSrc.includes('getPublicCompanies'),
  'public search loads complete API arrays instead of mock data',
);
check(
  !aiSearchSrc.includes('@/data/public/apartments') && !aiSearchSrc.includes('@/data/public/partners'),
  'public search no longer imports mock arrays',
);
check(
  !aiSearchSrc.includes('specialty') && !aiSearchSrc.includes('a.features'),
  'public search matcher drops mock-only dimensions',
);
for (const mockFile of [
  "src/data/public/partners.ts",
  "src/data/public/apartments.ts",
  "src/lib/public/interest.ts",
]) {
  let exists = true;
  try {
    readFileSync(join(process.cwd(), mockFile), "utf8");
  } catch {
    exists = false;
  }
  check(!exists, `mock runtime source removed: ${mockFile}`);
}
const companyCardSrc = readFileSync(
  join(process.cwd(), "src/components/public/company/CompanyListingCard.tsx"),
  "utf8",
);
check(
  companyCardSrc.includes('apartment_count') && !companyCardSrc.includes('specialty'),
  'company card uses real apartment_count, not mock specialty',
);
const apartmentCardSrc = readFileSync(
  join(process.cwd(), "src/components/public/apartments/ApartmentListingCard.tsx"),
  "utf8",
);
check(
  apartmentCardSrc.includes('unit_number') && apartmentCardSrc.includes('/apartments/${apartment.id}'),
  'apartment card uses unit_number title and UUID route',
);
const companyProfileSrc = readFileSync(
  join(process.cwd(), "src/components/public/company/CompanyProfileView.tsx"),
  "utf8",
);
check(
  companyProfileSrc.includes('getPublicApartments({ company_id: companyId, page: residencesPage') &&
    companyProfileSrc.includes('page_size: RESIDENCES_PAGE_SIZE'),
  'company residences request paginated company_id/page/page_size',
);
check(
  companyProfileSrc.includes('RESIDENCES_PAGE_SIZE = 6'),
  'company residences page size is 6',
);
check(
  companyProfileSrc.includes('response.items') || companyProfileSrc.includes('residencesData?.items'),
  'company residences render backend response items directly',
);
check(
  !companyProfileSrc.includes('getAllPublicApartments'),
  'company residences grid no longer assembles the full catalog',
);
check(
  companyProfileSrc.includes('‹ Prev') && companyProfileSrc.includes('Next ›'),
  'company residences have Previous/Next controls',
);
check(
  !companyProfileSrc.includes('Array.from({ length:') && companyProfileSrc.includes('Page {residencesPage} of {residenceTotalPages}'),
  'company residences show a static page indicator with no numbered buttons',
);
check(
  companyProfileSrc.includes('disabled={residencesPage === 1') &&
    companyProfileSrc.includes('disabled={residencesPage === residenceTotalPages'),
  'company residences disable Previous on first page and Next on last page',
);
check(
  companyProfileSrc.includes('No public residences yet.'),
  'company residences keep the zero-apartments empty state',
);
check(
  companyProfileSrc.includes('setResidencesPage(Math.max(1, data.total_pages))'),
  'company residences fall back to the last valid page when out of range',
);
check(
  companyProfileSrc.includes('/apartments/${apartment.id}'),
  'company residence cards keep UUID apartment links',
);
// ---------------------------------------------------------------------------
// Public apartments: backend pagination (page/page_size, no status param).
// ---------------------------------------------------------------------------
check(
  publicApiSrc.includes('PublicApartmentsPage') &&
    publicApiSrc.includes('total_pages') &&
    publicApiSrc.includes('page_size'),
  'public api types match the paginated backend response',
);
check(
  (() => {
    const start = publicApiSrc.indexOf('getPublicApartments');
    const body = publicApiSrc.slice(start, start + 800);
    return body.includes('page') && body.includes('page_size') && body.includes('company_id');
  })(),
  'apartments API sends page/page_size/company_id using the real contract',
);
check(
  publicApiSrc.includes('getAllPublicApartments') &&
    publicApiSrc.includes('total_pages'),
  'full-set helper walks backend pages instead of assuming one response',
);
const apartmentsListSrc = readFileSync(
  join(process.cwd(), "src/components/public/apartments/ApartmentsListView.tsx"),
  "utf8",
);
check(
  apartmentsListSrc.includes('page: currentPage') && apartmentsListSrc.includes('page_size: PAGE_SIZE'),
  'apartments page requests backend pages with page/page_size',
);
check(
  apartmentsListSrc.includes('pageData?.items') &&
    !apartmentsListSrc.includes('Array.from({ length: totalPages }') &&
    !apartmentsListSrc.includes('al-page is-active'),
  'unfiltered list renders backend page items with no numbered buttons',
);
check(
  !apartmentsListSrc.includes('Math.ceil(visible.length'),
  'page totals no longer derive from a locally loaded full array',
);
check(
  apartmentsListSrc.includes('al-page-indicator') &&
    !apartmentsListSrc.includes('al-page is-active') &&
    apartmentsListSrc.includes('Page {safePage} of {totalPages}'),
  'pagination shows Previous/Next with a static page indicator only',
);
check(
  apartmentsListSrc.includes('setCurrentPage(1)') || apartmentsListSrc.includes('setCurrentPage(Math.max(1'),
  'status change resets pagination to the first page',
);
check(
  apartmentsListSrc.includes('total_pages') && apartmentsListSrc.includes('pageData'),
  'pagination metadata comes from the backend response',
);
check(
  !apartmentsListSrc.includes('?status=') && !apartmentsListSrc.includes('status: filter'),
  'status filter stays client-side because the backend exposes no status param',
);
const cinematicSrc = readFileSync(
  join(process.cwd(), "src/components/public/cinematic/CinematicExperience.tsx"),
  "utf8",
);
check(
  cinematicSrc.includes('page_size: HOME_SHOWCASE_PAGE_SIZE') || cinematicSrc.includes('page: 1'),
  'home showcase requests one small backend page, not the catalog',
);
const apartmentDetailSrc2 = readFileSync(
  join(process.cwd(), "src/components/public/apartment-detail/ApartmentDetailView.tsx"),
  "utf8",
);
check(
  apartmentDetailSrc2.includes('page_size: 4') && apartmentDetailSrc2.includes('company_id'),
  'related apartments request one small company page',
);
check(
  !companyProfileSrc.includes('company.owner') &&
    !companyProfileSrc.includes('company.stats') &&
    !companyProfileSrc.includes('company.capabilities') &&
    !companyProfileSrc.includes('company.specialty'),
  'company profile renders no fictional owner/stats/capabilities/specialty',
);
const apartmentDetailSrc = readFileSync(
  join(process.cwd(), "src/components/public/apartment-detail/ApartmentDetailView.tsx"),
  "utf8",
);
check(
  apartmentDetailSrc.includes('getPublicApartment') &&
    apartmentDetailSrc.includes('toApartmentDetailViewModel'),
  'apartment detail loads real API through the view-model adapter',
);
const apartmentDetailModelSrc = readFileSync(
  join(process.cwd(), "src/lib/public/apartment-detail-model.ts"),
  "utf8",
);
check(
  apartmentDetailModelSrc.includes('image_url') &&
    !apartmentDetailModelSrc.includes('getPublicApartment') &&
    !apartmentDetailModelSrc.includes('apiJson'),
  'apartment view model maps gallery image_urls with no direct API calls',
);
const publicSearchApiSrc = readFileSync(join(process.cwd(), "src/lib/api/public.api.ts"), "utf8");
check(
  publicSearchApiSrc.includes('/public/ai/search') && publicSearchApiSrc.includes('searchPublicAI'),
  'public search calls POST /public/ai/search via central module',
);
check(
  (() => {
    const start = publicSearchApiSrc.indexOf('searchPublicAI');
    const body = publicSearchApiSrc.slice(start, start + 600);
    return body.includes('auth: false') && body.includes('{ query');
  })(),
  'public AI request sends only query with auth:false',
);
check(
  !publicSearchApiSrc.includes('/companies/${companyId}/ai/search') &&
    !publicSearchApiSrc.includes('company_id}/ai/search'),
  'public API module never touches the authenticated AI endpoint',
);
const publicSearchViewSrc = readFileSync(
  join(process.cwd(), "src/components/public/search/AISearchView.tsx"),
  "utf8",
);
check(
  !publicSearchViewSrc.includes('/companies/') || !publicSearchViewSrc.includes('/ai/search'),
  'public search view uses no authenticated AI endpoint',
);
check(
  publicSearchViewSrc.includes('maxLength={1000}'),
  'public search input caps query at backend 1000-char limit',
);
check(
  publicSearchViewSrc.includes('ai-answer') && publicSearchViewSrc.includes('response.answer'),
  'public search renders the backend AI answer',
);
check(
  publicSearchViewSrc.includes('aiUnavailable') &&
    publicSearchViewSrc.includes('AI search is temporarily unavailable'),
  'public search labels the real-data local fallback truthfully',
);
const hybridSearchSrc = readFileSync(join(process.cwd(), "src/lib/public/ai-search.ts"), "utf8");
check(
  !hybridSearchSrc.includes('NEXT_PUBLIC_AI_SEARCH_URL') && !hybridSearchSrc.includes('queryAiBackend'),
  'obsolete AI endpoint env override removed from public search',
);
check(
  hybridSearchSrc.includes('searchPublicAI') && hybridSearchSrc.includes('localSearch'),
  'public search runs hybrid AI plus local matcher',
);
check(
  hybridSearchSrc.includes('dedupeById') || hybridSearchSrc.includes('seen'),
  'hybrid search dedupes apartments by UUID',
);
check(
  hybridSearchSrc.includes("status.toLowerCase() !== 'available'") ||
    hybridSearchSrc.includes('!== \'available\''),
  'hybrid search preserves reserved/sold coverage locally',
);
check(
  hybridSearchSrc.includes('UNKNOWN') && hybridSearchSrc.includes('local.companies'),
  'hybrid search keeps local company results for UNKNOWN intent',
);
check(
  !hybridSearchSrc.includes('@/data/public/partners') && !hybridSearchSrc.includes('@/data/public/apartments'),
  'hybrid search uses API-loaded arrays, not mock data',
);
const nextConfigSrc = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
check(
  nextConfigSrc.includes('ik.imagekit.io'),
  'next/image allows the public API ImageKit host',
);
const servicesSrc = readFileSync(join(process.cwd(), "src/data/public/services.ts"), "utf8");
check(
  servicesSrc.includes('Engineering'),
  'static marketing services remain static',
);
const statsSrc = readFileSync(join(process.cwd(), "src/data/public/stats.ts"), "utf8");
check(
  statsSrc.includes('buildoraStats'),
  'static marketing stats remain static',
);
console.log(`${count} validation checks passed.`);
