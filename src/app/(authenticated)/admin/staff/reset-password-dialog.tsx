'use client';

import { useState } from 'react';

interface ResetPasswordDialogProps {
  userId: string;
  userName: string;
}

export default function ResetPasswordDialog({ userId, userName }: ResetPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, new_password: password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'エラーが発生しました');
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      setPassword('');
    }, 2000);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setError(''); setSuccess(false); setPassword(''); }}
        className="text-xs font-medium text-amber-600 hover:text-amber-800"
        title="パスワードリセット"
      >
        PW変更
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">パスワードリセット</h3>
        <p className="mt-1 text-sm text-gray-500">{userName} の新しいパスワードを設定</p>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>
        )}

        {success ? (
          <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
            パスワードを変更しました
          </div>
        ) : (
          <>
            <div className="mt-4">
              <label htmlFor="new-pw" className="block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <input
                id="new-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="6文字以上"
                autoFocus
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={loading || password.length < 6}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? '変更中...' : '変更する'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
