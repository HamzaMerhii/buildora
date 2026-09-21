import { z } from 'zod';
import { projectSchema } from '../validations/project.schema';
import { apartmentSchema } from '../validations/apartment.schema';
import { stageSchema } from '../validations/construction-stage.schema';
import { taskSchema } from '../validations/task.schema';
import { partySchema } from '../validations/party.schema';
import { paymentSchema } from '../validations/payment.schema';
import { buildingSchema } from '../validations/building.schema';
import { floorSchema } from '../validations/floor.schema';
import { memberSchema, companySchema } from '../validations/company.schema';
export type Project = z.output<typeof projectSchema> & { id:string; image:string; progress:number; paid:number; units:number; buildings:number };
export type Apartment = z.output<typeof apartmentSchema> & { id:string; image:string };
export type Stage = z.output<typeof stageSchema> & { id:string; progress:number };
export type Task = z.output<typeof taskSchema> & { id:string };
export type Party = z.output<typeof partySchema> & { id:string };
export type Payment = z.output<typeof paymentSchema> & { id:string };
export type Building = z.output<typeof buildingSchema> & { id:string };
export type Floor = z.output<typeof floorSchema> & { id:string };
export type Member = z.output<typeof memberSchema> & { id:string; platformRole:'SUPER_ADMIN'|'USER' };
export type Company = z.output<typeof companySchema> & { id:string; active:boolean };
export interface Lead { id:string; name:string; email?:string; phone?:string; apartmentId:string; status:'NEW'|'CONTACTED'|'CLOSED'; message:string; date:string; notes:string[] }
export interface DocumentRecord { id:string; projectId:string; name:string; category:'Agreement'|'Plan'|'Permit'|'Other'; format:string; size:string; date:string; url?:string }
export interface Category { id:string; name:string; description?:string }
export interface TaskUpdate { id:string; taskId:string; progress:number; notes?:string; date:string; photo?:string }
export interface Land { area:number; parcel:string; maxHeight:number; ratio:number; constraints?:string; notes?:string }
export interface WorkspaceData { projects:Project[]; apartments:Apartment[]; stages:Stage[]; tasks:Task[]; parties:Party[]; payments:Payment[]; buildings:Building[]; floors:Floor[]; members:Member[]; companies:Company[]; leads:Lead[]; documents:DocumentRecord[]; categories:Category[]; updates:TaskUpdate[]; land:Land; profile:{name:string; email:string; phone?:string} }
