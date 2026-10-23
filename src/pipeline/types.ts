export type Source = "play_store" | "app_store" | "reddit" | "youtube" | "tradingqna";
export type RecordType = "review" | "post" | "comment";

// One piece of public writing. No usernames or author names are ever kept.
export interface Post {
  id: string; // "<source>:<native id>"
  source: Source;
  app: string | null; // app key from sources.ts, when the post is a store review
  url: string;
  createdAt: string; // ISO date
  title: string;
  text: string;
  rating: number | null;
  context: string | null; // thread title or video title the post sits under
  recordType: RecordType;
}
