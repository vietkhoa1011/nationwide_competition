/**
 * Kiểm thử đầu-cuối (E2E) với PostgreSQL thật: chạy toàn bộ luồng thi ẩn danh
 * qua HTTP y như trình duyệt làm.
 *
 *   npx next start -p 3123   (hoặc npm run dev)
 *   npm run test:e2e
 *
 * Yêu cầu: DB đã `npm run db:migrate` + `npm run db:seed`.
 * Script tự xoá các lượt làm bài do nó tạo ra (không đụng tới đề thi/câu hỏi).
 */
import "dotenv/config";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3123";

const results = [];
const createdAttemptIds = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "[OK]  " : "[FAIL]"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Client tự quản lý cookie phiên ẩn danh giống trình duyệt. */
function makeClient() {
  let cookie = "";
  return async function request(path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;

    const response = await fetch(BASE + path, { ...init, headers });
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      if (raw.startsWith("luyenthi_session=")) cookie = raw.split(";")[0];
    }

    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { status: response.status, body };
  };
}

/** Bắt đầu lượt làm bài và ghi nhớ id để dọn dẹp sau. */
async function startAttempt(client, examId) {
  const response = await client("/api/attempts", {
    method: "POST",
    body: JSON.stringify({ examId }),
  });
  if (response.status === 201 && response.body?.attemptId) {
    createdAttemptIds.push(response.body.attemptId);
  }
  return response;
}

const student = makeClient();
const otherStudent = makeClient();
const anonymous = makeClient();

// 1. Danh sách đề thi
const exams = await student("/api/exams");
check("GET /api/exams → 200", exams.status === 200, `status=${exams.status}`);
check("có 3 đề đã xuất bản", exams.body?.items?.length === 3, `total=${exams.body?.total}`);
const examA = exams.body.items[0];
const examB = exams.body.items[1];

// 2. Bắt đầu lượt làm bài
const started = await startAttempt(student, examA.id);
check("POST /api/attempts → 201 (lượt mới)", started.status === 201, `resumed=${started.body?.resumed}`);
const attemptId = started.body.attemptId;
check("trả về attemptId + hạn làm bài", Boolean(attemptId) && Boolean(started.body.expiresAt));

const resumed = await student("/api/attempts", {
  method: "POST",
  body: JSON.stringify({ examId: examA.id }),
});
check(
  "gọi lại cùng đề → 200 resumed=true, không tạo lượt mới",
  resumed.status === 200 && resumed.body.resumed === true && resumed.body.attemptId === attemptId,
);

// 3. Tải lượt làm bài: không được rò rỉ đáp án
const attempt = await student(`/api/attempts/${attemptId}`);
check("GET /api/attempts/:id → 200", attempt.status === 200, `status=${attempt.status}`);
const rawPayload = JSON.stringify(attempt.body);
check(
  "payload trước khi nộp KHÔNG chứa đáp án đúng/lời giải",
  !rawPayload.includes("correctOptionIds") &&
    !rawPayload.includes("isCorrect") &&
    !rawPayload.includes("explanation"),
);
check("có đúng 5 câu hỏi", attempt.body.questions?.length === 5);
check(
  "counts ban đầu: 0 câu đã trả lời",
  attempt.body.counts?.total === 5 && attempt.body.counts?.answered === 0,
);

// 4. Lưu / xoá đáp án
const q1 = attempt.body.questions[0];
const q2 = attempt.body.questions[1];
const saved = await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: q1.questionId, optionId: q1.options[0].id }),
});
check(
  "PUT đáp án → 200 + selectedOptionId đúng",
  saved.status === 200 && saved.body.selectedOptionId === q1.options[0].id,
  `status=${saved.status}`,
);

const deleted = await student(
  `/api/attempts/${attemptId}/answers?questionId=${encodeURIComponent(q1.questionId)}`,
  { method: "DELETE" },
);
check(
  "DELETE đáp án → 200 + selectedOptionId=null",
  deleted.status === 200 && deleted.body.selectedOptionId === null,
  `status=${deleted.status}`,
);

await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: q1.questionId, optionId: q1.options[0].id }),
});
await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: q2.questionId, optionId: q2.options[1].id }),
});

const foreign = await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: "cau-hoi-khong-ton-tai", optionId: q1.options[0].id }),
});
check(
  "câu hỏi lạ → 404 QUESTION_NOT_IN_ATTEMPT",
  foreign.status === 404 && foreign.body.error?.code === "QUESTION_NOT_IN_ATTEMPT",
  `status=${foreign.status}`,
);

const wrongOption = await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: q1.questionId, optionId: "lua-chon-khong-ton-tai" }),
});
check(
  "lựa chọn lạ → 422 OPTION_NOT_IN_QUESTION",
  wrongOption.status === 422 && wrongOption.body.error?.code === "OPTION_NOT_IN_QUESTION",
  `status=${wrongOption.status}`,
);

// 5. Gắn cờ + ghi nhớ vị trí (theo đặc tả API, cả hai đều dùng POST)
const flagged = await student(`/api/attempts/${attemptId}/flag`, {
  method: "POST",
  body: JSON.stringify({ questionId: q1.questionId, isFlagged: true }),
});
check("POST cờ đánh dấu → 200", flagged.status === 200, `status=${flagged.status}`);

const progress = await student(`/api/attempts/${attemptId}/progress`, {
  method: "POST",
  body: JSON.stringify({ lastQuestionPosition: 2 }),
});
check("POST tiến độ → 200", progress.status === 200, `status=${progress.status}`);

