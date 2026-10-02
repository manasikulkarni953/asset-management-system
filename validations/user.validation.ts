import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['super_admin', 'admin', 'employee'], {
    message: 'Role must be strictly super_admin, admin, or employee',
  }),
  designation: z.string().trim().optional().nullable(),
  employee_id: z.string().trim().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['super_admin', 'admin', 'employee']).optional(),
  designation: z.string().trim().optional().nullable(),
  employee_id: z.string().trim().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
