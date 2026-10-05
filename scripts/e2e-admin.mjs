/**
 * Kiểm thử đầu-cuối (E2E) cho luồng TÀI KHOẢN + QUẢN TRỊ với PostgreSQL thật:
 * đăng ký/đăng nhập, nộp đơn xin quyền giáo viên, quản trị viên duyệt/từ chối,
 * khoá tài khoản (xoá phiên) và các lớp kiểm tra quyền.
 *
 *   npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"   (một lần, nếu chưa có)
 *   npx next start -p 3123   (hoặc npm run dev)
 *   npm run test:e2e:admin
 *
 * Biến môi trường:
 *   E2E_BASE_URL        địa chỉ ứng dụng (mặc định http://localhost:3123)
 *   E2E_ADMIN_EMAIL     email quản trị viên (mặc định ADMIN_EMAIL)
 *   E2E_ADMIN_PASSWORD  mật khẩu quản trị viên (mặc định ADMIN_PASSWORD)
 *
 * Yêu cầu: DB đã `npm run db:migrate` + `npm run db:seed` (cần ít nhất một môn học).
 * Script tạo 2 tài khoản học sinh tạm với email ngẫu nhiên và tự xoá ở cuối (kèm đơn,
 * phiên, lượt làm bài của chúng) nên chạy lại nhiều lần vẫn an toàn.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3123";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";

/** Mã ngẫu nhiên để mỗi lần chạy dùng email khác nhau (tránh đụng UNIQUE email). */
const RUN_ID = randomUUID().slice(0, 8);
const PASSWORD = "MatKhau123";

const results = [];
const createdUserIds = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "[OK]  " : "[FAIL]"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Client tự quản lý cookie giống trình duyệt: một hộp cookie cho mọi tên cookie nên vừa
 * giữ `better-auth.session_token` của phiên đăng nhập vừa giữ `luyenthi_session` của khách.
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

  return {
    cookieNames: () => [...jar.keys()],
    async request(path, init = {}) {
      const headers = { ...(init.headers ?? {}) };
      if (init.body !== undefined) headers["content-type"] = "application/json";
      const cookieHeader = readCookieHeader();
      if (cookieHeader) headers.cookie = cookieHeader;

      const response = await fetch(BASE + path, { ...init, headers });
      storeCookies(response);

      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 200) };
      }

      return {
        status: response.status,
        body,
        text,
        url: response.url,
        location: response.headers.get("location") ?? "",
      };
    },
    /** Tải một trang HTML: đi theo chuyển hướng để biết đích cuối cùng là trang nào. */
    async page(path) {
      const headers = {};
      const cookieHeader = readCookieHeader();
      if (cookieHeader) headers.cookie = cookieHeader;

      const response = await fetch(BASE + path, { headers, redirect: "follow" });
      storeCookies(response);
      const text = await response.text();
      return { status: response.status, text, url: response.url };
    },
  };
}

function errorCode(response) {
  return response.body?.error?.code ?? "";
}

const anonymous = makeClient();
const admin = makeClient();
const student = makeClient();
const otherStudent = makeClient();

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Thiếu tài khoản quản trị viên. Hãy chạy:\n" +
      '  npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"\n' +
      "rồi đặt ADMIN_EMAIL / ADMIN_PASSWORD (hoặc E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) trong .env.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Khách ẩn danh: chưa đăng nhập thì không chạm được khu quản trị
// ---------------------------------------------------------------------------
const meAnonymous = await anonymous.request("/api/me");
check(
  "GET /api/me (khách) → 200 với user=null",
  meAnonymous.status === 200 && meAnonymous.body?.user === null,
  `status=${meAnonymous.status}`,
);

const usersAnonymous = await anonymous.request("/api/admin/users");
check(
  "GET /api/admin/users (khách) → 401 AUTH_REQUIRED",
  usersAnonymous.status === 401 && errorCode(usersAnonymous) === "AUTH_REQUIRED",
  `status=${usersAnonymous.status} code=${errorCode(usersAnonymous)}`,
);

