import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { OjtUser, OjtRecord, OjtStep, Profile } from '@/lib/types';
import { OJT_STEPS, EVAL_LABELS, OJT_STATUS_LABELS, displayName } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StatusBadge from '@/components/status-badge';
import RecordForm from './record-form';

interface OjtStepRecordPageProps {
  params: Promise<{ workerId: string; userId: string }>;
}

export default async function OjtStepRecordPage({ params }: OjtStepRecordPageProps) {
  const { workerId, userId } = await params;
  const supabase = await createClient();

  // Fetch OJT user
  const { data: ojtUser } = await supabase
    .from('ojt_users')
    .select('*')
    .eq('id', userId)
    .eq('worker_id', workerId)
    .single();

  if (!ojtUser) {
    notFound();
  }

  const user = ojtUser as OjtUser;

  // Fetch worker name
  const { data: worker } = await supabase
    .from('foreign_workers')
    .select('name')
    .eq('id', workerId)
    .single();

  // Fetch all OJT records for this user, sorted by date desc
  const { data: ojtRecords } = await supabase
    .from('ojt_records')
    .select('*, companion:profiles!ojt_records_companion_id_fkey(id, name, role, is_archived)')
    .eq('ojt_user_id', userId)
    .eq('worker_id', workerId)
    .order('date', { ascending: false });

  const records = (ojtRecords ?? []) as (OjtRecord & {
    companion: Pick<Profile, 'id' | 'name' | 'role' | 'is_archived'> | null;
  })[];

  // Fetch staff list for companion dropdown
  const { data: staffData } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['trainer', 'supervisor', 'admin'])
    .order('name');

  const staff = (staffData ?? []) as Pick<Profile, 'id' | 'name' | 'role'>[];

  // Fetch current user profile for role check
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser?.id ?? '')
    .single();

  const isManagerRole =
    currentProfile?.role === 'admin' || currentProfile?.role === 'supervisor';

  // Determine step status based on records
  const stepOrder = OJT_STEPS.map((s) => s.step);

  const getStepStatus = (
    stepKey: OjtStep
  ): { status: 'completed' | 'current' | 'pending'; attempts: number; date: string | null } => {
    const stepRecords = records.filter((r) => r.step === stepKey);
    const passed = stepRecords.find((r) => r.result === 'pass');
    const attempts = stepRecords.length;

    if (passed) {
      return { status: 'completed', attempts, date: passed.date };
    }

    // Find latest passed step index
    let latestPassedIndex = -1;
    for (const step of stepOrder) {
      const hasPassed = records.some(
        (r) => r.step === step && r.result === 'pass'
      );
      if (hasPassed) {
        latestPassedIndex = stepOrder.indexOf(step);
      }
    }

    const thisIndex = stepOrder.indexOf(stepKey);
    if (thisIndex === latestPassedIndex + 1) {
      return { status: 'current', attempts, date: null };
    }

    return { status: 'pending', attempts, date: null };
  };

  // Determine current/next step for the form default
  let currentStepKey = OJT_STEPS[0].step;
  for (let i = stepOrder.length - 1; i >= 0; i--) {
    const hasPassed = records.some(
      (r) => r.step === stepOrder[i] && r.result === 'pass'
    );
    if (hasPassed) {
      currentStepKey =
        i + 1 < stepOrder.length ? stepOrder[i + 1] : stepOrder[i];
      break;
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  const getStepLabel = (step: string) => {
    const found = OJT_STEPS.find((s) => s.step === step);
    return found ? `${found.number} ${found.label}` : step;
  };

  const getResultLabel = (result: string | null) => {
    switch (result) {
      case 'pass':
        return '次へ進む';
      case 'redo':
        return '再実施';
      case 'rollback':
        return '差し戻し';
      default:
        return '未判定';
    }
  };

  const getResultColor = (result: string | null) => {
    switch (result) {
      case 'pass':
        return 'text-green-700 bg-green-50';
      case 'redo':
        return 'text-yellow-700 bg-yellow-50';
      case 'rollback':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`利用者 ${user.user_initial} のOJT`}
        subtitle={`${worker?.name ?? ''} - 週${user.visit_frequency}回訪問`}
      />

      <div className="px-4 py-6 sm:px-6">
        {/* Status summary */}
        <div className="mb-6 flex items-center gap-3">
          <StatusBadge status={user.ojt_status} />
          <span className="text-sm text-gray-600">
            {OJT_STATUS_LABELS[user.ojt_status]}
          </span>
          {user.ojt_start_date && (
            <span className="text-sm text-gray-400">
              開始: {formatDate(user.ojt_start_date)}
            </span>
          )}
        </div>

        {/* Step Timeline / Stepper */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            OJTステップ進捗
          </h2>

          <div className="relative">
            {OJT_STEPS.map((step, index) => {
              const stepInfo = getStepStatus(step.step);
              const isLast = index === OJT_STEPS.length - 1;

              return (
                <div key={step.step} className="relative flex gap-4 pb-6">
                  {/* Vertical line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[15px] top-8 h-full w-0.5 ${
                        stepInfo.status === 'completed'
                          ? 'bg-green-300'
                          : 'bg-gray-200'
                      }`}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    {stepInfo.status === 'completed' ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </div>
                    ) : stepInfo.status === 'current' ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-sm font-bold text-blue-700">
                        {step.number}
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-50 text-sm text-gray-400">
                        {step.number}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            stepInfo.status === 'completed'
                              ? 'text-green-700'
                              : stepInfo.status === 'current'
                              ? 'text-blue-700'
                              : 'text-gray-400'
                          }`}
                        >
                          {step.number} {step.label}
                        </p>
                        <p
                          className={`mt-0.5 text-xs ${
                            stepInfo.status === 'pending'
                              ? 'text-gray-300'
                              : 'text-gray-500'
                          }`}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {/* Step metadata */}
                    {(stepInfo.attempts > 0 || stepInfo.date) && (
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        {stepInfo.attempts > 0 && (
                          <span>実施回数: {stepInfo.attempts}回</span>
                        )}
                        {stepInfo.date && (
                          <span>完了日: {formatDate(stepInfo.date)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Record Button + Form */}
        <div className="mb-6">
          <RecordForm
            workerId={workerId}
            userId={userId}
            currentStep={currentStepKey}
            staff={staff}
            isManager={isManagerRole}
            ojtStatus={user.ojt_status}
          />
        </div>

        {/* Record History */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            OJT記録一覧
          </h2>

          {records.length === 0 ? (
            <p className="text-sm text-gray-500">記録はまだありません</p>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-4"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getStepLabel(record.step)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatDate(record.date)}
                        {record.companion && (
                          <> / 同行者: {displayName(record.companion)}</>
                        )}
                        {record.attempt_number > 0 && (
                          <> / {record.attempt_number}回目</>
                        )}
                      </p>
                    </div>
                    {record.result && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getResultColor(
                          record.result
                        )}`}
                      >
                        {getResultLabel(record.result)}
                      </span>
                    )}
                  </div>

                  {/* Checklist summary */}
                  {record.checklist_self && record.checklist_self.length > 0 && (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <p className="mb-1 text-xs font-medium text-gray-600">
                        チェックリスト評価
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          本人:{' '}
                          {record.checklist_self
                            .map((r) => EVAL_LABELS[r])
                            .join(' ')}
                        </span>
                        {record.checklist_trainer &&
                          record.checklist_trainer.length > 0 && (
                            <span>
                              指導者:{' '}
                              {record.checklist_trainer
                                .map((r) => EVAL_LABELS[r])
                                .join(' ')}
                            </span>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Content / Notes */}
                  {record.content && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">実施内容:</span>{' '}
                        {record.content}
                      </p>
                    </div>
                  )}

                  {record.manager_comment && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">管理者コメント:</span>{' '}
                        {record.manager_comment}
                      </p>
                    </div>
                  )}

                  {record.notes && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">備考:</span>{' '}
                        {record.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
