'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard } from '@/components/data-display/StatsCard';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { AssetSet, AssetSetItem } from '@/types/asset-set';
import { 
  Package, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  UserCheck, 
  Sparkles, 
  Laptop, 
  Monitor, 
  Keyboard, 
  Headphones, 
  Mouse, 
  Box, 
  Cpu, 
  Cable, 
  Zap, 
  BatteryCharging, 
  Wifi, 
  Network, 
  Video, 
  ShieldAlert, 
  Armchair, 
  Printer, 
  Tags, 
  Tag, 
  FileSpreadsheet,
  Check,
  Building2
} from 'lucide-react';
import { ASSET_TAG_SPECS, getAssetTagFormat } from '@/types/asset-set';

// Standard enterprise departments matching the database
const DEPARTMENTS = [
  'Quality',
  'Development',
  'Operations',
  'DBMS',
  'Email Marketing',
  'Management',
  'Sales',
  'Human Resources',
];

export default function AssetSetsPage() {
  const [assetSets, setAssetSets] = useState<AssetSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');

  // Tagging Reference Modal State
  const [isTagRefModalOpen, setIsTagRefModalOpen] = useState(false);

  // Assign Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSetForAssign, setSelectedSetForAssign] = useState<AssetSet | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [assignFilterByDept, setAssignFilterByDept] = useState(true);
  const [inStockAssets, setInStockAssets] = useState<any[]>([]);
  // Mapping of item category index -> chosen asset ID
  const [chosenAssetIds, setChosenAssetIds] = useState<{ [key: string]: string }>({});
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ message: string; assets: string[]; employeeName: string } | null>(null);

  // Create/Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [setFormData, setSetFormData] = useState({
    name: '',
    code: '',
    tag_number: '001',
    target_department: 'Operations',
    employee_id: '',
    chosen_asset_ids: {} as { [key: string]: string },
    description: '',
    items: [
      { category: 'CPU', quantity: 1, notes: 'Main Workstation Tower' },
      { category: 'Monitor', quantity: 1, notes: 'FHD IPS Display' },
      { category: 'Keyboard', quantity: 1, notes: 'Standard Keyboard' },
      { category: 'Mouse', quantity: 1, notes: 'Ergonomic Mouse' },
    ],
  });
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Helper to match target department to employee department with support for aliases
  const isDeptMatch = (targetDept: string, empDept: string) => {
    const t = (targetDept || '').trim().toLowerCase();
    const e = (empDept || '').trim().toLowerCase();
    if (!t || t === 'all') return true;
    if (t === e) return true;
    // Engineering / Dev / IT aliases
    if (['engineering', 'development', 'dev', 'software', 'tech', 'it'].includes(t) &&
        ['engineering', 'development', 'dev', 'dbms'].includes(e)) {
      return true;
    }
    // Operations aliases
    if (['operations', 'ops'].includes(t) &&
        ['operations', 'dbms', 'email marketing'].includes(e)) {
      return true;
    }
    // Design aliases
    if (['design', 'creative', 'multimedia', 'ui/ux'].includes(t) &&
        ['development', 'operations', 'marketing', 'design'].includes(e)) {
      return true;
    }
    return false;
  };

  // Filter employees strictly for the Create/Edit form by the chosen department
  const filteredEmployeesForForm = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    if (!setFormData.target_department || setFormData.target_department === 'All') {
      return employees;
    }
    const targetDept = setFormData.target_department.trim().toLowerCase();
    const matched = employees.filter((emp) => isDeptMatch(targetDept, emp.department || ''));
    return matched.length > 0 ? matched : employees;
  }, [employees, setFormData.target_department]);

  // Filter employees for Assign modal by the set's target department
  const filteredEmployeesForAssign = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    if (!selectedSetForAssign) return employees;
    if (!assignFilterByDept) return employees;

    const dept = (selectedSetForAssign.target_department || '').trim();
    if (!dept || dept.toLowerCase() === 'all') return employees;

    const matched = employees.filter((emp) => isDeptMatch(dept, emp.department || ''));
    // If no employees match this specific department, fall back to showing ALL employees
    // so the employee dropdown is NEVER empty and employees are ALWAYS visible!
    return matched.length > 0 ? matched : employees;
  }, [employees, selectedSetForAssign, assignFilterByDept]);

  // Real-time unique tag validation - strictly blocks duplicates
  const tagValidation = useMemo(() => {
    const clean = setFormData.tag_number.trim().replace(/\D/g, '');
    if (!clean) {
      return { isDuplicate: false, error: null, formattedTag: '', duplicateGroup: null };
    }
    const pad = clean.padStart(3, '0');
    const match = assetSets.find((s) => {
      if (editingSetId && s.id === editingSetId) return false;
      return (s.tag_number || '').trim().padStart(3, '0') === pad;
    });

    if (match) {
      return {
        isDuplicate: true,
        error: `Tag Number #${pad} is already assigned to "${match.name}" (${match.code}). Only unique tag numbers are accepted!`,
        formattedTag: pad,
        duplicateGroup: match,
      };
    }

    return { isDuplicate: false, error: null, formattedTag: pad, duplicateGroup: null };
  }, [setFormData.tag_number, assetSets, editingSetId]);

  // Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState<AssetSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAssetSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (department !== 'all') params.set('department', department);

      const res = await fetch(`/api/asset-sets?${params.toString()}`);
      const data = await res.json();
      if (data.assetSets) {
        setAssetSets(data.assetSets);
      }
      if (data.employees && Array.isArray(data.employees) && data.employees.length > 0) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error('Failed to fetch asset sets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, department]);

  const fetchPreloadData = useCallback(async () => {
    try {
      const [resEmp, resAssets] = await Promise.all([
        fetch('/api/employees?limit=100').then((r) => r.json()).catch(() => ({})),
        fetch('/api/assets?status=in_stock&limit=200').then((r) => r.json()).catch(() => ({})),
      ]);
      if (resEmp?.employees && Array.isArray(resEmp.employees) && resEmp.employees.length > 0) {
        setEmployees(resEmp.employees);
      }
      if (resAssets?.assets && Array.isArray(resAssets.assets)) {
        setInStockAssets(resAssets.assets);
      }
    } catch (err) {
      console.error('Failed to preload employees or assets:', err);
    }
  }, []);

  useEffect(() => {
    fetchAssetSets();
    fetchPreloadData();
  }, [fetchAssetSets, fetchPreloadData]);

  const openAssignModal = async (set: AssetSet) => {
    setSelectedSetForAssign(set);
    setTargetEmployeeId('');
    setAssignmentNotes('');
    setAssignError(null);

    // If target department has matching staff, keep filtering enabled;
    // if 0 employees match that specific department name, default to showing all staff so they are visible immediately!
    const dept = (set.target_department || '').trim();
    const hasDeptMatches = employees.some((emp) => isDeptMatch(dept, emp.department || ''));
    setAssignFilterByDept(hasDeptMatches);

    setIsAssignModalOpen(true);

    // Auto-select with currently loaded in-stock assets
    if (inStockAssets.length > 0) {
      const initialChosen: { [key: string]: string } = {};
      const usedAssetIds = new Set<string>();

      set.items.forEach((item, itemIdx) => {
        for (let q = 0; q < item.quantity; q++) {
          const slotKey = `${itemIdx}_${q}`;
          const match = inStockAssets.find(
            (a: any) =>
              (a.category?.toLowerCase() === item.category?.toLowerCase() ||
               (item.category?.toLowerCase() === 'cpu' && a.category?.toLowerCase() === 'desktop')) &&
              !usedAssetIds.has(String(a.id))
          );
          if (match) {
            initialChosen[slotKey] = String(match.id);
            usedAssetIds.add(String(match.id));
          } else {
            initialChosen[slotKey] = '';
          }
        }
      });
      setChosenAssetIds(initialChosen);
    }

    try {
      const [resEmp, resAssets] = await Promise.all([
        fetch('/api/employees?limit=150').then((r) => r.json()).catch(() => ({})),
        fetch('/api/assets?status=in_stock&limit=200').then((r) => r.json()).catch(() => ({})),
      ]);
      const loadedEmps = resEmp?.employees;
      const loadedAssets = resAssets?.assets;

      if (Array.isArray(loadedEmps) && loadedEmps.length > 0) {
        setEmployees(loadedEmps);
      }
      if (Array.isArray(loadedAssets) && loadedAssets.length > 0) {
        setInStockAssets(loadedAssets);

        // Update auto-select with freshly loaded assets
        const initialChosen: { [key: string]: string } = {};
        const usedAssetIds = new Set<string>();

        set.items.forEach((item, itemIdx) => {
          for (let q = 0; q < item.quantity; q++) {
            const slotKey = `${itemIdx}_${q}`;
            const match = loadedAssets.find(
              (a: any) =>
                (a.category?.toLowerCase() === item.category?.toLowerCase() ||
                 (item.category?.toLowerCase() === 'cpu' && a.category?.toLowerCase() === 'desktop')) &&
                !usedAssetIds.has(String(a.id))
            );
            if (match) {
              initialChosen[slotKey] = String(match.id);
              usedAssetIds.add(String(match.id));
            } else {
              initialChosen[slotKey] = '';
            }
          }
        });

        setChosenAssetIds(initialChosen);
      }
    } catch (err) {
      console.error('Error preloading assignment data:', err);
    }
  };

  const handleExecuteDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSetForAssign) return;
    if (!targetEmployeeId) {
      setAssignError('Please choose an employee custodian to receive this equipment set.');
      return;
    }

    const assetIdValues = Object.values(chosenAssetIds).filter((id) => id && id.trim() !== '');
    if (assetIdValues.length === 0) {
      setAssignError('Please select at least one physical asset to deploy.');
      return;
    }

    // Check duplicates
    const uniqueIds = new Set(assetIdValues);
    if (uniqueIds.size !== assetIdValues.length) {
      setAssignError('Duplicate equipment units selected. Please pick distinct assets for each item.');
      return;
    }

    setIsDeploying(true);
    setAssignError(null);

    try {
      const res = await fetch('/api/asset-sets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_id: selectedSetForAssign.id,
          employee_id: Number(targetEmployeeId),
          selected_asset_ids: assetIdValues.map(Number),
          notes: assignmentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy asset set');

      setIsAssignModalOpen(false);
      setSuccessBanner({
        message: data.message || `Successfully assigned ${selectedSetForAssign.name} to employee.`,
        assets: data.assets || [],
        employeeName: data.employeeName || 'Selected Employee',
      });
      fetchAssetSets();
    } catch (err: any) {
      setAssignError(err.message || 'Deployment error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Create / Edit modal logic
  const openCreateModal = () => {
    setEditingSetId(null);
    // Find next available unused unique tag number (e.g. 001, 002 -> next is unused)
    const usedTags = new Set(assetSets.map((s) => (s.tag_number || '').trim().padStart(3, '0')));
    let nextNum = 1;
    while (usedTags.has(String(nextNum).padStart(3, '0'))) {
      nextNum++;
    }
    const nextTag = String(nextNum).padStart(3, '0');

    setSetFormData({
      name: `Operations Hardware Kit #${nextTag}`,
      code: `SET-OPS-${nextTag}`,
      tag_number: nextTag,
      target_department: 'Operations',
      employee_id: '',
      chosen_asset_ids: {},
      description: 'Standard workstation equipment for operations team',
      items: [
        { category: 'CPU', quantity: 1, notes: 'Main Workstation Tower' },
        { category: 'Monitor', quantity: 1, notes: 'FHD IPS Display' },
        { category: 'Keyboard', quantity: 1, notes: 'Standard Keyboard' },
        { category: 'Mouse', quantity: 1, notes: 'Ergonomic Mouse' },
      ],
    });
    setEditModalError(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (set: AssetSet) => {
    setEditingSetId(set.id);
    setSetFormData({
      name: set.name,
      code: set.code,
      tag_number: set.tag_number || '001',
      target_department: set.target_department || 'Operations',
      employee_id: '',
      chosen_asset_ids: {},
      description: set.description || '',
      items: set.items.map((i) => ({
        category: i.category,
        quantity: i.quantity,
        notes: i.notes || '',
      })),
    });
    setEditModalError(null);
    setIsEditModalOpen(true);
  };

  const handleAddItemToForm = () => {
    setSetFormData((prev) => ({
      ...prev,
      items: [...prev.items, { category: 'Headset', quantity: 1, notes: '' }],
    }));
  };

  const handleRemoveItemFromForm = (idx: number) => {
    setSetFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setFormData.name.trim()) {
      setEditModalError('Group name is required.');
      return;
    }
    if (!setFormData.code.trim()) {
      setEditModalError('Group SKU code is required.');
      return;
    }
    const cleanTag = setFormData.tag_number.trim().replace(/\D/g, '');
    if (!cleanTag) {
      setEditModalError('Group Tagging Number is required (e.g. 001, 002, 008). Only numeric digits are permitted.');
      return;
    }

    if (tagValidation.isDuplicate) {
      setEditModalError(
        tagValidation.error || 'This Tag Number is already in use by another group. Only unique tag numbers are accepted.'
      );
      return;
    }

    if (setFormData.items.length === 0) {
      setEditModalError('Add at least one item category to this group.');
      return;
    }

    const formattedTag = cleanTag.padStart(3, '0');

    // Collect chosen physical asset IDs if an employee was assigned
    const chosenIds = Object.values(setFormData.chosen_asset_ids || {}).filter(
      (id) => id && id.trim() !== ''
    );

    setIsSavingSet(true);
    setEditModalError(null);

    try {
      const url = editingSetId ? `/api/asset-sets/${editingSetId}` : '/api/asset-sets';
      const method = editingSetId ? 'PUT' : 'POST';

      const payload: any = {
        name: setFormData.name.trim(),
        code: setFormData.code.trim(),
        tag_number: formattedTag,
        target_department: setFormData.target_department,
        description: setFormData.description.trim(),
        items: setFormData.items,
      };

      if (!editingSetId && setFormData.employee_id) {
        payload.employee_id = Number(setFormData.employee_id);
        payload.selected_asset_ids = chosenIds.map(Number);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save asset group');

      setIsEditModalOpen(false);
      fetchAssetSets();
      fetchPreloadData();

      if (setFormData.employee_id) {
        const emp = employees.find((e) => String(e.id) === String(setFormData.employee_id));
        setSuccessBanner({
          message: `Created group "${setFormData.name}" and assigned equipment to employee successfully.`,
          assets: chosenIds,
          employeeName: emp ? `${emp.name || emp.full_name} (${emp.employee_id || ''})` : 'Selected Employee',
        });
      }
    } catch (err: any) {
      setEditModalError(err.message || 'Save error');
    } finally {
      setIsSavingSet(false);
    }
  };

  // Delete modal logic
  const openDeleteModal = (set: AssetSet) => {
    setSetToDelete(set);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!setToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/asset-sets/${setToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete asset group');

      setIsDeleteModalOpen(false);
      setSetToDelete(null);
      fetchAssetSets();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Rich icons for all 15 asset categories from the specification sheet
  const getItemIcon = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('cpu') || cat.includes('desktop')) return <Cpu className="w-4 h-4 text-sky-400" />;
    if (cat.includes('monitor')) return <Monitor className="w-4 h-4 text-blue-400" />;
    if (cat.includes('laptop')) return <Laptop className="w-4 h-4 text-indigo-400" />;
    if (cat.includes('headset') || cat.includes('headphone')) return <Headphones className="w-4 h-4 text-purple-400" />;
    if (cat.includes('keyboard')) return <Keyboard className="w-4 h-4 text-amber-400" />;
    if (cat.includes('mouse')) return <Mouse className="w-4 h-4 text-pink-400" />;
    if (cat.includes('hdmi')) return <Cable className="w-4 h-4 text-cyan-400" />;
    if (cat.includes('power cable') || cat.includes('pwr')) return <Zap className="w-4 h-4 text-yellow-400" />;
    if (cat.includes('adapter') || cat.includes('charger') || cat.includes('adp')) return <BatteryCharging className="w-4 h-4 text-orange-400" />;
    if (cat.includes('router') || cat.includes('rtr')) return <Wifi className="w-4 h-4 text-emerald-400" />;
    if (cat.includes('switch') || cat.includes('gswh') || cat.includes('gigswitch')) return <Network className="w-4 h-4 text-teal-400" />;
    if (cat.includes('webcam') || cat.includes('cam')) return <Video className="w-4 h-4 text-rose-400" />;
    if (cat.includes('cctv')) return <ShieldAlert className="w-4 h-4 text-red-400" />;
    if (cat.includes('chair')) return <Armchair className="w-4 h-4 text-amber-300" />;
    if (cat.includes('printer') || cat.includes('prn')) return <Printer className="w-4 h-4 text-slate-300" />;
    return <Box className="w-4 h-4 text-slate-400" />;
  };

  // Metrics
  const totalSets = assetSets.length;
  const readySets = assetSets.filter((s) => (s.available_kits_count || 0) > 0).length;
  const totalConfiguredItems = assetSets.reduce((sum, s) => sum + (s.total_items || 0), 0);

  // Department badge styling
  const getDepartmentBadgeStyle = (dept: string) => {
    const d = (dept || '').toLowerCase();
    if (d.includes('dev') || d.includes('eng') || d.includes('tech')) {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/70';
    }
    if (d.includes('dbms') || d.includes('data')) {
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/70';
    }
    if (d.includes('email') || d.includes('market')) {
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/70';
    }
    if (d.includes('oper') || d.includes('ops')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';
    }
    if (d.includes('manage') || d.includes('exec') || d.includes('lead')) {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/70';
    }
    if (d.includes('sale') || d.includes('market')) {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/70';
    }
    if (d.includes('qual') || d.includes('qa')) {
      return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/70';
    }
    if (d.includes('hr') || d.includes('human')) {
      return 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800/70';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };


  const DEPARTMENT_FORM_OPTIONS: { value: string; label: string; group?: string }[] = [
    { value: 'Quality', label: 'Quality' },
    { value: 'Development', label: 'Development' },
    { value: 'Operations', label: 'Operations', group: 'Operations' },
    { value: 'DBMS', label: 'DBMS', group: 'Operations' },
    { value: 'Email Marketing', label: 'Email Marketing', group: 'Operations' },
    { value: 'Management', label: 'Management' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Human Resources', label: 'Human Resources' },
  ];

  const departmentFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Departments' },
      { value: 'Quality', label: 'Quality' },
      { value: 'Development', label: 'Development' },
      { value: 'Operations', label: 'Operations', group: 'Operations' },
      { value: 'DBMS', label: 'DBMS', group: 'Operations' },
      { value: 'Email Marketing', label: 'Email Marketing', group: 'Operations' },
      { value: 'Management', label: 'Management' },
      { value: 'Sales', label: 'Sales' },
      { value: 'Human Resources', label: 'Human Resources' },
    ];
  }, []);

  // Card renderer with properly arranged information and 'Assign to the employee' button (no icon)
  const renderCard = (set: AssetSet) => {
    const hasStock = (set.available_kits_count || 0) > 0;
    const setTag = set.tag_number || '001';

    return (
      <div
        key={set.id}
        className="bg-white dark:bg-[#0c1427] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-500/60 dark:hover:border-blue-500/50 hover:shadow-xl transition-all duration-200 group relative"
      >
        <div className="space-y-4">
          {/* Card Top: Department Badge & Actions */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getDepartmentBadgeStyle(
                set.target_department
              )}`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{set.target_department || 'Operations'}</span>
            </span>

            {/* Edit & Delete Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(set)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                title="Edit Asset Group"
                aria-label="Edit Asset Group"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(set)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Delete Asset Group"
                aria-label="Delete Asset Group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Group Title and Code / Tag Badges */}
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
              {set.name}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                {set.code}
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-1 shadow-2xs">
                <Tag className="w-3 h-3 text-indigo-500" />
                Tag #{setTag}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
                {set.total_items || set.items?.length || 0} Assets
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed min-h-[34px] line-clamp-2">
            {set.description || 'Configured standard departmental asset package.'}
          </p>

          {/* Included Tagged Hardware Items */}
          <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Included Tagged Hardware ({set.total_items || set.items?.length || 0} items)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {set.items.map((item, idx) => {
                const tagFmt = item.tag_format || getAssetTagFormat(item.category, setTag);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/70 text-xs shadow-2xs hover:border-blue-400 dark:hover:border-blue-500/50 transition-colors"
                    title={item.notes || undefined}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0">{getItemIcon(item.category)}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                        {item.quantity}x {item.category}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shrink-0">
                      {tagFmt}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stock Readiness Indicator */}
          <div className="flex items-center justify-between text-xs pt-1 px-0.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Inventory Status:</span>
            {hasStock ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {set.available_kits_count} complete {set.available_kits_count === 1 ? 'kit' : 'kits'} ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/50">
                <AlertCircle className="w-3.5 h-3.5" />
                Check in-stock items
              </span>
            )}
          </div>
        </div>

        {/* Primary Action Button - Assign to the employee (NO ICON) */}
        <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800/80">
          <Button
            variant="primary"
            size="md"
            onClick={() => openAssignModal(set)}
            className="w-full text-xs font-bold py-2.5 justify-center shadow-sm"
          >
            Assign to the employee
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Groups & Standard Bundles"
        description="Pre-configured equipment groups with standardized tag formats (TG-CPU-001, TG-LAP-001, etc.) for streamlined provisioning and inventory control."
        action={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              icon={<Tags className="w-4 h-4 text-blue-500" />}
              onClick={() => setIsTagRefModalOpen(true)}
              className="text-xs"
            >
              Tag Format Standards
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Create Asset Group
            </Button>
          </div>
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">{successBanner.message}</p>
              <p className="text-xs mt-1 text-emerald-700/80 dark:text-emerald-400">
                Custodian recipient: <strong>{successBanner.employeeName}</strong>. Assigned hardware units:{' '}
                <span className="font-mono font-semibold">{successBanner.assets.join(', ')}</span>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tag Format Bar Banner */}
      <div className="bg-[#0b1328] border border-blue-900/40 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Enterprise Asset Tagging Standards Active
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                Sequential Group Tagging
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Each group has isolated serial tagging: Group 001 (<span className="font-mono text-slate-300">TG-CPU-001</span>), Group 002 (<span className="font-mono text-slate-300">TG-CPU-002</span>), Group 008 (<span className="font-mono text-slate-300">TG-CPU-008</span>), etc.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsTagRefModalOpen(true)}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start md:self-auto py-1 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
        >
          View Full Specification Table →
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Defined Asset Groups"
          value={totalSets}
          icon={<Package className="w-5 h-5" />}
          color="blue"
          description="Configured hardware packages"
        />
        <StatsCard
          title="Ready to Deploy Kits"
          value={readySets}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          description="Full kits with in-stock stock available"
        />
        <StatsCard
          title="Configured Items"
          value={totalConfiguredItems}
          icon={<Layers className="w-5 h-5" />}
          color="purple"
          description="Cumulative hardware specifications"
        />
        <StatsCard
          title="Tagging Architecture"
          value="TG-Prefix"
          icon={<Sparkles className="w-5 h-5" />}
          color="amber"
          description="Standardized Code 128 barcodes"
        />
      </div>

      {/* Filters Bar */}
      <FilterBar
        searchPlaceholder="Search asset groups by name, code, or description..."
        search={search}
        onSearchChange={(val) => setSearch(val)}
        filters={[
          {
            key: 'department',
            label: 'Department',
            options: departmentFilterOptions,
            value: department,
            onChange: (val) => setDepartment(val),
          },
        ]}
        onReset={() => {
          setSearch('');
          setDepartment('all');
        }}
      />


      {/* Sets Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading asset groups...</p>
        </div>
      ) : assetSets.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Asset Groups Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create standard tagged hardware packages for quick onboarding and departmental deployment.
          </p>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            Create First Asset Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assetSets.map((set) => renderCard(set))}
        </div>
      )}

      {/* Modal: Official Asset Tagging Standards Reference */}
      <Modal
        isOpen={isTagRefModalOpen}
        onClose={() => setIsTagRefModalOpen(false)}
        title="Official Enterprise Asset Tagging Standards"
        description="Hardware categorization prefixes and standardized tag formats used across physical labeling and group packages."
        size="lg"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3.5">Asset Category</th>
                  <th className="py-2.5 px-3.5">Tag Format</th>
                  <th className="py-2.5 px-3.5">Prefix</th>
                  <th className="py-2.5 px-3.5">Description / Standard Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {ASSET_TAG_SPECS.map((spec, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3.5 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      {getItemIcon(spec.category)}
                      <span>{spec.category}</span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {spec.tagFormat}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-500 dark:text-slate-400">
                      {spec.prefix}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300 text-[11px]">
                      {spec.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/70 dark:border-blue-900/50 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              Dynamic Group Tagging Rule:
            </p>
            <p className="text-[11px] leading-relaxed">
              When an asset group is assigned a tag number such as <span className="font-mono font-bold text-blue-600 dark:text-blue-400">001</span>, <span className="font-mono font-bold text-blue-600 dark:text-blue-400">002</span>, or <span className="font-mono font-bold text-blue-600 dark:text-blue-400">008</span>, all hardware items in that group automatically receive that tag suffix (e.g. <span className="font-mono">TG-CPU-008</span>, <span className="font-mono">TG-MON-008</span>, <span className="font-mono">TG-LAP-008</span>).
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              * Matches enterprise hardware inventory sheet specification
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsTagRefModalOpen(false)}>
              Close Reference
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete Asset Group Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Delete Asset Group"
        description="Permanently remove this asset group bundle configuration."
        size="sm"
      >
        <div className="space-y-4">
          {setToDelete && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-1">
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                Are you sure you want to delete this group?
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                <span className="font-mono font-bold">{setToDelete.code}</span> — {setToDelete.name} ({setToDelete.total_items} items)
              </p>
            </div>
          )}
          <p className="text-xs text-slate-500">
            This will remove the group template. Existing physical hardware assets assigned to employees will remain unaffected.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Delete Group
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Assign Asset Group to Employee */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => !isDeploying && setIsAssignModalOpen(false)}
        title={selectedSetForAssign ? `Assign Group: ${selectedSetForAssign.name}` : 'Assign Group'}
        description="Deploy all physical devices in this tagged equipment package to an employee custodian in one atomic transaction."
        size="xl"
      >
        {selectedSetForAssign && (
          <form onSubmit={handleExecuteDeployment} className="space-y-5">
            {assignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                {assignError}
              </div>
            )}

            {/* Target Employee Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Employee Custodian *
                </span>
                {employees.length > 0 && selectedSetForAssign.target_department && selectedSetForAssign.target_department.toLowerCase() !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setAssignFilterByDept(!assignFilterByDept)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {assignFilterByDept
                      ? `Filter: ${selectedSetForAssign.target_department} (Click to show all ${employees.length} employees)`
                      : `Filter: Showing all ${employees.length} (Click to filter by ${selectedSetForAssign.target_department})`}
                  </button>
                )}
              </div>
              <Select
                required
                options={[
                  {
                    value: '',
                    label: filteredEmployeesForAssign.length > 0
                      ? `-- Choose Employee (${filteredEmployeesForAssign.length} available) --`
                      : '-- Loading employees... --',
                  },
                  ...filteredEmployeesForAssign.map((emp) => ({
                    value: String(emp.id),
                    label: `${emp.name || emp.full_name || 'Employee'} (${emp.employee_id || emp.email || `ID #${emp.id}`}) — ${emp.department || 'Operations'}${emp.designation ? ` • ${emp.designation}` : ''}`,
                  })),
                ]}
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                helperText={
                  filteredEmployeesForAssign.length === 0
                    ? 'Loading employee roster...'
                    : assignFilterByDept && filteredEmployeesForAssign.length < employees.length
                    ? `Showing ${filteredEmployeesForAssign.length} employees matching ${selectedSetForAssign.target_department}. Click the link above to view all ${employees.length} employees.`
                    : `Showing all ${filteredEmployeesForAssign.length} active employees.`
                }
              />
            </div>

            {/* Hardware Items Selection Table */}
            <div className="space-y-3">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
                Equipment Included in this Group ({selectedSetForAssign.items.length} Category Specs)
              </span>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {selectedSetForAssign.items.map((item, itemIdx) => {
                  const matchingInStock = inStockAssets.filter(
                    (a) =>
                      a.category?.toLowerCase() === item.category?.toLowerCase() ||
                      (item.category?.toLowerCase() === 'cpu' && a.category?.toLowerCase() === 'desktop')
                  );
                  const expectedTag = item.tag_format || getAssetTagFormat(item.category, selectedSetForAssign.tag_number || '001');

                  return Array.from({ length: item.quantity }).map((_, qIdx) => {
                    const slotKey = `${itemIdx}_${qIdx}`;
                    const currentChosen = chosenAssetIds[slotKey] || '';

                    return (
                      <div
                        key={slotKey}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-[200px]">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            {getItemIcon(item.category)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {item.category} {item.quantity > 1 ? `(#${qIdx + 1})` : ''}
                              </p>
                              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {expectedTag}
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-[10px] text-slate-400">{item.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex-1">
                          <Select
                            options={[
                              { value: '', label: `-- Select in-stock ${item.category} --` },
                              ...matchingInStock.map((a) => ({
                                value: String(a.id),
                                label: `${a.asset_number} — ${a.brand || ''} ${a.model || ''} (SN: ${a.serial_number || 'N/A'})`,
                              })),
                            ]}
                            value={currentChosen}
                            onChange={(e) =>
                              setChosenAssetIds((prev) => ({
                                ...prev,
                                [slotKey]: e.target.value,
                              }))
                            }
                            helperText={
                              matchingInStock.length === 0
                                ? `No in-stock ${item.category} available in inventory!`
                                : `${matchingInStock.length} in-stock available`
                            }
                          />
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            {/* Assignment Notes */}
            <Textarea
              label="Deployment & Handover Notes (Optional)"
              rows={2}
              placeholder="e.g. Standard workstation package provisioned for new desk assignment."
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
            />

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={isDeploying}
                onClick={() => setIsAssignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isDeploying}
                icon={<UserCheck className="w-4 h-4" />}
              >
                Deploy Group to Employee
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Create / Edit Asset Group */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSavingSet && setIsEditModalOpen(false)}
        title={editingSetId ? 'Edit Asset Group' : 'Create New Asset Group'}
        description="Configure a reusable group of hardware equipment with standardized unique tag formats and departmental employee assignment."
        size="lg"
      >
        <form onSubmit={handleSaveSet} className="space-y-4">
          {editModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>{editModalError}</span>
            </div>
          )}

          {/* Section 1: Department & Target Employee Assignment (Strictly Filtered) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-500" />
                1. Select Department & Employee
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                {filteredEmployeesForForm.length} staff in {setFormData.target_department}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Select Department *"
                  required
                  options={DEPARTMENT_FORM_OPTIONS}
                  value={setFormData.target_department}
                  onChange={(e) => {
                    const newDept = e.target.value;
                    setSetFormData((prev) => {
                      const padTag = (prev.tag_number || '001').padStart(3, '0');
                      const deptShort = newDept.slice(0, 3).toUpperCase();
                      return {
                        ...prev,
                        target_department: newDept,
                        employee_id: '', // Reset selected employee on department change
                        chosen_asset_ids: {},
                        code: prev.code.startsWith('SET-') ? `SET-${deptShort}-${padTag}` : prev.code,
                        name:
                          prev.name.includes('Hardware') || prev.name.includes('Kit') || !prev.name
                            ? `${newDept} Hardware Kit #${padTag}`
                            : prev.name,
                      };
                    });
                  }}
                  helperText="Choosing a department filters the employee list below exclusively."
                />
              </div>

              <div>
                <Select
                  label={`Select Employee in ${setFormData.target_department}`}
                  options={[
                    {
                      value: '',
                      label: editingSetId
                        ? '-- Keep template only (Assign later) --'
                        : `-- Choose Employee in ${setFormData.target_department} (${filteredEmployeesForForm.length} available) --`,
                    },
                    ...filteredEmployeesForForm.map((emp) => ({
                      value: String(emp.id),
                      label: `${emp.name || emp.full_name || 'Staff'} (${emp.employee_id || emp.email}) — ${emp.designation || emp.department}`,
                    })),
                  ]}
                  value={setFormData.employee_id}
                  onChange={(e) => {
                    const chosenEmpId = e.target.value;
                    setSetFormData((prev) => {
                      const initialChosen: { [key: string]: string } = {};
                      if (chosenEmpId) {
                        const usedAssetIds = new Set<string>();
                        prev.items.forEach((item, itemIdx) => {
                          for (let q = 0; q < item.quantity; q++) {
                            const slotKey = `${itemIdx}_${q}`;
                            const match = inStockAssets.find(
                              (a: any) =>
                                (a.category?.toLowerCase() === item.category?.toLowerCase() ||
                                  (item.category?.toLowerCase() === 'cpu' &&
                                    a.category?.toLowerCase() === 'desktop')) &&
                                !usedAssetIds.has(String(a.id))
                            );
                            if (match) {
                              initialChosen[slotKey] = String(match.id);
                              usedAssetIds.add(String(match.id));
                            } else {
                              initialChosen[slotKey] = '';
                            }
                          }
                        });
                      }
                      return {
                        ...prev,
                        employee_id: chosenEmpId,
                        chosen_asset_ids: initialChosen,
                      };
                    });
                  }}
                  helperText={
                    filteredEmployeesForForm.length === 0
                      ? `No staff members found in ${setFormData.target_department}.`
                      : `Only showing ${filteredEmployeesForForm.length} employees from ${setFormData.target_department}.`
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 2: Group Tagging Number (Unique) & Group Names */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-500" />
                2. Tag Number (Unique) & Group Information
              </span>
              {tagValidation.isDuplicate ? (
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300">
                  Tag #{tagValidation.formattedTag} Already Taken
                </span>
              ) : tagValidation.formattedTag ? (
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300">
                  ✓ Tag #{tagValidation.formattedTag} Available
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div>
                <Input
                  label="Group Tagging Number *"
                  required
                  placeholder="e.g. 008"
                  maxLength={4}
                  value={setFormData.tag_number}
                  leftIcon={<Tag className="w-4 h-4 text-blue-500" />}
                  error={tagValidation.isDuplicate ? `Tag #${tagValidation.formattedTag} already in use!` : undefined}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setSetFormData((prev) => ({ ...prev, tag_number: digits }));
                  }}
                  onBlur={() => {
                    if (setFormData.tag_number.trim()) {
                      const pad = setFormData.tag_number.replace(/\D/g, '').padStart(3, '0');
                      setSetFormData((prev) => ({ ...prev, tag_number: pad }));
                    }
                  }}
                  helperText="Any number (e.g. 001, 002, 008). Must be unique!"
                />
              </div>

              <div>
                <Input
                  label="Group Name *"
                  required
                  placeholder="e.g. Operations Workstation Group"
                  value={setFormData.name}
                  onChange={(e) => setSetFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <Input
                  label="SKU Code *"
                  required
                  placeholder="e.g. SET-OPS-008"
                  value={setFormData.code}
                  onChange={(e) => setSetFormData((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>
            </div>

            {/* Duplicate Tag Error Warning */}
            {tagValidation.isDuplicate && tagValidation.duplicateGroup && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">
                    Tag Number #{tagValidation.formattedTag} is already taken!
                  </p>
                  <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-300">
                    Already assigned to group <strong>{tagValidation.duplicateGroup.name}</strong> ({tagValidation.duplicateGroup.code}).
                    Please enter a different tag number. Duplicate tag numbers are strictly rejected.
                  </p>
                </div>
              </div>
            )}

            <div>
              <Input
                label="Group Summary Description"
                placeholder="e.g. Standard workstation equipment provisioned for technical staff"
                value={setFormData.description}
                onChange={(e) => setSetFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Group Tag Live Preview Banner */}
          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Active Group Tag:
              </span>
              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                #{setFormData.tag_number ? setFormData.tag_number.padStart(3, '0') : '001'}
              </span>
              <span className="text-slate-500 text-[11px] hidden sm:inline">
                All hardware in this group inherits this number:
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800">
                {getAssetTagFormat('CPU', setFormData.tag_number || '001')}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800">
                {getAssetTagFormat('Monitor', setFormData.tag_number || '001')}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800">
                {getAssetTagFormat('Laptop', setFormData.tag_number || '001')}
              </span>
            </div>
          </div>

          {/* Section 3: Select Hardware Assets for Group */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-500" />
                3. Select Hardware Assets Included in this Group
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItemToForm}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Add Hardware Item
              </Button>
            </div>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {setFormData.items.map((item, idx) => {
                const currentTagFmt = getAssetTagFormat(item.category, setFormData.tag_number || '001');

                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-5">
                      <Select
                        label="Equipment Category"
                        options={ASSET_TAG_SPECS.map((spec) => ({
                          value: spec.category,
                          label: `${spec.category} (${getAssetTagFormat(spec.category, setFormData.tag_number || '001')})`,
                        }))}
                        value={item.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSetFormData((prev) => {
                            const items = [...prev.items];
                            items[idx].category = val;
                            return { ...prev, items };
                          });
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        max="10"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setSetFormData((prev) => {
                            const items = [...prev.items];
                            items[idx].quantity = val;
                            return { ...prev, items };
                          });
                        }}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <Input
                        label={`Tag: ${currentTagFmt}`}
                        placeholder="Specifications / notes"
                        value={item.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSetFormData((prev) => {
                            const items = [...prev.items];
                            items[idx].notes = val;
                            return { ...prev, items };
                          });
                        }}
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItemFromForm(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 h-8 w-8"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: If Employee was Selected, Pick In-Stock Physical Asset Units */}
          {!editingSetId && setFormData.employee_id && (
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Physical Equipment Deployment to Selected Employee
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Select in-stock units to deploy to this employee upon group creation.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {setFormData.items.map((item, itemIdx) => {
                  const matchingInStock = inStockAssets.filter(
                    (a) =>
                      a.category?.toLowerCase() === item.category?.toLowerCase() ||
                      (item.category?.toLowerCase() === 'cpu' && a.category?.toLowerCase() === 'desktop')
                  );
                  const expectedTag = getAssetTagFormat(item.category, setFormData.tag_number || '001');

                  return Array.from({ length: item.quantity }).map((_, qIdx) => {
                    const slotKey = `${itemIdx}_${qIdx}`;
                    const currentChosen = setFormData.chosen_asset_ids[slotKey] || '';

                    return (
                      <div
                        key={slotKey}
                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-[180px]">
                          {getItemIcon(item.category)}
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {item.category} {item.quantity > 1 ? `(#${qIdx + 1})` : ''}
                            </p>
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200">
                              {expectedTag}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1">
                          <Select
                            options={[
                              { value: '', label: `-- Select in-stock ${item.category} --` },
                              ...matchingInStock.map((a) => ({
                                value: String(a.id),
                                label: `${a.asset_number} — ${a.brand || ''} ${a.model || ''} (SN: ${a.serial_number || 'N/A'})`,
                              })),
                            ]}
                            value={currentChosen}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSetFormData((prev) => ({
                                ...prev,
                                chosen_asset_ids: {
                                  ...prev.chosen_asset_ids,
                                  [slotKey]: val,
                                },
                              }));
                            }}
                            helperText={
                              matchingInStock.length === 0
                                ? `No in-stock ${item.category} available in inventory!`
                                : `${matchingInStock.length} units available in stock`
                            }
                          />
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isSavingSet}
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={tagValidation.isDuplicate || isSavingSet}
              isLoading={isSavingSet}
              icon={editingSetId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            >
              {tagValidation.isDuplicate
                ? 'Tag Number Already in Use'
                : editingSetId
                ? 'Save Changes'
                : setFormData.employee_id
                ? 'Create & Assign to Employee'
                : 'Create Asset Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
