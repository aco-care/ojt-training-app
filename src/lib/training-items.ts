/**
 * training_items may have multiple rows per item_number: one shared default
 * (facility_id === null) plus optional facility-specific overrides. Any code
 * that iterates "the 5 items" for a worker must resolve to exactly one row
 * per item_number using this function, or counts/labels will be duplicated.
 */
export function resolveTrainingItemsForFacility<
  T extends { item_number: number; facility_id: string | null },
>(items: T[], facilityId: string | null | undefined): T[] {
  const byNumber = new Map<number, T[]>();
  for (const item of items) {
    const arr = byNumber.get(item.item_number) ?? [];
    arr.push(item);
    byNumber.set(item.item_number, arr);
  }
  return Array.from(byNumber.entries())
    .sort(([a], [b]) => a - b)
    .map(([, variants]) => {
      const forFacility = facilityId ? variants.find((v) => v.facility_id === facilityId) : undefined;
      return forFacility ?? variants.find((v) => v.facility_id === null) ?? variants[0];
    })
    .filter((v): v is T => !!v);
}
