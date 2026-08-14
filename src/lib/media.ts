export type MediaKind = 'hero' | 'exterior' | 'family' | 'interior';

export interface ApprovedMediaAsset {
  src: string;
  srcSmall: string | null;
  srcLarge: string | null;
  width: number;
  height: number;
  origin: 'owner-original' | 'licensed' | 'ai-generated';
  rightsHolder: string | null;
  permission: 'unknown' | 'denied' | 'granted';
  permissionScope: 'website-only' | 'website-and-derivatives' | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  peopleVisibility: 'none-confirmed' | 'recognisable-present';
  peopleConsent: 'not-applicable' | 'unknown' | 'denied' | 'granted';
  credit: string | null;
}

export interface SiteMediaAsset extends ApprovedMediaAsset {
  kind: MediaKind;
  alt: { en: string; th: string; ru: string };
}

export function isPublishableMedia(asset: ApprovedMediaAsset): boolean {
  return (
    asset.permission === 'granted' &&
    asset.permissionScope === 'website-and-derivatives' &&
    Boolean(asset.rightsHolder && asset.confirmedBy && asset.confirmedAt) &&
    (asset.peopleVisibility === 'none-confirmed' || asset.peopleConsent === 'granted') &&
    (asset.origin !== 'licensed' || Boolean(asset.credit))
  );
}

export function getPublishableMedia(
  assets: readonly SiteMediaAsset[],
  kind: MediaKind,
): SiteMediaAsset | null {
  const asset = assets.find((candidate) => candidate.kind === kind);
  return asset && asset.origin !== 'ai-generated' && isPublishableMedia(asset) ? asset : null;
}
