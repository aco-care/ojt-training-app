import { createClient } from '@/lib/supabase/client';

export interface AuditLogParams {
  actorId: string;
  actorName: string;
  action: 'insert' | 'update' | 'delete' | 'cancel' | 'archive';
  targetTable: string;
  targetId: string;
  targetLabel: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * 操作履歴を記録する（fire-and-forget）
 * UIをブロックせず、エラーが発生しても無視する
 */
export function writeAuditLog(params: AuditLogParams): void {
  const supabase = createClient();
  void Promise.resolve(
    supabase.from('audit_logs').insert({
      actor_id: params.actorId,
      actor_name: params.actorName,
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId,
      target_label: params.targetLabel,
      description: params.description,
      metadata: params.metadata ?? {},
    })
  ).catch(() => {});
}

/** 日付を M/D 形式にフォーマット */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** ロール名を日本語に変換 */
export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: '管理者',
    supervisor: '指導責任者',
    trainer: '指導者',
    worker: '特定技能外国人',
    executive: '経営側',
  };
  return map[role] ?? role;
}

/** 資格名を日本語に変換 */
export function qualificationLabel(q: string): string {
  const map: Record<string, string> = {
    kaigofukushishi: '介護福祉士',
    shoninsya: '初任者研修',
    none: 'なし',
  };
  return map[q] ?? q;
}
