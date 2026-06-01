'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole, Qualification } from '@/lib/types';
import { ROLE_LABELS, QUALIFICATION_LABELS } from '@/lib/types';
import { FacilityMultiSelect } from '@/components/facility-multi-select';
import { FacilityBadges } from '@/components/facility-badges';
import { writeAuditLog, roleLabel, qualificationLabel } from '@/lib/audit-log';
import ResetPasswordDialog from './reset-password-dialog';
import AddFacilityDialog from './add-facility-dialog';

interface ProfileFacility {
  id: string;
  facility_id: string;
  is_primary: boolean;
  facility: { id: string; name: string };
}

interface StaffManagerProps {
  profiles: (Profile & { facility: { id: string; name: string } | null; profile_facilities: ProfileFacility[] })[];
  facilities: { id: string; name: string }[];
  currentUserId: string;
  currentUserName: string;
}

const ROLES: UserRole[] = ['admin', 'trainer', 'supervisor', 'worker', 'executive'];
const QUALIFICATIONS: Qualification[] = ['none', 'shoninsya', 'kaigofukushishi'];

function qualificationBadgeColor(q: Qualification): string {
  switch (q) {
    case 'kaigofukushishi': return 'bg-green-100 text-green-700';
    case 'shoninsya': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

export default function StaffManager({ profiles, facilities, currentUserId, currentUserName }: StaffManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('trainer');
  const [editFacilityIds, setEditFacilityIds] = useState<string[]>([]);
  const [editPrimaryFacilityId, setEditPrimaryFacilityId] = useState<string>('');
  const [editQualification, setEditQualification] = useState<Qualification>('none');
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [resetPwProfile, setResetPwProfile] = useState<{ id: string; name: string } | null>(null);

  const activeProfiles = profiles.filter((p) => !p.is_archived);
  const archivedProfiles = profiles.filter((p) => p.is_archived);
  const displayedProfiles = showArchived ? archivedProfiles : activeProfiles;

  const startEdit = (profile: StaffManagerProps['profiles'][number]) => {
    setEditingId(profile.id);
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditRole(profile.role);
    setEditQualification((profile as Profile).qualification ?? 'none');
    const pf = profile.profile_facilities ?? [];
    setEditFacilityIds(pf.map((r) => r.facility_id));
    const primary = pf.find((r) => r.is_primary);
    setEditPrimaryFacilityId(primary?.facility_id ?? (pf.length > 0 ? pf[0].facility_id : ''));
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

    // 1. Update profiles.facility_id to primary for backward compat
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: editName,
        email: editEmail,
        role: editRole,
        qualification: editQualification,
        facility_id: editPrimaryFacilityId || null,
      })
      .eq('id', profileId);

    if (updateError) {
      setLoading(null);
      setError(`更新に失敗しました: ${updateError.message}`);
      return;
    }

    // 2. Delete old profile_facilities rows
    const { error: deleteError } = await supabase
      .from('profile_facilities')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      setLoading(null);
      setError(`施設割り当ての削除に失敗しました: ${deleteError.message}`);
      return;
    }

    // 3. Insert new profile_facilities rows
    if (editFacilityIds.length > 0) {
      const rows = editFacilityIds.map((fid) => ({
        profile_id: profileId,
        facility_id: fid,
        is_primary: fid === editPrimaryFacilityId,
      }));

      const { error: insertError } = await supabase
        .from('profile_facilities')
        .insert(rows);

      if (insertError) {
        setLoading(null);
        setError(`施設割り当ての保存に失敗しました: ${insertError.message}`);
        return;
      }
    }

    // Audit log: compare old vs new values
    const target = profiles.find((p) => p.id === profileId);
    if (target) {
      const changes: string[] = [];
      if (editName !== target.name) changes.push(`氏名を ${target.name} → ${editName} に変更`);
      if (editRole !== target.role) changes.push(`役職を ${roleLabel(target.role)} → ${roleLabel(editRole)} に変更`);
      const oldQual = (target as Profile).qualification ?? 'none';
      if (editQualification !== oldQual) changes.push(`資格を ${qualificationLabel(oldQual)} → ${qualificationLabel(editQualification)} に変更`);
      if (changes.length > 0) {
        writeAuditLog({
          actorId: currentUserId,
          actorName: currentUserName,
          action: 'update',
          targetTable: 'profiles',
          targetId: profileId,
          targetLabel: target.name,
          description: `${target.name}の${changes.join('、')}`,
        });
      }
    }

    setLoading(null);
    setEditingId(null);
    router.refresh();
  };

  const toggleArchive = async (profileId: string, currentlyArchived: boolean, reason?: string) => {
    const action = currentlyArchived ? '復元' : (reason ?? '退職');
    if (!confirm(`このスタッフを${action}処理しますか？\n※研修記録やOJT記録は影響を受けません。`)) {
      return;
    }

    setLoading(profileId);
    setError(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_archived: !currentlyArchived,
        archived_at: currentlyArchived ? null : new Date().toISOString(),
      })
      .eq('id', profileId);

    setLoading(null);

    if (updateError) {
      setError(`${action}に失敗しました: ${updateError.message}`);
      return;
    }

    // Audit log
    const target = profiles.find((p) => p.id === profileId);
    if (target) {
      const desc = currentlyArchived
        ? `${target.name}を復元しました`
        : `${target.name}を退職処理しました`;
      writeAuditLog({
        actorId: currentUserId,
        actorName: currentUserName,
        action: 'archive',
        targetTable: 'profiles',
        targetId: profileId,
        targetLabel: target.name,
        description: desc,
      });
    }

    router.refresh();
  };

  const resendInvite = async (email: string) => {
    if (!confirm(`${email} に招待メールを再送しますか？`)) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '再送に失敗しました');
        return;
      }
      alert('招待メールを再送しました');
    } catch {
      setError('招待メールの再送に失敗しました');
    }
  };

  const handleFacilityChange = (selectedIds: string[], newPrimaryId: string) => {
    setEditFacilityIds(selectedIds);
    setEditPrimaryFacilityId(newPrimaryId);
  };

  const handleFacilityCreated = (id: string) => {
    setEditFacilityIds((prev) => [...prev, id]);
    if (editFacilityIds.length === 0) {
      setEditPrimaryFacilityId(id);
    }
    router.refresh();
  };

  const getBadgesData = (pf: ProfileFacility[]) =>
    pf.map((r) => ({ id: r.facility.id, name: r.facility.name, is_primary: r.is_primary }));

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">スタッフリスト</h2>
        <p className="mt-1 text-xs text-gray-500">
          役割・所属の変更、パスワードリセット、アーカイブ（退職処理）を行えます。
        </p>
      </div>

      {/* Tab: Active / Archived */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setShowArchived(false)}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !showArchived
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          在籍中 ({activeProfiles.length})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            showArchived
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          退職・異動済み ({archivedProfiles.length})
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {displayedProfiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {showArchived ? '退職・異動済みのスタッフはいません' : 'スタッフが登録されていません'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {displayedProfiles.map((profile) => (
              <div
                key={profile.id}
                className={`rounded-lg border bg-white p-4 shadow-sm ${
                  profile.is_archived ? 'border-gray-100 opacity-75' : 'border-gray-200'
                }`}
              >
                {editingId === profile.id ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor={`name-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">氏名</label>
                      <input
                        id={`name-mobile-${profile.id}`}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`email-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">メールアドレス</label>
                      <input
                        id={`email-mobile-${profile.id}`}
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`role-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">役割</label>
                      <select
                        id={`role-mobile-${profile.id}`}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`qual-mobile-${profile.id}`} className="block text-xs font-medium text-gray-700">資格</label>
                      <select
                        id={`qual-mobile-${profile.id}`}
                        value={editQualification}
                        onChange={(e) => setEditQualification(e.target.value as Qualification)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {QUALIFICATIONS.map((q) => (
                          <option key={q} value={q}>{QUALIFICATION_LABELS[q]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="block text-xs font-medium text-gray-700">所属施設</span>
                        <AddFacilityDialog onCreated={handleFacilityCreated} />
                      </div>
                      <FacilityMultiSelect
                        facilities={facilities}
                        selectedIds={editFacilityIds}
                        primaryId={editPrimaryFacilityId}
                        onChange={handleFacilityChange}
                        label=""
                      />
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${profile.is_archived ? 'text-gray-400' : 'text-gray-900'}`}>
                          {profile.name}
                        </p>
                        {(profile as Profile).qualification && (profile as Profile).qualification !== 'none' && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${qualificationBadgeColor((profile as Profile).qualification)}`}>
                            {QUALIFICATION_LABELS[(profile as Profile).qualification]}
                          </span>
                        )}
                        {profile.is_archived && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            退職済み
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{profile.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          profile.is_archived ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ROLE_LABELS[profile.role]}
                        </span>
                        <FacilityBadges facilities={getBadgesData(profile.profile_facilities ?? [])} />
                      </div>
                      {profile.archived_at && (
                        <p className="mt-1 text-[10px] text-gray-400">
                          アーカイブ日: {new Date(profile.archived_at).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-2">
                      {!profile.is_archived && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(profile)}
                            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <ResetPasswordDialog userId={profile.id} userName={profile.name} />
                        </div>
                      )}
                      <div className="flex items-center gap-3 border-t border-gray-100 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleArchive(profile.id, profile.is_archived)}
                          disabled={loading === profile.id}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            profile.is_archived
                              ? 'text-green-600 hover:bg-green-50 hover:text-green-800'
                              : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                          } disabled:opacity-50`}
                        >
                          {loading === profile.id ? '処理中...' : profile.is_archived ? '復元' : '退職処理'}
                        </button>
                        {!profile.is_archived && (
                          <button
                            type="button"
                            onClick={() => toggleArchive(profile.id, false, '異動')}
                            disabled={loading === profile.id}
                            className="rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                          >
                            異動処理
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="w-full divide-y divide-gray-200 table-fixed text-xs">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '38%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500">氏名</th>
                  <th scope="col" className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500">メール</th>
                  <th scope="col" className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500">役割</th>
                  <th scope="col" className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500">所属施設</th>
                  <th scope="col" className="relative px-1 py-2"><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedProfiles.map((profile) => (
                  <tr key={profile.id} className={`transition-colors ${profile.is_archived ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'}`}>
                    <td className="px-2 py-2 font-medium text-gray-900">
                      {editingId === profile.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <span>{profile.name}</span>
                          {(profile as Profile).qualification && (profile as Profile).qualification !== 'none' && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${qualificationBadgeColor((profile as Profile).qualification)}`}>
                              {QUALIFICATION_LABELS[(profile as Profile).qualification]}
                            </span>
                          )}
                          {profile.is_archived && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">退職済み</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-500 break-all">
                      {editingId === profile.id ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        profile.email
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {editingId === profile.id ? (
                        <div className="space-y-1">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                          <select
                            value={editQualification}
                            onChange={(e) => setEditQualification(e.target.value as Qualification)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {QUALIFICATIONS.map((q) => (
                              <option key={q} value={q}>{QUALIFICATION_LABELS[q]}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          profile.is_archived ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ROLE_LABELS[profile.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-500">
                      {editingId === profile.id ? (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <AddFacilityDialog onCreated={handleFacilityCreated} />
                          </div>
                          <FacilityMultiSelect
                            facilities={facilities}
                            selectedIds={editFacilityIds}
                            primaryId={editPrimaryFacilityId}
                            onChange={handleFacilityChange}
                            label=""
                          />
                        </div>
                      ) : (
                        <FacilityBadges facilities={getBadgesData(profile.profile_facilities ?? [])} />
                      )}
                    </td>
                    <td className="px-1 py-2 text-right">
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
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setMenuOpenId(menuOpenId === profile.id ? null : profile.id)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="操作メニュー"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                            </svg>
                          </button>
                          {menuOpenId === profile.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                              <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                {!profile.is_archived && (
                                  <>
                                    <button type="button" onClick={() => { setMenuOpenId(null); startEdit(profile); }} className="flex w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">編集</button>
                                    <button type="button" onClick={() => { setMenuOpenId(null); resendInvite(profile.email); }} className="flex w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">招待再送</button>
                                    <button type="button" onClick={() => { setMenuOpenId(null); setResetPwProfile({ id: profile.id, name: profile.name }); }} className="flex w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">PW変更</button>
                                    <div className="my-1 border-t border-gray-100" />
                                    <button type="button" onClick={() => { setMenuOpenId(null); toggleArchive(profile.id, false, '異動'); }} disabled={loading === profile.id} className="flex w-full px-3 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 disabled:opacity-50">異動処理</button>
                                  </>
                                )}
                                <button type="button" onClick={() => { setMenuOpenId(null); toggleArchive(profile.id, profile.is_archived); }} disabled={loading === profile.id} className={`flex w-full px-3 py-2 text-left text-sm ${profile.is_archived ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'} disabled:opacity-50`}>
                                  {loading === profile.id ? '処理中...' : profile.is_archived ? '復元' : '退職処理'}
                                </button>
                              </div>
                            </>
                          )}
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

      {/* PW reset dialog triggered from dropdown menu */}
      {resetPwProfile && (
        <ResetPasswordDialog
          key={resetPwProfile.id}
          userId={resetPwProfile.id}
          userName={resetPwProfile.name}
          defaultOpen
          onClose={() => setResetPwProfile(null)}
        />
      )}
    </>
  );
}
