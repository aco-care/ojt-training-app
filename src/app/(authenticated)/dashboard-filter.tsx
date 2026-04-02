'use client';

import { useState } from 'react';

interface DashboardFilterProps {
  facilities: { id: string; name: string }[];
  children: (selectedFacilityId: string | null) => React.ReactNode;
}

export default function DashboardFilter({
  facilities,
  children,
}: DashboardFilterProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );

  return (
    <div>
      {/* Facility pill tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFacilityId(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selectedFacilityId === null
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        {facilities.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFacilityId(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedFacilityId === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {children(selectedFacilityId)}
    </div>
  );
}
