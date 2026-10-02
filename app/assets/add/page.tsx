'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';
import { FormSection } from '@/components/forms/FormSection';

export default function AddAssetPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; employee_id: string }>>([]);

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    category: 'Laptop',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: today,
    purchase_cost: '',
    vendor: '',
    warranty_expiry: '',
    status: 'in_stock',
    current_employee_id: '',
  });

  useEffect(() => {
    fetch('/api/employees?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.employees) {
          setEmployees(
            data.employees.map((e: any) => ({
              id: e.id,
              name: e.name,
              employee_id: e.employee_id,
            }))
          );
        }
      })
      .catch((err) => console.error('Failed to load employees:', err));
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedSerial = formData.serial_number.trim();
      if (!trimmedSerial) {
        setError('Hardware serial number is required.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        category: formData.category.trim(),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        serial_number: trimmedSerial,
        purchase_date: formData.purchase_date,
        purchase_cost: parseFloat(formData.purchase_cost) || 0,
        vendor: formData.vendor.trim(),
        status: formData.status,
        current_employee_id: formData.current_employee_id ? Number(formData.current_employee_id) : null,
      };

      // Ensure asset_id and asset_number are never set or sent by client (backend generated)
      delete payload.asset_id;
      delete payload.asset_number;

      if (formData.warranty_expiry && formData.warranty_expiry.trim()) {
        payload.warranty_expiry = formData.warranty_expiry.trim();
      }

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create asset');
      }

      router.push(`/assets/${data.asset.id}`);
    } catch (err: any) {
      setError(err?.message || 'Error saving asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: 'Laptop', label: 'Laptop (LAP)' },
    { value: 'Desktop', label: 'Desktop (DSK)' },
    { value: 'Monitor', label: 'Monitor (MON)' },
    { value: 'Server', label: 'Server (SVR)' },
    { value: 'Mobile', label: 'Mobile (MOB)' },
    { value: 'Tablet', label: 'Tablet (TAB)' },
    { value: 'Printer', label: 'Printer (PRN)' },
    { value: 'Networking', label: 'Networking (NET)' },
    { value: 'Storage', label: 'Storage (STR)' },
    { value: 'Peripheral', label: 'Peripheral (PER)' },
  ];

  const employeeOptions = [
    { value: '', label: 'None (Keep in Stock)' },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.name} (${e.employee_id})`,
    })),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Register New Asset"
        description="A permanent asset number and Code 128 barcode identity will be automatically generated."
        backHref="/assets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Assets', href: '/assets' },
          { label: 'Register Asset' },
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
            {/* Section A: Asset Identity Information & Callout */}
            <FormSection
              title="A. Asset Identity (System-Generated)"
              description="System identity and barcode parameters are automatically determined by the backend."
            >
              <div className="md:col-span-2 lg:col-span-3 p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      System Asset ID (Read-Only)
                    </span>
                    <span className="font-mono text-base font-bold text-blue-700 block mt-0.5">
                      TGS-XXXXXX
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Permanent sequential primary identity auto-generated by MySQL.
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Asset Number / Barcode Identity (Read-Only)
                    </span>
                    <span className="font-mono text-base font-bold text-purple-700 block mt-0.5">
                      TGS-&lt;CAT&gt;-XXXXX
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Category-coded business number used to render Code 128 barcode stickers.
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 border-t border-blue-100 pt-2">
                  ℹ️ <strong>Identity Distinction:</strong> Both <strong>Asset ID</strong> and <strong>Asset Number</strong> are server-generated and immutable. <strong>Hardware Serial Number</strong> is the physical manufacturer number you must enter manually from the device.
                </p>
              </div>
            </FormSection>

            {/* Section B: Hardware Details */}
            <FormSection
              title="B. Hardware Specification"
              description="Basic categorization, manufacturer, model, and physical manufacturer serial number."
              borderTop
            >
              <Select
                label="Asset Category"
                required
                options={categoryOptions}
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                helperText="Derives category barcode prefix (e.g. Laptop → LAP)"
              />

              <Input
                label="Brand / Manufacturer"
                required
                placeholder="e.g. Dell, Apple, Lenovo, HP"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
              />

              <Input
                label="Model / Specification"
                required
                placeholder="e.g. Latitude 5440, MacBook Pro 16 M3"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
              />

              <div className="md:col-span-2 lg:col-span-3">
                <Input
                  label="Hardware Serial Number (Manufacturer Chassis)"
                  required
                  placeholder="e.g. 5CD2348ABC or C02G99..."
                  value={formData.serial_number}
                  onChange={(e) => handleChange('serial_number', e.target.value)}
                  helperText="Enter physical serial number stamped on the hardware. Must be unique across all records."
                />
              </div>
            </FormSection>

            {/* Section C: Procurement & Financials */}
            <FormSection
              title="C. Procurement & Financials"
              description="Purchase details, vendor, acquisition cost, and procurement dates."
              borderTop
            >
              <DateInput
                label="Purchase Date"
                required
                value={formData.purchase_date}
                onChange={(e) => handleChange('purchase_date', e.target.value)}
              />

              <Input
                label="Purchase Cost ($ USD)"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={formData.purchase_cost}
                onChange={(e) => handleChange('purchase_cost', e.target.value)}
              />

              <Input
                label="Vendor / Supplier"
                required
                placeholder="e.g. CDW, Insight, Dell Direct, Apple"
                value={formData.vendor}
                onChange={(e) => handleChange('vendor', e.target.value)}
              />
            </FormSection>

            {/* Section D: Warranty Coverage */}
            <FormSection
              title="D. Warranty Coverage"
              description="Manufacturer hardware warranty or extended service coverage period."
              borderTop
            >
              <DateInput
                label="Warranty Expiry Date"
                value={formData.warranty_expiry}
                onChange={(e) => handleChange('warranty_expiry', e.target.value)}
                helperText="Optional manufacturer coverage expiration date"
              />
            </FormSection>

            {/* Section E: Initial Custody Assignment */}
            <FormSection
              title="E. Initial Custody Assignment"
              description="Assign the hardware to an employee immediately or place directly into central stock."
              borderTop
            >
              <div className="md:col-span-2">
                <Select
                  label="Assign Directly to Employee"
                  options={employeeOptions}
                  value={formData.current_employee_id}
                  onChange={(e) => handleChange('current_employee_id', e.target.value)}
                  helperText="If assigned, asset status is automatically set to 'assigned' and an initial custody event recorded in MySQL."
                />
              </div>
            </FormSection>

            {/* Section F: Registration Review Preview */}
            <FormSection
              title="F. Registration Review"
              description="Verify key details before writing to MySQL database and generating barcodes."
              borderTop
            >
              <div className="md:col-span-2 lg:col-span-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                    <span className="font-bold text-slate-800">{formData.category || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Make & Model</span>
                    <span className="font-bold text-slate-800">
                      {formData.brand ? `${formData.brand} ${formData.model}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Serial Number</span>
                    <span className="font-mono font-bold text-slate-900">{formData.serial_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Initial Custody</span>
                    <span className="font-semibold text-slate-800">
                      {formData.current_employee_id
                        ? employees.find((e) => String(e.id) === String(formData.current_employee_id))?.name || 'Assigned'
                        : 'Central Inventory (In Stock)'}
                    </span>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>

          {/* Sticky Form Actions */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 -mx-6 -mb-6 p-4 sm:px-6 rounded-b-xl flex items-center justify-end gap-3 z-10">
            <Button variant="outline" type="button" onClick={() => router.push('/assets')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              Save & Generate Permanent Asset
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
