export interface Book { id: string; title: string; author: string; description: string }
export interface Chapter { id: string; bookId: string; title: string; summary: string; position: number }
export interface ReadingExcerpt { id: string; chapterId: string; label: string; text: string; position: number }
export type ExplorationMode = 'understand' | 'question' | 'connect' | 'reflect'
export interface ReadingNote { id: string; excerptId: string; mode: ExplorationMode; text: string; createdAt: string; updatedAt: string }
export interface ReadingSnapshot { books: Book[]; chapters: Chapter[]; excerpts: ReadingExcerpt[]; notes: ReadingNote[] }
