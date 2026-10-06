-- CreateEnum
CREATE TYPE "ExamScope" AS ENUM ('PUBLIC', 'CLASS');

-- CreateEnum
CREATE TYPE "ClassroomMemberRole" AS ENUM ('TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE');

-- AlterTable
ALTER TABLE "AttemptAnswer" ADD COLUMN     "snapshotContentDoc" JSONB;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "classroomId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "gradeLevel" INTEGER,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "instructionsDoc" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedRevision" INTEGER,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "scope" "ExamScope" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "contentDoc" JSONB,
ADD COLUMN     "explanationDoc" JSONB,
ADD COLUMN     "rule" JSONB;

-- AlterTable
ALTER TABLE "QuestionOption" ADD COLUMN     "contentDoc" JSONB;

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT,
    "gradeLevel" INTEGER,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMember" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClassroomMemberRole" NOT NULL DEFAULT 'STUDENT',
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "allowedAttempts" INTEGER,
    "revealAnswersAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "storageKey" TEXT NOT NULL,
    "examId" TEXT,
    "classroomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Classroom_ownerId_idx" ON "Classroom"("ownerId");

-- CreateIndex
CREATE INDEX "Classroom_subjectId_idx" ON "Classroom"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_ownerId_name_key" ON "Classroom"("ownerId", "name");

-- CreateIndex
CREATE INDEX "ClassroomMember_classroomId_role_idx" ON "ClassroomMember"("classroomId", "role");

-- CreateIndex
CREATE INDEX "ClassroomMember_userId_idx" ON "ClassroomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMember_classroomId_userId_key" ON "ClassroomMember"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "ExamAssignment_classroomId_idx" ON "ExamAssignment"("classroomId");

-- CreateIndex
CREATE INDEX "ExamAssignment_examId_idx" ON "ExamAssignment"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAssignment_examId_classroomId_key" ON "ExamAssignment"("examId", "classroomId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_uploaderId_idx" ON "MediaAsset"("uploaderId");

-- CreateIndex
CREATE INDEX "MediaAsset_examId_idx" ON "MediaAsset"("examId");

-- CreateIndex
CREATE INDEX "MediaAsset_classroomId_idx" ON "MediaAsset"("classroomId");

-- CreateIndex
CREATE INDEX "Exam_scope_status_idx" ON "Exam"("scope", "status");

-- CreateIndex
CREATE INDEX "Exam_classroomId_idx" ON "Exam"("classroomId");

-- CreateIndex
CREATE INDEX "Exam_createdById_idx" ON "Exam"("createdById");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
