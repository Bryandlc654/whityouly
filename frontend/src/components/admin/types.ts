export type AdminTab =
  | 'overview'
  | 'users'
  | 'reports'
  | 'appeals'
  | 'history'
  | 'featured'
  | 'taxonomy'
  | 'files'
  | 'support';

export type AdminNotify = (message: string) => void;