const applicationsAnonymous = await anonymous.request("/api/admin/teacher-applications");
check(
  "GET /api/admin/teacher-applications (khách) → 401 AUTH_REQUIRED",
  applicationsAnonymous.status === 401 && errorCode(applicationsAnonymous) === "AUTH_REQUIRED",
  `status=${applicationsAnonymous.status}`,
);

const adminPageAnonymous = await anonymous.page("/quan-tri");
check(
  "GET /quan-tri (khách) → chuyển hướng sang /dang-nhap",
  adminPageAnonymous.url.includes("/dang-nhap"),
  `đích=${adminPageAnonymous.url.replace(BASE, "")}`,
);

// ---------------------------------------------------------------------------
// 2. Đăng ký học sinh: vai trò do server quyết định, client không nâng được
// ---------------------------------------------------------------------------
const studentEmail = `e2e-student-${RUN_ID}@example.com`;
const registered = await student.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: `Học sinh E2E ${RUN_ID}`,
    email: studentEmail,
    password: PASSWORD,
  }),
});
check(
  "POST /api/auth/register → 201, vai trò STUDENT",
  registered.status === 201 && registered.body?.user?.role === "STUDENT",
  `status=${registered.status} role=${registered.body?.user?.role}`,
);
if (registered.body?.user?.id) createdUserIds.push(registered.body.user.id);
check(
  "đăng ký xong có cookie phiên đăng nhập",
  student.cookieNames().some((name) => name.includes("session")),
  `cookies=${student.cookieNames().join(",") || "(trống)"}`,
);
check("không trả token phiên trong thân phản hồi", !("token" in (registered.body ?? {})));

const meStudent = await student.request("/api/me");
check(
  "GET /api/me (học sinh) → đúng email và vai trò STUDENT",
  meStudent.status === 200 &&
    meStudent.body?.user?.email === studentEmail &&
    meStudent.body?.user?.role === "STUDENT",
  `status=${meStudent.status} role=${meStudent.body?.user?.role}`,
);

const duplicated = await anonymous.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({ name: "Trùng email", email: studentEmail, password: PASSWORD }),
});
check(
  "đăng ký lại cùng email → 409 EMAIL_ALREADY_USED",
  duplicated.status === 409 && errorCode(duplicated) === "EMAIL_ALREADY_USED",
  `status=${duplicated.status} code=${errorCode(duplicated)}`,
);

const shortPassword = await anonymous.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Mật khẩu ngắn",
    email: `e2e-short-${RUN_ID}@example.com`,
    password: "123",
  }),
});
check(
  "mật khẩu dưới 8 ký tự → 422 VALIDATION_ERROR",
  shortPassword.status === 422 && errorCode(shortPassword) === "VALIDATION_ERROR",
  `status=${shortPassword.status}`,
);

/** Thử tự nâng quyền ngay lúc đăng ký: các trường `input: false` phải bị bỏ qua. */
const otherEmail = `e2e-other-${RUN_ID}@example.com`;
const escalated = await otherStudent.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: `Học sinh E2E khác ${RUN_ID}`,
    email: otherEmail,
    password: PASSWORD,
    role: "ADMIN",
    banned: true,
  }),
});
check(
  "gửi kèm role=ADMIN / banned=true khi đăng ký → vẫn là STUDENT, không bị khoá",
  escalated.status === 201 &&
    escalated.body?.user?.role === "STUDENT" &&
    escalated.body?.user?.banned !== true,
  `status=${escalated.status} role=${escalated.body?.user?.role}`,
);
if (escalated.body?.user?.id) createdUserIds.push(escalated.body.user.id);

