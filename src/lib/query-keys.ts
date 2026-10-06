export const queryKeys = {
  /** Phiên đăng nhập hiện tại (`GET /api/me`). Là cơ sở để dọn cache khi phiên đổi chủ. */
  session: ["session"] as const,
  subjects: ["subjects"] as const,
  exams: (filters: Record<string, unknown>) => ["exams", filters] as const,
  exam: (examId: string) => ["exam", examId] as const,
  attempt: (attemptId: string) => ["attempt", attemptId] as const,
  result: (attemptId: string) => ["result", attemptId] as const,
  attemptHistory: (filters: Record<string, unknown>) => ["attempts", filters] as const,
  /** Đơn xin quyền giáo viên của người đang đăng nhập (`GET /api/teacher-applications`). */
  myTeacherApplication: ["teacher-application", "me"] as const,
  /** Danh sách người dùng cho trang quản trị (chỉ ADMIN gọi được). */
  adminUsers: (filters: Record<string, unknown>) => ["admin", "users", filters] as const,
  /** Danh sách đơn xin quyền giáo viên cho trang quản trị. */
  adminTeacherApplications: (filters: Record<string, unknown>) =>
    ["admin", "teacher-applications", filters] as const,
  /** Kho đề dành cho người soạn (giáo viên/quản trị viên). */
  authoringExams: (filters: Record<string, unknown>) => ["authoring", "exams", filters] as const,
  authoringExam: (examId: string) => ["authoring", "exam", examId] as const,
  /** Lớp học mà người đang đăng nhập nhìn thấy. */
  classrooms: (filters: Record<string, unknown>) => ["classrooms", filters] as const,
  classroom: (classroomId: string) => ["classroom", classroomId] as const,
  classroomAssignments: (classroomId: string) =>
    ["classroom", classroomId, "assignments"] as const,
  /** Góc nhìn của học sinh: lớp mình tham gia và đề đã được giao. */
  myClassrooms: ["my", "classrooms"] as const,
};
