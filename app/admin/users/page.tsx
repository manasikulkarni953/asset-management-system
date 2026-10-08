'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { FilterBar } from '@/components/data-display/FilterBar';
import { formatDate } from '@/lib/utils';
import type { UserRecord } from '@/services/user.service';
import type { UserRole } from '@/lib/permissions';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State for Add User
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal State for Delete User (Superadmin Only)
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as UserRole,
    designation: 'IT Specialist',
    employee_id: '',
  });

  // Modal State for Edit User
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'admin' as UserRole,
    designation: '',
    employee_id: '',
    status: 'active' as 'active' | 'inactive',
    password: '',
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load users');
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Retrieve authenticated user for role permissions
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch((err) => console.error('Auth check error in users page:', err));
  }, []);

  const handleOpenDelete = (user: UserRecord) => {
    setDeleteError(null);
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setIsDeleteModalOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      setDeleteError(err?.message || 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setIsAddModalOpen(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'admin',
        designation: 'IT Specialist',
        employee_id: '',
      });
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Error creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation || '',
      employee_id: user.employee_id || '',
      status: user.status,
      password: '',
    });
    setModalError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload: any = {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        designation: editFormData.designation,
        employee_id: editFormData.employee_id,
        status: editFormData.status,
      };
      if (editFormData.password.trim()) {
        payload.password = editFormData.password.trim();
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Error updating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-amber-100 text-amber-800 border-amber-300',
    admin: 'bg-blue-100 text-blue-800 border-blue-300',
    employee: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };

  const columns: Column<UserRecord>[] = [
    {
      key: 'name',
      header: 'User Identity',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border uppercase ${roleColors[row.role]}`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'designation',
      header: 'Designation / Staff Details',
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-800 block">
            {row.designation || (row.role === 'admin' ? 'Operations Admin' : 'Staff Member')}
          </span>
          {row.employee_id && (
            <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 inline-block mt-0.5">
              Code: {row.employee_id}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'danger'} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isSelf = currentUser?.id === row.id;
        const isSuperAdminUser = currentUser?.role === 'super_admin';

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              className="text-xs py-1 px-2.5"
            >
              Edit / Role →
            </Button>

            {isSuperAdminUser && (
              <button
                type="button"
                onClick={() => handleOpenDelete(row)}
                disabled={isSelf}
                title={isSelf ? 'Cannot delete current logged-in account' : `Delete ${row.name}`}
                className={`p-1.5 rounded-lg transition-colors border ${isSelf
                  ? 'text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed opacity-30'
                  : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-transparent hover:border-rose-200 dark:hover:border-rose-900/60'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise User & Access Management"
        description="Administrator authority to manage application users, assign roles (super_admin, admin, employee), manage staff designations, and control account status."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create Application User
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, role, or designation..."
        filters={[
          {
            key: 'role',
            value: roleFilter,
            onChange: setRoleFilter,
            options: [
              { value: 'all', label: 'All Roles' },
              { value: 'super_admin', label: 'Super Admin' },
              { value: 'admin', label: 'Admin (inc. IT Specialist)' },
              { value: 'employee', label: 'Employee' },
            ],
          },
          {
            key: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setRoleFilter('all');
          setStatusFilter('all');
        }}
      />

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Users Found"
        emptyDescription="No users match the search criteria."
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Application User"
        description="Provision access to the system. Choose from the three authorized roles."
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <Input
            label="Full Name"
            required
            value={newUser.name}
            onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Rahul Sharma"
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. rahul.s@enterprise.com"
          />

          <Input
            label="Temporary Password"
            type="password"
            required
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Minimum 6 characters"
          />

          <Select
            label="Application Role"
            required
            options={[
              { value: 'super_admin', label: 'Super Admin — Complete System Oversight' },
              { value: 'admin', label: 'Admin — Operational Management' },
              { value: 'employee', label: 'Employee — Self-Service Only' },
            ]}
            value={newUser.role}
            onChange={(e) => {
              const r = e.target.value as UserRole;
              setNewUser((prev) => ({
                ...prev,
                role: r,
                designation: r === 'admin' ? 'IT Specialist' : prev.designation,
              }));
            }}
          />

          <Input
            label="Designation / Title"
            value={newUser.designation}
            onChange={(e) => setNewUser((prev) => ({ ...prev, designation: e.target.value }))}
            placeholder={newUser.role === 'admin' ? 'e.g. IT Specialist' : 'e.g. Senior Software Engineer'}
            helperText={newUser.role === 'admin' ? 'Use "IT Specialist" to monitor workload in IT analytics' : undefined}
          />

          {newUser.role === 'employee' && (
            <Input
              label="Linked Employee Code"
              value={newUser.employee_id}
              onChange={(e) => setNewUser((prev) => ({ ...prev, employee_id: e.target.value }))}
              placeholder="e.g. TGS-001"
              helperText="Links this user account to physical equipment and assigned desk"
            />
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title={`Edit User: ${editingUser.name}`}
          description="Update credentials, assigned role, or activate/deactivate account."
        >
          <form onSubmit={handleUpdateUser} className="space-y-4">
            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {modalError}
              </div>
            )}

            <Input
              label="Full Name"
              required
              value={editFormData.name}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
            />

            <Input
              label="Email Address"
              type="email"
              required
              value={editFormData.email}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
            />

            <Select
              label="Application Role"
              required
              options={[
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'admin', label: 'Admin (Operational)' },
                { value: 'employee', label: 'Employee (Self-Service)' },
              ]}
              value={editFormData.role}
              onChange={(e) =>
                setEditFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))
              }
            />

            <Input
              label="Designation"
              value={editFormData.designation}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, designation: e.target.value }))}
              helperText={editFormData.role === 'admin' ? 'Set to "IT Specialist" for IT ticket tracking' : undefined}
            />

            {editFormData.role === 'employee' && (
              <Input
                label="Linked Employee Code"
                value={editFormData.employee_id}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
                placeholder="e.g. TGS-001"
              />
            )}

            <Select
              label="Account Status"
              options={[
                { value: 'active', label: 'Active — Can Log In' },
                { value: 'inactive', label: 'Inactive — Access Blocked' },
              ]}
              value={editFormData.status}
              onChange={(e) =>
                setEditFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
              }
            />

            <Input
              label="Reset Password (Optional)"
              type="password"
              value={editFormData.password}
              onChange={(e) => setEditFormData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Leave blank to keep existing password"
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" type="button" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Confirmation Modal (Superadmin Only) */}
      {isDeleteModalOpen && deletingUser && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setDeletingUser(null);
            }
          }}
          title="Delete User Account"
        >
          <div className="space-y-4">
            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
                {deleteError}
              </div>
            )}

            <div className="flex items-start gap-3 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Permanently delete this user?
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">{deletingUser.name}</span> (<span className="font-mono text-slate-700 dark:text-slate-300">{deletingUser.email}</span>)?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Account Role:</span>
                <span className="font-bold uppercase text-slate-900 dark:text-white">{deletingUser.role}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Designation:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{deletingUser.designation || 'N/A'}</span>
              </div>
              {deletingUser.employee_id && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Employee Code:</span>
                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{deletingUser.employee_id}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              This will revoke login and system access immediately. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingUser(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
