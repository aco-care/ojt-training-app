'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const FACILITY_TYPES = ['訪問介護', '通所介護', '特別養護老人ホーム', '介護老人保健施設', 'グループホーム', 'その他'];

interface AddFacilityDialogProps {
  onCreated?: (id: string, name: string) => void;
}

export default function AddFacilityDialog({ onCreated }: AddFacilityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('');

  const reset = () => {
    setName('');
    setAddress('');
    setType('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('事業所名は必須です');
      return;
    }

    setLoading(true);
    setError('');
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from('facilities')
      .insert({
        name: name.trim(),
        address: address.trim() || null,
        type: type || null,
      })
      .select('id, name')
      .single();

    setLoading(false);

    if (insertError) {
      setError(`登録に失敗しました: ${insertError.message}`);
      return;
    }

    if (data && onCreated) {
      onCreated(data.id, data.name);
    }

    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); reset(); }}
        className="text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        + 事業所を追加
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">事業所を追加</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="new-facility-name" className="block text-sm font-medium text-gray-700">
                  事業所名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="new-facility-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例：ACO訪問介護ステーション"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="new-facility-type" className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  id="new-facility-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" className="text-gray-400">選択してください</option>
                  {FACILITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="new-facility-address" className="block text-sm font-medium text-gray-700">住所</label>
                <input
                  id="new-facility-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例：東京都新宿区..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '追加中...' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
