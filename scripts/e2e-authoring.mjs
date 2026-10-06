/**
 * Kiểm thử đầu-cuối (E2E) cho tính năng TẠO & QUẢN LÝ ĐỀ THI với PostgreSQL thật:
 * giáo viên tạo lớp → tạo đề nháp → soạn câu hỏi có CÔNG THỨC KaTeX và ẢNH → lưu nháp →
 * mở lại → kiểm tra → xuất bản → giao đề cho lớp → học sinh làm bài; kèm các lớp kiểm tra
 * quyền và tính toàn vẹn dữ liệu.
 *
 *   npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"   (một lần, nếu chưa có)
 *   npm run build && npx next start -p 3123
 *   npm run test:e2e:authoring
 *
 * Biến môi trường:
 *   E2E_BASE_URL        địa chỉ ứng dụng (mặc định http://localhost:3123)
 *   E2E_ADMIN_EMAIL     email quản trị viên (mặc định ADMIN_EMAIL)
 *   E2E_ADMIN_PASSWORD  mật khẩu quản trị viên (mặc định ADMIN_PASSWORD)
 *
 * Yêu cầu: DB đã `npm run db:migrate` + `npm run db:seed` (cần ít nhất một môn học).
 * Script dùng ba tài khoản cố định (e2e-teacher-a, e2e-teacher-b, e2e-student) và tạo dữ liệu
 * tạm (lớp, đề, ảnh, lượt làm bài) rồi tự dọn ở cuối, nên chạy lại nhiều lần vẫn an toàn.
 * Nếu bị 429 do giới hạn tần suất đăng nhập, script tự chờ rồi thử lại (tối đa 4 lần).
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3123";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const MEDIA_DIR = process.env.MEDIA_STORAGE_DIR ?? "storage/uploads";

const RUN_ID = randomUUID().slice(0, 8);
const PASSWORD = "MatKhau123";

const results = [];
const createdUserIds = [];
let createdExamIds = [];
let createdQuestionIds = [];
let createdClassroomIds = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "[OK]  " : "[FAIL]"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Client tự quản lý cookie giống trình duyệt (giữ cả phiên đăng nhập của Better Auth và
 * cookie phiên làm bài), kèm một hàm riêng cho `multipart/form-data`.
 */
function makeClient() {
  const jar = new Map();

  function readCookieHeader() {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  function storeCookies(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const separator = pair.indexOf("=");
      if (separator < 0) continue;

      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const cleared = value === "" || /max-age=0(\b|;|$)/i.test(raw);

      if (cleared) jar.delete(name);
      else jar.set(name, value);
    }
  }

  async function parse(response) {
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { status: response.status, body, text };
  }

  return {
    async request(pathname, init = {}) {
      const headers = { ...(init.headers ?? {}) };
      if (init.body !== undefined) headers["content-type"] = "application/json";
      const cookieHeader = readCookieHeader();
      if (cookieHeader) headers.cookie = cookieHeader;

      const response = await fetch(BASE + pathname, { ...init, headers });
      storeCookies(response);
      return parse(response);
    },
    /** Tải tệp lên: không đặt content-type để Node tự sinh boundary của multipart. */
    async upload(pathname, formData) {
      const headers = {};
      const cookieHeader = readCookieHeader();
      if (cookieHeader) headers.cookie = cookieHeader;

      const response = await fetch(BASE + pathname, { method: "POST", body: formData, headers });
      storeCookies(response);
      return parse(response);
    },
  };
}

function errorCode(response) {
  return response.body?.error?.code ?? "";
}

const anonymous = makeClient();
const admin = makeClient();
const teacherA = makeClient();
const teacherB = makeClient();
const student = makeClient();

// Kiểm tra sớm: thiếu tài khoản quản trị viên thì không thể duyệt đơn giáo viên trong kịch bản.
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Thiếu tài khoản quản trị viên. Hãy chạy:\n" +
      '  npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"\n' +
      "rồi đặt ADMIN_EMAIL / ADMIN_PASSWORD (hoặc E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) trong .env.",
  );
  process.exit(1);
}

/**
 * Đăng nhập có chờ khi bị giới hạn tần suất: Better Auth chặn vài lần đăng nhập/đăng ký mỗi
 * phút cho một IP, nên khi chạy kiểm thử liên tiếp cần chờ thay vì báo lỗi giả.
 */
async function requestWithRetry(client, pathname, body, attempts = 4) {
  let response = null;

  for (let index = 0; index < attempts; index += 1) {
    response = await client.request(pathname, { method: "POST", body: JSON.stringify(body) });

    if (response.status !== 429) {
      return response;
    }

    console.log("[INFO] Bị giới hạn tần suất xác thực, chờ 20 giây rồi thử lại…");
    await new Promise((resolve) => setTimeout(resolve, 20_000));
  }

  return response;
}

/**
 * Chuẩn bị một tài khoản dùng lại được giữa các lần chạy: thử đăng nhập trước (tài khoản đã
 * tồn tại từ lần trước), nếu chưa có thì đăng ký. Nhờ vậy số lần gọi vào endpoint xác thực
 * mỗi lần chạy rất ít và không chạm giới hạn tần suất.
 */
