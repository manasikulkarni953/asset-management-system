'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Employee } from '@/types/employee';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Add Employee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [newEmployee, setNewEmployee] = useState({
    employee_id: '',
    name: '',
    email: '',
    department: 'Engineering',
    designation: '',
    location: 'Headquarters',
    status: 'active',
  });

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (department !== 'all') params.set('department', department);
      if (status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/employees?${params.toString()}`);
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
        setTotal(data.total);
        if (data.departments) setDepartments(data.departments);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, department, status, page]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add employee');
      }

      setIsAddModalOpen(false);
      setNewEmployee({
        employee_id: '',
        name: '',
        email: '',
        department: 'Engineering',
        designation: '',
        location: 'Headquarters',
        status: 'active',
      });
      fetchEmployees();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'employee_id',
      header: 'Employee ID',
      render: (row) => (
        <Link
          href={`/employees/${row.id}`}
          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.employee_id}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Staff Member',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.name}</span>
          <span className="text-xs text-slate-500">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department / Role',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-800 block text-xs">{row.department}</span>
          <span className="text-[11px] text-slate-500">{row.designation}</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location / Workstation',
      render: (row) => (
        <div>
          <span className="text-xs text-slate-700 block">{row.location}</span>
          {row.workstation && (
            <span className="text-[11px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">
              {row.workstation}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'asset_count',
      header: 'Assets Held',
      render: (row) => (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          {row.asset_count || 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Link href={`/employees/${row.id}`}>
          <Button variant="ghost" size="sm" className="px-2 py-1 text-xs text-blue-600">
            View Profile →
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employee Directory"
        description="Staff custodians eligible for company hardware allocation and tracking."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Employee
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by name, ID, or email..."
        filters={[
          {
            key: 'department',
            value: department,
            onChange: (v) => {
              setDepartment(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Departments' },
              ...departments.map((d) => ({ value: d, label: d })),
            ],
          },
          {
            key: 'status',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'on_leave', label: 'On Leave' },
              { value: 'terminated', label: 'Terminated' },
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setDepartment('all');
          setStatus('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Employees Found"
        emptyDescription="No employee records match the filter criteria."
        emptyAction={
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            Add First Employee
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee Custodian"
        description="Register an employee profile into the asset management system."
        size="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Employee ID (Unique)"
              required
              placeholder="e.g. EMP-1004"
              value={newEmployee.employee_id}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, employee_id: e.target.value }))
              }
            />

            <Input
              label="Full Name"
              required
              placeholder="e.g. John Doe"
              value={newEmployee.name}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <Input
            label="Work Email"
            type="email"
            required
            placeholder="john.doe@enterprise.com"
            value={newEmployee.email}
            onChange={(e) =>
              setNewEmployee((prev) => ({ ...prev, email: e.target.value }))
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              required
              options={[
                { value: 'Engineering', label: 'Engineering' },
                { value: 'DevOps & Cloud', label: 'DevOps & Cloud' },
                { value: 'Product Management', label: 'Product Management' },
                { value: 'Design', label: 'Design' },
                { value: 'Finance', label: 'Finance' },
                { value: 'Human Resources', label: 'Human Resources' },
                { value: 'Sales & Marketing', label: 'Sales & Marketing' },
                { value: 'Operations', label: 'Operations' },
              ]}
              value={newEmployee.department}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, department: e.target.value }))
              }
            />

            <Input
              label="Designation"
              required
              placeholder="e.g. Senior Backend Engineer"
              value={newEmployee.designation}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, designation: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Work Location"
              required
              placeholder="e.g. Building A, Floor 2"
              value={newEmployee.location}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, location: e.target.value }))
              }
            />

            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'on_leave', label: 'On Leave' },
                { value: 'terminated', label: 'Terminated' },
              ]}
              value={newEmployee.status}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, status: e.target.value }))
              }
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
