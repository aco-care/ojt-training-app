interface FacilityBadgesProps {
  facilities: { id: string; name: string; is_primary: boolean }[];
}

export function FacilityBadges({ facilities }: FacilityBadgesProps) {
  if (!facilities || facilities.length === 0) {
    return <span className="text-xs text-gray-400">未所属</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {facilities.map((f) => (
        <span
          key={f.id}
          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
            f.is_primary
              ? 'bg-blue-100 text-blue-800 font-bold'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {f.name}
        </span>
      ))}
    </div>
  );
}