// ---------------------------------------------------------------------------
// 3. Nộp đơn xin quyền giáo viên (học sinh đang đăng nhập)
// ---------------------------------------------------------------------------
const stateBefore = await student.request("/api/teacher-applications");
check(
  "GET /api/teacher-applications → chưa có đơn, được phép nộp",
  stateBefore.status === 200 &&
    stateBefore.body?.application === null &&
    stateBefore.body?.role === "STUDENT" &&
    stateBefore.body?.canSubmit === true,
  `status=${stateBefore.status} canSubmit=${stateBefore.body?.canSubmit}`,
);

const subjects = await student.request("/api/subjects");
check(
  "GET /api/subjects → có môn học để chọn",
  subjects.status === 200 && Array.isArray(subjects.body?.items) && subjects.body.items.length > 0,
  `total=${subjects.body?.items?.length ?? 0}`,
);
const subjectId = subjects.body?.items?.[0]?.id;
const subjectName = subjects.body?.items?.[0]?.name;

const MOTIVATION = `Tôi là giáo viên ${RUN_ID}, mong muốn đồng hành cùng học sinh luyện đề trên hệ thống.`;

const tooShort = await student.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({ motivation: "Quá ngắn" }),
});
check(
  "giới thiệu dưới 40 ký tự → 422 VALIDATION_ERROR",
  tooShort.status === 422 && errorCode(tooShort) === "VALIDATION_ERROR",
  `status=${tooShort.status}`,
);

const badSubject = await student.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({ motivation: MOTIVATION, subjectId: "mon-hoc-khong-ton-tai" }),
});
check(
  "môn học không tồn tại → 422 VALIDATION_ERROR",
  badSubject.status === 422 && errorCode(badSubject) === "VALIDATION_ERROR",
  `status=${badSubject.status} code=${errorCode(badSubject)}`,
);

const submitted = await student.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({
    school: `Trường E2E ${RUN_ID}`,
    subjectId,
    experienceYears: 5,
    contactPhone: "0901234567",
    motivation: MOTIVATION,
  }),
});
check(
  "POST /api/teacher-applications → 201, trạng thái PENDING",
  submitted.status === 201 && submitted.body?.status === "PENDING",
  `status=${submitted.status} đơn=${submitted.body?.status}`,
);
const applicationId = submitted.body?.id;
check(
  "đơn trả về đủ trường công khai (môn học, trường, số năm) và không có pendingKey",
  submitted.body?.subjectName === subjectName &&
    submitted.body?.school === `Trường E2E ${RUN_ID}` &&
    submitted.body?.experienceYears === 5 &&
    !("pendingKey" in (submitted.body ?? {})),
  `môn=${submitted.body?.subjectName}`,
);

const resubmitted = await student.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({ motivation: MOTIVATION }),
});
check(
  "nộp đơn thứ hai khi đang chờ → 409 TEACHER_APPLICATION_EXISTS",
  resubmitted.status === 409 && errorCode(resubmitted) === "TEACHER_APPLICATION_EXISTS",
  `status=${resubmitted.status} code=${errorCode(resubmitted)}`,
);

const statePending = await student.request("/api/teacher-applications");
check(
  "GET /api/teacher-applications → thấy đơn PENDING và không cho nộp tiếp",
  statePending.status === 200 &&
    statePending.body?.application?.status === "PENDING" &&
    statePending.body?.canSubmit === false,
  `canSubmit=${statePending.body?.canSubmit}`,
);

// ---------------------------------------------------------------------------
// 4. Học sinh không vào được khu quản trị (API 403, trang 404)
// ---------------------------------------------------------------------------
const usersAsStudent = await student.request("/api/admin/users");
check(
  "GET /api/admin/users (học sinh) → 403 FORBIDDEN",
  usersAsStudent.status === 403 && errorCode(usersAsStudent) === "FORBIDDEN",
  `status=${usersAsStudent.status} code=${errorCode(usersAsStudent)}`,
);

const applicationsAsStudent = await student.request("/api/admin/teacher-applications");
check(
  "GET /api/admin/teacher-applications (học sinh) → 403 FORBIDDEN",
  applicationsAsStudent.status === 403,
  `status=${applicationsAsStudent.status}`,
);

