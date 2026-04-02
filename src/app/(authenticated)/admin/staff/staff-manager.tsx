'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import ResetPasswordDialog from './reset-password-dialog';

interface StaffManagerProps {
  profiles: (Profile & { facility: { id: string; name: string } | null })[];
  facilities: { id: string; name: string }[];
}

const ROLES: UserRole[] = ['admin', 'trainer', 'supervisor', 'worker', 'executive'];

export default function StaffManager({ profiles, facilities }: StaffManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('trainer');
  const [editFacilityId, setEditFacilityId] = useState<string>('');

  const startEdit = (profile: Profile & { facility: { id: string; name: string } | null }) => {
    setEditingId(profile.id);
    setEditRole(profile.role);
    setEditFacilityId(profile.facility_id ?? '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const saveEdit = async (profileId: string) => {
    setLoading(profileId);
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: editRole,
        facility_id: editFacilityId || null,
      })
      .eq('id', profileId);

    setLoading(null);

    if (updateError) {
      setError(`更新に失敗しました: ${updateError.message}`);
      return;
    }

    setEditingId(null);
    router.refresh();
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">スタッフリスト</h2>
        <p className="mt-1 text-xs text-gray-500">
          スタッフの役割・所属の変更とパスワードリセットを行えます。
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">スタッフが登録されていません</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                {editingId === profile.id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                      <p className="text-xs text-gray-500">{profile.email}</p>
                    </div>
                    <div>
                      <label htmlFor={`role-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">役割</label>
                      <select
                        id={`role-mobile-${profile.id}`}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`facility-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">所属施設</label>
                      <select
                        id={`facility-mobile-${profile.id}`}
                        value={editFacilityId}
                        onChange={(e) => setEditFacilityId(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">未所属</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(profile.id)}
                        disabled={loading === profile.id}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading === profile.id ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{profile.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{profile.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {ROLE_LABELS[profile.role]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {profile.facility?.name ?? '未所属'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(profile)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <ResetPasswordDialog userId={profile.id} userName={profile.name} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">氏名</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">メール</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">役割</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">所属施設</th>
                  <th scope="col" className="relative px-4 py-3"><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {profile.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {profile.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {editingId === profile.id ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {ROLE_LABELS[profile.role]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {editingId === profile.id ? (
                        <select
                          value={editFacilityId}
                          onChange={(e) => setEditFacilityId(e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">未所属</option>
                          {facilities.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      ) : (
                        profile.facility?.name ?? '未所属'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      {editingId === profile.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="font-medium text-gray-600 hover:text-gray-800"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(profile.id)}
                            disabled={loading === profile.id}
                            className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {loading === profile.id ? '保存中...' : '保存'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <ResetPasswordDialog userId={profile.id} userName={profile.name} />
                          <button
                            type="button"
                            onClick={() => startEdit(profile)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            編集
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
