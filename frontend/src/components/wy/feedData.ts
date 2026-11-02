/** Forma de un relato tal como lo consume el feed visual. */
export interface FeedStory {
  id: string;
  author: string;
  initials: string;
  time: string;
  category: string;
  updateKind: string;
  updateDate: string;
  updateText: string;
  title: string;
  text: string;
  language: string;
  countryCode: string | null;
  translation?: { title: string; content: string } | null;
  support: number;
  comments: number;
  music?: string;
}
