export interface Book { id: string; title: string; author: string; description: string; richContent: string | null; formatVersion: number | null }
export interface Chapter { id: string; bookId: string; title: string; summary: string; position: number; richContent: string | null; formatVersion: number | null }
export interface ReadingExcerpt { id: string; chapterId: string; label: string; text: string; position: number; richContent: string | null; formatVersion: number | null }
export type ExplorationMode = 'understand' | 'question' | 'connect' | 'reflect'
export interface ReadingNote { id: string; excerptId: string; mode: ExplorationMode; text: string; createdAt: string; updatedAt: string; richContent: string | null; formatVersion: number | null }
export interface ReadingSnapshot { books: Book[]; chapters: Chapter[]; excerpts: ReadingExcerpt[]; notes: ReadingNote[] }
