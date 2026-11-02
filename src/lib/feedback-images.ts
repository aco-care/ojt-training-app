const PUBLIC_URL_MARKER = '/storage/v1/object/public/feedback-images/';

/**
 * feedbacks.image_url holds a storage path. Rows written while the bucket was
 * public hold a full public URL, so both forms resolve to the same path here.
 */
export function feedbackImagePath(imageUrl: string): string {
  const markerIndex = imageUrl.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex === -1) return imageUrl;
  return decodeURIComponent(imageUrl.slice(markerIndex + PUBLIC_URL_MARKER.length).split('?')[0]);
}
