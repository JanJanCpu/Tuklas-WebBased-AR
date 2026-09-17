import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { hashPassword, requireAuth, requireRole, signToken, verifyPassword } from "../lib/auth.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";
import { passwordSchema, usernameSchema } from "../lib/validation.js";

export const authRouter = Router();

function requireDatabase(response: import("express").Response) {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before using accounts." });
    return false;
  }
  return true;
}

const accountRelations = {
  enrolledSection: { select: { name: true, teacher: { select: { name: true } } } },
  createdBy: { select: { name: true } },
} satisfies Prisma.UserInclude;

function toPublicUser(user: {
  id: string; username: string; role: string; name: string; sectionId: string | null; createdAt: Date;
  enrolledSection?: { name: string; teacher: { name: string } } | null;
  createdBy?: { name: string } | null;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    sectionId: user.sectionId,
    createdAt: user.createdAt,
    ...(user.role === "student" ? {
      sectionName: user.enrolledSection?.name ?? null,
      teacherName: user.enrolledSection?.teacher.name ?? user.createdBy?.name ?? null,
    } : {}),
  };
}

const registerTeacherSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required.").max(100),
});

authRouter.post("/register-teacher", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = registerTeacherSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        username: payload.username,
        passwordHash,
        role: "teacher",
        name: payload.name,
      },
    });

    const token = signToken({ sub: user.id, username: user.username, role: "teacher" });
    response.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "That username is already taken." });
      return;
    }
    next(error);
  }
});

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password is required."),
});

authRouter.post("/login", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: payload.username }, include: accountRelations });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    response.json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const user = await prisma.user.findUnique({ where: { id: request.user!.sub }, include: accountRelations });
    if (!user) {
      response.status(404).json({ error: "Account no longer exists." });
      return;
    }
    response.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const resetProgressSchema = z.object({
  moduleId: z.string().min(1).optional(),
});

// Lets a teacher clear a student's own submitted activity records (all
// modules, or one specific module) so a locked Predict/Observe/Explain
// screen opens back up for a genuine redo - e.g. an honest mistake.
authRouter.post("/students/:studentId/reset-progress", requireAuth, requireRole("teacher"), async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const student = await prisma.user.findFirst({
      where: { id: request.params.studentId, createdById: request.user!.sub },
    });
    if (!student) {
      response.status(404).json({ error: "Student not found." });
      return;
    }

    const payload = resetProgressSchema.parse(request.body ?? {});
    const scope = payload.moduleId ? { userId: student.id, moduleId: payload.moduleId } : { userId: student.id };
    const [result] = await Promise.all([
      prisma.activityRecord.deleteMany({ where: scope }),
      // A grade refers to a specific submission - once that submission is
      // wiped for a redo, the old score/comment would otherwise linger and
      // misleadingly show as "Graded" before the student has resubmitted.
      prisma.feedback.deleteMany({
        where: payload.moduleId ? { studentId: student.id, moduleId: payload.moduleId } : { studentId: student.id },
      }),
    ]);

    response.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
});

// A teacher's class dashboard: their roster plus every synced activity
// record belonging to those students, so the frontend can compute
// per-student, per-module progress without one request per student.
authRouter.get("/class-progress", requireAuth, requireRole("teacher"), async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const students = await prisma.user.findMany({
      where: { createdById: request.user!.sub },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = students.map((student) => student.id);
    const records = studentIds.length
      ? await prisma.activityRecord.findMany({
          where: { userId: { in: studentIds } },
          orderBy: { createdAt: "desc" },
        })
      : [];

    response.json({
      students: students.map(toPublicUser),
      records: records.map((record) => ({
        id: record.id,
        userId: record.userId,
        moduleId: record.moduleId,
        stage: record.stage,
        mode: record.mode,
        text: record.text,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});
