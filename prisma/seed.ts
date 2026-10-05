/**
 * Dữ liệu mẫu cho "Luyện Thi 2027".
 *
 * Chạy: npm run db:seed   (hoặc: npx prisma db seed)
 *
 * Script có thể chạy lại nhiều lần mà không tạo dữ liệu trùng: mọi bản ghi đều
 * dùng ID xác định trước và được ghi bằng `upsert`.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

type SeedLevel = "EASY" | "MEDIUM" | "HARD";

interface SeedOption {
  label: string;
  content: string;
  isCorrect: boolean;
}

interface SeedQuestion {
  key: string;
  content: string;
  explanation: string;
  level: SeedLevel;
  options: SeedOption[];
}

interface SeedExam {
  key: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  year: number;
  isFeatured: boolean;
  questions: SeedQuestion[];
}

interface SeedSubject {
  slug: string;
  name: string;
  description: string;
  accentColor: string;
  position: number;
  topic: string;
  exams: SeedExam[];
}

const seedSubjects: SeedSubject[] = [
  {
    slug: "toan",
    name: "Toán",
    description:
      "Đại số, giải tích, hình học và xác suất thống kê theo cấu trúc đề thi tốt nghiệp.",
    accentColor: "#0284c7",
    position: 1,
    topic: "Ôn tập tổng hợp",
    exams: [
      {
        key: "toan-so-1",
        slug: "de-thi-thu-toan-2027-so-1",
        title: "Đề thi thử tốt nghiệp THPT 2027 môn Toán — số 1",
        description:
          "Đề làm quen cấu trúc mới: hàm số, cấp số cộng, số phức và hình học không gian.",
        durationMinutes: 50,
        year: 2027,
        isFeatured: true,
        questions: [
          {
            key: "q1",
            content: "Tập nghiệm của bất phương trình 2x + 3 > 0 là:",
            explanation: "2x + 3 > 0 ⇔ 2x > −3 ⇔ x > −3/2.",
            level: "EASY",
            options: [
              { label: "A", content: "x > −3/2", isCorrect: true },
              { label: "B", content: "x < −3/2", isCorrect: false },
              { label: "C", content: "x > 3/2", isCorrect: false },
              { label: "D", content: "x < 3/2", isCorrect: false },
            ],
          },
          {
            key: "q2",
            content: "Hàm số y = x³ − 3x có bao nhiêu điểm cực trị?",
            explanation:
              "y' = 3x² − 3 = 0 ⇔ x = ±1. y' đổi dấu khi qua cả hai nghiệm nên hàm số có 2 điểm cực trị.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "2", isCorrect: true },
              { label: "B", content: "1", isCorrect: false },
              { label: "C", content: "0", isCorrect: false },
              { label: "D", content: "3", isCorrect: false },
            ],
          },
          {
            key: "q3",
            content: "Cho cấp số cộng (uₙ) có u₁ = 2 và công sai d = 3. Số hạng u₅ bằng:",
            explanation: "uₙ = u₁ + (n − 1)d nên u₅ = 2 + 4·3 = 14.",
            level: "EASY",
            options: [
              { label: "A", content: "14", isCorrect: true },
              { label: "B", content: "17", isCorrect: false },
              { label: "C", content: "11", isCorrect: false },
              { label: "D", content: "12", isCorrect: false },
            ],
          },
          {
            key: "q4",
            content: "Số phức z = 2 − 3i có phần ảo bằng:",
            explanation: "Với z = a + bi thì phần ảo là b, ở đây b = −3.",
            level: "EASY",
            options: [
              { label: "A", content: "−3", isCorrect: true },
              { label: "B", content: "3", isCorrect: false },
              { label: "C", content: "−3i", isCorrect: false },
              { label: "D", content: "2", isCorrect: false },
            ],
          },
          {
            key: "q5",
            content: "Thể tích của khối cầu có bán kính R = 3 bằng:",
            explanation: "V = (4/3)πR³ = (4/3)π·27 = 36π.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "36π", isCorrect: true },
              { label: "B", content: "12π", isCorrect: false },
              { label: "C", content: "9π", isCorrect: false },
              { label: "D", content: "27π", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "vat-li",
    name: "Vật lí",
    description: "Dao động cơ, sóng, điện xoay chiều và lượng tử ánh sáng.",
    accentColor: "#7c3aed",
    position: 2,
    topic: "Ôn tập tổng hợp",
    exams: [
      {
        key: "vat-li-so-1",
        slug: "de-thi-thu-vat-li-2027-so-1",
        title: "Đề thi thử tốt nghiệp THPT 2027 môn Vật lí — số 1",
        description: "Đề làm quen cấu trúc mới: dao động điều hoà, sóng cơ, dòng điện xoay chiều.",
        durationMinutes: 50,
        year: 2027,
        isFeatured: false,
        questions: [
          {
            key: "q1",
            content:
              "Một vật dao động điều hoà với biên độ A = 5 cm. Quãng đường vật đi được trong một chu kì là:",
            explanation: "Trong một chu kì vật đi được quãng đường 4A = 4·5 = 20 cm.",
            level: "EASY",
            options: [
              { label: "A", content: "20 cm", isCorrect: true },
              { label: "B", content: "10 cm", isCorrect: false },
              { label: "C", content: "5 cm", isCorrect: false },
              { label: "D", content: "15 cm", isCorrect: false },
            ],
          },
          {
            key: "q2",
            content: "Đơn vị đo cường độ dòng điện trong hệ SI là:",
            explanation: "Cường độ dòng điện đo bằng ampe, kí hiệu A.",
            level: "EASY",
            options: [
              { label: "A", content: "ampe (A)", isCorrect: true },
              { label: "B", content: "vôn (V)", isCorrect: false },
              { label: "C", content: "oát (W)", isCorrect: false },
              { label: "D", content: "jun (J)", isCorrect: false },
            ],
          },
          {
            key: "q3",
            content:
              "Một sóng cơ có tần số 50 Hz lan truyền với tốc độ 20 m/s. Bước sóng của sóng này bằng:",
            explanation: "λ = v/f = 20/50 = 0,4 m.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "0,4 m", isCorrect: true },
              { label: "B", content: "2,5 m", isCorrect: false },
              { label: "C", content: "0,2 m", isCorrect: false },
              { label: "D", content: "4 m", isCorrect: false },
            ],
          },
          {
            key: "q4",
            content:
              "Trong đoạn mạch xoay chiều chỉ có điện trở thuần, cường độ dòng điện và điện áp hai đầu đoạn mạch:",
            explanation: "Mạch chỉ có điện trở thuần thì u và i cùng pha (độ lệch pha bằng 0).",
            level: "EASY",
            options: [
              { label: "A", content: "cùng pha", isCorrect: true },
              { label: "B", content: "lệch pha π/2", isCorrect: false },
              { label: "C", content: "ngược pha", isCorrect: false },
              { label: "D", content: "lệch pha π/4", isCorrect: false },
            ],
          },
          {
            key: "q5",
            content: "Năng lượng của một photon ánh sáng được xác định bởi công thức:",
            explanation: "ε = hf, trong đó h là hằng số Plăng và f là tần số ánh sáng.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "ε = hf", isCorrect: true },
              { label: "B", content: "ε = h/f", isCorrect: false },
              { label: "C", content: "ε = f/h", isCorrect: false },
              { label: "D", content: "ε = hf²", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "tieng-anh",
    name: "Tiếng Anh",
    description: "Ngữ pháp, từ vựng và đọc hiểu theo định dạng đề thi tốt nghiệp.",
    accentColor: "#059669",
    position: 3,
    topic: "Ôn tập tổng hợp",
    exams: [
      {
        key: "tieng-anh-so-1",
        slug: "de-thi-thu-tieng-anh-2027-so-1",
        title: "Đề thi thử tốt nghiệp THPT 2027 môn Tiếng Anh — số 1",
        description: "Đề làm quen cấu trúc mới: thì, câu điều kiện, rút gọn mệnh đề quan hệ.",
        durationMinutes: 60,
        year: 2027,
        isFeatured: true,
        questions: [
          {
            key: "q1",
            content: "Choose the best answer: She ______ to school every day.",
            explanation: "Chủ ngữ số ít “She” ở thì hiện tại đơn nên động từ chia thêm -es: goes.",
            level: "EASY",
            options: [
              { label: "A", content: "goes", isCorrect: true },
              { label: "B", content: "go", isCorrect: false },
              { label: "C", content: "going", isCorrect: false },
              { label: "D", content: "gone", isCorrect: false },
            ],
          },
          {
            key: "q2",
            content: "Choose the best answer: If I ______ you, I would take the job.",
            explanation: "Câu điều kiện loại 2: If + S + were, S + would + V.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "were", isCorrect: true },
              { label: "B", content: "am", isCorrect: false },
              { label: "C", content: "was", isCorrect: false },
              { label: "D", content: "be", isCorrect: false },
            ],
          },
          {
            key: "q3",
            content: "Choose the best answer: The book ______ by Nguyen Du is a masterpiece.",
            explanation:
              "Rút gọn mệnh đề quan hệ bị động: the book which was written → the book written.",
            level: "HARD",
            options: [
              { label: "A", content: "written", isCorrect: true },
              { label: "B", content: "writing", isCorrect: false },
              { label: "C", content: "writes", isCorrect: false },
              { label: "D", content: "wrote", isCorrect: false },
            ],
          },
          {
            key: "q4",
            content: "Choose the word CLOSEST in meaning to “rapid”:",
            explanation:
              "rapid = quick (nhanh). Các từ còn lại: slow (chậm), careful (cẩn thận), heavy (nặng).",
            level: "MEDIUM",
            options: [
              { label: "A", content: "quick", isCorrect: true },
              { label: "B", content: "slow", isCorrect: false },
              { label: "C", content: "careful", isCorrect: false },
              { label: "D", content: "heavy", isCorrect: false },
            ],
          },
          {
            key: "q5",
            content: "Choose the best answer: It's the first time I ______ such a beautiful beach.",
            explanation: "Cấu trúc: It's the first time + S + have/has + V3/ed.",
            level: "MEDIUM",
            options: [
              { label: "A", content: "have seen", isCorrect: true },
              { label: "B", content: "saw", isCorrect: false },
              { label: "C", content: "see", isCorrect: false },
              { label: "D", content: "had seen", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
];

interface SeedCounts {
  subjects: number;
  topics: number;
  questions: number;
  options: number;
  exams: number;
  examQuestions: number;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "Thiếu DATABASE_URL. Hãy sao chép .env.example thành .env và cấu hình chuỗi kết nối PostgreSQL.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function seed(): Promise<void> {
  const prisma = createPrismaClient();
  const counts: SeedCounts = {
    subjects: 0,
    topics: 0,
    questions: 0,
    options: 0,
    exams: 0,
    examQuestions: 0,
  };

  try {
    for (const subject of seedSubjects) {
      const subjectId = `seed-subject-${subject.slug}`;

      await prisma.subject.upsert({
        where: { id: subjectId },
        create: {
          id: subjectId,
          name: subject.name,
          slug: subject.slug,
          description: subject.description,
          accentColor: subject.accentColor,
          position: subject.position,
        },
        update: {
          name: subject.name,
          slug: subject.slug,
          description: subject.description,
          accentColor: subject.accentColor,
          position: subject.position,
        },
      });
      counts.subjects += 1;

      const topicId = `seed-topic-${subject.slug}`;

      await prisma.topic.upsert({
        where: { id: topicId },
        create: { id: topicId, name: subject.topic, subjectId },
        update: { name: subject.topic, subjectId },
      });
      counts.topics += 1;

      for (const exam of subject.exams) {
        const examId = `seed-exam-${exam.key}`;

        await prisma.exam.upsert({
          where: { id: examId },
          create: {
            id: examId,
            title: exam.title,
            slug: exam.slug,
            description: exam.description,
            subjectId,
            durationMinutes: exam.durationMinutes,
            status: "PUBLISHED",
            year: exam.year,
            isFeatured: exam.isFeatured,
          },
          update: {
            title: exam.title,
            slug: exam.slug,
            description: exam.description,
            subjectId,
            durationMinutes: exam.durationMinutes,
            status: "PUBLISHED",
            year: exam.year,
            isFeatured: exam.isFeatured,
          },
        });
        counts.exams += 1;

        for (const [questionIndex, question] of exam.questions.entries()) {
          const correctOptions = question.options.filter((option) => option.isCorrect);
          if (correctOptions.length !== 1) {
            throw new Error(
              `Câu hỏi ${question.key} của đề ${exam.key} phải có đúng một đáp án đúng (hiện có ${correctOptions.length}).`,
            );
          }

          const position = questionIndex + 1;
          const questionId = `seed-question-${subject.slug}-${exam.key}-${question.key}`;

          await prisma.question.upsert({
            where: { id: questionId },
            create: {
              id: questionId,
              subjectId,
              topicId,
              type: "SINGLE_CHOICE",
              level: question.level,
              content: question.content,
              explanation: question.explanation,
            },
            update: {
              subjectId,
              topicId,
              type: "SINGLE_CHOICE",
              level: question.level,
              content: question.content,
              explanation: question.explanation,
            },
          });
          counts.questions += 1;

          for (const [optionIndex, option] of question.options.entries()) {
            await prisma.questionOption.upsert({
              where: { questionId_label: { questionId, label: option.label } },
              create: {
                id: `${questionId}-${option.label}`,
                questionId,
                label: option.label,
                content: option.content,
                isCorrect: option.isCorrect,
                position: optionIndex + 1,
              },
              update: {
                content: option.content,
                isCorrect: option.isCorrect,
                position: optionIndex + 1,
              },
            });
            counts.options += 1;
          }

          await prisma.examQuestion.upsert({
            where: { examId_position: { examId, position } },
            create: {
              id: `${examId}-question-${position}`,
              examId,
              questionId,
              position,
              points: 1,
            },
            update: { questionId, points: 1 },
          });
          counts.examQuestions += 1;
        }
      }
    }

    console.log("Nạp dữ liệu mẫu thành công:");
    console.log(`  - ${counts.subjects} môn học`);
    console.log(`  - ${counts.exams} đề thi`);
    console.log(`  - ${counts.questions} câu hỏi (${counts.options} lựa chọn)`);
    console.log(`  - ${counts.examQuestions} liên kết đề thi – câu hỏi`);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error("Nạp dữ liệu mẫu thất bại:", error);
  process.exitCode = 1;
});

