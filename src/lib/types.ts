// ============================================================
// ACO 研修・OJT マネージャー — TypeScript Type Definitions
// ============================================================

export type UserRole = 'admin' | 'trainer' | 'supervisor' | 'worker' | 'executive';
export type TrainingFormat = 'classroom' | 'ojt' | 'roleplay' | 'simulation';
export type TrainingStatus = 'not_started' | 'in_progress' | 'completed';
export type OjtStep = 'matching' | 'explanation' | 'pre_training' | 'observation' | 'main' | 'independent' | 'completion';
export type OjtResult = 'pass' | 'redo' | 'rollback';
export type OjtStatus = 'not_started' | 'in_progress' | 'completed';
export type EvalRating = 'good' | 'fair' | 'poor'; // ○ △ ×

export interface Facility {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  facility_id: string | null;
  certifications: string[] | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  facility?: Facility;
  profile_facilities?: ProfileFacility[];
}

export interface ProfileFacility {
  id: string;
  profile_id: string;
  facility_id: string;
  is_primary: boolean;
  created_at: string;
  facility?: Facility;
}

export interface WorkerFacility {
  id: string;
  worker_id: string;
  facility_id: string;
  is_primary: boolean;
  created_at: string;
  facility?: Facility;
}

/** アーカイブ済みスタッフの表示名を返す */
export function displayName(profile: Pick<Profile, 'name' | 'is_archived'>): string {
  return profile.is_archived ? `${profile.name}（退職済み）` : profile.name;
}

export interface ForeignWorker {
  id: string;
  name: string;
  nationality: string | null;
  birth_date: string | null;
  facility_id: string;
  experience_years: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  facility?: Facility;
  worker_facilities?: WorkerFacility[];
}

export interface TrainingItem {
  id: string;
  item_number: number;
  title: string;
  target_hours: number;
  target_sessions: number;
  sort_order: number;
  subtopics?: TrainingSubtopic[];
}

export interface TrainingSubtopic {
  id: string;
  item_id: string;
  title: string;
  sort_order: number;
}

export interface TrainingSession {
  id: string;
  worker_id: string;
  item_id: string;
  date: string;
  start_time: string;
  end_time: string;
  trainer_id: string;
  format: TrainingFormat;
  completed_subtopics: string[];
  notes: string | null;
  facility_id?: string;
  created_at: string;
  updated_at: string;
  trainer?: Profile;
  item?: TrainingItem;
  facility?: Facility;
}

export interface TrainingApproval {
  id: string;
  worker_id: string;
  item_id: string;
  status: TrainingStatus;
  approved_by: string | null;
  approved_at: string | null;
}

export interface OjtUser {
  id: string;
  worker_id: string;
  facility_id: string;
  user_initial: string;
  visit_frequency: number;
  ojt_start_date: string | null;
  ojt_status: OjtStatus;
  created_at: string;
  updated_at: string;
}

export interface OjtRecord {
  id: string;
  worker_id: string;
  ojt_user_id: string;
  step: OjtStep;
  attempt_number: number;
  date: string;
  companion_id: string | null;
  content: string | null;
  checklist_self: EvalRating[];
  checklist_trainer: EvalRating[];
  result: OjtResult | null;
  manager_comment: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  companion?: Profile;
}

export interface FinalEvaluation {
  id: string;
  worker_id: string;
  eval_date: string;
  scores_self: EvalRating[];
  scores_trainer: EvalRating[];
  supervisor_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

// OJTステップ定義（報告書準拠）
export const OJT_STEPS: { step: OjtStep; number: string; label: string; description: string }[] = [
  { step: 'matching', number: '①', label: '利用者の選定・マッチング', description: '管理者が利用者を選定し、特定技能外国人とマッチング' },
  { step: 'explanation', number: '②', label: '利用者・家族への説明', description: '訪問サービス提供体制とOJTを行うことについて書面にて説明し署名を取得' },
  { step: 'pre_training', number: '③', label: '事前研修', description: '介護記録・個別援助計画の理解、利用者居室確認を事業所内研修で実施' },
  { step: 'observation', number: '④', label: 'OJT 1回目（見学）', description: '同行職員の業務を見学。訪問終了後に業務の確認と復習' },
  { step: 'main', number: '⑤', label: 'OJT 2回目（メイン）', description: '特定技能外国人メインで支援、同行職員はすぐ近くでサポート' },
  { step: 'independent', number: '⑥', label: 'OJT 3回目（独立）', description: '特定技能外国人一人で支援、同行者は待機' },
  { step: 'completion', number: '⑦', label: 'OJT完了判定', description: '問題なければ当該利用者のOJT終了' },
];

// 到達目標チェックシート8項目（報告書準拠）
export const CHECKLIST_ITEMS = [
  'サービス内容の手順を理解しているか',
  'サービス内容を実施できているか',
  '緊急体制・連携を理解しているか',
  '記録・報告ができているか',
  '他職種と連携できているか',
  '利用者とコミュニケーションが取れているか',
  'アセスメント記録により利用者の状態像・周辺環境等を理解しているか',
  '個別援助計画に沿った支援を提供できているか',
];

// 評価ラベル
export const EVAL_LABELS: Record<EvalRating, string> = {
  good: '○',
  fair: '△',
  poor: '×',
};

// 研修形式ラベル
export const FORMAT_LABELS: Record<TrainingFormat, string> = {
  classroom: '対面',
  ojt: 'OJT',
  roleplay: 'ロールプレイ',
  simulation: 'シミュレーション',
};

// ロールラベル
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  trainer: '指導者',
  supervisor: '指導責任者',
  worker: '特定技能外国人',
  executive: '経営側',
};

// ステータスラベル
export const STATUS_LABELS: Record<TrainingStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
};

export const OJT_STATUS_LABELS: Record<OjtStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
};
