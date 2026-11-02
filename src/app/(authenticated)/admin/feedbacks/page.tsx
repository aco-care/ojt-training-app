import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Feedback } from '@/lib/types';
import { feedbackImagePath } from '@/lib/feedback-images';
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

  const storedFeedbacks = (feedbacksData ?? []) as (Feedback & {
    sender: { id: string; name: string } | null;
  })[];

  // The bucket is private: swap each stored image for a short-lived signed URL
  const imagePaths = storedFeedbacks.flatMap((f) => (f.image_url ? [feedbackImagePath(f.image_url)] : []));
  const { data: signedImages } = imagePaths.length > 0
    ? await supabase.storage.from('feedback-images').createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map((signedImages ?? []).map((s) => [s.path, s.signedUrl]));

  const feedbacks = storedFeedbacks.map((f) => ({
    ...f,
    image_url: f.image_url ? signedUrlByPath.get(feedbackImagePath(f.image_url)) ?? null : null,
  }));

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