const approveAsStudent = await student.request(
  `/api/admin/teacher-applications/${applicationId}/approve`,
  { method: "POST", body: JSON.stringify({ note: "tự duyệt" }) },
);
check(
  "học sinh tự duyệt đơn của mình → 403 FORBIDDEN",
  approveAsStudent.status === 403 && errorCode(approveAsStudent) === "FORBIDDEN",
  `status=${approveAsStudent.status}`,
);

const banSelfAsStudent = await student.request(
  `/api/admin/users/${createdUserIds[0]}/ban`,
  { method: "POST", body: JSON.stringify({ reason: "tự khoá" }) },
);
check(
  "học sinh tự khoá tài khoản → 403 FORBIDDEN",
  banSelfAsStudent.status === 403 && errorCode(banSelfAsStudent) === "FORBIDDEN",
  `status=${banSelfAsStudent.status}`,
);

const adminPageAsStudent = await student.page("/quan-tri");
check(
  "GET /quan-tri (học sinh) → 404 (không lộ sự tồn tại của trang)",
  adminPageAsStudent.status === 404,
  `status=${adminPageAsStudent.status}`,
);

// ---------------------------------------------------------------------------
// 5. Quản trị viên đăng nhập và duyệt đơn
// ---------------------------------------------------------------------------
const wrongPassword = await anonymous.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: studentEmail, password: "SaiMatKhau123" }),
});
check(
  "đăng nhập sai mật khẩu → 401 INVALID_CREDENTIALS",
  wrongPassword.status === 401 && errorCode(wrongPassword) === "INVALID_CREDENTIALS",
  `status=${wrongPassword.status} code=${errorCode(wrongPassword)}`,
);

const adminLogin = await admin.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
check(
  "đăng nhập quản trị viên → 200, vai trò ADMIN",
  adminLogin.status === 200 && adminLogin.body?.user?.role === "ADMIN",
  `status=${adminLogin.status} role=${adminLogin.body?.user?.role}`,
);
const adminId = adminLogin.body?.user?.id ?? "";

const usersSearch = await admin.request(
  `/api/admin/users?search=${encodeURIComponent(studentEmail)}`,
);
const studentRow = usersSearch.body?.items?.[0];
check(
  "GET /api/admin/users?search → tìm thấy học sinh vừa đăng ký kèm số đơn chờ",
  usersSearch.status === 200 &&
    usersSearch.body?.total === 1 &&
    studentRow?.email === studentEmail &&
    studentRow?.role === "STUDENT" &&
    studentRow?.pendingApplicationCount === 1 &&
    studentRow?.banned === false,
  `total=${usersSearch.body?.total} đơn chờ=${studentRow?.pendingApplicationCount}`,
);
const studentId = studentRow?.id ?? createdUserIds[0];

const usersPage = await admin.request("/api/admin/users?page=1&pageSize=5");
const rawUsers = JSON.stringify(usersPage.body ?? {});
check(
  "danh sách người dùng không rò rỉ trường nhạy cảm",
  !rawUsers.includes("password") &&
    !rawUsers.includes("sessionToken") &&
    !rawUsers.includes('"token"') &&
    !rawUsers.includes("pendingKey"),
);
check(
  "phân trang hợp lệ (page/pageSize/totalPages)",
  usersPage.status === 200 &&
    usersPage.body?.page === 1 &&
    usersPage.body?.pageSize === 5 &&
    Number.isInteger(usersPage.body?.totalPages),
  `total=${usersPage.body?.total} totalPages=${usersPage.body?.totalPages}`,
);

const queue = await admin.request("/api/admin/teacher-applications?status=PENDING&pageSize=50");
const queued = queue.body?.items?.find((item) => item.id === applicationId);
check(
  "GET /api/admin/teacher-applications?status=PENDING → có đơn vừa nộp kèm hồ sơ người nộp",
  queue.status === 200 && queued?.applicant?.email === studentEmail && queued?.status === "PENDING",
  `status=${queue.status} total=${queue.body?.total}`,
);

