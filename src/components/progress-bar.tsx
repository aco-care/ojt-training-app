interface ProgressBarProps {
  percentage: number;
  label?: string;
}

function getBarColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-500';
  if (percentage < 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function ProgressBar({ percentage, label }: ProgressBarProps) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const barColor = getBarColor(clampedPercentage);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-900">
            {Math.round(clampedPercentage)}%
          </span>
        </div>
      )}
      {!label && (
        <div className="mb-1 text-right">
          <span className="text-sm font-medium text-gray-900">
            {Math.round(clampedPercentage)}%
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}