const reloaded = await student(`/api/attempts/${attemptId}`);
check(
  "tải lại thấy 2 câu đã trả lời + 1 câu gắn cờ + vị trí đã lưu",
  reloaded.body.counts?.answered === 2 &&
    reloaded.body.counts?.flagged === 1 &&
    reloaded.body.lastQuestionPosition === 2,
  `answered=${reloaded.body.counts?.answered} flagged=${reloaded.body.counts?.flagged} vị trí=${reloaded.body.lastQuestionPosition}`,
);

// 6. Cách ly theo phiên ẩn danh
await startAttempt(otherStudent, examB.id);
const crossed = await otherStudent(`/api/attempts/${attemptId}`);
check(
  "phiên khác xem lượt của người khác → 404 ATTEMPT_NOT_FOUND",
  crossed.status === 404 && crossed.body.error?.code === "ATTEMPT_NOT_FOUND",
  `status=${crossed.status}`,
);

const noSession = await anonymous(`/api/attempts/${attemptId}`);
check(
  "khách không có cookie → 404 ATTEMPT_NOT_FOUND (phiên mới không sở hữu lượt làm bài)",
  noSession.status === 404 && noSession.body.error?.code === "ATTEMPT_NOT_FOUND",
  `status=${noSession.status}`,
);

// 7. Chưa nộp thì chưa có kết quả
const early = await student(`/api/attempts/${attemptId}/result`);
check(
  "xem kết quả khi chưa nộp → 409 RESULT_NOT_READY",
  early.status === 409 && early.body.error?.code === "RESULT_NOT_READY",
  `status=${early.status}`,
);

// 8. Nộp bài và chấm điểm
const submitted = await student(`/api/attempts/${attemptId}/submit`, { method: "POST" });
check("POST submit → 200", submitted.status === 200, `status=${submitted.status}`);
const result = submitted.body;
check("status = SUBMITTED", result.status === "SUBMITTED", `status=${result.status}`);
check(
  "kết quả có điểm và thống kê đúng/sai/bỏ trống",
  typeof result.score === "number" &&
    result.maxScore === 5 &&
    result.correctCount + result.incorrectCount + result.unansweredCount === 5,
  `score=${result.score}/${result.maxScore} đúng=${result.correctCount} sai=${result.incorrectCount} bỏ=${result.unansweredCount}`,
);
check(
  "mỗi câu có đáp án đúng + lời giải",
  Array.isArray(result.questions) &&
    result.questions.length === 5 &&
    result.questions.every(
      (question) =>
        Array.isArray(question.correctOptionIds) &&
        question.correctOptionIds.length === 1 &&
        typeof question.isCorrect === "boolean" &&
        typeof question.explanation === "string",
    ),
);
const q1Result = result.questions.find((question) => question.questionId === q1.questionId);
check(
  "chấm đúng/sai khớp với lựa chọn đã lưu",
  q1Result.isCorrect === (q1.options[0].id === q1Result.correctOptionIds[0]),
  `chọn ${q1.options[0].label ?? q1.options[0].id} → isCorrect=${q1Result.isCorrect}`,
);

// 9. Nộp lại: idempotent
const resubmit = await student(`/api/attempts/${attemptId}/submit`, { method: "POST" });
check(
  "nộp lại không đổi điểm và mốc thời gian nộp",
  resubmit.status === 200 &&
    resubmit.body.score === result.score &&
    resubmit.body.submittedAt === result.submittedAt,
  `score=${resubmit.body.score}`,
);

// 10. Khoá sửa đáp án sau khi nộp
const locked = await student(`/api/attempts/${attemptId}/answers`, {
  method: "PUT",
  body: JSON.stringify({ questionId: q1.questionId, optionId: q1.options[1].id }),
});
check(
  "sửa đáp án sau khi nộp → 409 ATTEMPT_SUBMITTED",
  locked.status === 409 && locked.body.error?.code === "ATTEMPT_SUBMITTED",
  `status=${locked.status}`,
);

const reread = await student(`/api/attempts/${attemptId}/result`);
check(
  "GET result → 200 và trùng điểm đã chấm",
  reread.status === 200 && reread.body.score === result.score,
  `status=${reread.status}`,
);

// 11. Sang đề khác sau khi nộp → lượt mới
const second = await startAttempt(student, examB.id);
check(
  "sang đề khác → 201 resumed=false (lượt mới)",
  second.status === 201 && second.body.resumed === false && second.body.attemptId !== attemptId,
  `status=${second.status}`,
);

// Dọn dẹp: xoá các lượt làm bài do chính script này tạo.
async function cleanup() {
  if (createdAttemptIds.length === 0) return;
  if (!process.env.DATABASE_URL) {
    console.log("[WARN] Thiếu DATABASE_URL nên không dọn được lượt kiểm thử.");
    return;
  }
  let client;
  try {
    const pgModule = await import("pg");
    const pg = pgModule.default ?? pgModule;
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('delete from "AttemptAnswer" where "attemptId" = any($1::text[])', [
      createdAttemptIds,
    ]);
    await client.query('delete from "Attempt" where id = any($1::text[])', [createdAttemptIds]);
    console.log(`[OK]  đã dọn ${createdAttemptIds.length} lượt làm bài kiểm thử khỏi DB`);
  } catch (error) {
    console.log(`[WARN] Không dọn được lượt kiểm thử: ${error.message}`);
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
console.log("Luồng thi ẩn danh hoạt động đúng với dữ liệu thật trong PostgreSQL.");

