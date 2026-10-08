import { z } from 'zod';

export const createEmployeeSchema = z.object({
  employee_id: z.string().trim().optional().nullable(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  department: z.string().min(2, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  location: z.string().trim().default('The Space'),
  workstation: z.string().trim().optional().nullable(),
  phone_number: z.string().trim().optional().nullable(),
  status: z.enum(['active', 'on_leave', 'terminated']).default('active'),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
