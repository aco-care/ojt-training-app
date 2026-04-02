'use client';

import { useCallback } from 'react';

interface FacilityMultiSelectProps {
  facilities: { id: string; name: string }[];
  selectedIds: string[];
  primaryId: string;
  onChange: (selectedIds: string[], primaryId: string) => void;
  label?: string;
  required?: boolean;
}

export function FacilityMultiSelect({
  facilities,
  selectedIds,
  primaryId,
  onChange,
  label = '所属施設',
  required = false,
}: FacilityMultiSelectProps) {
  const handleToggle = useCallback(
    (facilityId: string) => {
      let next: string[];
      if (selectedIds.includes(facilityId)) {
        next = selectedIds.filter((id) => id !== facilityId);
      } else {
        next = [...selectedIds, facilityId];
      }

      let nextPrimary = primaryId;
      if (next.length === 0) {
        nextPrimary = '';
      } else if (next.length === 1) {
        nextPrimary = next[0];
      } else if (!next.includes(primaryId)) {
        nextPrimary = next[0];
      }

      onChange(next, nextPrimary);
    },
    [selectedIds, primaryId, onChange],
  );

  const handlePrimary = useCallback(
    (facilityId: string) => {
      onChange(selectedIds, facilityId);
    },
    [selectedIds, onChange],
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="space-y-2">
        {facilities.map((facility) => {
          const isSelected = selectedIds.includes(facility.id);
          const isPrimary = primaryId === facility.id;

          return (
            <label
              key={facility.id}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(facility.id)}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex-1 text-sm">{facility.name}</span>
              {isSelected && selectedIds.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePrimary(facility.id);
                  }}
                  className={`shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isPrimary
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  ★主
                </button>
              )}
            </label>
          );
        })}
      </div>
      {/* Parent can render AddFacilityDialog or other controls below */}
    </div>
  );
}
