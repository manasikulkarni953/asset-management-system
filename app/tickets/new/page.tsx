'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormSection } from '@/components/forms/FormSection';
import { FormActions } from '@/components/forms/FormActions';
import { Spinner } from '@/components/ui/Spinner';
import { Building2, Layers, MapPin } from 'lucide-react';

function RaiseTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultAssetId = searchParams.get('assetId') || searchParams.get('asset_id') || '';
  const defaultEmployeeId = searchParams.get('employeeId') || searchParams.get('employee_id') || '';
  const explicitWorkstation = searchParams.get('workstation') || searchParams.get('desk') || '';

  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    asset_id: defaultAssetId,
    employee_id: defaultEmployeeId,
    raised_building: 'The Space',
    raised_floor: '5th Floor',
    raised_workstation: explicitWorkstation,
    issue_category: 'Hardware Failure',
    priority: 'medium',
    issue_description: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/assets?limit=100').then((r) => r.json()),
      fetch('/api/employees?limit=100').then((r) => r.json()),
      fetch('/api/tickets?limit=1').then((r) => r.json()),
    ])
      .then(([assetData, empData, ticketData]) => {
        const loadedAssets = assetData.assets || [];
        const loadedEmployees = empData.employees || [];
        if (loadedAssets.length) setAssets(loadedAssets);
        if (loadedEmployees.length) setEmployees(loadedEmployees);
        if (ticketData.issueCategories) setCategories(ticketData.issueCategories);

        // Determine active initial employee
        let targetEmpId = defaultEmployeeId;
        if (defaultAssetId && !defaultEmployeeId && loadedAssets.length) {
          const selected = loadedAssets.find((a: any) => String(a.id) === defaultAssetId);
          if (selected?.current_employee_id) {
            targetEmpId = String(selected.current_employee_id);
          }
        }
        if (!targetEmpId && loadedEmployees.length === 1) {
          targetEmpId = String(loadedEmployees[0].id);
        }

        if (targetEmpId && loadedEmployees.length) {
          const targetEmp = loadedEmployees.find((e: any) => String(e.id) === targetEmpId);
          setFormData((prev) => ({
            ...prev,
            employee_id: targetEmpId,
            raised_workstation: explicitWorkstation || targetEmp?.workstation || prev.raised_workstation || '',
          }));
        }
      })
      .catch((err) => console.error('Error fetching metadata:', err))
      .finally(() => setIsLoadingMeta(false));
  }, [defaultAssetId, defaultEmployeeId, explicitWorkstation]);

  const handleAssetChange = (selectedId: string) => {
    const match = assets.find((a) => String(a.id) === selectedId);
    if (match && match.current_employee_id) {
      const empId = String(match.current_employee_id);
      const targetEmp = employees.find((e) => String(e.id) === empId);
      setFormData((prev) => ({
        ...prev,
        asset_id: selectedId,
        employee_id: empId,
        raised_workstation: targetEmp?.workstation || prev.raised_workstation || '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, asset_id: selectedId }));
    }
  };

  const handleEmployeeChange = (selectedEmpId: string) => {
    const targetEmp = employees.find((e) => String(e.id) === selectedEmpId);
    setFormData((prev) => ({
      ...prev,
      employee_id: selectedEmpId,
      raised_workstation: targetEmp?.workstation || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const cleanWs = formData.raised_workstation.trim();
    if (!cleanWs) {
      setError('Workstation / Desk number is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        asset_id: Number(formData.asset_id),
        employee_id: Number(formData.employee_id),
        raised_building: 'The Space',
        raised_floor: '5th Floor',
        raised_workstation: cleanWs,
        issue_category: formData.issue_category,
        priority: formData.priority,
        issue_description: formData.issue_description,
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to raise ticket');
      }

      router.push(`/tickets/${data.ticket.id}`);
    } catch (err: any) {
      setError(err?.message || 'Error creating ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingMeta) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading ticket form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Raise Support Ticket"
        description="Report a hardware breakdown, physical defect, or service maintenance request."
        backHref="/tickets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Tickets', href: '/tickets' },
          { label: 'Raise Ticket' },
        ]}
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
          <span className="font-bold text-rose-600">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-6">
            <FormSection
              title="Target Equipment & Custodian"
              description="Identify the hardware experiencing issues and the reporting employee."
            >
              <Select
                label="Affected Asset"
                required
                options={[
                  { value: '', label: '-- Select Equipment --' },
                  ...assets.map((a) => ({
                    value: a.id,
                    label: `${a.asset_number} — ${a.brand} ${a.model} (${a.category})`,
                  })),
                ]}
                value={formData.asset_id}
                onChange={(e) => handleAssetChange(e.target.value)}
                helperText="Permanent asset identity number"
              />

              <Select
                label="Reporting Employee Custodian"
                required
                options={[
                  { value: '', label: '-- Select Employee --' },
                  ...employees.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.employee_id}) — ${e.workstation ? `${e.workstation} • ` : ''}${e.department}`,
                  })),
                ]}
                value={formData.employee_id}
                onChange={(e) => handleEmployeeChange(e.target.value)}
              />
            </FormSection>

            {/* Ticket Location Section */}
            <FormSection
              title="Ticket Location"
              description="Fixed corporate facility with physical desk/workstation identity."
              borderTop
            >
              <div className="md:col-span-2 lg:col-span-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Fixed Building (Read Only) */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Building
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          Read Only
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        The Space
                      </p>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Corporate Facility</span>
                    </div>

                    {/* Fixed Floor (Read Only) */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Floor
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          Read Only
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        5th Floor
                      </p>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Assigned Work Level</span>
                    </div>

                    {/* Workstation / Desk No. (Editable) */}
                    <div className="p-3 bg-white border-2 border-indigo-200 rounded-lg shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="raised_workstation" className="text-[10px] uppercase font-bold tracking-wider text-indigo-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Workstation / Desk No. *
                          </label>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            Editable
                          </span>
                        </div>
                        <Input
                          id="raised_workstation"
                          required
                          value={formData.raised_workstation}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, raised_workstation: e.target.value }))
                          }
                          placeholder="e.g. WS-5-042"
                          className="font-mono text-sm font-bold text-slate-900 mt-0.5 h-9"
                          helperText={
                            employees.find((e) => String(e.id) === formData.employee_id)?.workstation
                              ? `Assigned desk: ${employees.find((e) => String(e.id) === formData.employee_id)?.workstation}`
                              : 'Physical desk where issue is reported (e.g. WS-5-042)'
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Issue Severity & Categorization"
              description="Classify the incident to ensure appropriate IT response SLA."
              borderTop
            >
              <Select
                label="Issue Category"
                required
                options={categories.map((c) => ({ value: c, label: c }))}
                value={formData.issue_category}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, issue_category: e.target.value }))
                }
              />

              <Select
                label="Incident Priority"
                required
                options={[
                  { value: 'low', label: 'Low — Minor inconvenience' },
                  { value: 'medium', label: 'Medium — Normal operational impact' },
                  { value: 'high', label: 'High — Significant impairment' },
                  { value: 'critical', label: 'Critical — Complete hardware failure / outage' },
                ]}
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, priority: e.target.value }))
                }
              />

              <div className="md:col-span-2 lg:col-span-3">
                <Textarea
                  label="Detailed Symptom & Problem Description"
                  required
                  rows={4}
                  placeholder="Describe what occurred, any error messages, physical damage, or troubleshooting steps taken..."
                  value={formData.issue_description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, issue_description: e.target.value }))
                  }
                  helperText="Minimum 5 characters required."
                />
              </div>
            </FormSection>
          </div>

          <FormActions
            onCancel={() => router.push('/tickets')}
            submitText="Submit Support Ticket"
            isSubmitting={isSubmitting}
          />
        </Card>
      </form>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <RaiseTicketForm />
    </Suspense>
  );
}
