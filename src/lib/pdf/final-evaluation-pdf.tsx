import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, colors, wrapCJK } from '@/lib/pdf-styles';
import { CHECKLIST_ITEMS, EVAL_LABELS, type EvalRating } from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FinalEvaluationPDFProps {
  worker: { name: string; nationality: string | null; facility_name: string };
  evaluation: {
    eval_date: string;
    scores_self: string[];
    scores_trainer: string[];
    supervisor_comment: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
  };
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
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function ratingSymbol(rating: string | undefined): string {
  if (!rating) return '―';
  return EVAL_LABELS[rating as EvalRating] ?? '―';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const FinalEvaluationPDF: React.FC<FinalEvaluationPDFProps> = ({
  worker,
  evaluation,
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>最終到達目標評価票</Text>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.headerMeta}>{worker.facility_name}</Text>
            <Text style={styles.headerMeta}>{today()}</Text>
          </View>
        </View>

        {/* Worker info */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>対象者情報</Text>
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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>評価実施日</Text>
            <Text style={styles.infoValue}>{formatDate(evaluation.eval_date)}</Text>
          </View>
        </View>

        {/* Main evaluation table */}
        <View style={styles.mb12}>
          <Text style={styles.subtitle}>到達目標評価</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 28 }]}>
                <Text>No.</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { flex: 1 }]}>
                <Text>評価項目</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 64 }]}>
                <Text>本人評価</Text>
              </View>
              <View style={[styles.tableCellHeader, { width: 64 }]}>
                <Text>指導者評価</Text>
              </View>
            </View>
            {CHECKLIST_ITEMS.map((itemText, idx) => {
              const isLast = idx === CHECKLIST_ITEMS.length - 1;
              return (
                <View key={idx} wrap={false} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 28, textAlign: 'center' }]}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { flex: 1 }]}>
                    <Text>{wrapCJK(itemText)}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 64, textAlign: 'center' }]}>
                    <Text style={{ fontSize: 12 }}>{ratingSymbol(evaluation.scores_self[idx])}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 64, textAlign: 'center' }]}>
                    <Text style={{ fontSize: 12 }}>{ratingSymbol(evaluation.scores_trainer[idx])}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Rating legend */}
          <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 2 }]}>
            <Text style={{ fontSize: 7, color: colors.mediumGray }}>
              ○：良好　△：おおむね良好　×：不十分
            </Text>
          </View>
        </View>

        {/* Overall assessment */}
        <View style={styles.mb12}>
          <Text style={styles.subtitle}>総合コメント</Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.black,
              padding: 10,
              minHeight: 80,
            }}
          >
            <Text style={{ fontSize: 9 }}>
              {wrapCJK(evaluation.supervisor_comment)}
            </Text>
          </View>
        </View>

        {/* Signature section - 4 boxes */}
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
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>管理者承認</Text>
            {evaluation.approved_by_name ? (
              <>
                <Text style={styles.signatureName}>{evaluation.approved_by_name}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureDate}>
                  日付：{formatDate(evaluation.approved_at)}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureDate}>日付：　　年　　月　　日</Text>
              </>
            )}
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

export default FinalEvaluationPDF;
