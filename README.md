# Luyện Thi 2027

Website luyện thi THPT (phiên bản chạy được đầu tiên): xem danh sách đề thi theo môn, bắt đầu
một lượt làm bài ẩn danh, làm bài có đồng hồ đếm ngược, nộp bài và xem kết quả kèm lời giải.

Toàn bộ việc **chấm điểm diễn ra ở server**; trình duyệt chỉ nhận nội dung câu hỏi và các lựa
chọn, không bao giờ nhận đáp án đúng hay lời giải trước khi lượt làm bài được chốt.

Bên cạnh luồng ẩn danh, hệ thống có **tài khoản người dùng** (đăng ký/đăng nhập email + mật khẩu
qua Better Auth), **đơn xin quyền giáo viên** (`STUDENT` → `TEACHER` sau khi quản trị viên duyệt)
và **bảng điều khiển quản trị** `/quan-tri` để duyệt đơn, khoá/mở khoá tài khoản.

## Công nghệ

| Thành phần | Lựa chọn |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Ngôn ngữ | TypeScript (strict) |
| Dữ liệu | PostgreSQL 17 + Prisma 7 (`@prisma/adapter-pg`, driver adapter) |
| API/state | Route Handlers + TanStack Query 5 |
| Xác thực | Better Auth 1.7 (email + mật khẩu, phiên cookie httpOnly, vai trò `STUDENT`/`TEACHER`/`ADMIN` phía server) |
| Kiểm tra dữ liệu | Zod 4 |
| Phiên làm bài ẩn danh | Cookie `luyenthi_session` (httpOnly, sinh ở server) cho khách chưa đăng nhập |
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

# 4. Tạo tài khoản quản trị viên đầu tiên (nâng quyền cho email đã có, hoặc tạo mới)
npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"

# 5. Chạy dev server
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
| `npm run test:e2e:admin` | Kiểm thử đầu-cuối luồng tài khoản + quản trị với PostgreSQL thật (`scripts/e2e-admin.mjs`, cần app đang chạy) |
| `npm run db:generate` | `prisma generate` (sinh client vào `src/generated/prisma`) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | `prisma db seed` → `tsx prisma/seed.ts` |
| `npm run db:admin` | `tsx scripts/create-admin.ts` — tạo/nâng quyền tài khoản `ADMIN` đầu tiên |
| `npm run db:studio` | `prisma studio` |

## Tài khoản quản trị viên đầu tiên (`npm run db:admin`)

Trường `role` của Better Auth được khai báo `input: false`, nghĩa là **không ai tự nâng quyền qua API
được**: đăng ký luôn tạo tài khoản `STUDENT`. Quản trị viên đầu tiên vì vậy phải được tạo bằng một
tiến trình chạy trực tiếp trên máy chủ:

```bash
# Nâng quyền cho email đã có, đặt lại mật khẩu và đăng xuất mọi phiên cũ
npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"

# Chỉ nâng quyền (giữ nguyên mật khẩu) — email phải tồn tại trước
npm run db:admin -- --email admin@luyenthi.vn

# Bỏ hẳn tham số, lấy từ ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME trong .env
npm run db:admin
```

`tsx scripts/create-admin.ts` chạy lại nhiều lần vẫn an toàn:

| Tình huống | Việc script làm |
| --- | --- |
| Email chưa tồn tại (bắt buộc có mật khẩu) | Tạo `User` vai trò `ADMIN` + `Account` đăng nhập email/mật khẩu (mật khẩu băm bằng `hashPassword` của Better Auth) |
| Email đã tồn tại | Nâng `role` lên `ADMIN`, **mở khoá** (`banned = false`, xoá lý do/mốc khoá) và **xoá mọi phiên** đang mở |
| Có truyền mật khẩu | Đặt lại mật khẩu của `Account` provider `credential` (dùng khi quên mật khẩu) |
| Không có mật khẩu mà email chưa tồn tại | Dừng với thông báo cần mật khẩu (tránh tạo tài khoản không đăng nhập được) |

Vì sao phải xoá phiên: phiên cũ có thể được tạo khi tài khoản còn vai trò thấp hơn, giữ lại thì cookie
đang mở vẫn mang vai trò cũ. Sau khi chạy script, đăng nhập lại tại `/dang-nhap` rồi mở `/quan-tri`.

