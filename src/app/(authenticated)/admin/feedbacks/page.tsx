import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Feedback } from '@/lib/types';
import PageHeader from '@/components/page-header';
import FeedbackList from './feedback-list';

export default async function AdminFeedbacksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') redirect('/');

  // Fetch feedbacks with sender profile
  const { data: feedbacksData } = await supabase
    .from('feedbacks')
    .select('*, sender:profiles!feedbacks_sender_id_fkey(id, name)')
    .order('created_at', { ascending: false });

  const feedbacks = (feedbacksData ?? []) as (Feedback & {
    sender: { id: string; name: string } | null;
  })[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="フィードバック管理"
        subtitle="ユーザーからの改善要望・バグ報告"
      />
      <div className="px-4 py-6 sm:px-6">
        <FeedbackList feedbacks={feedbacks} currentUserId={user.id} />
      </div>
    </div>
  );
}
