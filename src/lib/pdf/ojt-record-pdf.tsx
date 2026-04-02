import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, colors } from '@/lib/pdf-styles';
import {
  CHECKLIST_ITEMS,
  EVAL_LABELS,
  OJT_STEPS,
  OJT_STATUS_LABELS,
  type EvalRating,
  type OjtStep,
  type OjtStatus,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface OjtRecordPDFProps {
  worker: { name: string; nationality: string | null; facility_name: string };
  ojtUser: {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '―';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function today(): string {
  return formatDate(new Date().toISOString());
}

function ratingSymbol(rating: string | undefined): string {
  if (!rating) return '―';
  return EVAL_LABELS[rating as EvalRating] ?? '―';
}

function resultLabel(result: string | null): string {
  if (!result) return '―';
  switch (result) {
    case 'pass':
      return '合格';
    case 'redo':
      return '再実施';
    case 'rollback':
      return '差戻し';
    default:
      return result;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const OjtRecordPDF: React.FC<OjtRecordPDFProps> = ({
  worker,
  ojtUser,
  records,
}) => {
  // Group records by step
  const stepOrder: OjtStep[] = ['explanation', 'pre_training', 'observation', 'main', 'independent', 'completion'];
  const recordsByStep = stepOrder.map((step) => {
    const stepInfo = OJT_STEPS.find((s) => s.step === step);
    const stepRecords = records.filter((r) => r.step === step);
    return { step, stepInfo, records: stepRecords };
  });

  // Determine step statuses for the timeline
  function stepStatus(step: OjtStep): string {
    const recs = records.filter((r) => r.step === step);
    if (recs.length === 0) return '未実施';
    const lastRecord = recs[recs.length - 1];
    if (lastRecord.result === 'pass') return '完了';
    if (lastRecord.result === 'redo') return '再実施';
    if (lastRecord.result === 'rollback') return '差戻し';
    return '実施中';
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>OJT記録票（同行訪問記録）</Text>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.headerMeta}>{worker.facility_name}</Text>
            <Text style={styles.headerMeta}>{today()}</Text>
          </View>
        </View>

        {/* Worker info */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>対象者情報</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>氏名</Text>
                <Text style={styles.infoValue}>{worker.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>国籍</Text>
                <Text style={styles.infoValue}>{worker.nationality ?? '―'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>所属事業所</Text>
                <Text style={styles.infoValue}>{worker.facility_name}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>利用者イニシャル</Text>
                <Text style={styles.infoValue}>{ojtUser.user_initial}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>訪問頻度</Text>
                <Text style={styles.infoValue}>週{ojtUser.visit_frequency}回</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>OJT開始日</Text>
                <Text style={styles.infoValue}>{formatDate(ojtUser.ojt_start_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>OJTステータス</Text>
                <Text style={styles.infoValue}>
                  {OJT_STATUS_LABELS[ojtUser.ojt_status as OjtStatus] ?? ojtUser.ojt_status}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Step progress timeline */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>ステップ進捗</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {OJT_STEPS.map((s, idx) => (
                <View
                  key={s.step}
                  style={[
                    styles.tableCellHeader,
                    idx < OJT_STEPS.length - 1 ? styles.tableCellBorder : {},
                    { flex: 1 },
                  ]}
                >
                  <Text>{s.number}</Text>
                  <Text style={{ fontSize: 6, marginTop: 1 }}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tableRowLast}>
              {OJT_STEPS.map((s, idx) => {
                const status = stepStatus(s.step);
                return (
                  <View
                    key={s.step}
                    style={[
                      styles.tableCell,
                      idx < OJT_STEPS.length - 1 ? styles.tableCellBorder : {},
                      { flex: 1, textAlign: 'center' },
                      status === '完了' ? { backgroundColor: '#e8f5e9' } : {},
                    ]}
                  >
                    <Text>{status}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Detailed records by step */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>実施記録詳細</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 70 }]}>
                <Text>ステップ</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 28 }]}>
                <Text>回</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 66 }]}>
                <Text>実施日</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 56 }]}>
                <Text>同行者</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { flex: 1 }]}>
                <Text>実施内容</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 44 }]}>
                <Text>判定</Text>
              </View>
              <View style={[styles.tableCellHeader, { width: 70 }]}>
                <Text>備考</Text>
              </View>
            </View>
            {records.map((r, idx) => {
              const isLast = idx === records.length - 1;
              return (
                <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 70 }]}>
                    <Text>{r.step_label}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 28, textAlign: 'center' }]}>
                    <Text>{r.attempt_number}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 66 }]}>
                    <Text>{formatDate(r.date)}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 56 }]}>
                    <Text>{r.companion_name ?? '―'}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { flex: 1 }]}>
                    <Text>{r.content ?? '―'}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 44, textAlign: 'center' }]}>
                    <Text>{resultLabel(r.result)}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 70 }]}>
                    <Text>{r.notes ?? ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Checklist summary table */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>到達目標チェックリスト（最新評価）</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 28 }]}>
                <Text>No.</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { flex: 1 }]}>
                <Text>評価項目</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 56 }]}>
                <Text>本人評価</Text>
              </View>
              <View style={[styles.tableCellHeader, { width: 56 }]}>
                <Text>指導者評価</Text>
              </View>
            </View>
            {CHECKLIST_ITEMS.map((itemText, idx) => {
              // Use latest record that has checklist data
              const latestWithChecklist = [...records]
                .reverse()
                .find(
                  (r) => r.checklist_self.length > idx || r.checklist_trainer.length > idx
                );
              const selfRating = latestWithChecklist?.checklist_self[idx];
              const trainerRating = latestWithChecklist?.checklist_trainer[idx];
              const isLast = idx === CHECKLIST_ITEMS.length - 1;

              return (
                <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 28, textAlign: 'center' }]}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { flex: 1 }]}>
                    <Text>{itemText}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 56, textAlign: 'center' }]}>
                    <Text>{ratingSymbol(selfRating)}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 56, textAlign: 'center' }]}>
                    <Text>{ratingSymbol(trainerRating)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Signature section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>指導者</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureDate}>日付：　　年　　月　　日</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>指導責任者</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureDate}>日付：　　年　　月　　日</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>本人</Text>
            <Text style={styles.signatureName}>{worker.name}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureDate}>日付：　　年　　月　　日</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            訪問系サービスの要件に係る報告書 準拠
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default OjtRecordPDF;
