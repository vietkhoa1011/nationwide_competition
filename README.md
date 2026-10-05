# Luyện Thi 2027

Website luyện thi THPT (phiên bản chạy được đầu tiên): xem danh sách đề thi theo môn, bắt đầu
một lượt làm bài ẩn danh, làm bài có đồng hồ đếm ngược, nộp bài và xem kết quả kèm lời giải.

Toàn bộ việc **chấm điểm diễn ra ở server**; trình duyệt chỉ nhận nội dung câu hỏi và các lựa
chọn, không bao giờ nhận đáp án đúng hay lời giải trước khi lượt làm bài được chốt.

## Công nghệ

| Thành phần | Lựa chọn |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Ngôn ngữ | TypeScript (strict) |
| Dữ liệu | PostgreSQL 17 + Prisma 7 (`@prisma/adapter-pg`, driver adapter) |
| API/state | Route Handlers + TanStack Query 5 |
| Kiểm tra dữ liệu | Zod 4 |
| Phiên ẩn danh | Cookie `luyenthi_session` (httpOnly, sinh ở server) |
| Giao diện | Tailwind CSS 4 + component tự viết trong `src/components/ui` |
| Kiểm thử | Vitest 3 (node environment) |

## Yêu cầu môi trường

- Node.js 20+
- PostgreSQL 17 — **khuyến nghị chạy bằng Docker** (xem mục dưới)

## Chọn nguồn PostgreSQL

Máy dev này đã có PostgreSQL 17 cài trực tiếp (`postgresql-x64-17`, cổng **5432**, xác thực
`scram-sha-256`) và đang phục vụ database của dự án khác. Vì vậy Luyện Thi 2027 **không dùng
chung server đó**: dự án chạy PostgreSQL trong container Docker ở cổng **5433**.

| Cách | Cổng host | Ghi chú |
| --- | --- | --- |
| Docker Compose `db` (khuyến nghị) | `POSTGRES_PORT`, mặc định **5433** | Dữ liệu trong named volume `luyenthi2027-db-data`; xoá sạch bằng `docker compose down -v` |
| PostgreSQL 17 cài trực tiếp | 5432 | Không cần cài thêm, nhưng phải tự tạo role `luyenthi` + database `luyenthi2027` bằng `psql`/pgAdmin rồi đổi `DATABASE_URL` về cổng 5432 |

### Cài Docker Desktop + WSL2 trên Windows 11 (làm một lần)

Mở **Terminal/PowerShell bằng quyền Administrator** rồi chạy:

```powershell
# 1. Bật WSL2 (máy sẽ yêu cầu khởi động lại)
wsl --install --no-distribution

# 2. Sau khi khởi động lại, kiểm tra WSL đã sẵn sàng
wsl --status

# 3. Cài Docker Desktop
winget install -e --id Docker.DockerDesktop
```

Sau đó mở **Docker Desktop**, đồng ý điều khoản, giữ mặc định *Use WSL 2 based engine* và chờ tới khi
trạng thái là **Engine running**. Kiểm tra trong terminal thường:

```powershell
docker version      # phải in ra cả Client và Server
```

> Không muốn cài Docker? Dùng PostgreSQL 17 sẵn có: chạy
> `psql -U postgres -h 127.0.0.1 -c "CREATE ROLE luyenthi LOGIN PASSWORD 'luyenthi';"` rồi
> `psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE luyenthi2027 OWNER luyenthi ENCODING 'UTF8';"`
> và đổi `DATABASE_URL` trong `.env` về cổng 5432.

## Cài đặt và chạy

```bash
npm install

# 1. Tạo tệp .env từ mẫu (PowerShell: Copy-Item .env.example .env)
copy .env.example .env

# 2. Dựng PostgreSQL trong Docker (Docker Desktop phải đang chạy)
docker compose up -d
docker compose ps           # chờ tới khi service `db` báo healthy

# 3. Sinh Prisma Client + tạo bảng + nạp dữ liệu mẫu
npm run db:generate
npm run db:migrate          # prisma migrate dev — tạo migration đầu tiên rồi apply
npm run db:seed             # 3 môn × 1 đề × 5 câu hỏi trắc nghiệm

# 4. Chạy dev server
npm run dev                 # http://localhost:3000
```

Quản lý container:

```powershell
docker compose stop        # tạm dừng, giữ dữ liệu
docker compose down        # xoá container, giữ volume
docker compose down -v     # xoá cả dữ liệu (lần sau migrate + seed lại từ đầu)
```

