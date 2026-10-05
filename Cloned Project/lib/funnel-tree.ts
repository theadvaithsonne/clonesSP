// Shared funnel-tree types for both the admin global-template studio and the
// user-facing per-funnel builder. The tree shape is identical; only the API
// backing it differs.
export interface FunnelVideo {
  id?: string;
  key?: string;
  title: string;
  subtitle: string;
  s3Key?: string;
  youtubeId?: string;
  thumbnailKey?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  order: number;
}
export interface FunnelNode {
  id?: string;
  key?: string;
  label: string;
  order: number;
  prompt?: string;
  videos: FunnelVideo[];
  children: FunnelNode[];
}
export interface FunnelTemplate {
  rootQuestion: string;
  options: FunnelNode[];
}
