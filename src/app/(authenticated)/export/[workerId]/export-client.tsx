'use client';

import { useState, useCallback, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';

// ---------------------------------------------------------------------------
// Props types (serializable from server component)
// ---------------------------------------------------------------------------
interface WorkerInfo {
  name: string;
  nationality: string | null;
  facility_name: string;
}

interface TrainingItemData {
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
  }[];
  approval: { approved_by_name: string; approved_at: string } | null;
}

interface OjtUserData {
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
    notes: string | null;
  }[];
}

interface EvaluationData {
  eval_date: string;
  scores_self: string[];
  scores_trainer: string[];
  supervisor_comment: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
}

interface ExportClientProps {
  worker: WorkerInfo;
  trainingData: TrainingItemData[];
  ojtData: OjtUserData[];
  evaluationData: EvaluationData | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ExportClient({
  worker,
  trainingData,
  ojtData,
  evaluationData,
}: ExportClientProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const handleBulkPdf = useCallback(async () => {
    setIsBulkLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { PDFDocument } = await import('pdf-lib');
      const { default: TrainingRecordPDF } = await import(
        '@/lib/pdf/training-record-pdf'
      );
      const { default: OjtRecordPDF } = await import('@/lib/pdf/ojt-record-pdf');
      const { default: FinalEvaluationPDF } = await import(
        '@/lib/pdf/final-evaluation-pdf'
      );

      const docs: ReactElement[] = [
        ...trainingData.map((itemData) => (
          <TrainingRecordPDF
            key={`training-${itemData.item.id}`}
            worker={worker}
            item={itemData.item}
            subtopics={itemData.subtopics}
            sessions={itemData.sessions}
            approval={itemData.approval}
          />
        )),
        ...ojtData.map((userData) => (
          <OjtRecordPDF
            key={`ojt-${userData.ojtUser.id}`}
            worker={worker}
            ojtUser={userData.ojtUser}
            records={userData.records}
          />
        )),
        ...(evaluationData
          ? [
              <FinalEvaluationPDF
                key="evaluation"
                worker={worker}
                evaluation={evaluationData}
              />,
            ]
          : []),
      ];

      if (docs.length === 0) {
        alert('出力できる帳票がありません。');
        return;
      }

      const mergedPdf = await PDFDocument.create();
      for (const doc of docs) {
        // react-pdf's `pdf()` types its argument as ReactElement<DocumentProps>,
        // but our children are the higher-level components (TrainingRecordPDF
        // etc.) that render a <Document> internally — this is the same usage
        // as the individual export handlers above, just gathered into a list.
        const blob = await pdf(doc as ReactElement<DocumentProps>).toBlob();
        const bytes = await blob.arrayBuffer();
        const sourcePdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `研修OJT記録一式_${worker.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Bulk PDF generation failed:', err);
      alert('一括PDF出力に失敗しました。');
    } finally {
      setIsBulkLoading(false);
    }
  }, [worker, trainingData, ojtData, evaluationData]);

  const handleTrainingPdf = useCallback(
    async (itemData: TrainingItemData) => {
      const key = `training-${itemData.item.id}`;
      setLoadingKey(key);
      try {
        const { pdf } = await import('@react-pdf/renderer');
        const { default: TrainingRecordPDF } = await import(
          '@/lib/pdf/training-record-pdf'
        );

        const blob = await pdf(
          <TrainingRecordPDF
            worker={worker}
            item={itemData.item}
            subtopics={itemData.subtopics}
            sessions={itemData.sessions}
            approval={itemData.approval}
          />,
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `研修記録票_${itemData.item.item_number}_${worker.name}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('PDF generation failed:', err);
        alert('PDF生成に失敗しました。');
      } finally {
        setLoadingKey(null);
      }
    },
    [worker],
  );

  const handleOjtPdf = useCallback(
    async (userData: OjtUserData) => {
      const key = `ojt-${userData.ojtUser.id}`;
      setLoadingKey(key);
      try {
        const { pdf } = await import('@react-pdf/renderer');
        const { default: OjtRecordPDF } = await import(
          '@/lib/pdf/ojt-record-pdf'
        );

        const blob = await pdf(
          <OjtRecordPDF
            worker={worker}
            ojtUser={userData.ojtUser}
            records={userData.records}
          />,
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OJT記録票_${userData.ojtUser.user_initial}_${worker.name}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('PDF generation failed:', err);
        alert('PDF生成に失敗しました。');
      } finally {
        setLoadingKey(null);
      }
    },
    [worker],
  );

  const handleEvaluationPdf = useCallback(async () => {
    if (!evaluationData) return;
    const key = 'evaluation';
    setLoadingKey(key);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { default: FinalEvaluationPDF } = await import(
        '@/lib/pdf/final-evaluation-pdf'
      );

      const blob = await pdf(
        <FinalEvaluationPDF worker={worker} evaluation={evaluationData} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `最終評価票_${worker.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF生成に失敗しました。');
    } finally {
      setLoadingKey(null);
    }
  }, [worker, evaluationData]);

  const ITEM_NUMBERS = ['①', '②', '③', '④', '⑤'];
  const bulkCount = trainingData.length + ojtData.length + (evaluationData ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Bulk export */}
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">すべての帳票を一括出力</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {bulkCount > 0
              ? `研修記録票・OJT記録票・最終評価票を1つのPDFにまとめて出力します（全${bulkCount}件）`
              : '出力できる帳票がまだありません'}
          </p>
        </div>
        <button
          type="button"
          disabled={isBulkLoading || loadingKey !== null || bulkCount === 0}
          onClick={handleBulkPdf}
          className="ml-3 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBulkLoading ? (
            <>
              <svg
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              一括出力
            </>
          )}
        </button>
      </div>

      {/* Training Record PDFs */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          研修記録票
        </h2>
        {trainingData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">研修項目がありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {trainingData.map((itemData, idx) => {
              const key = `training-${itemData.item.id}`;
              const isLoading = loadingKey === key;
              return (
                <div
                  key={itemData.item.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="mr-1 text-blue-600">
                        {ITEM_NUMBERS[idx] ?? `${idx + 1}`}
                      </span>
                      {itemData.item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {itemData.sessions.length}回実施
                      {itemData.approval ? ' / 承認済み' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || loadingKey !== null}
                    onClick={() => handleTrainingPdf(itemData)}
                    className="ml-3 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="mr-1.5 h-3 w-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg
                          className="mr-1.5 h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        PDF出力
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* OJT Record PDFs */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          OJT記録票
        </h2>
        {ojtData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">OJT対象利用者がいません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ojtData.map((userData) => {
              const key = `ojt-${userData.ojtUser.id}`;
              const isLoading = loadingKey === key;
              return (
                <div
                  key={userData.ojtUser.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {userData.ojtUser.user_initial}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          利用者 {userData.ojtUser.user_initial}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userData.records.length}件の記録
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || loadingKey !== null}
                    onClick={() => handleOjtPdf(userData)}
                    className="ml-3 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="mr-1.5 h-3 w-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg
                          className="mr-1.5 h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        PDF出力
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Final Evaluation PDF */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          最終評価票
        </h2>
        {!evaluationData ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">最終評価が未実施です</p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                最終到達目標評価票
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                評価日: {evaluationData.eval_date}
                {evaluationData.approved_by_name
                  ? ` / 承認: ${evaluationData.approved_by_name}`
                  : ' / 未承認'}
              </p>
            </div>
            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={handleEvaluationPdf}
              className="ml-3 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingKey === 'evaluation' ? (
                <>
                  <svg
                    className="mr-1.5 h-3 w-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  生成中...
                </>
              ) : (
                <>
                  <svg
                    className="mr-1.5 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  PDF出力
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