const approved = await admin.request(`/api/admin/teacher-applications/${applicationId}/approve`, {
  method: "POST",
  body: JSON.stringify({ note: "Hồ sơ đầy đủ, duyệt." }),
});
check(
  "duyệt đơn → 200 APPROVED, có mốc thời gian duyệt",
  approved.status === 200 &&
    approved.body?.status === "APPROVED" &&
    typeof approved.body?.reviewedAt === "string",
  `status=${approved.status} đơn=${approved.body?.status}`,
);

const approvedAgain = await admin.request(
  `/api/admin/teacher-applications/${applicationId}/approve`,
  { method: "POST", body: JSON.stringify({}) },
);
check(
  "duyệt lại đơn đã xử lý → 409 TEACHER_APPLICATION_ALREADY_REVIEWED",
  approvedAgain.status === 409 &&
    errorCode(approvedAgain) === "TEACHER_APPLICATION_ALREADY_REVIEWED",
  `status=${approvedAgain.status} code=${errorCode(approvedAgain)}`,
);

const meAfterApproval = await student.request("/api/me");
check(
  "phiên cũ của học sinh đọc lại từ DB → vai trò TEACHER (không cần đăng nhập lại)",
  meAfterApproval.status === 200 && meAfterApproval.body?.user?.role === "TEACHER",
  `role=${meAfterApproval.body?.user?.role}`,
);

const stateAfterApproval = await student.request("/api/teacher-applications");
check(
  "sau khi thành giáo viên → canSubmit=false, thấy đơn APPROVED",
  stateAfterApproval.status === 200 &&
    stateAfterApproval.body?.role === "TEACHER" &&
    stateAfterApproval.body?.canSubmit === false &&
    stateAfterApproval.body?.application?.status === "APPROVED",
  `canSubmit=${stateAfterApproval.body?.canSubmit}`,
);

const teacherFilter = await admin.request(
  `/api/admin/users?role=TEACHER&search=${encodeURIComponent(studentEmail)}`,
);
check(
  "lọc theo vai trò TEACHER → thấy đúng tài khoản vừa được nâng quyền",
  teacherFilter.status === 200 && teacherFilter.body?.total === 1,
  `total=${teacherFilter.body?.total}`,
);

// ---------------------------------------------------------------------------
// 6. Giáo viên KHÔNG phải quản trị viên: kiểm tra quyền vẫn chạy lại ở server
// ---------------------------------------------------------------------------
const usersAsTeacher = await student.request("/api/admin/users");
check(
  "GET /api/admin/users (giáo viên) → 403 FORBIDDEN",
  usersAsTeacher.status === 403 && errorCode(usersAsTeacher) === "FORBIDDEN",
  `status=${usersAsTeacher.status}`,
);

const adminPageAsTeacher = await student.page("/quan-tri");
check(
  "GET /quan-tri (giáo viên) → 404",
  adminPageAsTeacher.status === 404,
  `status=${adminPageAsTeacher.status}`,
);

// ---------------------------------------------------------------------------
// 7. Từ chối đơn kèm lý do, rồi cho nộp lại (khoá UNIQUE `pendingKey` được mở)
// ---------------------------------------------------------------------------
const otherSubmitted = await otherStudent.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({
    motivation: `Tôi mong muốn trở thành giáo viên của hệ thống (${RUN_ID}) để hỗ trợ học sinh.`,
  }),
});
check(
  "học sinh thứ hai nộp đơn → 201 PENDING",
  otherSubmitted.status === 201 && otherSubmitted.body?.status === "PENDING",
  `status=${otherSubmitted.status}`,
);
const otherApplicationId = otherSubmitted.body?.id;

