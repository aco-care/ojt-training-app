'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole, Qualification } from '@/lib/types';
import { ROLE_LABELS, QUALIFICATION_LABELS } from '@/lib/types';
import { FacilityMultiSelect } from '@/components/facility-multi-select';
import AddFacilityDialog from './add-facility-dialog';

interface CreateStaffFormProps {
  facilities: { id: string; name: string }[];
}

const ROLES: UserRole[] = ['admin', 'trainer', 'supervisor', 'worker', 'executive'];
const QUALIFICATIONS: Qualification[] = ['none', 'shoninsya', 'kaigofukushishi'];

export default function CreateStaffForm({ facilities }: CreateStaffFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('trainer');
  const [qualification, setQualification] = useState<Qualification>('none');
  const [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [primaryFacilityId, setPrimaryFacilityId] = useState('');

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('trainer');
    setQualification('none');
    setFacilityIds([]);
    setPrimaryFacilityId('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        qualification,
        facility_ids: facilityIds.length > 0 ? facilityIds : null,
        primary_facility_id: primaryFacilityId || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'エラーが発生しました');
      return;
    }

    setSuccess(`${data.name}（${ROLE_LABELS[data.role as UserRole]}）を作成しました`);
    reset();
    router.refresh();

    setTimeout(() => {
      setSuccess('');
      setOpen(false);
    }, 2000);
  };

  const handleFacilityChange = (selectedIds: string[], newPrimaryId: string) => {
    setFacilityIds(selectedIds);
    setPrimaryFacilityId(newPrimaryId);
  };

  const handleFacilityCreated = (id: string) => {
    setFacilityIds((prev) => [...prev, id]);
    if (facilityIds.length === 0) {
      setPrimaryFacilityId(id);
    }
    router.refresh();
  };

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => { setOpen(true); reset(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新しいスタッフを追加
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">新しいスタッフを追加</h3>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="staff-name" className="block text-sm font-medium text-gray-700">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例：山下太郎"
                />
              </div>

              <div>
                <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例：yamashita@aco-care.jp"
                />
              </div>

              <div>
                <label htmlFor="staff-password" className="block text-sm font-medium text-gray-700">
                  初期パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-password"
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="6文字以上"
                />
                <p className="mt-1 text-xs text-gray-500">初回ログイン後にスタッフ自身で変更を推奨</p>
              </div>

              <div>
                <label htmlFor="staff-role" className="block text-sm font-medium text-gray-700">
                  役割 <span className="text-red-500">*</span>
                </label>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="staff-qualification" className="block text-sm font-medium text-gray-700">
                  資格
                </label>
                <select
                  id="staff-qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value as Qualification)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>{QUALIFICATION_LABELS[q]}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-sm font-medium text-gray-700">所属施設</span>
                  <AddFacilityDialog onCreated={handleFacilityCreated} />
                </div>
                <FacilityMultiSelect
                  facilities={facilities}
                  selectedIds={facilityIds}
                  primaryId={primaryFacilityId}
                  onChange={handleFacilityChange}
                  label=""
                />
              </div>
            </div>

            {/* Role description */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700 mb-1">選択中の役割の説明</p>
              <p className="text-xs text-gray-500">
                {role === 'admin' && '全データの閲覧・編集、スタッフ管理、PDF出力、進捗ダッシュボードの全機能を使用できます。'}
                {role === 'trainer' && '担当する外国人の研修記録・OJT記録の入力・更新ができます。'}
                {role === 'supervisor' && '研修計画の承認・最終サイン、到達目標の評価を行えます。'}
                {role === 'worker' && '自分の記録の閲覧と自己評価の入力ができます。'}
                {role === 'executive' && '全事業所横断のダッシュボードを閲覧できます（読み取り専用）。'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '作成中...' : 'アカウントを作成'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