`DATABASE_URL` mặc định trong `.env.example` khớp cổng host của service `db`:

```
postgresql://luyenthi:luyenthi@localhost:5433/luyenthi2027?schema=public
```

## Script npm

| Lệnh | Việc nó làm |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm run build` / `npm start` | Build và chạy production |
| `npm run lint` | ESLint (`eslint .`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run test:e2e` | Kiểm thử đầu-cuối với PostgreSQL thật (`scripts/e2e-smoke.mjs`, cần app đang chạy) |
| `npm run db:generate` | `prisma generate` (sinh client vào `src/generated/prisma`) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | `prisma db seed` → `tsx prisma/seed.ts` |
| `npm run db:studio` | `prisma studio` |

## Kiến trúc

```
prisma/
  schema.prisma            # Subject, Exam, Question, QuestionOption, ExamAttempt, AttemptAnswer
  seed.ts                  # Dữ liệu mẫu (idempotent, dùng upsert + ID cố định)
src/
  app/                     # App Router: pages + Route Handlers
    api/...                # 10 file route handler / 11 endpoint (xem bảng bên dưới)
  components/ui/           # Button, Card, Feedback (Loading/Error/Empty)
  features/exams/          # types, schemas (Zod), hooks (TanStack Query), components, services
  features/attempts/       # types, schemas, hooks, components, services
  lib/                     # prisma, session, env, http, errors, api-client, query-keys
  generated/prisma/        # Prisma Client được sinh tự động (không sửa tay)
```

Quy ước chính:

- `src/features/*/types` là nguồn sự thật cho DTO dùng chung giữa server và client.
- `src/features/*/services` **chỉ chạy trên server** (`import "server-only"`), nhận `sessionId`
  từ cookie và gọi Prisma. Không có Prisma/Next import trong `grading.ts` và `attempt-core.ts`
  nhờ vậy có thể test thuần bằng Vitest.
- `src/features/attempts/services/attempt-core.ts` chứa toàn bộ luật nghiệp vụ thuần:
  `resolveEffectiveStatus`, `assertAttemptOwnership`, `assertAnswersEditable`, `assertResultReady`,
  `toStudentOptions` / `toCorrectOptionIds`, `serializeStudentAttempt`, `serializeAttemptResult`.
