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

  const [employeeNum, setEmployeeNum] = useState('');
  const [workstationNum, setWorkstationNum] = useState('');

  const [newEmployee, setNewEmployee] = useState({
    employee_id: '',
    name: '',
    email: '',
    phone_number: '',
    department: 'Development',
    designation: '',
    location: 'The Space',
    workstation: '',
    status: 'active',
  });

  const openAddModal = async () => {
    setIsAddModalOpen(true);
    setModalError(null);
    try {
      const res = await fetch('/api/employees/next-id');
      const data = await res.json();
      const empNum = data?.nextEmployeeId ? data.nextEmployeeId.replace(/^TGS[-_]?/i, '') : '003';
      const wsNum = data?.nextWorkstation ? data.nextWorkstation.replace(/^WS[-_]?0?5[-_]?/i, '') : '005';
      setEmployeeNum(empNum);
      setWorkstationNum(wsNum);
      setNewEmployee({
        employee_id: `TGS-${empNum}`,
        name: '',
        email: '',
        phone_number: '',
        department: 'Development',
        designation: '',
        location: 'The Space',
        workstation: `WS-05-${wsNum}`,
        status: 'active',
      });
    } catch (e) {
      console.error('Error fetching next employee ID:', e);
      setEmployeeNum('003');
      setWorkstationNum('005');
    }
  };

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
      const rawEmp = employeeNum.trim().replace(/^TGS[-_]?/i, '') || '001';
      const finalEmployeeId = `TGS-${rawEmp.padStart(3, '0')}`;

      const rawWs = workstationNum.trim().replace(/^WS[-_]?0?5[-_]?/i, '') || '001';
      const finalWorkstation = `WS-05-${rawWs.padStart(3, '0')}`;

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmployee,
          employee_id: finalEmployeeId,
          location: 'The Space',
          workstation: finalWorkstation,
          phone_number: newEmployee.phone_number.trim() || undefined,
        }),
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
        phone_number: '',
        department: 'Development',
        designation: '',
        location: 'The Space',
        workstation: '',
        status: 'active',
      });
      setEmployeeNum('');
      setWorkstationNum('');
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
      render: (row) => {
        let displayId = 'TGS-000';
        if (row.employee_id) {
          const numMatch = row.employee_id.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            displayId = `TGS-${String(num).padStart(3, '0')}`;
          } else {
            displayId = row.employee_id;
          }
        }
        return (
          <Link
            href={`/employees/${row.id}`}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
          >
            {displayId}
          </Link>
        );
      },
    },
    {
      key: 'name',
      header: 'Staff Member',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">{row.name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department / Role',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-white block text-xs">{row.department}</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-300">{row.designation}</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location / Workstation',
      render: (row) => {
        let displayWs = row.workstation;
        if (displayWs) {
          if (!displayWs.toUpperCase().startsWith('WS-05-')) {
            const num = displayWs.replace(/[^0-9]/g, '');
            displayWs = num ? `WS-05-${num.padStart(3, '0')}` : displayWs;
          }
        }
        return (
          <div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">The Space</span>
            {displayWs ? (
              <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60 inline-block mt-0.5">
                {displayWs}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 dark:text-slate-400 italic block mt-0.5">Unassigned</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'asset_count',
      header: 'Assets Held',
      render: (row) => (
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
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
          <Button variant="ghost" size="sm" className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
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
            onClick={openAddModal}
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
        searchPlaceholder="Search by ID (e.g. TGS-001), name, workstation (e.g. WS-05-001)..."
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
              { value: 'Quality', label: 'Quality' },
              { value: 'Development', label: 'Development' },
              { value: 'Operations', label: 'Operations', group: 'Operations' },
              { value: 'DBMS', label: 'DBMS', group: 'Operations' },
              { value: 'Email Marketing', label: 'Email Marketing', group: 'Operations' },
              { value: 'Management', label: 'Management' },
              { value: 'Sales', label: 'Sales' },
              { value: 'Human Resources', label: 'Human Resources' },
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

          {/* Employee ID Number Input (FIXED TGS- Prefix, Editable Number Only) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Employee ID Number <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/employees/next-id');
                    const data = await res.json();
                    if (data?.nextEmployeeId) {
                      const num = data.nextEmployeeId.replace(/^TGS[-_]?/i, '');
                      setEmployeeNum(num);
                    }
                  } catch (e) {
                    console.error('Error auto-generating ID:', e);
                  }
                }}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline cursor-pointer"
              >
                Auto-generate
              </button>
            </div>
            <div className="flex rounded-lg shadow-sm border border-slate-300 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden bg-white dark:bg-slate-900">
              <span className="inline-flex items-center px-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-bold text-sm border-r border-slate-300 dark:border-slate-700 select-none">
                TGS-
              </span>
              <input
                type="text"
                required
                placeholder="003"
                className="flex-1 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white bg-transparent focus:outline-none"
                value={employeeNum}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setEmployeeNum(val);
                }}
                onBlur={() => {
                  if (employeeNum.trim()) {
                    setEmployeeNum(employeeNum.padStart(3, '0'));
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Prefix <span className="font-mono font-bold text-slate-700 dark:text-slate-300">TGS-</span> is fixed. You can change only the number (e.g. 003).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              required
              placeholder="e.g. John Doe"
              value={newEmployee.name}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, name: e.target.value }))
              }
            />

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              required
              options={[
                { value: 'Quality', label: 'Quality' },
                { value: 'Development', label: 'Development' },
                { value: 'Operations', label: 'Operations', group: 'Operations' },
                { value: 'DBMS', label: 'DBMS', group: 'Operations' },
                { value: 'Email Marketing', label: 'Email Marketing', group: 'Operations' },
                { value: 'Management', label: 'Management' },
                { value: 'Sales', label: 'Sales' },
                { value: 'Human Resources', label: 'Human Resources' },
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

          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Office Location</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">The Space</span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-full shadow-xs">
              Standard Corporate Location
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Workstation / WS Number Input (FIXED WS-05- Prefix, Editable Number Only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Workstation / WS Number <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/employees/next-id');
                      const data = await res.json();
                      if (data?.nextWorkstation) {
                        const num = data.nextWorkstation.replace(/^WS[-_]?0?5[-_]?/i, '');
                        setWorkstationNum(num);
                      }
                    } catch (e) {
                      console.error('Error auto-generating workstation:', e);
                    }
                  }}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline cursor-pointer"
                >
                  Auto-generate
                </button>
              </div>
              <div className="flex rounded-lg shadow-sm border border-slate-300 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden bg-white dark:bg-slate-900">
                <span className="inline-flex items-center px-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-bold text-sm border-r border-slate-300 dark:border-slate-700 select-none">
                  WS-05-
                </span>
                <input
                  type="text"
                  required
                  placeholder="005"
                  className="flex-1 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white bg-transparent focus:outline-none"
                  value={workstationNum}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setWorkstationNum(val);
                  }}
                  onBlur={() => {
                    if (workstationNum.trim()) {
                      setWorkstationNum(workstationNum.padStart(3, '0'));
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Prefix <span className="font-mono font-bold text-slate-700 dark:text-slate-300">WS-05-</span> is fixed. You can change only the number (e.g. 005).
              </p>
            </div>

            {/* Phone Number Input */}
            <Input
              label="Phone Number"
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={newEmployee.phone_number}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, phone_number: e.target.value }))
              }
            />
          </div>

          <div>
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
