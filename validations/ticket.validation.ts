import { z } from 'zod';

export const createTicketSchema = z.object({
  asset_id: z.coerce.number().positive('Asset is required'),
  employee_id: z.coerce.number().positive('Employee is required'),
  issue_category: z.string().min(2, 'Issue category is required'),
  issue_description: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  attachment_url: z.string().optional().nullable(),
  raised_building: z.string().trim().default('The Space'),
  raised_floor: z.string().trim().default('5th Floor'),
  raised_workstation: z
    .string()
    .trim()
    .min(1, 'Workstation / Desk number is required')
    .optional(),
});

export const updateTicketSchema = z.object({
  status: z
    .enum(['new', 'assigned', 'in_progress', 'waiting_for_user', 'resolved', 'closed'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: z.coerce.number().nullable().optional(),
  assigned_to_user_id: z.coerce.number().nullable().optional(),
  raised_workstation: z.string().trim().min(1, 'Workstation cannot be empty').optional().nullable(),
  resolution: z.string().nullable().optional(),
  comment: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