## Kiến trúc

```
prisma/
  schema.prisma            # Subject, Exam, Question, QuestionOption, Attempt, AttemptAnswer,
                           # User/Session/Account (Better Auth), TeacherApplication
  seed.ts                  # Dữ liệu mẫu (idempotent, dùng upsert + ID cố định)
src/
  app/                     # App Router: pages + Route Handlers
    api/...                # 21 file route handler / 24 endpoint (xem bảng bên dưới)
  components/ui/           # Button, Card, Feedback (Loading/Error/Empty), Badge, bảng dữ liệu…
  components/layout/       # site-header, user-menu (đăng nhập/đăng xuất, lối vào /quan-tri)
  features/auth/           # biểu mẫu đăng nhập/đăng ký, nhãn vai trò, schema dùng chung
  features/exams/          # types, schemas (Zod), hooks (TanStack Query), components, services
  features/attempts/       # types, schemas, hooks, components, services
  features/teacher-applications/  # đơn xin quyền giáo viên: schema, service, hook, panel
  features/admin/          # types, schemas, service, hooks, bảng quản trị (users + đơn)
  lib/                     # prisma, auth/ (Better Auth + guard vai trò), session, env, http, errors
  generated/prisma/        # Prisma Client được sinh tự động (không sửa tay)
scripts/
  create-admin.ts          # npm run db:admin — tạo/nâng quyền tài khoản ADMIN đầu tiên
  e2e-smoke.mjs            # npm run test:e2e — kiểm thử đầu-cuối qua HTTP
  e2e-admin.mjs            # npm run test:e2e:admin — kiểm thử đầu-cuối tài khoản + đơn giáo viên + quản trị
```

Quy ước chính:

- `src/features/*/types` là nguồn sự thật cho DTO dùng chung giữa server và client.
- `src/features/*/services` **chỉ chạy trên server** (`import "server-only"`), nhận `sessionId`
  từ cookie và gọi Prisma. Không có Prisma/Next import trong `grading.ts`, `attempt-core.ts`,
  `admin-core.ts` và `teacher-application-core.ts` nhờ vậy có thể test thuần bằng Vitest.
- `src/features/attempts/services/attempt-core.ts` chứa toàn bộ luật nghiệp vụ thuần:
  `resolveEffectiveStatus`, `assertAttemptOwnership`, `assertAnswersEditable`, `assertResultReady`,
  `toStudentOptions` / `toCorrectOptionIds`, `serializeStudentAttempt`, `serializeAttemptResult`.
- `src/features/admin/services/admin-core.ts` chứa luật quản trị thuần (chặn tự khoá/khoá quản trị
  viên khác, chuẩn hoá lý do, ánh xạ DTO) và `teacher-application-core.ts` chứa luật nộp/duyệt đơn.
- Mọi route `/api/admin/*` gọi `requireRole("ADMIN")` **trước khi** chạm service; service không kiểm
  tra lại vai trò người gọi nên không thể lách qua khi gọi trực tiếp từ nơi khác.
- Trang `/quan-tri` là Server Component: không phải ADMIN thì `notFound()` → trả **404** (không lộ
  sự tồn tại của trang), đúng như kịch bản kiểm thử thủ công ở cuối tài liệu này.
