'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FacilityMultiSelect } from '@/components/facility-multi-select';

const NATIONALITIES = [
  'ネパール',
  'ベトナム',
  'インドネシア',
  'フィリピン',
  'ミャンマー',
  '中国',
  'タイ',
  'カンボジア',
  'モンゴル',
  'その他',
];

interface WorkerFormProps {
  facilities: { id: string; name: string }[];
}

export default function WorkerForm({ facilities }: WorkerFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [primaryFacilityId, setPrimaryFacilityId] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName('');
    setNationality('');
    setBirthDate('');
    setFacilityIds([]);
    setPrimaryFacilityId('');
    setExperienceYears('0');
    setNotes('');
    setError(null);
  };

  const handleFacilityChange = useCallback((selectedIds: string[], primaryId: string) => {
    setFacilityIds(selectedIds);
    setPrimaryFacilityId(primaryId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || facilityIds.length === 0) {
      setError('氏名と所属施設（1つ以上）は必須です');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: inserted, error: insertError } = await supabase
      .from('foreign_workers')
      .insert({
        name: name.trim(),
        nationality: nationality || null,
        birth_date: birthDate || null,
        facility_id: primaryFacilityId,
        experience_years: parseInt(experienceYears, 10) || 0,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      setLoading(false);
      setError(`登録に失敗しました: ${insertError?.message ?? '不明なエラー'}`);
      return;
    }

    const workerFacilityRows = facilityIds.map((fId) => ({
      worker_id: inserted.id,
      facility_id: fId,
      is_primary: fId === primaryFacilityId,
    }));

    const { error: facilitiesError } = await supabase
      .from('worker_facilities')
      .insert(workerFacilityRows);

    setLoading(false);

    if (facilitiesError) {
      setError(`施設の紐付けに失敗しました: ${facilitiesError.message}`);
      return;
    }

    resetForm();
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        新規登録
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">特定技能外国人 新規登録</h3>
              <button
                type="button"
                onClick={() => { setOpen(false); resetForm(); }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="worker-name" className="block text-sm font-medium text-gray-700">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="worker-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例: グエン・バン・A"
                  required
                />
              </div>

              <div>
                <label htmlFor="worker-nationality" className="block text-sm font-medium text-gray-700">国籍</label>
                <select
                  id="worker-nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="worker-birth-date" className="block text-sm font-medium text-gray-700">生年月日</label>
                <input
                  id="worker-birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <FacilityMultiSelect
                facilities={facilities}
                selectedIds={facilityIds}
                primaryId={primaryFacilityId}
                onChange={handleFacilityChange}
                label="所属施設"
                required
              />

              <div>
                <label htmlFor="worker-experience" className="block text-sm font-medium text-gray-700">経験年数</label>
                <input
                  id="worker-experience"
                  type="number"
                  min="0"
                  max="50"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="worker-notes" className="block text-sm font-medium text-gray-700">備考</label>
                <textarea
                  id="worker-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="特記事項があれば入力してください"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => { setOpen(false); resetForm(); }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
