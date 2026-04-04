'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface OjtUserFormProps {
  workerId: string;
  facilities: { id: string; name: string }[];
}

export default function OjtUserForm({ workerId, facilities }: OjtUserFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFacilityId, setSelectedFacilityId] = useState(facilities[0]?.id ?? '');
  const [userInitial, setUserInitial] = useState('');
  const [visitFrequency, setVisitFrequency] = useState('1');
  const [ojtStartDate, setOjtStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const resetForm = () => {
    setSelectedFacilityId(facilities[0]?.id ?? '');
    setUserInitial('');
    setVisitFrequency('1');
    setOjtStartDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInitial.trim()) {
      setError('利用者イニシャルは必須です');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('ojt_users').insert({
      worker_id: workerId,
      facility_id: selectedFacilityId,
      user_initial: userInitial.trim(),
      visit_frequency: parseInt(visitFrequency, 10),
      ojt_start_date: ojtStartDate || null,
      ojt_status: 'not_started',
    });

    setLoading(false);

    if (insertError) {
      setError(`登録に失敗しました: ${insertError.message}`);
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
        利用者追加
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                OJT対象利用者 追加
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="ojt-facility"
                  className="block text-sm font-medium text-gray-700"
                >
                  OJT実施事業所 <span className="text-red-500">*</span>
                </label>
                <select
                  id="ojt-facility"
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ojt-user-initial"
                  className="block text-sm font-medium text-gray-700"
                >
                  利用者イニシャル <span className="text-red-500">*</span>
                </label>
                <input
                  id="ojt-user-initial"
                  type="text"
                  value={userInitial}
                  onChange={(e) => setUserInitial(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例: A"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  個人情報保護のためイニシャルで登録してください
                </p>
              </div>

              <div>
                <label
                  htmlFor="ojt-visit-frequency"
                  className="block text-sm font-medium text-gray-700"
                >
                  訪問頻度（週あたり）
                </label>
                <select
                  id="ojt-visit-frequency"
                  value={visitFrequency}
                  onChange={(e) => setVisitFrequency(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="1">週1回</option>
                  <option value="2">週2回</option>
                  <option value="3">週3回以上</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ojt-start-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  OJT開始日
                </label>
                <input
                  id="ojt-start-date"
                  type="date"
                  value={ojtStartDate}
                  onChange={(e) => setOjtStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
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