- Mọi kết quả đều là `ApiResult` (`src/lib/http.ts`); lỗi dùng `AppError` với `code` ổn định
  (`EXAM_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `ATTEMPT_EXPIRED`, `ATTEMPT_SUBMITTED`,
  `RESULT_NOT_READY`, `QUESTION_NOT_IN_ATTEMPT`, `OPTION_NOT_IN_QUESTION`,
  `DATABASE_UNAVAILABLE`, …).

## API

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/subjects` | Danh sách môn học kèm số đề đã xuất bản |
| `GET` | `/api/exams` | Tìm kiếm/lọc/phân trang đề thi (`search`, `subjectId`, `featured`, `page`, `pageSize`) |
| `GET` | `/api/exams/[examId]` | Chi tiết đề thi: mô tả, thời lượng, số câu, điểm, thống kê độ khó |
| `POST` | `/api/attempts` | Bắt đầu lượt làm bài (`{ examId }`); nếu đang có lượt IN_PROGRESS thì trả lại lượt đó (200 thay vì 201) |
| `GET` | `/api/attempts/[attemptId]` | Payload làm bài (câu hỏi + lựa chọn + đáp án đã chọn), **không có đáp án đúng** |
| `PUT` | `/api/attempts/[attemptId]/answers` | Lưu đáp án một câu (`{ questionId, optionId }`; `optionId: null` để bỏ chọn) |
| `DELETE` | `/api/attempts/[attemptId]/answers?questionId=…` | Xoá đáp án đã chọn của một câu |
| `POST` | `/api/attempts/[attemptId]/flag` | Đánh dấu/bỏ đánh dấu câu hỏi (`{ questionId, isFlagged }`) |
| `POST` | `/api/attempts/[attemptId]/progress` | Lưu vị trí câu đang xem (`{ lastQuestionPosition }`) |
| `POST` | `/api/attempts/[attemptId]/submit` | Nộp bài: chấm điểm, lưu `isCorrect`, trả kết quả |
| `GET` | `/api/attempts/[attemptId]/result` | Xem kết quả + lời giải sau khi bài đã chốt |

Trang người dùng: `/` (trang chủ, môn học, đề nổi bật), `/de-thi` (duyệt & lọc đề),
`/de-thi/[examId]` (chi tiết đề), `/lam-bai/[attemptId]` (phòng thi), `/ket-qua/[attemptId]` (kết quả).

Hai trang kho đề (`/de-thi`, `/de-thi/[examId]`) là **Server Component đọc trực tiếp service**
(`listSubjects`, `listExams`, `getExamById`) chứ không gọi vòng qua HTTP nội bộ: dữ liệu được render
sẵn trong HTML rồi truyền xuống client component qua `initialData` (kèm `staleTime` 30 giây để không
fetch lặp ngay khi mount). Bộ lọc/phân trang vẫn nằm trên URL (`router.push`) và chỉ khi người dùng
đổi bộ lọc thì client mới gọi `/api/exams` — vì vậy route handler vẫn cần cho điều hướng phía client
và cho `test:e2e`. Khi DB tắt, truy vấn phía server được bọc bằng `Promise.allSettled` / `catch` nên
trang vẫn trả `200` và client tự thử lại rồi hiển thị `ErrorBlock`.

## Luật nghiệp vụ quan trọng

1. **Ẩn danh bằng cookie.** Lần gọi API đầu tiên sẽ tạo cookie phiên httpOnly; mọi lượt làm bài
   gắn với `sessionId` đó. Không có tài khoản, không đăng nhập.
2. **Chấm điểm ở server.** Khi bắt đầu lượt làm bài, mỗi câu được "đóng băng" thành bản ghi
   `AttemptAnswer` gồm snapshot nội dung, điểm và `snapshotCorrectOptionIds` /
   `snapshotExplanation`. Sửa đề thi về sau không ảnh hưởng kết quả đã/đang làm.
3. **Không rò rỉ đáp án.** `serializeStudentAttempt` chỉ trả các trường an toàn
   (`id`, `label`, `content`, `order` của lựa chọn; `selectedOptionId`, `isFlagged`, `points`).
   Có test khẳng định chuỗi JSON không chứa `snapshot`, `correctOptionIds`, `isCorrect`, lời giải.
4. **Nộp bài idempotent.** `submitAttempt` chạy trong transaction với `updateMany` ràng buộc
   `status: "IN_PROGRESS"`; lần gọi thứ hai trở đi chỉ đọc lại kết quả đã ghi, không ghi đè điểm
   hay `submittedAt`.
5. **Hết giờ tự động.** Trạng thái hiệu lực được suy ra từ `expiresAt`. Lần đọc/submit kế tiếp sau
   khi hết giờ sẽ tự chốt bài (`EXPIRED`) và chấm điểm thay người dùng.
6. **Cách ly theo phiên.** Sai `sessionId` trả `404 ATTEMPT_NOT_FOUND` (không phải 403) để không
   tiết lộ sự tồn tại của lượt làm bài của người khác.
7. **Lỗi DB hiển thị hướng dẫn.** `handleRouteError` (`src/lib/http.ts`) quy mọi lỗi hạ tầng
   PostgreSQL về `503 DATABASE_UNAVAILABLE`, kể cả lỗi của driver (`ECONNREFUSED`, `ETIMEDOUT`, …)
   mà `@prisma/adapter-pg` gói trong `PrismaClientKnownRequestError`, cùng các SQLSTATE nhóm `08`,
   `3D000` (database chưa tồn tại) và `28P01` (sai mật khẩu). `ErrorBlock` nhận diện mã này và in
   hướng dẫn thiết lập PostgreSQL bằng tiếng Việt thay vì lỗi chung chung.
8. **Chỉ hỗ trợ `SINGLE_CHOICE`.** Enum `QuestionType` đã dự trù `TRUE_FALSE` / `SHORT_ANSWER` nhưng
   Phase này chỉ dùng câu chọn một đáp án đúng: seed ép `type = SINGLE_CHOICE` và dừng nếu một câu
   không có **đúng một** lựa chọn đúng. Loại câu khác chưa được giao diện phòng thi hay phần chấm
   điểm hỗ trợ (`gradeQuestion` so khớp đúng một `selectedOptionId`), nên không được thêm vào đề đã
   xuất bản.
9. **Lịch sử làm bài theo cookie.** Phase này cố ý giữ ẩn danh: chưa có trang lịch sử và chưa có tài
   khoản. Mọi lượt làm bài chỉ gắn với cookie phiên httpOnly của trình duyệt; xoá cookie là mất dấu
   các lượt cũ.

## Kiểm thử

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
npm run lint      # eslint .
```

| Tệp | Nội dung |
| --- | --- |
| `grading.test.ts` (11 test) | `roundScore`, `isAnswered`, `isAnswerCorrect`, `gradeQuestion`, `gradeAttempt` |
| `attempt-core.test.ts` (22 test) | `resolveEffectiveStatus`, `assertAttemptOwnership`, `assertAnswersEditable`, `assertResultReady`, `toStudentOptions`/`toCorrectOptionIds`, `serializeStudentAttempt` (không rò rỉ đáp án), `serializeAttemptResult` |
| `attempts-service.test.ts` (15 test) | Luồng nghiệp vụ đầu-cuối với Prisma giả: bắt đầu/tiếp tục lượt làm bài, lưu & xoá đáp án, validate câu hỏi/lựa chọn, nộp bài idempotent, tự chốt khi hết giờ, cách ly theo phiên |
| `http.test.ts` (13 test) | `handleRouteError`: giữ nguyên `AppError`, map `ZodError` → 422, map lỗi hạ tầng (`ECONNREFUSED`, `P1001`, SQLSTATE `08*`/`3D000`/`28P01`, lỗi lồng trong `cause`) → `503 DATABASE_UNAVAILABLE`, còn lại → 500 |
| `fake-prisma.ts` | Prisma in-memory (`exam`, `attempt`, `attemptAnswer`, `$transaction`) để test service không cần PostgreSQL |

### Kiểm thử đầu-cuối với PostgreSQL thật

`scripts/e2e-smoke.mjs` (chạy bằng `npm run test:e2e`) mô phỏng một học sinh ẩn danh bằng `fetch`
+ cookie thật rồi kiểm tra **28 điểm** trên chính dữ liệu đã seed:

- duyệt đề, bắt đầu lượt mới (`201`) và gọi lại cùng đề thì trả `200` với `resumed: true`;
- payload phòng thi **không** chứa `correctOptionIds` / `isCorrect` / `explanation`;
- lưu & xoá đáp án, gắn cờ, lưu vị trí câu đang xem, tải lại thấy đúng trạng thái đã lưu;
- lỗi nghiệp vụ đúng mã HTTP: `404 QUESTION_NOT_IN_ATTEMPT`, `422 OPTION_NOT_IN_QUESTION`,
  `409 RESULT_NOT_READY`, `409 ATTEMPT_SUBMITTED` (sau khi nộp), `404 ATTEMPT_NOT_FOUND`
  (phiên khác), `401 SESSION_MISSING` (không có cookie);
- nộp bài idempotent (gọi lại không đổi điểm và `submittedAt`) và điểm khớp lựa chọn đã lưu;
- nộp xong rồi sang đề khác thì tạo lượt mới (`201`, `resumed: false`).

Mặc định script gọi `http://localhost:3123`; đổi bằng biến môi trường `E2E_BASE_URL`. Script tự
xoá các lượt làm bài do nó tạo ra nên đề thi và các lượt làm bài khác giữ nguyên.

## Dữ liệu mẫu (`npm run db:seed`)

- 3 môn: Toán, Vật lí, Tiếng Anh.
- Mỗi môn 1 đề thi đã xuất bản, mỗi đề 5 câu hỏi chọn một đáp án đúng, kèm lời giải.
- Seed **idempotent**: ID cố định + `upsert`, có thể chạy lại nhiều lần.
- Trước khi ghi, seed kiểm tra mỗi câu có **đúng một** lựa chọn đúng; sai thì dừng và báo lỗi.
- Kết thúc in ra số lượng môn/đề/câu đã nạp.

## Trạng thái xác thực

Đã chạy và **đạt** trên máy dev hiện tại (Windows 11 + PostgreSQL 17 trong Docker Desktop):

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | 0 lỗi |
| `npm run lint` (`eslint .`) | 0 lỗi, 0 cảnh báo |
| `npm test` (`vitest run`) | 4 file, 61 test — tất cả pass |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid` |
| `npx next build` | Build production thành công (11 endpoint API + 5 trang) |

Ngoài ra, đã chạy `next start` trên cổng 3123 để kiểm tra **cả hai** đường đi:

- **Khi chưa có DB**: `GET /`, `GET /de-thi` trả `200` (HTML tiếng Việt render bình thường), còn
  `GET /api/subjects`, `GET /api/exams`, `POST /api/attempts` trả `503` với thân
  `{"error":{"code":"DATABASE_UNAVAILABLE","message":"Không kết nối được cơ sở dữ liệu PostgreSQL. Hãy kiểm tra DATABASE_URL và trạng thái máy chủ."}}`.
  Ca này cũng kiểm chứng lỗi `ECONNREFUSED` của driver `pg` (cổng 5433 chưa có gì lắng nghe): trước khi
  bổ sung mã lỗi hạ tầng vào `isPrismaConnectionError`, API trả `500 INTERNAL_ERROR`; sau khi sửa thì
  trả đúng `503 DATABASE_UNAVAILABLE` và được khoá lại bằng `http.test.ts`.
- **Khi container PostgreSQL đã sẵn sàng**: `npx prisma migrate status` → *Database schema is up to date!*
  và `npm run test:e2e` → **28/28 kiểm tra đạt**.

| Lệnh | Kết quả |
| --- | --- |
| `npm run db:migrate` | Sinh & áp dụng migration đầu tiên `prisma/migrations/20261005024823` (8 bảng nghiệp vụ + `_prisma_migrations`) |
| `npm run db:seed` | Nạp 3 môn, 3 chuyên đề, 3 đề × 5 câu, 15 câu hỏi, 60 lựa chọn; chạy lại vẫn an toàn (idempotent) |
| `npm run test:e2e` | 28/28 kiểm tra đạt với DB thật: luồng thi ẩn danh, chống rò rỉ đáp án, chấm điểm, cách ly phiên |

### Kiểm tra database trên máy dev hiện tại

| Hạng mục | Kết quả |
| --- | --- |
| Docker Desktop | Đã cài; `docker version` → Client/Server `29.8.1`, `docker compose` v5.5.1 |
| Container `luyenthi2027-db` | `postgres:17-alpine`, đang chạy ở cổng **5433** (`0.0.0.0:5433->5432`), health `healthy` |
| Database `luyenthi2027` | Đã có **9 bảng**: `Subject`, `Topic`, `Exam`, `ExamQuestion`, `Question`, `QuestionOption`, `Attempt`, `AttemptAnswer`, `_prisma_migrations` |
| Migration đã áp dụng | `20261005024823` (`finished_at` 2026-10-05 02:48 UTC) |
| Dữ liệu mẫu | 3 môn, 3 chuyên đề, 3 đề, 15 câu hỏi, 60 lựa chọn; mỗi câu có **đúng 1** lựa chọn đúng (đã kiểm tra bằng SQL) |
| PostgreSQL 17 native (`postgresql-x64-17`, cổng 5432) | Vẫn chạy song song phục vụ `anime_db` / `anime_cv_db` của việc khác ⇒ container dùng cổng 5433 để hai bên không đụng nhau |

Vì DB đã sẵn sàng, toàn bộ luồng chạy bằng dữ liệu thật: duyệt đề → vào phòng thi → lưu đáp án/gắn cờ
→ nộp bài → xem điểm và lời giải. Khi DB tắt, API trở lại `503 DATABASE_UNAVAILABLE` và giao diện hiển
thị khối hướng dẫn thay vì trắng trang.

### Kiểm chứng kho đề đọc service ở server (SSR)

Sau khi chuyển `/de-thi` và `/de-thi/[examId]` sang đọc service ngay trên Server Component, đã kiểm
chứng trên bản build production (`npm run build` + `next start -p 3123`):

| Phép kiểm | Kết quả |
| --- | --- |
| Phân loại route khi build | `/de-thi`, `/de-thi/[examId]` là **Dynamic (server-rendered on demand)**; `/` vẫn Static |
| `GET /de-thi` | `200`; HTML đầu tiên đã chứa **9** id `seed-exam-*` và **9** `seed-subject-*` ⇒ dữ liệu DB do server render, không phải client fetch |
| `GET /de-thi/seed-exam-tieng-anh-so-1` | `200`; HTML có dữ liệu đề (5 câu, thời lượng, tổng điểm) |
| `npm run test:e2e` trên server này | 28/28 kiểm tra đạt |
| `GET /de-thi` khi `DATABASE_URL` trỏ sai cổng | vẫn `200` (không có `seed-exam-*`, client sẽ hiện `ErrorBlock`), còn `/api/exams` trả `503 DATABASE_UNAVAILABLE` |
| `npm run lint` / `npm run typecheck` / `npm test` sau khi sửa | 0 lỗi / 0 lỗi / 61 test đạt |

## Bước tiếp theo (gợi ý)

- Nhiều loại câu hỏi (đúng/sai, trả lời ngắn) và đề nhiều phần.
- Lưu lịch sử làm bài theo phiên, thống kê tiến bộ theo môn/chuyên đề.
- Xác thực người dùng thật (email/mật khẩu) và đồng bộ kết quả qua các thiết bị.
- Google Index / sitemap cho các trang đề thi (SEO).

