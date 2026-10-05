export const queryKeys = {
  subjects: ["subjects"] as const,
  exams: (filters: Record<string, unknown>) => ["exams", filters] as const,
  exam: (examId: string) => ["exam", examId] as const,
  attempt: (attemptId: string) => ["attempt", attemptId] as const,
  result: (attemptId: string) => ["result", attemptId] as const,
};
