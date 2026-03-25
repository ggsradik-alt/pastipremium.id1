import { supabase } from './supabase';

export async function logAdminAction(
  adminId: number,
  action: string,
  entityType: string,
  entityId: number,
  beforeData?: Record<string, unknown> | null,
  afterData?: Record<string, unknown> | null
) {
  await supabase.from('audit_logs').insert({
    admin_id: adminId,
    actor_type: 'admin',
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: beforeData || null,
    after_data: afterData || null,
  });
}

export async function logSystemAction(
  action: string,
  entityType: string,
  entityId: number,
  beforeData?: Record<string, unknown> | null,
  afterData?: Record<string, unknown> | null
) {
  await supabase.from('audit_logs').insert({
    admin_id: null,
    actor_type: 'system',
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_data: beforeData || null,
    after_data: afterData || null,
  });
}
