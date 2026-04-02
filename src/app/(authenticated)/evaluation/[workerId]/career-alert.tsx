'use client';

interface CareerAlertProps {
  approvedAt: string;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function CareerAlert({ approvedAt }: CareerAlertProps) {
  const approvedDate = new Date(approvedAt);
  const deadlineDate = new Date(approvedDate);
  deadlineDate.setMonth(deadlineDate.getMonth() + 12);

  const now = new Date();
  const elevenMonthsAfter = new Date(approvedDate);
  elevenMonthsAfter.setMonth(elevenMonthsAfter.getMonth() + 11);

  const isNearDeadline = now >= elevenMonthsAfter;
  const isPastDeadline = now >= deadlineDate;

  if (!isNearDeadline) return null;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        isPastDeadline
          ? 'border-red-300 bg-red-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <svg
          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
            isPastDeadline ? 'text-red-600' : 'text-amber-600'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p
            className={`text-sm font-medium ${
              isPastDeadline ? 'text-red-800' : 'text-amber-800'
            }`}
          >
            {isPastDeadline
              ? 'キャリアアップ計画の更新期限を過ぎています'
              : 'キャリアアップ計画の更新期限が近づいています'}
          </p>
          <p
            className={`mt-1 text-xs ${
              isPastDeadline ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            更新期限: {formatDate(deadlineDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
