import { Font, StyleSheet } from '@react-pdf/renderer';

// ---------------------------------------------------------------------------
// Font Registration - Noto Sans JP for Japanese text
// ---------------------------------------------------------------------------
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff',
      fontWeight: 700,
    },
  ],
});

// react-pdf's line-breaker only treats a literal ASCII space as a place it
// can wrap without hyphenating; Japanese has no spaces, so a whole comma-
// separated list (or sentence) is seen as a single unbreakable "word" and
// either overflows its box or gets force-split with an English-style "-".
// wrapCJK() inserts a real space after natural Japanese punctuation so the
// renderer gets legitimate wrap points, the same way it already wraps at
// English word boundaries. Use it for any dynamic/long Japanese text
// rendered as PDF Text (list-joined values, free-text notes/comments).
export function wrapCJK(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/([、。・（）「」『』】])/g, '$1 ');
}

// ---------------------------------------------------------------------------
// Color palette (monochrome, official document style)
// ---------------------------------------------------------------------------
export const colors = {
  black: '#000000',
  darkGray: '#333333',
  mediumGray: '#666666',
  lightGray: '#999999',
  borderGray: '#cccccc',
  headerBg: '#f0f0f0',
  white: '#ffffff',
};

// ---------------------------------------------------------------------------
// A4 dimensions in points
// ---------------------------------------------------------------------------
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// ---------------------------------------------------------------------------
// Shared StyleSheet
// ---------------------------------------------------------------------------
export const styles = StyleSheet.create({
  // Page
  page: {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    color: colors.black,
  },

  // Header area
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
    paddingBottom: 8,
  },

  // Document title
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Section subtitle
  subtitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.mediumGray,
  },

  // Header meta text (date, facility, etc.)
  headerMeta: {
    fontSize: 8,
    color: colors.mediumGray,
    textAlign: 'right',
  },

  // Info row (label: value)
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 700,
    width: 100,
  },
  infoValue: {
    fontSize: 9,
    flex: 1,
  },

  // Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.black,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderGray,
    minHeight: 18,
  },
  tableRowLast: {
    flexDirection: 'row',
    minHeight: 18,
  },
  tableCell: {
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    textAlign: 'center',
  },
  tableCellBorder: {
    borderRightWidth: 0.5,
    borderRightColor: colors.borderGray,
  },

  // Mutual comment block (trainer/worker/supervisor), shown under a session/record row
  commentBlock: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#f7f7f7',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderGray,
  },
  commentBlockLast: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#f7f7f7',
  },
  commentLine: {
    fontSize: 7,
    color: colors.darkGray,
    marginBottom: 1,
  },

  // Signature section
  signatureSection: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '23%',
    borderWidth: 1,
    borderColor: colors.black,
    padding: 6,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 4,
    textAlign: 'center',
  },
  signatureLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.black,
    marginTop: 16,
    marginBottom: 4,
  },
  signatureDate: {
    fontSize: 7,
    color: colors.mediumGray,
    textAlign: 'right',
  },
  signatureName: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderGray,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: colors.lightGray,
    textAlign: 'center',
  },

  // Utility
  bold: {
    fontWeight: 700,
  },
  textCenter: {
    textAlign: 'center',
  },
  textRight: {
    textAlign: 'right',
  },
  mb4: {
    marginBottom: 4,
  },
  mb8: {
    marginBottom: 8,
  },
  mb12: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
});