- Mọi kết quả đều là `ApiResult` (`src/lib/http.ts`); lỗi dùng `AppError` với `code` ổn định
  (`EXAM_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `ATTEMPT_EXPIRED`, `ATTEMPT_SUBMITTED`,
  `RESULT_NOT_READY`, `QUESTION_NOT_IN_ATTEMPT`, `OPTION_NOT_IN_QUESTION`,
  `TEACHER_APPLICATION_EXISTS`, `TEACHER_APPLICATION_ALREADY_REVIEWED`, `USER_ACTION_NOT_ALLOWED`,
  `DATABASE_UNAVAILABLE`, …).

## API

### Kho đề và làm bài

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

### Tài khoản, đơn xin quyền giáo viên và quản trị

| Method | Endpoint | Mô tả | Ai được gọi |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản email + mật khẩu; vai trò luôn là `STUDENT` | Công khai |
| `POST` | `/api/auth/login` | Đăng nhập, đặt cookie phiên Better Auth | Công khai |
| `POST` | `/api/auth/logout` | Đăng xuất, xoá phiên hiện tại | Đã đăng nhập |
| `GET` | `/api/me` | Hồ sơ người đang đăng nhập (`id`, `name`, `email`, `role`, `banned`) | Đã đăng nhập |
| `GET` | `/api/teacher-applications` | Trạng thái đơn xin quyền giáo viên gần nhất của người gọi | Đã đăng nhập |
| `POST` | `/api/teacher-applications` | Nộp đơn (`201`); chỉ `STUDENT`, mỗi lúc **một** đơn `PENDING` | Đã đăng nhập |
| `GET` | `/api/admin/users` | Danh sách tài khoản (`search`, `role`, `status`, `page`, `pageSize`) | `ADMIN` |
| `POST` | `/api/admin/users/[userId]/ban` | Khoá tài khoản kèm lý do (`{ reason }`) và **xoá mọi phiên** đang mở | `ADMIN` |
| `POST` | `/api/admin/users/[userId]/unban` | Mở khoá tài khoản (xoá lý do và mốc khoá) | `ADMIN` |
| `GET` | `/api/admin/teacher-applications` | Hàng đợi đơn (`status`, mặc định `PENDING`) | `ADMIN` |
| `POST` | `/api/admin/teacher-applications/[applicationId]/approve` | Duyệt đơn + nâng vai trò tài khoản lên `TEACHER` | `ADMIN` |
| `POST` | `/api/admin/teacher-applications/[applicationId]/reject` | Từ chối đơn kèm ghi chú (`{ note }`) | `ADMIN` |

Trang người dùng: `/` (trang chủ, môn học, đề nổi bật), `/de-thi` (duyệt & lọc đề),
`/de-thi/[examId]` (chi tiết đề), `/lam-bai/[attemptId]` (phòng thi), `/ket-qua/[attemptId]` (kết quả),
`/lich-su` (lịch sử làm bài của tài khoản đang đăng nhập).

Trang tài khoản và quản trị: `/dang-ky` (đăng ký), `/dang-nhap` (đăng nhập), `/tai-khoan` (bảng điều
khiển theo vai trò), `/xin-quyen-giao-vien` (nộp đơn xin quyền giáo viên), `/quan-tri` (bảng quản trị
duyệt đơn + quản lý người dùng). `/tai-khoan` chưa đăng nhập thì `redirect()` sang
`/dang-nhap?next=…`; `/quan-tri` cũng vậy, nhưng người **đã đăng nhập mà không phải** `ADMIN` nhận
**404** qua `notFound()` (không tiết lộ sự tồn tại của trang, khác với `403` của API). `/lich-su` vẫn
mở cho khách ẩn danh — trang chỉ đọc cookie phiên sẵn có nên không ghi cookie ở Server Component. Nút
đăng nhập/đăng xuất và lối vào `/quan-tri` nằm trong `user-menu` ở header.

Hai trang kho đề (`/de-thi`, `/de-thi/[examId]`) là **Server Component đọc trực tiếp service**
(`listSubjects`, `listExams`, `getExamById`) chứ không gọi vòng qua HTTP nội bộ: dữ liệu được render
sẵn trong HTML rồi truyền xuống client component qua `initialData` (kèm `staleTime` 30 giây để không
fetch lặp ngay khi mount). Bộ lọc/phân trang vẫn nằm trên URL (`router.push`) và chỉ khi người dùng
đổi bộ lọc thì client mới gọi `/api/exams` — vì vậy route handler vẫn cần cho điều hướng phía client
và cho `test:e2e`. Khi DB tắt, truy vấn phía server được bọc bằng `Promise.allSettled` / `catch` nên
trang vẫn trả `200` và client tự thử lại rồi hiển thị `ErrorBlock`.

## Luật nghiệp vụ quan trọng

1. **Hai lớp danh tính.** Lượt làm bài gắn với cookie phiên httpOnly (`sessionId`) nên khách chưa
   đăng nhập vẫn luyện đề được; tài khoản (Better Auth, email + mật khẩu) là lớp danh tính thứ hai
   dùng cho lịch sử theo tài khoản (mọi thiết bị), đơn xin quyền giáo viên và phân quyền. API đọc
   `sessionId` từ cookie, không bao giờ tin `sessionId`/`userId` do client gửi trong body.
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
9. **Lịch sử làm bài theo danh tính.** `GET /api/attempts` (dùng bởi `/lich-su`) lọc theo `userId` khi
   đã đăng nhập — thấy được lượt làm trên mọi thiết bị — và theo `sessionId` + `userId: null` khi ẩn
   danh. Vì vậy lượt làm khi còn ẩn danh **không** tự chuyển sang tài khoản sau khi đăng nhập, và xoá
   cookie là mất dấu các lượt ẩn danh cũ.
10. **Nâng quyền chỉ qua script.** Better Auth khai báo `role` là `input: false`, nên không ai tự nâng
    quyền qua API: đăng ký luôn tạo `STUDENT`, `TEACHER` chỉ có sau khi quản trị viên duyệt đơn,
    `ADMIN` chỉ có qua `npm run db:admin`.
11. **Đơn xin quyền giáo viên là tuần tự.** Mỗi học sinh chỉ giữ **một** đơn `PENDING` (nộp lại trả
    `409 TEACHER_APPLICATION_EXISTS`, kèm ràng buộc `UNIQUE pendingKey` để chặn cả trường hợp hai
    request song song). Duyệt/từ chối dùng `updateMany` có ràng buộc `status: "PENDING"` nên khi hai
    quản trị viên bấm cùng lúc chỉ một thao tác thắng, thao tác còn lại nhận
    `409 TEACHER_APPLICATION_ALREADY_REVIEWED`. Duyệt đơn nâng vai trò tài khoản lên `TEACHER` trong
    cùng transaction.
12. **Khoá tài khoản là chặn ngay và toàn bộ.** `setUserBanState` ghi `banned` / `bannedReason` /
    `bannedAt` rồi xoá **mọi** `Session` của tài khoản, nên cookie đang mở hết hiệu lực ngay ở request
    kế tiếp và lần đăng nhập sau trả `403 ACCOUNT_LOCKED`. Không thể tự khoá chính mình và không thể
    khoá một `ADMIN` khác (`409 USER_ACTION_NOT_ALLOWED`) — nếu không hệ thống có thể mất hết quản trị
    viên.
13. **Quyền được kiểm tra hai lần.** Route handler gọi `requireRole("ADMIN")` (thiếu phiên → `401
    AUTH_REQUIRED`, sai vai trò → `403 FORBIDDEN`) **trước khi** gọi service; giao diện cũng chỉ hiện
    nút thao tác hợp vai trò, nhưng máy chủ mới là nơi quyết định cuối cùng. `teacher-applications`
    và `admin-service` không kiểm tra lại vai trò để luật thuần vẫn kiểm thử được bằng Prisma giả.

## Kiểm thử

```bash
npm test          # vitest run — 6 tệp / 106 test
npm run typecheck # tsc --noEmit
npm run lint      # eslint .
```

| Tệp | Nội dung |
| --- | --- |
| `grading.test.ts` (11 test) | `roundScore`, `isAnswered`, `isAnswerCorrect`, `gradeQuestion`, `gradeAttempt` |
| `attempt-core.test.ts` (27 test) | `resolveEffectiveStatus`, `assertAttemptOwnership`, `assertAnswersEditable`, `assertResultReady`, `toStudentOptions`/`toCorrectOptionIds`, `serializeStudentAttempt` (không rò rỉ đáp án), `serializeAttemptResult` |
| `attempts-service.test.ts` (28 test) | Luồng nghiệp vụ đầu-cuối với Prisma giả: bắt đầu/tiếp tục lượt làm bài, lưu & xoá đáp án, validate câu hỏi/lựa chọn, nộp bài idempotent, tự chốt khi hết giờ, lịch sử theo tài khoản/phiên, cách ly theo phiên |
| `admin-core.test.ts` (9 test) | `assertCanModerateUser` (chặn tự khoá & khoá quản trị viên khác), `normalizeBanReason`/`normalizeReviewNote`, `toAdminUserSummaryDto`, `toAdminTeacherApplicationDto` |
| `admin-service.test.ts` (18 test) | Với Prisma giả: `listAdminUsers` (lọc/tìm/phân trang), `setUserBanState` (lưu lý do, xoá phiên, giữ phiên khi mở khoá, chặn tự khoá, 404), `listAdminTeacherApplications`, `reviewTeacherApplication` (nâng vai trò, ghi lý do, `count: 0` khi bị xử lý song song, 404) |
| `http.test.ts` (13 test) | `handleRouteError`: giữ nguyên `AppError`, map `ZodError` → 422, map lỗi hạ tầng (`ECONNREFUSED`, `P1001`, SQLSTATE `08*`/`3D000`/`28P01`, lỗi lồng trong `cause`) → `503 DATABASE_UNAVAILABLE`, còn lại → 500 |
| `fake-prisma.ts` | Prisma in-memory (`exam`, `attempt`, `attemptAnswer`, `$transaction`) để test service không cần PostgreSQL |
| `fake-admin-prisma.ts` | Prisma in-memory cho khu vực quản trị: `user`, `session`, `teacherApplication` với `findUniqueOrThrow`, `updateMany` trả `{ count }` (mô phỏng khoá lạc quan) và `$transaction` |

### Kiểm thử đầu-cuối với PostgreSQL thật

`scripts/e2e-smoke.mjs` (chạy bằng `npm run test:e2e`) mô phỏng một học sinh ẩn danh bằng `fetch`
+ cookie thật rồi kiểm tra **28 điểm** trên chính dữ liệu đã seed:

- duyệt đề, bắt đầu lượt mới (`201`) và gọi lại cùng đề thì trả `200` với `resumed: true`;
- payload phòng thi **không** chứa `correctOptionIds` / `isCorrect` / `explanation`;
- lưu & xoá đáp án, gắn cờ, lưu vị trí câu đang xem, tải lại thấy đúng trạng thái đã lưu;
- lỗi nghiệp vụ đúng mã HTTP: `404 QUESTION_NOT_IN_ATTEMPT`, `422 OPTION_NOT_IN_QUESTION`,
  `409 RESULT_NOT_READY`, `409 ATTEMPT_SUBMITTED` (sau khi nộp) và `404 ATTEMPT_NOT_FOUND` khi người
  gọi không sở hữu lượt — dù là phiên khác hay khách không có cookie (server cấp phiên mới nên phiên
  đó không sở hữu lượt làm bài);
- nộp bài idempotent (gọi lại không đổi điểm và `submittedAt`) và điểm khớp lựa chọn đã lưu;
- nộp xong rồi sang đề khác thì tạo lượt mới (`201`, `resumed: false`).

Mặc định script gọi `http://localhost:3123`; đổi bằng biến môi trường `E2E_BASE_URL`. Script tự
xoá các lượt làm bài do nó tạo ra nên đề thi và các lượt làm bài khác giữ nguyên.

### Kiểm thử đầu-cuối luồng tài khoản và quản trị

`scripts/e2e-admin.mjs` (chạy bằng `npm run test:e2e:admin`, dùng chung `E2E_BASE_URL`) đi hết vòng
đời một tài khoản trên dữ liệu thật và kiểm tra **54 điểm**:

- gọi `/api/admin/users` khi chưa đăng nhập → `401 AUTH_REQUIRED`; đăng ký tài khoản mới luôn ra
  `STUDENT` dù body có gửi `role: "ADMIN"` hay `banned: true` (Better Auth khai báo hai trường này
  `input: false`, nên giá trị gửi lên bị bỏ qua);
- nộp đơn xin quyền giáo viên: lý do quá ngắn → `422 VALIDATION_ERROR`, thiếu trường → `422`, nộp
  lần thứ hai khi đơn còn `PENDING` → `409 TEACHER_APPLICATION_EXISTS`;
- tài khoản `STUDENT` gọi `/api/admin/users` → `403 FORBIDDEN` và mở `/quan-tri` → **404** (không lộ
  sự tồn tại của trang);
- quản trị viên đăng nhập rồi tìm kiếm/phân trang người dùng và kiểm tra payload **không** rò rỉ bí
  mật (không có `password`, `token`, `accessToken`);
- duyệt đơn → đơn `APPROVED` và tài khoản được nâng lên `TEACHER`; duyệt lại → `409
  TEACHER_APPLICATION_ALREADY_REVIEWED`; từ chối kèm ghi chú → `REJECTED`, người nộp gửi được đơn
  mới (`PENDING`) trong khi đơn cũ vẫn giữ nguyên `REJECTED` cùng lý do đã lưu;
- khoá tài khoản → mọi phiên bị xoá (cookie cũ thành phiên khách) và đăng nhập lại nhận `403
  ACCOUNT_LOCKED`; mở khoá → đăng nhập bình thường trở lại; tự khoá chính mình → `409
  USER_ACTION_NOT_ALLOWED`.

Script tự xoá tài khoản và lượt làm bài do nó tạo (qua `pg`) rồi dọn bảng `RateLimit` để không tiêu
hao hạn mức của lần chạy sau. Script **dừng ngay** với thông báo rõ ràng nếu thiếu thông tin đăng nhập
quản trị viên, nên cần chuẩn bị trước:

```bash
# 1) Tạo hoặc nâng quyền tài khoản quản trị viên đầu tiên
npm run db:admin -- admin@luyenthi.vn MatKhau123 "Quản trị viên"

# 2) Chạy app trên cổng kiểm thử rồi chạy script
npx next start -p 3123
npm run test:e2e:admin
```

Script đọc email/mật khẩu quản trị viên theo thứ tự `E2E_ADMIN_EMAIL` → `ADMIN_EMAIL` và
`E2E_ADMIN_PASSWORD` → `ADMIN_PASSWORD`. Vì `.env.example` để hai biến `ADMIN_*` ở dạng chú thích,
cách nhanh nhất là truyền biến `E2E_*` cho riêng lần chạy (PowerShell):

```powershell
$env:E2E_ADMIN_EMAIL="admin@luyenthi.vn"; $env:E2E_ADMIN_PASSWORD="MatKhau123"; npm run test:e2e:admin
```

### Kiểm thử thủ công luồng tài khoản và quản trị

Sau khi đã chạy `db:seed` và `db:admin` (mục *Cài đặt và chạy*):

1. **Học sinh nộp đơn.** Tạo tài khoản mới ở `/dang-ky`, vào `/xin-quyen-giao-vien` điền
   trường học / môn / số năm kinh nghiệm / lý do rồi gửi. Gửi lần thứ hai khi đơn còn `PENDING` phải
   nhận `409 TEACHER_APPLICATION_EXISTS`; `/tai-khoan` hiển thị vai trò *Học sinh* và nút *Xin quyền
   giáo viên*.
2. **Quản trị viên duyệt.** Đăng nhập bằng tài khoản `db:admin` rồi mở `/quan-tri`: đơn vừa gửi nằm
   đầu hàng đợi. Bấm **Duyệt** → đơn chuyển `APPROVED` và tài khoản học sinh được nâng lên `TEACHER`
   (kiểm tra ở cột vai trò trong bảng *Người dùng*, hoặc `/tai-khoan` của tài khoản đó).
3. **Từ chối kèm lý do.** Gửi một đơn từ tài khoản học sinh khác rồi bấm **Từ chối**: trạng thái
   `REJECTED`, lý do hiển thị trên bảng quản trị và ở `/xin-quyen-giao-vien` của người nộp để họ sửa
   rồi gửi lại.
4. **Khoá tài khoản.** Trong bảng *Người dùng* bấm **Khoá** một tài khoản học sinh đang mở tab khác:
   mọi phiên bị xoá nên lần điều hướng kế tiếp bị đẩy về `/dang-nhap`, và đăng nhập lại nhận
   `403 ACCOUNT_LOCKED`. Bấm **Mở khoá** thì đăng nhập bình thường trở lại.
5. **Chặn lạm quyền.** Đăng nhập bằng tài khoản học sinh rồi mở `/quan-tri` → **404**. Gọi trực tiếp
   `GET /api/admin/users` khi chưa đăng nhập → `401 AUTH_REQUIRED`; khi đã đăng nhập bằng tài khoản
   học sinh → `403 FORBIDDEN`. Trên bảng quản trị, nút *Khoá* bị vô hiệu với chính quản trị viên đang
   đăng nhập và với mọi tài khoản `ADMIN` khác.

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
| `npm test` (`vitest run`) | 6 tệp, 106 test — tất cả pass |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid` |
| `npm run build` (`next build`) | Build production thành công: **21 route handler / 24 endpoint API**, **11 trang** (2 trang tĩnh `/`, `/dang-ky` + 9 trang dynamic) |

Ngoài ra, đã chạy `next start` trên cổng 3123 để kiểm tra **cả hai** đường đi:

- **Khi chưa có DB**: `GET /`, `GET /de-thi` trả `200` (HTML tiếng Việt render bình thường), còn
  `GET /api/subjects`, `GET /api/exams`, `POST /api/attempts` trả `503` với thân
  `{"error":{"code":"DATABASE_UNAVAILABLE","message":"Không kết nối được cơ sở dữ liệu PostgreSQL. Hãy kiểm tra DATABASE_URL và trạng thái máy chủ."}}`.
  Ca này cũng kiểm chứng lỗi `ECONNREFUSED` của driver `pg` (cổng 5433 chưa có gì lắng nghe): trước khi
  bổ sung mã lỗi hạ tầng vào `isPrismaConnectionError`, API trả `500 INTERNAL_ERROR`; sau khi sửa thì
  trả đúng `503 DATABASE_UNAVAILABLE` và được khoá lại bằng `http.test.ts`.
- **Khi container PostgreSQL đã sẵn sàng**: `npx prisma migrate status` → *Database schema is up to date!*,
  `npm run test:e2e` → **28/28 kiểm tra đạt** và `npm run test:e2e:admin` → **54/54 kiểm tra đạt**
  (cả hai script tự dọn dữ liệu kiểm thử sau khi chạy).

| Lệnh | Kết quả |
| --- | --- |
| `npm run db:migrate` | Sinh & áp dụng 2 migration: `prisma/migrations/20261005024823` (8 bảng đề thi/lượt làm bài) và `prisma/migrations/20261005071602_auth_users_attempts_teacher_applications` (`User`, `Session`, `Account`, `Verification`, `RateLimit`, `TeacherApplication`, cột `Attempt.userId`) |
| `npm run db:seed` | Nạp 3 môn, 3 chuyên đề, 3 đề × 5 câu, 15 câu hỏi, 60 lựa chọn; chạy lại vẫn an toàn (idempotent) |
| `npm run test:e2e` | 28/28 kiểm tra đạt với DB thật: luồng thi ẩn danh, chống rò rỉ đáp án, chấm điểm, cách ly phiên |
| `npm run test:e2e:admin` | 54/54 kiểm tra đạt với DB thật: đăng ký/đăng nhập, chặn tự nâng quyền, đơn xin quyền giáo viên, duyệt/từ chối, khoá–mở khoá tài khoản |

### Kiểm tra database trên máy dev hiện tại

| Hạng mục | Kết quả |
| --- | --- |
| Docker Desktop | Đã cài; `docker version` → Client/Server `29.8.1`, `docker compose` v5.5.1 |
| Container `luyenthi2027-db` | `postgres:17-alpine`, đang chạy ở cổng **5433** (`0.0.0.0:5433->5432`), health `healthy` |
| Database `luyenthi2027` | Đã có **14 bảng nghiệp vụ**: `Subject`, `Topic`, `Exam`, `ExamQuestion`, `Question`, `QuestionOption`, `Attempt`, `AttemptAnswer`, `User`, `Session`, `Account`, `Verification`, `RateLimit`, `TeacherApplication` (+ `_prisma_migrations`) |
| Migration đã áp dụng | `20261005024823` và `20261005071602_auth_users_attempts_teacher_applications` — `npx prisma migrate status` → *Database schema is up to date!* |
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
| `npm run lint` / `npm run typecheck` / `npm test` sau khi sửa | 0 lỗi / 0 lỗi / 106 test đạt |

## Bước tiếp theo (gợi ý)

- Nhiều loại câu hỏi (đúng/sai, trả lời ngắn) và đề nhiều phần.
- Lưu lịch sử làm bài theo phiên, thống kê tiến bộ theo môn/chuyên đề.
- Xác thực người dùng thật (email/mật khẩu) và đồng bộ kết quả qua các thiết bị.
- Google Index / sitemap cho các trang đề thi (SEO).

