export type HandbookOutlineItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type HandbookSnippet = {
  code: string;
  runnable: boolean;
  corpus: string | null;
  line: number;
};

export type HandbookExercise = {
  number: number;
  prompt: string;
};

export type HandbookChapter = {
  slug: string;
  number: number | null;
  title: string;
  promise: string;
  concepts: string[];
  outline: HandbookOutlineItem[];
  snippets: HandbookSnippet[];
  exercises: HandbookExercise[];
  bodyMarkdown: string;
  widerSystemMarkdown: string;
};
