import { AuthUser } from './auth';

export type UserRole = 'super_admin' | 'admin' | 'employee';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
  employee: 1,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === 'super_admin';
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

export function isEmployee(user: AuthUser | null): boolean {
  return user?.role === 'employee';
}

export const Permissions = {
  // Dashboard: SUPER_ADMIN FULL, ADMIN YES, EMPLOYEE NO
  canViewEnterpriseDashboard: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Assets: SUPER_ADMIN FULL, ADMIN MANAGE, EMPLOYEE OWN/ASSIGNED
  canManageAssets: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Employees: SUPER_ADMIN FULL, ADMIN MANAGE, EMPLOYEE OWN PROFILE
  canManageEmployees: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Assignment: SUPER_ADMIN FULL, ADMIN MANAGE, EMPLOYEE NO
  canAssignAssets: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Barcode Scan: SUPER_ADMIN YES, ADMIN YES, EMPLOYEE AUTHORIZED
  canScanBarcode: (user: AuthUser | null): boolean => {
    return !!user;
  },

  // Raise Ticket: SUPER_ADMIN YES, ADMIN YES, EMPLOYEE YES
  canRaiseTicket: (user: AuthUser | null): boolean => {
    return !!user;
  },

  // Manage Tickets: SUPER_ADMIN FULL, ADMIN YES, EMPLOYEE OWN
  canManageTickets: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // IT Specialist Workload & Performance: SUPER_ADMIN YES, ADMIN NO, EMPLOYEE NO
  canViewITPerformance: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin';
  },

  // Reports: SUPER_ADMIN FULL, ADMIN OPERATIONAL, EMPLOYEE NO
  canViewReports: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Insurance: SUPER_ADMIN FULL, ADMIN YES, EMPLOYEE NO
  canManageInsurance: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Damaged Assets: SUPER_ADMIN FULL, ADMIN YES, EMPLOYEE OWN/REPORT
  canManageDamageAssets: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Network: SUPER_ADMIN FULL, ADMIN YES, EMPLOYEE NO
  canManageNetwork: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // User Management: SUPER_ADMIN YES, ADMIN YES, EMPLOYEE NO
  canManageUsers: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  // Delete User: SUPER_ADMIN YES, ADMIN NO, EMPLOYEE NO
  canDeleteUsers: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin';
  },

  // System Settings: SUPER_ADMIN YES, ADMIN NO, EMPLOYEE NO
  canManageSystemSettings: (user: AuthUser | null): boolean => {
    if (!user) return false;
    return user.role === 'super_admin';
  },
};
