'use client';

import React, { useState } from 'react';
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

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    category: 'CPU',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: today,
    purchase_cost: '',
    location: 'The Space',
    warranty_expiry: '',
    vendor: '',
    vendor_phone: '',
    vendor_email: '',
    status: 'in_stock',
  });

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

      if (!formData.vendor.trim()) {
        setError('Vendor name is required.');
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
        vendor_phone: formData.vendor_phone ? formData.vendor_phone.trim() : null,
        vendor_email: formData.vendor_email ? formData.vendor_email.trim() : null,
        location: formData.location ? formData.location.trim() : 'The Space',
        status: 'in_stock',
        current_employee_id: null,
      };

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
    { value: 'CPU', label: 'Cpu (CPU)' },
    { value: 'Monitor', label: 'Monitor (MON)' },
    { value: 'Laptop', label: 'Laptop (LAP)' },
    { value: 'Headset', label: 'Headset (HST)' },
    { value: 'Keyboard', label: 'Keyboard (KBD)' },
    { value: 'Mouse', label: 'Mouse (MSE)' },
    { value: 'HDMI', label: 'HDMI (HDMI)' },
    { value: 'Power Cable', label: 'Power Cable (PWR)' },
    { value: 'Power Adapter', label: 'Power Adapter (ADP)' },
    { value: 'Router', label: 'Router (RTR)' },
    { value: 'Gigswitch', label: 'Gigswitch (GSWH)' },
    { value: 'Webcam', label: 'Webcam (WEBC)' },
    { value: 'CCTV', label: 'CCTV (CCTV)' },
    { value: 'Chair', label: 'Chair (CHR)' },
    { value: 'Printer', label: 'Printer (PRN)' },
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
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <span className="font-bold text-rose-600 dark:text-rose-400">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-8">
            {/* Section A: Hardware Identification */}
            <FormSection
              title="A. Hardware Classification"
              description="Select the hardware category. The permanent asset number prefix and barcode will be automatically determined."
            >
              <div className="md:col-span-2">
                <Select
                  label="Hardware Category"
                  required
                  options={categoryOptions}
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  helperText="Prefix will automatically map from category"
                />
              </div>

              {/* Informational callout about asset ID and Barcode generation */}
              <div className="md:col-span-2 lg:col-span-3 p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <p className="font-semibold text-blue-950 dark:text-white">Automatic Asset Number & Code 128 Barcode</p>
                  <p className="text-blue-800 dark:text-blue-300">
                    The permanent asset tag (e.g., <code className="font-mono font-bold bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">TGS-{formData.category.slice(0, 4).toUpperCase()}-0001</code>) 
                    and matching barcode are generated securely upon saving.
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Section B: Device Specifications */}
            <FormSection
              title="B. Device Specifications"
              description="Physical device make, model, and manufacturer hardware serial number."
              borderTop
            >
              <Input
                label="Brand / Manufacturer"
                required
                placeholder="e.g. Dell, Apple, Lenovo, HP, Logitech"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
              />

              <Input
                label="Model Name / Number"
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

            {/* Section C: Procurement, Warranty & Location */}
            <FormSection
              title="C. Procurement, Warranty & Location"
              description="Purchase details, warranty expiration, and physical location of the hardware."
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

              <DateInput
                label="Warranty Expiry Date"
                value={formData.warranty_expiry}
                onChange={(e) => handleChange('warranty_expiry', e.target.value)}
                helperText="Optional manufacturer warranty expiration date"
              />

              <Input
                label="Location"
                placeholder="e.g. The Space, 5th Floor, Server Room"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                helperText="Physical office or facility location"
              />
            </FormSection>

            {/* Section D: Vendor Details */}
            <FormSection
              title="D. Vendor Details"
              description="Supplier contact details including vendor name, phone number, and email ID."
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
                helperText="Vendor contact or support phone number"
              />

              <Input
                label="Email ID"
                type="email"
                placeholder="e.g. support@vendor.com"
                value={formData.vendor_email}
                onChange={(e) => handleChange('vendor_email', e.target.value)}
                helperText="Vendor support or sales representative email"
              />
            </FormSection>

            {/* Section E: Registration Review */}
            <FormSection
              title="E. Registration Review"
              description="Verify key details before writing to MySQL database and generating barcodes."
              borderTop
            >
              <div className="md:col-span-2 lg:col-span-3 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{formData.category || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Make & Model</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formData.brand ? `${formData.brand} ${formData.model}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Serial Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formData.serial_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formData.location || 'The Space'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vendor</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formData.vendor || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vendor Contact</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formData.vendor_phone || formData.vendor_email || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purchase Cost</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      ${formData.purchase_cost || '0.00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stock Status</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">In Stock (Central)</span>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>

          {/* Sticky Form Actions */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 -mx-6 -mb-6 p-4 sm:px-6 rounded-b-xl flex items-center justify-end gap-3 z-10">
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
