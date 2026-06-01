import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from '@/lib/pdf-styles';
import { FORMAT_LABELS, type TrainingFormat } from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TrainingRecordPDFProps {
  worker: { name: string; nationality: string | null; facility_name: string };
  item: { item_number: number; title: string; target_hours: number };
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
  approval?: { approved_by_name: string; approved_at: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TrainingRecordPDF: React.FC<TrainingRecordPDFProps> = ({
  worker,
  item,
  subtopics,
  sessions,
  approval,
}) => {
  const totalHours = sessions.reduce(
    (sum, s) => sum + calcHours(s.start_time, s.end_time),
    0
  );

  const allCompletedIds = new Set(sessions.flatMap((s) => s.completed_subtopics));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>研修記録票</Text>
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
        </View>

        {/* Training item info */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>研修項目情報</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>研修項目名</Text>
            <Text style={styles.infoValue}>
              {item.item_number}. {item.title}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>目標時間</Text>
            <Text style={styles.infoValue}>{item.target_hours}時間</Text>
          </View>
        </View>

        {/* Subtopic checklist */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>研修細目チェックリスト</Text>
          <View style={styles.table}>
            {/* Header row */}
            <View style={styles.tableHeader}>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 36 }]}>
                <Text>No.</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { flex: 1 }]}>
                <Text>細目</Text>
              </View>
              <View style={[styles.tableCellHeader, { width: 60 }]}>
                <Text>実施済み</Text>
              </View>
            </View>
            {/* Data rows */}
            {subtopics.map((st, idx) => {
              const done = allCompletedIds.has(st.id);
              const isLast = idx === subtopics.length - 1;
              return (
                <View key={st.id} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 36, textAlign: 'center' }]}>
                    <Text>{st.sort_order}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { flex: 1 }]}>
                    <Text>{st.title}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 60, textAlign: 'center' }]}>
                    <Text>{done ? '○' : '―'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Session history */}
        <View style={styles.mb8}>
          <Text style={styles.subtitle}>研修実施記録</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 70 }]}>
                <Text>実施日</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 70 }]}>
                <Text>時間</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 60 }]}>
                <Text>指導者</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { width: 56 }]}>
                <Text>実施形式</Text>
              </View>
              <View style={[styles.tableCellHeader, styles.tableCellBorder, { flex: 1 }]}>
                <Text>実施内容</Text>
              </View>
              <View style={[styles.tableCellHeader, { width: 70 }]}>
                <Text>備考</Text>
              </View>
            </View>
            {sessions.map((s, idx) => {
              const hours = calcHours(s.start_time, s.end_time);
              const isLast = idx === sessions.length - 1;
              const subtopicTitles = subtopics
                .filter((st) => s.completed_subtopics.includes(st.id))
                .map((st) => st.title)
                .join('、');
              return (
                <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 70 }]}>
                    <Text>{formatDate(s.date)}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 70 }]}>
                    <Text>
                      {s.start_time}〜{s.end_time}
                      {'\n'}({hours.toFixed(1)}h)
                    </Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 60 }]}>
                    <Text>{s.trainer_name}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { width: 56 }]}>
                    <Text>{FORMAT_LABELS[s.format as TrainingFormat] ?? s.format}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellBorder, { flex: 1 }]}>
                    <Text>{subtopicTitles || '―'}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 70 }]}>
                    <Text>{s.notes ?? ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Cumulative hours */}
          <View style={[styles.row, { justifyContent: 'flex-end', marginTop: 4 }]}>
            <Text style={[styles.bold, { fontSize: 10 }]}>
              累計時間: {totalHours.toFixed(1)}時間 / 目標 {item.target_hours}時間
            </Text>
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
            {approval ? (
              <>
                <Text style={styles.signatureName}>{approval.approved_by_name}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureDate}>
                  日付：{formatDate(approval.approved_at)}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureDate}>日付：　　年　　月　　日</Text>
              </>
            )}
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

export default TrainingRecordPDF;
