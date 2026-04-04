import { createClient } from '@/lib/supabase/server';
import type { Facility } from '@/lib/types';
import PageHeader from '@/components/page-header';
import FacilityManager from './facility-manager';

export default async function FacilitiesPage() {
  const supabase = await createClient();

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, address, type, created_at, updated_at')
    .order('name');

  const facilityList = (facilities ?? []) as Facility[];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="施設管理" subtitle={`${facilityList.length}件の施設が登録されています`} />
      <div className="px-4 py-6 sm:px-6">
        <FacilityManager facilities={facilityList} />
      </div>
    </div>
  );
}