const REJECT_NOTE = `Hồ sơ thiếu minh chứng chuyên môn (${RUN_ID}).`;
const rejected = await admin.request(
  `/api/admin/teacher-applications/${otherApplicationId}/reject`,
  { method: "POST", body: JSON.stringify({ note: REJECT_NOTE }) },
);
check(
  "từ chối đơn → 200 REJECTED kèm lý do",
  rejected.status === 200 &&
    rejected.body?.status === "REJECTED" &&
    rejected.body?.reviewNote === REJECT_NOTE,
  `status=${rejected.status} đơn=${rejected.body?.status}`,
);

const otherState = await otherStudent.request("/api/teacher-applications");
check(
  "người bị từ chối thấy lý do và được nộp lại (canSubmit=true)",
  otherState.status === 200 &&
    otherState.body?.application?.status === "REJECTED" &&
    otherState.body?.application?.reviewNote === REJECT_NOTE &&
    otherState.body?.canSubmit === true,
  `canSubmit=${otherState.body?.canSubmit}`,
);

const otherResubmitted = await otherStudent.request("/api/teacher-applications", {
  method: "POST",
  body: JSON.stringify({ motivation: `Đã bổ sung minh chứng, xin xét duyệt lại (${RUN_ID}).` }),
});
check(
  "nộp lại sau khi bị từ chối → 201 (khoá chống trùng đã được mở)",
  otherResubmitted.status === 201 && otherResubmitted.body?.status === "PENDING",
  `status=${otherResubmitted.status}`,
);
check(
  "đơn cũ giữ trạng thái REJECTED, đơn mới là PENDING",
  otherResubmitted.body?.id !== otherApplicationId,
);

const rejectedQueue = await admin.request(
  "/api/admin/teacher-applications?status=REJECTED&pageSize=50",
);
check(
  "đơn cũ nằm trong danh sách REJECTED kèm lý do đã lưu",
  rejectedQueue.body?.items?.some(
    (item) => item.id === otherApplicationId && item.reviewNote === REJECT_NOTE,
  ),
  `total=${rejectedQueue.body?.total}`,
);

const pendingQueue = await admin.request(
  "/api/admin/teacher-applications?status=PENDING&pageSize=50",
);
check(
  "đơn nộp lại nằm trong hàng đợi PENDING",
  pendingQueue.body?.items?.some((item) => item.id === otherResubmitted.body?.id),
  `total=${pendingQueue.body?.total}`,
);

// ---------------------------------------------------------------------------
// 8. Khoá tài khoản: xoá mọi phiên đang mở và chặn đăng nhập
// ---------------------------------------------------------------------------
const BAN_REASON = `Vi phạm nội quy kiểm thử (${RUN_ID}).`;
const banned = await admin.request(`/api/admin/users/${studentId}/ban`, {
  method: "POST",
  body: JSON.stringify({ reason: BAN_REASON }),
});
check(
  "khoá tài khoản → 200 banned=true kèm lý do và mốc thời gian",
  banned.status === 200 &&
    banned.body?.banned === true &&
    banned.body?.banReason === BAN_REASON &&
    typeof banned.body?.bannedAt === "string",
  `status=${banned.status} banned=${banned.body?.banned}`,
);

const meAfterBan = await student.request("/api/me");
check(
  "phiên đang mở của người bị khoá bị xoá ngay → user=null",
  meAfterBan.status === 200 && meAfterBan.body?.user === null,
  `status=${meAfterBan.status}`,
);

const adminApiAfterBan = await student.request("/api/admin/users");
check(
  "gọi API bằng cookie cũ sau khi bị khoá → 401 AUTH_REQUIRED",
  adminApiAfterBan.status === 401 && errorCode(adminApiAfterBan) === "AUTH_REQUIRED",
  `status=${adminApiAfterBan.status}`,
);

const loginWhileBanned = await student.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
});
check(
  "tài khoản bị khoá đăng nhập lại → 403 ACCOUNT_LOCKED",
  loginWhileBanned.status === 403 && errorCode(loginWhileBanned) === "ACCOUNT_LOCKED",
  `status=${loginWhileBanned.status} code=${errorCode(loginWhileBanned)}`,
);

