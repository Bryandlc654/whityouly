export interface PrivacySettings {
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  showAvatar: boolean;
  showBio: boolean;
}

export interface CharacterSummary {
  id: string;
  name: string;
  tagline?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  privacySettings?: PrivacySettings;
}

export interface SessionInfo {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export const AVATAR_PLACEHOLDER =
  'bg-surface-container text-on-surface-variant';
