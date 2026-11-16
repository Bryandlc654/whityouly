export type AdminTab =
  | 'overview'
  | 'users'
  | 'content'
  | 'reports'
  | 'appeals'
  | 'history'
  | 'featured'
  | 'taxonomy'
  | 'files'
  | 'support';

export type AdminNotify = (message: string) => void;
