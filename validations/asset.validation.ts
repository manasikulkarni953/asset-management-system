import { z } from 'zod';

export const createAssetSchema = z.object({
  category: z.string().trim().min(2, 'Category must be at least 2 characters'),
  brand: z.string().trim().min(1, 'Brand is required'),
  model: z.string().trim().min(1, 'Model is required'),
  serial_number: z.string().trim().min(1, 'Hardware serial number is required'),
  purchase_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid purchase date is required (YYYY-MM-DD)'),
  purchase_cost: z.coerce.number().min(0, 'Purchase cost must be a positive number'),
  vendor: z.string().trim().min(1, 'Vendor is required'),
  warranty_expiry: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid warranty date required (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  status: z.enum(['in_stock', 'assigned', 'under_maintenance', 'retired']).default('in_stock'),
  current_employee_id: z.coerce.number().nullable().optional(),
});

export const updateAssetSchema = createAssetSchema.partial().extend({
  status: z.enum(['in_stock', 'assigned', 'under_maintenance', 'retired']).optional(),
});

export const insuranceSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  policy_number: z.string().min(1, 'Policy number is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid start date required'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid expiry date required'),
  coverage_amount: z.coerce.number().min(0, 'Coverage amount must be 0 or more'),
  document_url: z.string().nullable().optional(),
  status: z.enum(['active', 'expiring', 'expired']).default('active'),
});

export const networkSchema = z.object({
  ip_address: z.string().nullable().optional().or(z.literal('')),
  mac_address: z.string().nullable().optional().or(z.literal('')),
  hostname: z.string().nullable().optional().or(z.literal('')),
  network_name: z.string().nullable().optional().or(z.literal('')),
  vlan: z.string().nullable().optional().or(z.literal('')),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type InsuranceInput = z.infer<typeof insuranceSchema>;
export type NetworkInput = z.infer<typeof networkSchema>;
