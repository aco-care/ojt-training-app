// Shared between export-client.tsx (main thread) and pdf-worker.ts
// (worker thread) so both sides agree on the shape of data passed via
// postMessage.
export interface WorkerInfo {
  name: string;
  nationality: string | null;
  facility_name: string;
}

export interface MutualComments {
  trainer_comment: string | null;
  worker_comment: string | null;
  supervisor_comment_to_trainer: string | null;
  supervisor_comment_to_worker: string | null;
}

export interface TrainingItemData {
  item: {
    id: string;
    item_number: number;
    title: string;
    target_hours: number;
  };
  subtopics: { id: string; title: string; sort_order: number }[];
  sessions: {
    date: string;
    start_time: string;
    end_time: string;
    trainer_name: string;
    format: string;
    completed_subtopics: string[];
    notes: string | null;
    comments: MutualComments | null;
  }[];
  approval: { approved_by_name: string; approved_at: string } | null;
}

export interface OjtUserData {
  ojtUser: {
    id: string;
    user_initial: string;
    visit_frequency: number;
    ojt_start_date: string | null;
    ojt_status: string;
  };
  records: {
    step: string;
    step_label: string;
    attempt_number: number;
    date: string;
    companion_name: string | null;
    content: string | null;
    checklist_self: string[];
    checklist_trainer: string[];
    result: string | null;
    manager_comment: string | null;
    worker_comment: string | null;
    notes: string | null;
    comments: MutualComments | null;
  }[];
}

export interface EvaluationData {
  eval_date: string;
  scores_self: string[];
  scores_trainer: string[];
  supervisor_comment: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
}
