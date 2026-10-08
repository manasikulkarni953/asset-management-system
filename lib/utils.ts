export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | null
  | { [key: string]: any }
  | ClassValue[];

export function cn(...classes: ClassValue[]): string {
  const result: string[] = [];

  function process(item: ClassValue) {
    if (!item) return;
    if (typeof item === 'string' || typeof item === 'number') {
      result.push(String(item));
    } else if (Array.isArray(item)) {
      item.forEach(process);
    } else if (typeof item === 'object') {
      for (const [key, value] of Object.entries(item)) {
        if (value) result.push(key);
      }
    }
  }

  classes.forEach(process);
  return result.join(' ');
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '$0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An unexpected error occurred';
}

export function getStatusVariant(
  status: string
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
  switch (status?.toLowerCase()) {
    case 'in_stock':
    case 'active':
    case 'resolved':
    case 'closed':
    case 'repaired':
      return 'success';

    case 'assigned':
    case 'in_progress':
    case 'reported':
    case 'minor':
      return 'info';

    case 'under_maintenance':
    case 'waiting_for_user':
    case 'on_leave':
    case 'expiring':
    case 'medium':
    case 'moderate':
    case 'under_investigation':
    case 'sent_for_repair':
      return 'warning';

    case 'retired':
    case 'terminated':
    case 'expired':
    case 'critical':
    case 'high':
    case 'severe':
    case 'total_loss':
    case 'written_off':
      return 'danger';

    case 'new':
      return 'purple';

    default:
      return 'default';
  }
}

export function formatStatusLabel(status: string): string {
  if (!status) return '';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
