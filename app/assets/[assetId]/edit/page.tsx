'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { FormSection } from '@/components/forms/FormSection';
import { FormActions } from '@/components/forms/FormActions';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';

export default function EditAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetireOpen, setIsRetireOpen] = useState(false);

  const [formData, setFormData] = useState({
    asset_number: '',
    category: '',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_cost: '',
    location: '',
    vendor: '',
    vendor_phone: '',
    vendor_email: '',
    warranty_expiry: '',
    status: 'in_stock',
  });

  useEffect(() => {
    fetch(`/api/assets/${assetId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.asset) {
          const a = data.asset;
          setFormData({
            asset_number: a.asset_number,
            category: a.category,
            brand: a.brand,
            model: a.model,
            serial_number: a.serial_number,
            purchase_date: a.purchase_date ? a.purchase_date.split('T')[0] : '',
            purchase_cost: String(a.purchase_cost || ''),
            location: a.location || 'The Space',
            vendor: a.vendor || '',
            vendor_phone: a.vendor_phone || '',
            vendor_email: a.vendor_email || '',
            warranty_expiry: a.warranty_expiry ? a.warranty_expiry.split('T')[0] : '',
            status: a.status,
          });
        }
      })
      .catch((err) => console.error('Fetch error:', err))
      .finally(() => setIsLoading(false));
  }, [assetId]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        brand: formData.brand,
        model: formData.model,
        serial_number: formData.serial_number,
        purchase_date: formData.purchase_date,
        purchase_cost: parseFloat(formData.purchase_cost) || 0,
        location: formData.location ? formData.location.trim() : 'The Space',
        vendor: formData.vendor.trim(),
        vendor_phone: formData.vendor_phone ? formData.vendor_phone.trim() : null,
        vendor_email: formData.vendor_email ? formData.vendor_email.trim() : null,
        status: formData.status,
      };

      if (formData.warranty_expiry) {
        payload.warranty_expiry = formData.warranty_expiry;
      }

      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update asset');
      }

      router.push(`/assets/${assetId}`);
    } catch (err: any) {
      setError(err?.message || 'Error updating asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetire = async () => {
    try {
      const res = await fetch(`/api/assets/${assetId}?mode=retire`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Asset retired via asset edit panel' }),
      });
      if (res.ok) {
        router.push(`/assets/${assetId}`);
      }
    } catch (err) {
      console.error('Retire error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading asset data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`Edit Asset: ${formData.asset_number}`}
        description="Update hardware specifications, financial records, or operational status."
        backHref={`/assets/${assetId}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Assets', href: '/assets' },
          { label: formData.asset_number, href: `/assets/${assetId}` },
          { label: 'Edit' },
        ]}
        action={
          formData.status !== 'retired' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsRetireOpen(true)}
            >
              Retire Asset
            </Button>
          ) : undefined
        }
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
              title="Permanent Identity"
              description="Asset identity and category cannot be altered once registered."
            >
              <Input
                label="Permanent Asset Number"
                value={formData.asset_number}
                disabled
                className="bg-slate-100 font-mono font-bold text-slate-700 cursor-not-allowed"
                helperText="Permanent key across entire lifecycle."
              />

              <Input
                label="Category"
                value={formData.category}
                disabled
                className="bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
              />

              <Select
                label="Operational Status"
                options={[
                  { value: 'in_stock', label: 'In Stock (Available)' },
                  { value: 'assigned', label: 'Assigned to Staff' },
                  { value: 'under_maintenance', label: 'Under Maintenance / Repair' },
                  { value: 'retired', label: 'Retired (End of Life)' },
                ]}
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              />
            </FormSection>

            <FormSection
              title="Hardware Specification"
              description="Update manufacturer, model, and serial details."
              borderTop
            >
              <Input
                label="Brand / Manufacturer"
                required
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
              />

              <Input
                label="Model / Specification"
                required
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
              />

              <div className="md:col-span-2 lg:col-span-3">
                <Input
                  label="Hardware Serial Number (Unique)"
                  required
                  value={formData.serial_number}
                  onChange={(e) => handleChange('serial_number', e.target.value)}
                />
              </div>
            </FormSection>

            <FormSection
              title="Procurement, Warranty & Location"
              description="Purchase details, warranty dates, and hardware location."
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
                value={formData.purchase_cost}
                onChange={(e) => handleChange('purchase_cost', e.target.value)}
              />

              <DateInput
                label="Warranty Expiry Date"
                value={formData.warranty_expiry}
                onChange={(e) => handleChange('warranty_expiry', e.target.value)}
              />

              <Input
                label="Location"
                placeholder="e.g. The Space, 5th Floor, Server Room"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </FormSection>

            <FormSection
              title="Vendor Details"
              description="Supplier contact details including name, phone number, and email ID."
              borderTop
            >
              <Input
                label="Vendor Name"
                required
                placeholder="e.g. CDW, Insight, Dell Direct, Apple"
                value={formData.vendor}
                onChange={(e) => handleChange('vendor', e.target.value)}
              />

              <Input
                label="Phone No"
                type="tel"
                placeholder="e.g. +1 (800) 555-0199"
                value={formData.vendor_phone}
                onChange={(e) => handleChange('vendor_phone', e.target.value)}
              />

              <Input
                label="Email ID"
                type="email"
                placeholder="e.g. support@vendor.com"
                value={formData.vendor_email}
                onChange={(e) => handleChange('vendor_email', e.target.value)}
              />
            </FormSection>
          </div>

          <FormActions
            onCancel={() => router.push(`/assets/${assetId}`)}
            submitText="Save Changes"
            isSubmitting={isSubmitting}
          />
        </Card>
      </form>

      {/* Confirm retire modal */}
      <ConfirmDialog
        isOpen={isRetireOpen}
        onClose={() => setIsRetireOpen(false)}
        onConfirm={handleRetire}
        title="Retire Asset from Active Inventory?"
        message={`Are you sure you want to retire asset ${formData.asset_number}? Any active custodian assignment will be returned and status changed to Retired.`}
        confirmText="Confirm Retirement"
        variant="danger"
      />
    </div>
  );
}
