import { apiForm } from './client';

export interface CreateCompanyPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: File;
}

export interface CreateCompanyResult {
  message: string;
}

function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned : undefined;
}

export async function createCompany(payload: CreateCompanyPayload): Promise<CreateCompanyResult> {
  const form = new FormData();
  form.set('name', payload.name.trim());

  const email = cleanOptional(payload.email);
  const phone = cleanOptional(payload.phone);
  const address = cleanOptional(payload.address);

  if (email) form.set('email', email);
  if (phone) form.set('phone', phone);
  if (address) form.set('address', address);
  if (payload.logo) form.set('logo', payload.logo);

  return apiForm<CreateCompanyResult>('/companies/', form, { method: 'POST' });
}
