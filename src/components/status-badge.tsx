type Status = 'not_started' | 'in_progress' | 'completed';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  not_started: {
    label: '未着手',
    className: 'bg-gray-100 text-gray-700 ring-gray-300',
  },
  in_progress: {
    label: '進行中',
    className: 'bg-blue-100 text-blue-700 ring-blue-300',
  },
  completed: {
    label: '完了',
    className: 'bg-green-100 text-green-700 ring-green-300',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}