const banSelf = await admin.request(`/api/admin/users/${adminId}/ban`, {
  method: "POST",
  body: JSON.stringify({ reason: "tự khoá" }),
});
check(
  "quản trị viên tự khoá chính mình → 409 USER_ACTION_NOT_ALLOWED",
  banSelf.status === 409 && errorCode(banSelf) === "USER_ACTION_NOT_ALLOWED",
  `status=${banSelf.status} code=${errorCode(banSelf)}`,
);

const banUnknown = await admin.request(`/api/admin/users/khong-ton-tai-${RUN_ID}/ban`, {
  method: "POST",
  body: JSON.stringify({ reason: "thử" }),
});
check(
  "khoá tài khoản không tồn tại → 404 USER_NOT_FOUND",
  banUnknown.status === 404 && errorCode(banUnknown) === "USER_NOT_FOUND",
  `status=${banUnknown.status} code=${errorCode(banUnknown)}`,
);

const unbanned = await admin.request(`/api/admin/users/${studentId}/unban`, {
  method: "POST",
  body: JSON.stringify({}),
});
check(
  "mở khoá → 200 banned=false, lý do bị xoá",
  unbanned.status === 200 &&
    unbanned.body?.banned === false &&
    unbanned.body?.banReason === null,
  `status=${unbanned.status} banned=${unbanned.body?.banned}`,
);

const loginAfterUnban = await student.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: studentEmail, password: PASSWORD }),
});
check(
  "mở khoá xong đăng nhập lại được → 200 và giữ vai trò TEACHER",
  loginAfterUnban.status === 200 && loginAfterUnban.body?.user?.role === "TEACHER",
  `status=${loginAfterUnban.status} role=${loginAfterUnban.body?.user?.role}`,
);

const logout = await student.request("/api/auth/logout", { method: "POST" });
check("đăng xuất → 204", logout.status === 204, `status=${logout.status}`);

const meAfterLogout = await student.request("/api/me");
check(
  "sau khi đăng xuất → 200 user=null",
  meAfterLogout.status === 200 && meAfterLogout.body?.user === null,
  `status=${meAfterLogout.status}`,
);

// ---------------------------------------------------------------------------
// Dọn dẹp: xoá tài khoản do script tạo (phiên, đơn, lượt làm bài xoá theo)
// ---------------------------------------------------------------------------
async function cleanup() {
  if (createdUserIds.length === 0) return;
  if (!process.env.DATABASE_URL) {
    console.log("[WARN] Thiếu DATABASE_URL nên không dọn được tài khoản kiểm thử.");
    return;
  }

  let client;
  try {
    const pgModule = await import("pg");
    const pg = pgModule.default ?? pgModule;
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await client.query('delete from "Attempt" where "userId" = any($1::text[])', [
      createdUserIds,
    ]);
    // Xoá người dùng sẽ kéo theo Session, Account và TeacherApplication (onDelete: Cascade).
    await client.query('delete from "User" where id = any($1::text[])', [createdUserIds]);
    // Bộ đếm giới hạn tần suất là trạng thái tạm: xoá để lần đăng nhập sau của bạn không bị chặn.
    await client.query('delete from "RateLimit"');

    console.log(`[OK]  đã dọn ${createdUserIds.length} tài khoản kiểm thử khỏi DB`);
  } catch (error) {
    console.log(`[WARN] Không dọn được tài khoản kiểm thử: ${error.message}`);
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

await cleanup();

const failed = results.filter((item) => !item.ok);
console.log(`\nTỔNG: ${results.length - failed.length}/${results.length} kiểm tra đạt`);
if (failed.length > 0) {
  console.log("THẤT BẠI: " + failed.map((item) => item.name).join(" | "));
  process.exit(1);
}
console.log("Luồng tài khoản + quản trị hoạt động đúng với dữ liệu thật trong PostgreSQL.");