async function ensureAccount(client, label) {
  const email = `${label}@e2e.luyenthi.test`;

  let loggedIn = await requestWithRetry(client, "/api/auth/login", { email, password: PASSWORD });
  let action = "đăng nhập";

  if (loggedIn.status !== 200) {
    const registered = await requestWithRetry(client, "/api/auth/register", {
      name: `E2E ${label}`,
      email,
      password: PASSWORD,
    });
    check(`đăng ký tài khoản ${label} → 201`, registered.status === 201, `status=${registered.status}`);
    action = "đăng ký + đăng nhập";
    loggedIn = await requestWithRetry(client, "/api/auth/login", { email, password: PASSWORD });
  }

  check(`chuẩn bị tài khoản ${label} (${action}) → 200`, loggedIn.status === 200, `status=${loggedIn.status}`);

  const me = await client.request("/api/me");
  const userId = me.body?.user?.id ?? "";
  if (userId && !createdUserIds.includes(userId)) createdUserIds.push(userId);

  return { email, userId, role: me.body?.user?.role ?? "" };
}

/** Nộp đơn xin quyền giáo viên rồi nhờ quản trị viên duyệt để nâng vai trò lên TEACHER. */
async function ensureTeacher(client, applicantEmail) {
  const me = await client.request("/api/me");
  if (me.body?.user?.role === "TEACHER" || me.body?.user?.role === "ADMIN") {
    check("tài khoản đã có vai trò giáo viên từ lần chạy trước", true);
    return true;
  }

  const applied = await client.request("/api/teacher-applications", {
    method: "POST",
    body: JSON.stringify({
      school: "THPT Kiểm thử",
      motivation:
        "Tôi là giáo viên Toán, muốn dùng hệ thống để soạn đề và giao bài cho lớp trong học kỳ này.",
    }),
  });
  check("nộp đơn xin quyền giáo viên → 201", applied.status === 201, `status=${applied.status}`);

  const queue = await admin.request("/api/admin/teacher-applications?status=PENDING&pageSize=50");
  const application = (queue.body?.items ?? []).find(
    (item) => item.applicant?.email === applicantEmail,
  );

  if (!application) {
    check("tìm thấy đơn trong hàng đợi quản trị", false, `email=${applicantEmail}`);
    return false;
  }

  const approved = await admin.request(`/api/admin/teacher-applications/${application.id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note: "Duyệt trong bài kiểm thử E2E." }),
  });
  check("quản trị viên duyệt đơn → 200", approved.status === 200, `status=${approved.status}`);

  const afterApprove = await client.request("/api/me");
  return afterApprove.body?.user?.role === "TEACHER";
}

/** Ảnh PNG 1×1 tối thiểu (đúng chữ ký nhị phân) để kiểm tra luồng tải ảnh lên. */
function tinyPng() {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[19] = 1;
  bytes[23] = 1;
  return bytes;
}

function paragraph(text) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function mathParagraph(latex) {
  return { type: "paragraph", content: [{ type: "mathInline", attrs: { latex } }] };
}

function richDoc(blocks) {
  return { schemaVersion: 1, doc: { type: "doc", content: blocks } };
}

// ---------------------------------------------------------------------------
// 1. Khách ẩn danh không chạm được khu vực soạn đề
// ---------------------------------------------------------------------------
const authoringAnonymous = await anonymous.request("/api/authoring/exams");
check(
  "GET /api/authoring/exams (khách) → 401 AUTH_REQUIRED",
  authoringAnonymous.status === 401 && errorCode(authoringAnonymous) === "AUTH_REQUIRED",
  `status=${authoringAnonymous.status} code=${errorCode(authoringAnonymous)}`,
);

const teacherPageAnonymous = await anonymous.request("/api/classrooms");
check(
  "GET /api/classrooms (khách) → 401 AUTH_REQUIRED",
  teacherPageAnonymous.status === 401 && errorCode(teacherPageAnonymous) === "AUTH_REQUIRED",
  `status=${teacherPageAnonymous.status}`,
);

// ---------------------------------------------------------------------------
// 2. Chuẩn bị: quản trị viên, hai giáo viên và một học sinh
// ---------------------------------------------------------------------------
const adminLogin = await requestWithRetry(admin, "/api/auth/login", {
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
check("đăng nhập quản trị viên → 200", adminLogin.status === 200, `status=${adminLogin.status}`);

const subjects = await admin.request("/api/subjects");
const subjectId = subjects.body?.items?.[0]?.id ?? "";
check("có ít nhất một môn học để tạo đề", Boolean(subjectId), `subjectId=${subjectId}`);

const teacherAUser = await ensureAccount(teacherA, "e2e-teacher-a");
const teacherBUser = await ensureAccount(teacherB, "e2e-teacher-b");
const studentUser = await ensureAccount(student, "e2e-student");

const teacherAReady = await ensureTeacher(teacherA, teacherAUser.email);
const teacherBReady = await ensureTeacher(teacherB, teacherBUser.email);
check("tài khoản A có vai trò giáo viên", teacherAReady === true);
check("tài khoản B có vai trò giáo viên", teacherBReady === true);

// ---------------------------------------------------------------------------
// 3. Lớp học: giáo viên tạo lớp, thêm học sinh; lớp B thuộc giáo viên khác
// ---------------------------------------------------------------------------
const classroomA = await teacherA.request("/api/classrooms", {
  method: "POST",
  body: JSON.stringify({ name: `Lớp A ${RUN_ID}`, subjectId, gradeLevel: 12 }),
});
check(
  "giáo viên A tạo lớp → 201 và là chủ lớp",
  classroomA.status === 201 && classroomA.body?.isOwner === true,
  `status=${classroomA.status}`,
);
const classroomAId = classroomA.body?.id ?? "";
if (classroomAId) createdClassroomIds.push(classroomAId);

const classroomB = await teacherB.request("/api/classrooms", {
  method: "POST",
  body: JSON.stringify({ name: `Lớp B ${RUN_ID}`, subjectId, gradeLevel: 11 }),
});
const classroomBId = classroomB.body?.id ?? "";
if (classroomBId) createdClassroomIds.push(classroomBId);

check(
  "giáo viên B tạo lớp riêng → 201",
  classroomB.status === 201 && Boolean(classroomBId),
  `status=${classroomB.status}`,
);

const studentSeesClassroomBeforeJoin = await student.request("/api/classrooms");
check(
  "học sinh chưa vào lớp nào → danh sách rỗng",
  studentSeesClassroomBeforeJoin.status === 200 &&
    (studentSeesClassroomBeforeJoin.body?.items ?? []).length === 0,
  `total=${(studentSeesClassroomBeforeJoin.body?.items ?? []).length}`,
);

const teacherBViewsClassroomA = await teacherB.request(`/api/classrooms/${classroomAId}`);
check(
  "giáo viên B xem lớp của A → 403 FORBIDDEN",
  teacherBViewsClassroomA.status === 403,
  `status=${teacherBViewsClassroomA.status} code=${errorCode(teacherBViewsClassroomA)}`,
);

const adminViewsClassroomA = await admin.request(`/api/classrooms/${classroomAId}`);
check(
  "quản trị viên xem được mọi lớp → 200",
  adminViewsClassroomA.status === 200,
  `status=${adminViewsClassroomA.status}`,
);

// ---------------------------------------------------------------------------
// 4. Tạo đề: giáo viên chỉ tạo được đề của lớp mình; đề công khai là của ADMIN
// ---------------------------------------------------------------------------
const teacherAPublicExam = await teacherA.request("/api/authoring/exams", {
  method: "POST",
  body: JSON.stringify({
    title: `Đề công khai trái phép ${RUN_ID}`,
    subjectId,
    scope: "PUBLIC",
    durationMinutes: 45,
  }),
});
check(
  "giáo viên A tạo đề PUBLIC → 403 FORBIDDEN",
  teacherAPublicExam.status === 403,
  `status=${teacherAPublicExam.status} code=${errorCode(teacherAPublicExam)}`,
);

const teacherAClassBExam = await teacherA.request("/api/authoring/exams", {
  method: "POST",
  body: JSON.stringify({
    title: `Đề cho lớp của B ${RUN_ID}`,
    subjectId,
    scope: "CLASS",
    classroomId: classroomBId,
    durationMinutes: 45,
  }),
});
check(
  "giáo viên A tạo đề cho lớp của B → 403 FORBIDDEN",
  teacherAClassBExam.status === 403,
  `status=${teacherAClassBExam.status} code=${errorCode(teacherAClassBExam)}`,
);

const examDraft = await teacherA.request("/api/authoring/exams", {
  method: "POST",
  body: JSON.stringify({
    title: `Kiểm tra 45 phút — ${RUN_ID}`,
    subjectId,
    scope: "CLASS",
    classroomId: classroomAId,
    durationMinutes: 45,
    gradeLevel: 12,
    description: "Đề kiểm thử tự động cho luồng soạn đề.",
  }),
});
check(
  "giáo viên A tạo đề nháp cho lớp mình → 201",
  examDraft.status === 201 && examDraft.body?.status === "DRAFT",
  `status=${examDraft.status}`,
);
const examId = examDraft.body?.id ?? "";
if (examId) createdExamIds.push(examId);

const teacherBReadsExam = await teacherB.request(`/api/authoring/exams/${examId}`);
check(
  "giáo viên B đọc đề của lớp A → 403 FORBIDDEN",
  teacherBReadsExam.status === 403,
  `status=${teacherBReadsExam.status}`,
);

const studentReadsExam = await student.request(`/api/authoring/exams/${examId}`);
check(
  "học sinh đọc endpoint soạn đề → 403 FORBIDDEN",
  studentReadsExam.status === 403,
  `status=${studentReadsExam.status}`,
);

const studentListsAuthoring = await student.request("/api/authoring/exams");
check(
  "học sinh liệt kê kho soạn đề → 403 FORBIDDEN",
  studentListsAuthoring.status === 403,
  `status=${studentListsAuthoring.status}`,
);

// ---------------------------------------------------------------------------
// 5. Ảnh: kiểm tra loại tệp thật, kích thước và quyền đọc
// ---------------------------------------------------------------------------
const svgUpload = new FormData();
svgUpload.append(
  "file",
  new Blob([new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')], {
    type: "image/png",
  }),
  "hinh.svg",
);
svgUpload.append("examId", examId);
const svgResponse = await teacherA.upload("/api/media", svgUpload);
check(
  "tải lên SVG (giả mạo image/png) → 415 MEDIA_TYPE_UNSUPPORTED",
  svgResponse.status === 415 && errorCode(svgResponse) === "MEDIA_TYPE_UNSUPPORTED",
  `status=${svgResponse.status} code=${errorCode(svgResponse)}`,
);

const hugeUpload = new FormData();
hugeUpload.append("file", new Blob([new Uint8Array(5 * 1024 * 1024)], { type: "image/png" }), "to.png");
hugeUpload.append("examId", examId);
const hugeResponse = await teacherA.upload("/api/media", hugeUpload);
check(
  "tải lên ảnh vượt giới hạn → 413 MEDIA_TOO_LARGE",
  hugeResponse.status === 413 && errorCode(hugeResponse) === "MEDIA_TOO_LARGE",
  `status=${hugeResponse.status} code=${errorCode(hugeResponse)}`,
);

const imageUpload = new FormData();
imageUpload.append("file", new Blob([tinyPng()], { type: "image/png" }), "do-thi.png");
imageUpload.append("examId", examId);
imageUpload.append("alt", "Đồ thị minh hoạ");
const imageResponse = await teacherA.upload("/api/media", imageUpload);
check(
  "giáo viên A tải ảnh PNG hợp lệ → 201 kèm kích thước ảnh",
  imageResponse.status === 201 && imageResponse.body?.width === 1 && imageResponse.body?.height === 1,
  `status=${imageResponse.status} width=${imageResponse.body?.width}`,
);
const assetId = imageResponse.body?.id ?? "";

const imageUrl = imageResponse.body?.url ?? "";
if (imageUrl) {
  const studentReadsDraftImage = await student.request(imageUrl);
  check(
    "học sinh đọc ảnh của đề lớp chưa xuất bản → 403 FORBIDDEN",
    studentReadsDraftImage.status === 403,
    `status=${studentReadsDraftImage.status}`,
  );
}

const teacherBReadsImage = await teacherB.request(imageUrl);
check(
  "giáo viên khác đọc ảnh của đề lớp A → 403 FORBIDDEN",
  teacherBReadsImage.status === 403,
  `status=${teacherBReadsImage.status}`,
);

// ---------------------------------------------------------------------------
// 6. Soạn câu hỏi có công thức và ảnh, lưu nháp rồi mở lại
// ---------------------------------------------------------------------------
const questionPayload = {
  type: "SINGLE_CHOICE",
  level: "MEDIUM",
  points: 2,
  contentDoc: richDoc([
    paragraph("Cho hàm số "),
    mathParagraph("\\frac{x^{2}-1}{x-1}"),
  ]),
  explanationDoc: richDoc([mathParagraph("\\lim_{x \\to 1} \\frac{x^{2}-1}{x-1} = 2")]),
  options: [
    { contentDoc: richDoc([paragraph("1")]), isCorrect: false },
    { contentDoc: richDoc([paragraph("2")]), isCorrect: true },
    { contentDoc: richDoc([paragraph("0")]), isCorrect: false },
    { contentDoc: richDoc([{ type: "image", attrs: { assetId, alt: "Đồ thị" } }]), isCorrect: false },
  ],
};

const createdQuestion = await teacherA.request(`/api/authoring/exams/${examId}/questions`, {
  method: "POST",
  body: JSON.stringify(questionPayload),
});
check(
  "thêm câu hỏi có công thức và ảnh → 201",
  createdQuestion.status === 201 && createdQuestion.body?.position === 1,
  `status=${createdQuestion.status}`,
);
const questionId = createdQuestion.body?.id ?? "";
if (questionId) createdQuestionIds.push(questionId);

const reopened = await teacherA.request(`/api/authoring/exams/${examId}`);
const reopenedQuestion = (reopened.body?.questions ?? [])[0];
check(
  "mở lại đề thấy nội dung có cấu trúc đã lưu (công thức + mã ảnh)",
  reopened.status === 200 &&
    JSON.stringify(reopenedQuestion?.contentDoc ?? {}).includes("\\\\frac") &&
    reopenedQuestion?.options?.some((option) =>
      JSON.stringify(option.contentDoc ?? {}).includes(assetId),
    ),
  `status=${reopened.status}`,
);
check(
  "đáp án đúng được lưu theo ID phương án",
  reopenedQuestion?.options?.filter((option) => option.isCorrect).length === 1,
  `correct=${reopenedQuestion?.options?.filter((option) => option.isCorrect).length}`,
);

// Lưu nháp thông tin đề kèm hướng dẫn làm bài có công thức.
const savedInfo = await teacherA.request(`/api/authoring/exams/${examId}`, {
  method: "PATCH",
  body: JSON.stringify({
    revision: reopened.body?.revision,
    durationMinutes: 40,
    instructionsDoc: richDoc([paragraph("Làm bài cẩn thận."), mathParagraph("\\sqrt{x}")]),
  }),
});
check(
  "lưu nháp thông tin đề → 200 và tăng phiên bản nội dung",
  savedInfo.status === 200 && savedInfo.body?.revision === (reopened.body?.revision ?? 0) + 1,
  `revision=${savedInfo.body?.revision}`,
);

const staleSave = await teacherA.request(`/api/authoring/exams/${examId}`, {
  method: "PATCH",
  body: JSON.stringify({ revision: reopened.body?.revision, title: `Tên cũ ${RUN_ID}` }),
});
check(
  "lưu bằng phiên bản cũ (tab khác đã lưu) → 409 EXAM_REVISION_CONFLICT",
  staleSave.status === 409 && errorCode(staleSave) === "EXAM_REVISION_CONFLICT",
  `status=${staleSave.status} code=${errorCode(staleSave)}`,
);

const staleTitle = await teacherA.request(`/api/authoring/exams/${examId}`);
check(
  "bản lưu bị từ chối không ghi đè dữ liệu mới",
  staleTitle.body?.title === `Kiểm tra 45 phút — ${RUN_ID}` &&
    staleTitle.body?.durationMinutes === 40,
  `title=${staleTitle.body?.title}`,
);

// ---------------------------------------------------------------------------
// 7. Kiểm tra trước khi xuất bản: công thức lỗi và loại câu chưa hỗ trợ bị chặn
// ---------------------------------------------------------------------------
const invalidFormulaQuestion = await teacherA.request(
  `/api/authoring/exams/${examId}/questions`,
  {
    method: "POST",
    body: JSON.stringify({
      type: "SINGLE_CHOICE",
      level: "EASY",
      points: 1,
      contentDoc: richDoc([mathParagraph("\\frac{a}{")]),
      explanationDoc: richDoc([paragraph("Lời giải")]),
      options: [
        { contentDoc: richDoc([paragraph("A")]), isCorrect: true },
        { contentDoc: richDoc([paragraph("B")]), isCorrect: false },
      ],
    }),
  },
);
const invalidQuestionId = invalidFormulaQuestion.body?.id ?? "";
if (invalidQuestionId) createdQuestionIds.push(invalidQuestionId);

const invalidReport = await teacherA.request(`/api/authoring/exams/${examId}/validate`, {
  method: "POST",
});
check(
  "kiểm tra đề phát hiện công thức LaTeX lỗi",
  invalidReport.status === 200 &&
    invalidReport.body?.issues?.some((issue) => issue.code === "FORMULA_INVALID"),
  `errors=${invalidReport.body?.errorCount}`,
);
check(
  "kiểm tra đề báo không thể xuất bản khi còn lỗi",
  invalidReport.body?.canPublish === false && invalidReport.body?.errorCount > 0,
  `canPublish=${invalidReport.body?.canPublish}`,
);

const publishWithErrors = await teacherA.request(`/api/authoring/exams/${examId}/lifecycle`, {
  method: "POST",
  body: JSON.stringify({ action: "publish" }),
});
check(
  "xuất bản khi còn lỗi → 409 EXAM_PUBLISH_INVALID kèm danh sách lỗi",
  publishWithErrors.status === 409 &&
    errorCode(publishWithErrors) === "EXAM_PUBLISH_INVALID" &&
    (publishWithErrors.body?.error?.details?.issues ?? []).length > 0,
  `status=${publishWithErrors.status}`,
);

const unsupportedTypeQuestion = await teacherA.request(
  `/api/authoring/exams/${examId}/questions`,
  {
    method: "POST",
    body: JSON.stringify({
      type: "TRUE_FALSE",
      level: "EASY",
      points: 1,
      contentDoc: richDoc([paragraph("Đúng hay sai?")]),
      explanationDoc: richDoc([paragraph("Lời giải")]),
      options: [
        { contentDoc: richDoc([paragraph("Đúng")]), isCorrect: true },
        { contentDoc: richDoc([paragraph("Sai")]), isCorrect: false },
      ],
    }),
  },
);
const unsupportedQuestionId = unsupportedTypeQuestion.body?.id ?? "";
if (unsupportedQuestionId) createdQuestionIds.push(unsupportedQuestionId);

const reportWithUnsupported = await teacherA.request(`/api/authoring/exams/${examId}/validate`, {
  method: "POST",
});
check(
  "loại câu Đúng/sai bị chặn xuất bản ở máy chủ",
  reportWithUnsupported.body?.issues?.some(
    (issue) => issue.code === "QUESTION_TYPE_UNSUPPORTED" && issue.questionId === unsupportedQuestionId,
  ),
  `errors=${reportWithUnsupported.body?.errorCount}`,
);

// Dọn hai câu "cố tình sai" rồi kiểm tra lại: đề hợp lệ và xuất bản được.
await teacherA.request(`/api/authoring/exams/${examId}/questions/${invalidQuestionId}`, {
  method: "DELETE",
});
await teacherA.request(`/api/authoring/exams/${examId}/questions/${unsupportedQuestionId}`, {
  method: "DELETE",
});

const cleanReport = await teacherA.request(`/api/authoring/exams/${examId}/validate`, {
  method: "POST",
});
check(
  "sau khi sửa hết lỗi, đề đủ điều kiện xuất bản",
  cleanReport.body?.canPublish === true && cleanReport.body?.errorCount === 0,
  `errors=${cleanReport.body?.errorCount}`,
);

const beforePublish = await teacherA.request(`/api/authoring/exams/${examId}`);

const published = await teacherA.request(`/api/authoring/exams/${examId}/lifecycle`, {
  method: "POST",
  body: JSON.stringify({ action: "publish", revision: beforePublish.body?.revision }),
});
check(
  "xuất bản nội dung đề → 200 status=PUBLISHED",
  published.status === 200 && published.body?.status === "PUBLISHED",
  `status=${published.status} examStatus=${published.body?.status}`,
);

// Xuất bản nội dung KHÔNG tự giao đề: học sinh chưa thấy gì để làm.
const studentBeforeAssign = await student.request("/api/my/classrooms");
check(
  "học sinh chưa được thêm vào lớp → chưa thấy đề nào",
  studentBeforeAssign.status === 200 && (studentBeforeAssign.body?.items ?? []).length === 0,
  `classes=${(studentBeforeAssign.body?.items ?? []).length}`,
);

// ---------------------------------------------------------------------------
// 8. Giao đề cho lớp và luồng làm bài của học sinh
// ---------------------------------------------------------------------------
const duplicateAndOrder = await runDuplicateAndOrderChecks();
const assignBeforePublishCheck = await teacherA.request(
  `/api/classrooms/${classroomAId}/assignments`,
  {
    method: "POST",
    body: JSON.stringify({
      examId,
      opensAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      allowedAttempts: 1,
      revealAnswersAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }),
  },
);
check(
  "giao đề đã xuất bản cho lớp → 201 kèm lịch mở/đóng và số lượt",
  assignBeforePublishCheck.status === 201 &&
    assignBeforePublishCheck.body?.allowedAttempts === 1,
  `status=${assignBeforePublishCheck.status}`,
);

const notMemberYet = await student.request("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId }),
});
check(
  "học sinh ngoài lớp làm đề của lớp → 403 FORBIDDEN",
  notMemberYet.status === 403,
  `status=${notMemberYet.status} code=${errorCode(notMemberYet)}`,
);

const addedStudent = await teacherA.request(`/api/classrooms/${classroomAId}/members`, {
  method: "POST",
  body: JSON.stringify({ email: studentUser.email, role: "STUDENT" }),
});
check(
  "giáo viên A thêm học sinh vào lớp → 201",
  addedStudent.status === 201 && addedStudent.body?.email === studentUser.email,
  `status=${addedStudent.status}`,
);

const futureWindowStart = await student.request("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId }),
});
check(
  "đề chưa tới giờ mở → 409 ASSIGNMENT_NOT_OPEN",
  futureWindowStart.status === 409 && errorCode(futureWindowStart) === "ASSIGNMENT_NOT_OPEN",
  `status=${futureWindowStart.status} code=${errorCode(futureWindowStart)}`,
);

// Mở đề ngay để kiểm thử luồng làm bài.
const openedNow = await teacherA.request(`/api/classrooms/${classroomAId}/assignments`, {
  method: "POST",
  body: JSON.stringify({
    examId,
    opensAt: null,
    closesAt: null,
    allowedAttempts: 1,
    revealAnswersAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  }),
});
check("mở đề ngay → 200", openedNow.status === 201 || openedNow.status === 200, `status=${openedNow.status}`);

const studentClassrooms = await student.request("/api/my/classrooms");
const assignedExam = (studentClassrooms.body?.items?.[0]?.exams ?? [])[0];
check(
  "học sinh trong lớp thấy đề đã giao kèm trạng thái cửa sổ",
  studentClassrooms.status === 200 && assignedExam?.window === "OPEN" && assignedExam?.canStart === true,
  `window=${assignedExam?.window} canStart=${assignedExam?.canStart}`,
);

const started = await student.request("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId }),
});
check(
  "học sinh bắt đầu làm bài → 201",
  started.status === 201 && Boolean(started.body?.attemptId),
  `status=${started.status}`,
);
const attemptId = started.body?.attemptId ?? "";

const attemptPayload = await student.request(`/api/attempts/${attemptId}`);
const serializedAttempt = JSON.stringify(attemptPayload.body ?? {});
const studentQuestion = attemptPayload.body?.questions?.[0];
check(
  "payload làm bài có công thức và ảnh dạng cấu trúc",
  serializedAttempt.includes("mathInline") || serializedAttempt.includes("mathBlock"),
  `hasMath=${serializedAttempt.includes("mathInline")}`,
);
check(
  "payload làm bài KHÔNG chứa đáp án đúng hay lời giải",
  !serializedAttempt.includes("correctOptionIds") &&
    !serializedAttempt.includes("isCorrect") &&
    !serializedAttempt.includes("Lời giải"),
);
check(
  "payload làm bài KHÔNG lộ trường snapshot hay đáp án đúng",
  !serializedAttempt.includes("snapshot"),
  `questionKeys=${Object.keys(studentQuestion ?? {}).join(",")}`,
);

const correctOptionId =
  reopenedQuestion?.options?.find((option) => option.isCorrect)?.id ?? "";
const savedAnswer = await student.request(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId, optionId: correctOptionId }),
});
check(
  "học sinh lưu đáp án → 200",
  savedAnswer.status === 200,
  `status=${savedAnswer.status} code=${errorCode(savedAnswer)}`,
);

const submitted = await student.request(`/api/attempts/${attemptId}/submit`, { method: "POST" });
check(
  "nộp bài → 200 và được 2 điểm",
  submitted.status === 200 && submitted.body?.score === 2,
  `score=${submitted.body?.score}`,
);

const result = await student.request(`/api/attempts/${attemptId}/result`);
check(
  "chưa tới mốc xem đáp án → máy chủ ẩn đáp án và lời giải",
  result.status === 200 &&
    result.body?.answersHidden === true &&
    (result.body?.questions ?? []).every(
      (item) => item.explanation === null && (item.correctOptionIds ?? []).length === 0,
    ),
  `answersHidden=${result.body?.answersHidden}`,
);

const secondAttempt = await student.request("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId }),
});
check(
  "hết số lượt (allowedAttempts=1) → 409 ATTEMPTS_EXHAUSTED",
  secondAttempt.status === 409 && errorCode(secondAttempt) === "ATTEMPTS_EXHAUSTED",
  `status=${secondAttempt.status} code=${errorCode(secondAttempt)}`,
);

// ---------------------------------------------------------------------------
// 9. Nhân bản và sắp xếp lại câu hỏi không làm sai đáp án
//
// Kiểm tra này chạy TRƯỚC khi học sinh làm bài (mục 8) vì đề đã phát sinh lượt làm bài thì
// nội dung bị khoá — đúng luật nghiệp vụ mà mục 10 sẽ kiểm chứng.
// ---------------------------------------------------------------------------
async function runDuplicateAndOrderChecks() {
  const duplicated = await teacherA.request(
  `/api/authoring/exams/${examId}/questions/${questionId}/duplicate`,
  { method: "POST" },
);
const duplicatedQuestionId = duplicated.body?.id ?? "";
check(
  "nhân bản câu hỏi → 201 với ID mới cho câu và phương án",
  duplicated.status === 201 &&
    duplicatedQuestionId !== questionId &&
    (duplicated.body?.options ?? []).every(
      (option) => !(reopenedQuestion?.options ?? []).some((item) => item.id === option.id),
    ),
  `status=${duplicated.status}`,
);

const afterDuplicate = await teacherA.request(`/api/authoring/exams/${examId}`);
const originalRow = (afterDuplicate.body?.questions ?? []).find((item) => item.id === questionId);
const duplicatedRow = (afterDuplicate.body?.questions ?? []).find(
  (item) => item.id === duplicatedQuestionId,
);
const correctContent = (row) =>
  (row?.options ?? []).find((option) => option.isCorrect)?.content ?? "";

check(
  "bản sao giữ đúng nội dung đáp án và điểm của câu gốc",
  duplicatedRow?.points === originalRow?.points &&
    correctContent(duplicatedRow) === correctContent(originalRow) &&
    correctContent(duplicatedRow).length > 0,
  `gốc=${correctContent(originalRow)} sao=${correctContent(duplicatedRow)}`,
);

const orderIds = (afterDuplicate.body?.questions ?? []).map((item) => item.id).reverse();
const reordered = await teacherA.request(`/api/authoring/exams/${examId}/questions/order`, {
  method: "PUT",
  body: JSON.stringify({ questionIds: orderIds }),
});
check(
  "sắp xếp lại câu hỏi → 200 với thứ tự mới",
  reordered.status === 200 &&
    (reordered.body?.questions ?? []).map((item) => item.id).join(",") === orderIds.join(","),
  `status=${reordered.status}`,
);

const afterReorder = await teacherA.request(`/api/authoring/exams/${examId}`);
const reorderedOriginal = (afterReorder.body?.questions ?? []).find((item) => item.id === questionId);
check(
  "sau khi sắp xếp, đáp án đúng vẫn nguyên và vị trí được đánh lại 1..n",
  correctContent(reorderedOriginal) === correctContent(originalRow) &&
    (afterReorder.body?.questions ?? []).every((item, index) => item.position === index + 1),
);

const badOrder = await teacherA.request(`/api/authoring/exams/${examId}/questions/order`, {
  method: "PUT",
  body: JSON.stringify({ questionIds: [questionId] }),
});
  check(
    "gửi thứ tự thiếu câu → 422 VALIDATION_ERROR",
    badOrder.status === 422 && errorCode(badOrder) === "VALIDATION_ERROR",
    `status=${badOrder.status} code=${errorCode(badOrder)}`,
  );

  return { reorderedQuestions: afterReorder.body?.questions ?? [] };
}

// ---------------------------------------------------------------------------
// 10. Đề đã có lượt làm bài: khoá nội dung và tạo bản sao để chỉnh sửa
// ---------------------------------------------------------------------------
const lockedInfoSave = await teacherA.request(`/api/authoring/exams/${examId}`, {
  method: "PATCH",
  body: JSON.stringify({ title: `Đổi tên sau khi có bài làm ${RUN_ID}` }),
});
check(
  "sửa đề đã có lượt làm bài → 409 EXAM_CONTENT_LOCKED",
  lockedInfoSave.status === 409 && errorCode(lockedInfoSave) === "EXAM_CONTENT_LOCKED",
  `status=${lockedInfoSave.status} code=${errorCode(lockedInfoSave)}`,
);

const lockedQuestionAdd = await teacherA.request(`/api/authoring/exams/${examId}/questions`, {
  method: "POST",
  body: JSON.stringify(questionPayload),
});
check(
  "thêm câu hỏi vào đề đã có bài làm → 409 EXAM_CONTENT_LOCKED",
  lockedQuestionAdd.status === 409 && errorCode(lockedQuestionAdd) === "EXAM_CONTENT_LOCKED",
  `status=${lockedQuestionAdd.status}`,
);

const lockedUnpublish = await teacherA.request(`/api/authoring/exams/${examId}/lifecycle`, {
  method: "POST",
  body: JSON.stringify({ action: "unpublish" }),
});
check(
  "thu hồi đề đã có bài làm → 409 EXAM_CONTENT_LOCKED",
  lockedUnpublish.status === 409 && errorCode(lockedUnpublish) === "EXAM_CONTENT_LOCKED",
  `status=${lockedUnpublish.status}`,
);

const historicalResult = await student.request(`/api/attempts/${attemptId}/result`);
check(
  "điểm của lượt làm cũ vẫn nguyên vẹn (snapshot theo từng lượt)",
  historicalResult.status === 200 && historicalResult.body?.score === 2,
  `score=${historicalResult.body?.score}`,
);

const examCopy = await teacherA.request(`/api/authoring/exams/${examId}/duplicate`, {
  method: "POST",
  body: JSON.stringify({}),
});
const copyId = examCopy.body?.id ?? "";
if (copyId) createdExamIds.push(copyId);
for (const row of examCopy.body?.questions ?? []) {
  createdQuestionIds.push(row.id);
}
check(
  "tạo bản sao để chỉnh sửa → 201 bản nháp mới có cùng số câu",
  examCopy.status === 201 &&
    examCopy.body?.status === "DRAFT" &&
    examCopy.body?.questionCount === duplicateAndOrder.reorderedQuestions.length,
  `status=${examCopy.status} questions=${examCopy.body?.questionCount}`,
);

const copyEditable = await teacherA.request(`/api/authoring/exams/${copyId}/questions`, {
  method: "POST",
  body: JSON.stringify(questionPayload),
});
if (copyEditable.body?.id) createdQuestionIds.push(copyEditable.body.id);
check(
  "bản sao vẫn sửa được nội dung → 201",
  copyEditable.status === 201,
  `status=${copyEditable.status}`,
);

const archived = await teacherA.request(`/api/authoring/exams/${copyId}/lifecycle`, {
  method: "POST",
  body: JSON.stringify({ action: "archive" }),
});
check(
  "lưu trữ bản sao → 200 status=ARCHIVED",
  archived.status === 200 && archived.body?.status === "ARCHIVED",
  `status=${archived.body?.status}`,
);

// Đóng đề rồi kiểm tra học sinh không vào được nữa.
await teacherA.request(`/api/classrooms/${classroomAId}/assignments`, {
  method: "POST",
  body: JSON.stringify({
    examId,
    opensAt: null,
    closesAt: new Date(Date.now() - 60 * 1000).toISOString(),
    allowedAttempts: 5,
  }),
});

const afterClose = await student.request("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId }),
});
check(
  "đề đã đóng → 409 ASSIGNMENT_CLOSED",
  afterClose.status === 409 && errorCode(afterClose) === "ASSIGNMENT_CLOSED",
  `status=${afterClose.status} code=${errorCode(afterClose)}`,
);

// ---------------------------------------------------------------------------
// 11. Dọn dẹp dữ liệu kiểm thử (chạy lại nhiều lần vẫn an toàn)
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const assetRows = createdUserIds.length
    ? await pool.query('SELECT "storageKey" FROM "MediaAsset" WHERE "uploaderId" = ANY($1::text[])', [
        createdUserIds,
      ])
    : { rows: [] };

  await pool.query('DELETE FROM "Attempt" WHERE "examId" = ANY($1::text[])', [createdExamIds]);
  await pool.query('DELETE FROM "ExamAssignment" WHERE "examId" = ANY($1::text[])', [createdExamIds]);

  const linkedQuestions = createdExamIds.length
    ? await pool.query('SELECT "questionId" FROM "ExamQuestion" WHERE "examId" = ANY($1::text[])', [
        createdExamIds,
      ])
    : { rows: [] };
  const questionIds = [
    ...new Set([...createdQuestionIds, ...linkedQuestions.rows.map((row) => row.questionId)]),
  ];

  await pool.query('DELETE FROM "ExamQuestion" WHERE "examId" = ANY($1::text[])', [createdExamIds]);
  if (questionIds.length > 0) {
    await pool.query('DELETE FROM "Question" WHERE "id" = ANY($1::text[])', [questionIds]);
  }
  await pool.query('DELETE FROM "Exam" WHERE "id" = ANY($1::text[])', [createdExamIds]);
  await pool.query('DELETE FROM "MediaAsset" WHERE "uploaderId" = ANY($1::text[])', [createdUserIds]);
  await pool.query('DELETE FROM "ClassroomMember" WHERE "classroomId" = ANY($1::text[])', [
    createdClassroomIds,
  ]);
  await pool.query('DELETE FROM "Classroom" WHERE "id" = ANY($1::text[])', [createdClassroomIds]);

  // Tài khoản dùng lại giữa các lần chạy (e2e-teacher-a/e2e-teacher-b/e2e-student) nên KHÔNG
  // bị xoá ở đây, nhờ vậy lần chạy sau không phải đăng ký lại và không chạm giới hạn tần suất
  // của endpoint xác thực. Chỉ dữ liệu do bài kiểm thử tạo ra (đề, lớp, ảnh, lượt làm bài) bị dọn.

  for (const row of assetRows.rows) {
    await unlink(path.resolve(process.cwd(), MEDIA_DIR, path.basename(row.storageKey))).catch(
      () => undefined,
    );
  }
} catch (cleanupError) {
  console.warn(`[WARN] Không dọn sạch được dữ liệu kiểm thử: ${cleanupError?.message ?? cleanupError}`);
} finally {
  await pool.end();
}

// ---------------------------------------------------------------------------
// Tổng kết
// ---------------------------------------------------------------------------
const failed = results.filter((result) => !result.ok);

console.log("");
console.log(`Tổng số kiểm tra: ${results.length} — đạt ${results.length - failed.length}, lỗi ${failed.length}`);

if (failed.length > 0) {
  console.log("Các kiểm tra lỗi:");
  for (const result of failed) {
    console.log(`  - ${result.name}`);
  }
  process.exit(1);
}


