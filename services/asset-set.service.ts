import { query, execute, withTransaction } from '@/lib/db';
import { AssetSet, AssetSetItem, CreateAssetSetInput, UpdateAssetSetInput, DeployAssetSetInput, getAssetTagFormat } from '@/types/asset-set';
import { AssignmentService } from './assignment.service';

export class AssetSetService {
  static async getAssetSets(search?: string, department?: string): Promise<AssetSet[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push('(s.name LIKE ? OR s.code LIKE ? OR s.description LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    if (department && department !== 'all') {
      conditions.push('s.target_department = ?');
      params.push(department);
    }

    const whereClause = conditions.join(' AND ');

    const sets = await query<any>(
      `SELECT 
        s.id,
        s.name,
        s.code,
        s.tag_number,
        s.target_department,
        s.description,
        s.is_active,
        s.created_at,
        s.updated_at
       FROM asset_sets s
       WHERE ${whereClause}
       ORDER BY s.id ASC`,
      params
    );

    if (sets.length === 0) return [];

    // Map each set ID to its tag_number
    const setTagMap = new Map<number, string>();
    sets.forEach((s: any, idx: number) => {
      // Ensure there's a fallback 3-digit tag
      const tag = s.tag_number || String(idx + 1).padStart(3, '0');
      setTagMap.set(s.id, tag);
    });

    // Fetch items for all sets
    const setIds = sets.map((s: any) => s.id);
    const placeholders = setIds.map(() => '?').join(', ');
    const items = await query<any>(
      `SELECT id, set_id, category, quantity, notes 
       FROM asset_set_items 
       WHERE set_id IN (${placeholders})
       ORDER BY id ASC`,
      setIds
    );

    // Fetch current in_stock counts by category to compute readiness
    const stockCounts = await query<any>(
      `SELECT category, COUNT(*) as in_stock_count 
       FROM assets 
       WHERE status = 'in_stock' 
       GROUP BY category`
    );
    const stockMap = new Map<string, number>();
    stockCounts.forEach((r: any) => {
      stockMap.set(r.category.toLowerCase(), Number(r.in_stock_count));
    });

    // Group items by set_id with customized tag format
    const itemMap = new Map<number, AssetSetItem[]>();
    items.forEach((item: any) => {
      if (!itemMap.has(item.set_id)) itemMap.set(item.set_id, []);
      const currentGroupTag = setTagMap.get(item.set_id) || '001';
      itemMap.get(item.set_id)!.push({
        id: item.id,
        set_id: item.set_id,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes,
        tag_format: getAssetTagFormat(item.category, currentGroupTag),
      });
    });

    return sets.map((s: any, idx: number) => {
      const setItemList = itemMap.get(s.id) || [];
      const totalItems = setItemList.reduce((sum, item) => sum + item.quantity, 0);
      const effectiveTag = s.tag_number || String(idx + 1).padStart(3, '0');

      // Compute how many full kits could be deployed right now
      let availableKits = setItemList.length > 0 ? 999999 : 0;
      for (const it of setItemList) {
        const inStock = stockMap.get(it.category.toLowerCase()) || 0;
        const possible = Math.floor(inStock / (it.quantity || 1));
        if (possible < availableKits) {
          availableKits = possible;
        }
      }
      if (availableKits === 999999) availableKits = 0;

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        tag_number: effectiveTag,
        target_department: s.target_department || 'All',
        description: s.description,
        is_active: Boolean(s.is_active),
        items: setItemList,
        total_items: totalItems,
        available_kits_count: availableKits,
        created_at: s.created_at,
        updated_at: s.updated_at,
      };
    });
  }

  static async getAssetSetById(id: number): Promise<AssetSet | null> {
    const sets = await query<any>(
      `SELECT id, name, code, tag_number, target_department, description, is_active, created_at, updated_at
       FROM asset_sets WHERE id = ?`,
      [id]
    );
    if (sets.length === 0) return null;

    const groupTag = sets[0].tag_number || '001';

    const items = await query<any>(
      `SELECT id, set_id, category, quantity, notes 
       FROM asset_set_items 
       WHERE set_id = ? 
       ORDER BY id ASC`,
      [id]
    );

    const mappedItems: AssetSetItem[] = items.map((it: any) => ({
      id: it.id,
      set_id: it.set_id,
      category: it.category,
      quantity: it.quantity,
      notes: it.notes,
      tag_format: getAssetTagFormat(it.category, groupTag),
    }));

    return {
      id: sets[0].id,
      name: sets[0].name,
      code: sets[0].code,
      tag_number: groupTag,
      target_department: sets[0].target_department || 'All',
      description: sets[0].description,
      is_active: Boolean(sets[0].is_active),
      items: mappedItems,
      total_items: mappedItems.reduce((sum: number, it: any) => sum + it.quantity, 0),
      created_at: sets[0].created_at,
      updated_at: sets[0].updated_at,
    };
  }

  static async createAssetSet(data: CreateAssetSetInput): Promise<AssetSet> {
    return withTransaction(async (conn) => {
      // 1. Check code uniqueness
      const [existing] = await conn.query<any[]>(
        'SELECT id FROM asset_sets WHERE code = ? LIMIT 1 FOR UPDATE',
        [data.code.trim()]
      );
      if (existing.length > 0) {
        throw new Error(`An asset set with code "${data.code}" already exists.`);
      }

      // Determine tag_number
      let tagNumber = data.tag_number ? String(data.tag_number).trim().replace(/\D/g, '') : '';
      if (tagNumber) {
        tagNumber = tagNumber.padStart(3, '0');
      } else {
        const [maxRows] = await conn.query<any[]>('SELECT MAX(CAST(tag_number AS UNSIGNED)) as max_tag FROM asset_sets');
        const nextNum = (Number(maxRows[0]?.max_tag) || 0) + 1;
        tagNumber = String(nextNum).padStart(3, '0');
      }

      // 2. Check tag_number uniqueness - strictly reject duplicate tag numbers
      const [existingTag] = await conn.query<any[]>(
        'SELECT id, name FROM asset_sets WHERE tag_number = ? LIMIT 1 FOR UPDATE',
        [tagNumber]
      );
      if (existingTag.length > 0) {
        throw new Error(`Tag Number "${tagNumber}" is already in use by group "${existingTag[0].name}". Tag numbers must be unique.`);
      }

      const [res] = await conn.execute<any>(
        `INSERT INTO asset_sets (name, code, tag_number, target_department, description, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [data.name.trim(), data.code.trim(), tagNumber, data.target_department || 'All', data.description || null]
      );
      const setId = res.insertId;

      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (!item.category || !item.category.trim()) continue;
          await conn.execute(
            `INSERT INTO asset_set_items (set_id, category, quantity, notes)
             VALUES (?, ?, ?, ?)`,
            [setId, item.category.trim(), item.quantity || 1, item.notes || null]
          );
        }
      }

      // 3. If target employee and physical assets were selected, deploy them immediately
      if (data.employee_id && data.selected_asset_ids && data.selected_asset_ids.length > 0) {
        const note = `Assigned upon creation of Asset Group [${data.code.trim()} - ${data.name.trim()}]`;
        for (const assetId of data.selected_asset_ids) {
          await conn.execute(
            `UPDATE assets SET status = 'assigned', current_employee_id = ? WHERE id = ?`,
            [data.employee_id, assetId]
          );
          await conn.execute(
            `INSERT INTO asset_assignments (asset_id, employee_id, status, notes)
             VALUES (?, ?, 'assigned', ?)`,
            [assetId, data.employee_id, note]
          );
        }
      }

      return this.getAssetSetById(setId) as Promise<AssetSet>;
    });
  }

  static async updateAssetSet(id: number, data: UpdateAssetSetInput): Promise<AssetSet> {
    return withTransaction(async (conn) => {
      const [existing] = await conn.query<any[]>(
        'SELECT id, code FROM asset_sets WHERE id = ? FOR UPDATE',
        [id]
      );
      if (existing.length === 0) {
        throw new Error('Asset set not found.');
      }

      if (data.code && data.code.trim() !== existing[0].code) {
        const [dup] = await conn.query<any[]>(
          'SELECT id FROM asset_sets WHERE code = ? AND id != ? LIMIT 1',
          [data.code.trim(), id]
        );
        if (dup.length > 0) {
          throw new Error(`An asset set with code "${data.code}" already exists.`);
        }
      }

      const fields: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name.trim()); }
      if (data.code !== undefined) { fields.push('code = ?'); params.push(data.code.trim()); }
      if (data.tag_number !== undefined) {
        const cleanTag = String(data.tag_number).trim().replace(/\D/g, '');
        const formattedTag = cleanTag ? cleanTag.padStart(3, '0') : '001';

        // Check uniqueness excluding current set
        const [dupTag] = await conn.query<any[]>(
          'SELECT id, name FROM asset_sets WHERE tag_number = ? AND id != ? LIMIT 1',
          [formattedTag, id]
        );
        if (dupTag.length > 0) {
          throw new Error(`Tag Number "${formattedTag}" is already in use by group "${dupTag[0].name}". Tag numbers must be unique.`);
        }

        fields.push('tag_number = ?');
        params.push(formattedTag);
      }
      if (data.target_department !== undefined) { fields.push('target_department = ?'); params.push(data.target_department); }
      if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
      if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

      if (fields.length > 0) {
        params.push(id);
        await conn.execute(`UPDATE asset_sets SET ${fields.join(', ')} WHERE id = ?`, params);
      }

      if (data.items !== undefined) {
        // Replace items
        await conn.execute('DELETE FROM asset_set_items WHERE set_id = ?', [id]);
        for (const item of data.items) {
          if (!item.category || !item.category.trim()) continue;
          await conn.execute(
            `INSERT INTO asset_set_items (set_id, category, quantity, notes)
             VALUES (?, ?, ?, ?)`,
            [id, item.category.trim(), item.quantity || 1, item.notes || null]
          );
        }
      }

      return this.getAssetSetById(id) as Promise<AssetSet>;
    });
  }

  static async deleteAssetSet(id: number): Promise<boolean> {
    const res = await execute('DELETE FROM asset_sets WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  static async deployAssetSetToEmployee(
    input: DeployAssetSetInput,
    userId?: number
  ): Promise<{ count: number; assets: string[]; employeeName: string }> {
    const set = await this.getAssetSetById(input.set_id);
    if (!set) {
      throw new Error('Target asset set not found.');
    }

    const note = input.notes?.trim()
      ? `Deployed via Asset Set [${set.code} - ${set.name}]: ${input.notes.trim()}`
      : `Deployed via Asset Set [${set.code} - ${set.name}]`;

    return AssignmentService.assignAssets(
      input.employee_id,
      input.selected_asset_ids,
      note,
      userId
    );
  }
}
