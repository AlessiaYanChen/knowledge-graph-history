export type ReviewStatus = 'reviewed' | 'partial' | 'pending'
export interface Question {
  id: string; title: string; eyebrow: string; summary: string; points: string[]
  context: { period: string | null; place: string | null; interpretationNote: string | null }
  sourceIds: string[]; reviewStatus: ReviewStatus
}
export interface Recommendation { fromQuestionId: string; toQuestionId: string; reason: string }
export interface MapNode { id: string; label: string; kind: string; questionId: string | null }
export interface KnowledgeRelation { fromNodeId: string; toNodeId: string; type: string; label: string; reviewStatus: ReviewStatus; sourceIds: string[] }
export interface Source { id: string; title: string; publisher: string; url: string; reviewStatus: ReviewStatus; note: string | null }
export interface ExplorationData {
  theme: string; intro: string; featuredQuestionIds: string[]; questions: Question[]
  recommendations: Recommendation[]; mapNodes: MapNode[]; knowledgeRelations: KnowledgeRelation[]; sources: Source[]
}
export interface SavedPath { id: string; title: string; questionIds: string[]; createdAt: string }
