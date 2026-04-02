import { createClient } from '@/lib/supabase/server';
import type { Profile, Facility } from '@/lib/types';
import PageHeader from '@/components/page-header';
import StaffManager from './staff-manager';
import CreateStaffForm from './create-staff-form';

export default async function StaffPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, facility:facilities(id, name), profile_facilities(id, facility_id, is_primary, facility:facilities(id, name))')
    .order('name');

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name')
    .order('name');

  const profileList = (profiles ?? []) as (Profile & { facility: { id: string; name: string } | null; profile_facilities: { id: string; facility_id: string; is_primary: boolean; facility: { id: string; name: string } }[] })[];
  const facilityList = (facilities ?? []) as { id: string; name: string }[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="スタッフ管理" subtitle={`${profileList.length}名のスタッフが登録されています`} />
      <div className="px-4 py-6 sm:px-6">
        <CreateStaffForm facilities={facilityList} />
        <StaffManager profiles={profileList} facilities={facilityList} />
      </div>
    </div>
  );
}
