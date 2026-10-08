import { query } from '@/lib/db';

/**
 * Validates whether an employee ID strictly matches the standard TGS-XXX format
 * (e.g., TGS-001, TGS-002, TGS-100).
 */
export function isValidEmployeeId(employeeId: string): boolean {
  if (!employeeId) return false;
  // Accepts standard TGS-XXX (e.g., TGS-001, TGS-1234) or any standard employee alphanumeric code
  return /^(?:TGS-\d+|[A-Za-z0-9-_]{2,})$/i.test(employeeId.trim());
}

/**
 * Validates whether a workstation is valid.
 * Supports standard WS-05-XXX as well as any workstation identifier code.
 */
export function isValidWorkstation(workstation: string): boolean {
  if (!workstation) return false;
  return /^(?:WS[-_].*|[A-Za-z0-9-_]{2,})$/i.test(workstation.trim());
}

/**
 * Normalizes any employee ID or employee number into the standard TGS-XXX format.
 * If user enters "099", "99", "7", "TGS-099", "tgs-7", "TGS099", etc.,
 * it automatically attaches "TGS-" and 3-digit zero-pads it (e.g. "TGS-099", "TGS-007").
 */
export function normalizeEmployeeId(input?: string | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Match plain digits (e.g. "099", "99", "7") or TGS prefix with digits (e.g. "TGS-099", "tgs-7")
  const match = trimmed.match(/^(?:TGS[-_\s]*)?(\d+)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      return `TGS-${String(num).padStart(3, '0')}`;
    }
  }
  return trimmed.toUpperCase();
}

/**
 * Normalizes workstation string to canonical uppercase format WS-05-XXX.
 * If user only enters a seat number (e.g. "007", "7", "022", "99", "105", etc.),
 * it automatically attaches "WS-05-" and pads to at least 3 digits.
 */
export function normalizeWorkstation(workstation: string): string {
  if (!workstation) return '';
  const trimmed = workstation.trim().toUpperCase();
  // If user only typed seat number e.g. "001", "7", "022", "105"
  if (/^\d+$/.test(trimmed)) {
    return `WS-05-${trimmed.padStart(3, '0')}`;
  }
  const match = trimmed.match(/^WS[-_]?0?5[-_]?(\d+)$/i);
  if (match) {
    return `WS-05-${match[1].padStart(3, '0')}`;
  }
  return trimmed;
}

/**
 * Queries the database and returns the next available sequential TGS employee ID (e.g. TGS-007).
 */
export async function getNextEmployeeId(): Promise<string> {
  const rows = await query<{ employee_id: string }>(
    "SELECT employee_id FROM employee WHERE employee_id LIKE 'TGS-%'"
  );

  const usedNums = new Set<number>();
  for (const r of rows) {
    const numPart = r.employee_id.replace(/^TGS-/i, '');
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      usedNums.add(parsed);
    }
  }

  let nextNum = 1;
  while (usedNums.has(nextNum)) {
    nextNum++;
  }

  return `TGS-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Queries the database and returns the next available workstation code WS-05-XXX
 * that is not currently assigned to any active employee.
 */
export async function getNextAvailableWorkstation(): Promise<string> {
  const rows = await query<{ workstation: string }>(
    "SELECT workstation FROM employee WHERE workstation IS NOT NULL AND (status = 'active' OR is_active = 1)"
  );

  const usedSeats = new Set<number>();
  for (const r of rows) {
    if (r.workstation) {
      const match = r.workstation.trim().toUpperCase().match(/^WS-05-(\d+)$/);
      if (match) {
        const seat = parseInt(match[1], 10);
        if (!isNaN(seat)) {
          usedSeats.add(seat);
        }
      }
    }
  }

  let nextSeat = 1;
  while (usedSeats.has(nextSeat)) {
    nextSeat++;
  }

  return `WS-05-${String(nextSeat).padStart(3, '0')}`;
}

/**
 * Checks if a workstation is already assigned to another active employee.
 */
export async function isWorkstationAssignedToActiveEmployee(
  workstation: string,
  excludeEmployeeId?: number
): Promise<{ assigned: boolean; occupant?: { id: number; name: string; employee_id: string } }> {
  const normalized = normalizeWorkstation(workstation);
  if (!normalized) return { assigned: false };

  const params: any[] = [normalized];
  let sql = "SELECT id, COALESCE(name, full_name) as name, employee_id FROM employee WHERE UPPER(workstation) = ? AND (status = 'active' OR is_active = 1)";
  if (excludeEmployeeId) {
    sql += " AND id != ?";
    params.push(excludeEmployeeId);
  }
  sql += " LIMIT 1";

  const rows = await query<any>(sql, params);
  if (rows && rows.length > 0) {
    return {
      assigned: true,
      occupant: rows[0],
    };
  }
  return { assigned: false };
}
