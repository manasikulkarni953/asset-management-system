import { z } from 'zod';

export const assignAssetSchema = z
  .object({
    action: z.literal('assign').optional(),
    asset_id: z.coerce.number().positive().optional(),
    asset_ids: z.array(z.coerce.number().positive()).optional(),
    assetIds: z.array(z.coerce.number().positive()).optional(),
    employee_id: z.coerce.number().positive().optional(),
    employeeId: z.coerce.number().positive().optional(),
    condition: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) => Boolean(data.employee_id || data.employeeId),
    { message: 'Employee is required', path: ['employeeId'] }
  )
  .refine(
    (data) => {
      const list = data.assetIds || data.asset_ids || (data.asset_id ? [data.asset_id] : []);
      return list.length > 0;
    },
    { message: 'At least one asset must be selected for assignment', path: ['assetIds'] }
  )
  .refine(
    (data) => {
      const list = data.assetIds || data.asset_ids || (data.asset_id ? [data.asset_id] : []);
      const unique = new Set(list);
      return unique.size === list.length;
    },
    { message: 'Duplicate asset IDs are not permitted in a single assignment request', path: ['assetIds'] }
  );

export const transferAssetSchema = z.object({
  asset_id: z.coerce.number().positive('Asset ID is required'),
  to_employee_id: z.coerce.number().positive('Target employee is required'),
  notes: z.string().optional().nullable(),
});

export const returnAssetSchema = z.object({
  asset_id: z.coerce.number().positive('Asset ID is required'),
  return_to: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type AssignAssetInput = z.infer<typeof assignAssetSchema>;
export type TransferAssetInput = z.infer<typeof transferAssetSchema>;
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;
