import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  assignments,
  assignmentSubmissions,
  cbtAnswers,
  cbtPapers,
  cbtQuestions,
  cbtSessions,
  classes,
  libraryBooks,
  libraryCards,
  libraryCopies,
  libraryEbooks,
  libraryFines,
  libraryLoans,
  libraryReservations,
  studentClassHistory,
  studentMaterials,
  subjects,
} from "../db/schema";
import { BadRequestError, ForbiddenError, NotFoundError } from "../middleware/error";

export async function getStudentEnrollmentClassId(tenantId: string, studentId: string) {
  const [enrollment] = await db.select({ classId: studentClassHistory.classId })
    .from(studentClassHistory)
    .where(and(
      eq(studentClassHistory.studentId, studentId),
      eq(studentClassHistory.tenantId, tenantId),
      isNull(studentClassHistory.toDate),
    ))
    .orderBy(desc(studentClassHistory.fromDate))
    .limit(1);
  return enrollment?.classId ?? null;
}

export async function listStudentAssignmentsEnriched(tenantId: string, studentId: string) {
  const classId = await getStudentEnrollmentClassId(tenantId, studentId);
  if (!classId) return [];

  const rows = await db.select({
    id: assignments.id,
    title: assignments.title,
    description: assignments.description,
    dueDate: assignments.dueDate,
    createdAt: assignments.createdAt,
    classId: assignments.classId,
    subjectId: assignments.subjectId,
    subjectName: subjects.name,
    className: classes.name,
  })
    .from(assignments)
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .leftJoin(classes, eq(classes.id, assignments.classId))
    .where(and(eq(assignments.tenantId, tenantId), eq(assignments.classId, classId)))
    .orderBy(desc(assignments.dueDate), desc(assignments.createdAt))
    .limit(50);

  const subs = await db.select().from(assignmentSubmissions).where(and(
    eq(assignmentSubmissions.tenantId, tenantId),
    eq(assignmentSubmissions.studentId, studentId),
  ));
  const subByAssignment = new Map(subs.map((s) => [s.assignmentId, s]));

  return rows.map((a) => {
    const sub = subByAssignment.get(a.id);
    const overdue = a.dueDate && !sub?.submittedAt && new Date(a.dueDate) < new Date();
    return {
      ...a,
      submission: sub ?? null,
      overdue: Boolean(overdue),
    };
  });
}

export async function getStudentAssignmentDetail(tenantId: string, studentId: string, assignmentId: string) {
  const classId = await getStudentEnrollmentClassId(tenantId, studentId);
  const [row] = await db.select({
    id: assignments.id,
    title: assignments.title,
    description: assignments.description,
    dueDate: assignments.dueDate,
    createdAt: assignments.createdAt,
    classId: assignments.classId,
    subjectId: assignments.subjectId,
    subjectName: subjects.name,
    className: classes.name,
  })
    .from(assignments)
    .leftJoin(subjects, eq(subjects.id, assignments.subjectId))
    .leftJoin(classes, eq(classes.id, assignments.classId))
    .where(and(eq(assignments.id, assignmentId), eq(assignments.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError("Assignment not found");
  if (classId && row.classId !== classId) throw new ForbiddenError("This assignment is not for your class");

  const [submission] = await db.select().from(assignmentSubmissions).where(and(
    eq(assignmentSubmissions.assignmentId, assignmentId),
    eq(assignmentSubmissions.studentId, studentId),
    eq(assignmentSubmissions.tenantId, tenantId),
  )).limit(1);

  return { ...row, submission: submission ?? null };
}

export async function assertStudentAssignmentAccess(tenantId: string, studentId: string, assignmentId: string) {
  const detail = await getStudentAssignmentDetail(tenantId, studentId, assignmentId);
  return detail;
}

export async function upsertAssignmentSubmission(
  tenantId: string,
  studentId: string,
  assignmentId: string,
  content: string,
  asDraft = false,
) {
  await assertStudentAssignmentAccess(tenantId, studentId, assignmentId);
  const [ex] = await db.select().from(assignmentSubmissions).where(and(
    eq(assignmentSubmissions.assignmentId, assignmentId),
    eq(assignmentSubmissions.studentId, studentId),
  )).limit(1);
  if (ex?.gradedAt) {
    throw new BadRequestError("This submission has been graded and cannot be changed");
  }
  const status = asDraft ? "draft" : "submitted";
  const payload = {
    content,
    status,
    submittedAt: asDraft ? ex?.submittedAt : new Date(),
  };
  if (ex) {
    const [row] = await db.update(assignmentSubmissions).set(payload).where(eq(assignmentSubmissions.id, ex.id)).returning();
    return row;
  }
  const [row] = await db.insert(assignmentSubmissions).values({
    tenantId,
    assignmentId,
    studentId,
    content,
    status,
  }).returning();
  return row;
}

export async function deleteAssignmentSubmission(tenantId: string, studentId: string, assignmentId: string) {
  const [ex] = await db.select().from(assignmentSubmissions).where(and(
    eq(assignmentSubmissions.assignmentId, assignmentId),
    eq(assignmentSubmissions.studentId, studentId),
    eq(assignmentSubmissions.tenantId, tenantId),
  )).limit(1);
  if (!ex) throw new NotFoundError("No submission found");
  if (ex.gradedAt) {
    throw new BadRequestError("Graded submissions cannot be withdrawn");
  }
  await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.id, ex.id));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function paperVisibleToClass(paper: { classId: string | null }, classId: string | null) {
  if (!paper.classId) return true;
  return classId != null && paper.classId === classId;
}

export async function listStudentCbtPapers(tenantId: string, studentId: string) {
  const classId = await getStudentEnrollmentClassId(tenantId, studentId);
  const papers = await db.select({
    id: cbtPapers.id,
    title: cbtPapers.title,
    durationMinutes: cbtPapers.durationMinutes,
    mode: cbtPapers.mode,
    lockdown: cbtPapers.lockdown,
    classId: cbtPapers.classId,
    subjectId: cbtPapers.subjectId,
    published: cbtPapers.published,
    createdAt: cbtPapers.createdAt,
    subjectName: subjects.name,
  })
    .from(cbtPapers)
    .leftJoin(subjects, eq(subjects.id, cbtPapers.subjectId))
    .where(and(eq(cbtPapers.tenantId, tenantId), eq(cbtPapers.published, true)))
    .orderBy(desc(cbtPapers.createdAt));

  const visible = papers.filter((p) => paperVisibleToClass(p, classId));
  const sessions = await db.select().from(cbtSessions).where(and(
    eq(cbtSessions.tenantId, tenantId),
    eq(cbtSessions.studentId, studentId),
  )).orderBy(desc(cbtSessions.startedAt));

  const sessionByPaper = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = sessionByPaper.get(s.paperId) ?? [];
    list.push(s);
    sessionByPaper.set(s.paperId, list);
  }

  return visible.map((p) => {
    const paperSessions = sessionByPaper.get(p.id) ?? [];
    const inProgress = paperSessions.find((s) => s.status === "in_progress");
    const latest = paperSessions[0];
    return {
      ...p,
      inProgressSessionId: inProgress?.id ?? null,
      latestSession: latest ? {
        id: latest.id,
        status: latest.status,
        score: latest.score,
        maxScore: latest.maxScore,
        submittedAt: latest.submittedAt,
      } : null,
    };
  });
}

export async function listStudentCbtSessions(tenantId: string, studentId: string) {
  return db.select({
    id: cbtSessions.id,
    paperId: cbtSessions.paperId,
    startedAt: cbtSessions.startedAt,
    endsAt: cbtSessions.endsAt,
    submittedAt: cbtSessions.submittedAt,
    status: cbtSessions.status,
    score: cbtSessions.score,
    maxScore: cbtSessions.maxScore,
    paperTitle: cbtPapers.title,
    mode: cbtPapers.mode,
  })
    .from(cbtSessions)
    .innerJoin(cbtPapers, eq(cbtPapers.id, cbtSessions.paperId))
    .where(and(eq(cbtSessions.tenantId, tenantId), eq(cbtSessions.studentId, studentId)))
    .orderBy(desc(cbtSessions.startedAt))
    .limit(40);
}

async function assertSessionOwner(tenantId: string, studentId: string, sessionId: string) {
  const [session] = await db.select().from(cbtSessions).where(and(
    eq(cbtSessions.id, sessionId),
    eq(cbtSessions.tenantId, tenantId),
    eq(cbtSessions.studentId, studentId),
  )).limit(1);
  if (!session) throw new NotFoundError("Session not found");
  return session;
}

export async function startStudentCbtSession(
  tenantId: string,
  studentId: string,
  paperId: string,
  meta?: { ipAddress?: string; deviceFingerprint?: string },
) {
  const classId = await getStudentEnrollmentClassId(tenantId, studentId);
  const [paper] = await db.select().from(cbtPapers).where(and(
    eq(cbtPapers.id, paperId),
    eq(cbtPapers.tenantId, tenantId),
    eq(cbtPapers.published, true),
  )).limit(1);
  if (!paper) throw new NotFoundError("Exam not available");
  if (!paperVisibleToClass(paper, classId)) throw new ForbiddenError("This exam is not assigned to your class");

  const [existing] = await db.select().from(cbtSessions).where(and(
    eq(cbtSessions.tenantId, tenantId),
    eq(cbtSessions.studentId, studentId),
    eq(cbtSessions.paperId, paperId),
    eq(cbtSessions.status, "in_progress"),
  )).limit(1);
  if (existing) {
    const questions = await loadSessionQuestions(paper, existing.id, undefined, false);
    return {
      session: existing,
      paper: { id: paper.id, title: paper.title, durationMinutes: paper.durationMinutes, lockdown: paper.lockdown, mode: paper.mode },
      questions,
      resumed: true,
    };
  }

  const endsAt = new Date(Date.now() + paper.durationMinutes * 60 * 1000);
  const [session] = await db.insert(cbtSessions).values({
    tenantId,
    paperId: paper.id,
    studentId,
    endsAt,
    ipAddress: meta?.ipAddress,
    deviceFingerprint: meta?.deviceFingerprint,
    maxScore: 0,
  }).returning();
  const questions = await db.select().from(cbtQuestions).where(eq(cbtQuestions.paperId, paper.id));
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  await db.update(cbtSessions).set({ maxScore }).where(eq(cbtSessions.id, session.id));
  const qs = await loadSessionQuestions(paper, session.id, questions);
  return {
    session: { ...session, maxScore },
    paper: { id: paper.id, title: paper.title, durationMinutes: paper.durationMinutes, lockdown: paper.lockdown, mode: paper.mode },
    questions: qs,
    resumed: false,
  };
}

async function loadSessionQuestions(
  paper: typeof cbtPapers.$inferSelect,
  _sessionId: string,
  questions?: typeof cbtQuestions.$inferSelect[],
  allowShuffle = true,
) {
  const qs = questions ?? await db.select().from(cbtQuestions).where(eq(cbtQuestions.paperId, paper.id));
  let mapped = qs.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    questionType: q.questionType,
    optionsJson: q.optionsJson,
    points: q.points,
    maxWords: q.maxWords,
  }));
  if (paper.randomize && allowShuffle) mapped = shuffle(mapped);
  return mapped;
}

export async function saveStudentCbtAnswer(
  tenantId: string,
  studentId: string,
  sessionId: string,
  questionId: string,
  answer: number | string | Record<string, unknown>,
) {
  const session = await assertSessionOwner(tenantId, studentId, sessionId);
  if (session.status !== "in_progress") throw new BadRequestError("Session is not active");
  if (session.endsAt && new Date() > session.endsAt) throw new BadRequestError("Time expired");

  const [q] = await db.select().from(cbtQuestions).where(and(
    eq(cbtQuestions.id, questionId),
    eq(cbtQuestions.paperId, session.paperId),
  )).limit(1);
  if (!q) throw new NotFoundError("Question not found");

  let score: number | null = null;
  if (q.questionType === "mcq" && typeof answer === "number") {
    score = answer === q.correctIndex ? q.points : 0;
  }
  const [existing] = await db.select().from(cbtAnswers).where(and(
    eq(cbtAnswers.sessionId, session.id),
    eq(cbtAnswers.questionId, q.id),
  )).limit(1);
  const payload = { answerJson: answer, score };
  if (existing) {
    await db.update(cbtAnswers).set(payload).where(eq(cbtAnswers.id, existing.id));
  } else {
    await db.insert(cbtAnswers).values({ tenantId, sessionId: session.id, questionId: q.id, ...payload });
  }
  return { autoScore: score };
}

export async function submitStudentCbtSession(tenantId: string, studentId: string, sessionId: string) {
  const session = await assertSessionOwner(tenantId, studentId, sessionId);
  const answers = await db.select().from(cbtAnswers).where(eq(cbtAnswers.sessionId, session.id));
  const objectiveScore = answers.reduce((s, a) => s + (a.score ?? 0), 0);
  const subjective = answers.filter((a) => a.score == null);
  const status = subjective.length > 0 ? "pending_grading" : "graded";
  const [updated] = await db.update(cbtSessions).set({
    submittedAt: new Date(),
    status,
    score: objectiveScore,
  }).where(eq(cbtSessions.id, session.id)).returning();
  return updated;
}

export async function getStudentCbtSessionDetail(tenantId: string, studentId: string, sessionId: string) {
  const session = await assertSessionOwner(tenantId, studentId, sessionId);
  const [paper] = await db.select({ title: cbtPapers.title, mode: cbtPapers.mode }).from(cbtPapers).where(eq(cbtPapers.id, session.paperId)).limit(1);
  return { session, paper };
}

export async function getStudentLibraryOverview(tenantId: string, studentId: string) {
  const [libraryCard] = await db.select({
    id: libraryCards.id,
    cardNumber: libraryCards.cardNumber,
    status: libraryCards.status,
  }).from(libraryCards).where(and(
    eq(libraryCards.tenantId, tenantId),
    eq(libraryCards.studentId, studentId),
  )).limit(1);

  const loanRows = await db.select({
    id: libraryLoans.id,
    loanedAt: libraryLoans.loanedAt,
    dueAt: libraryLoans.dueAt,
    returnedAt: libraryLoans.returnedAt,
    bookTitle: libraryBooks.title,
    bookAuthor: libraryBooks.author,
    barcode: libraryCopies.barcode,
  })
    .from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.studentId, studentId)))
    .orderBy(desc(libraryLoans.loanedAt))
    .limit(30);

  const activeLoans = loanRows.filter((l) => !l.returnedAt);
  const overdueLoans = activeLoans.filter((l) => l.dueAt && new Date(l.dueAt) < new Date());

  const loanIds = loanRows.map((l) => l.id);
  let fines: { id: string; loanId: string; amount: number; paid: boolean }[] = [];
  if (loanIds.length) {
    fines = await db.select({
      id: libraryFines.id,
      loanId: libraryFines.loanId,
      amount: libraryFines.amount,
      paid: libraryFines.paid,
    }).from(libraryFines).where(and(
      eq(libraryFines.tenantId, tenantId),
      inArray(libraryFines.loanId, loanIds),
    ));
  }

  const reservations = await db.select({
    id: libraryReservations.id,
    bookId: libraryReservations.bookId,
    ebookId: libraryReservations.ebookId,
    status: libraryReservations.status,
    createdAt: libraryReservations.createdAt,
    bookTitle: libraryBooks.title,
    ebookTitle: libraryEbooks.title,
  })
    .from(libraryReservations)
    .leftJoin(libraryBooks, eq(libraryBooks.id, libraryReservations.bookId))
    .leftJoin(libraryEbooks, eq(libraryEbooks.id, libraryReservations.ebookId))
    .where(and(
      eq(libraryReservations.tenantId, tenantId),
      eq(libraryReservations.studentId, studentId),
    ))
    .orderBy(desc(libraryReservations.createdAt))
    .limit(20);

  return {
    libraryCard: libraryCard ?? null,
    libraryStats: {
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      unpaidFines: fines.filter((f) => !f.paid).length,
    },
    libraryLoans: loanRows,
    fines,
    reservations,
  };
}

export async function searchLibraryCatalog(tenantId: string, q: string) {
  const term = `%${q.trim()}%`;
  const books = await db.select({
    id: libraryBooks.id,
    title: libraryBooks.title,
    author: libraryBooks.author,
    isbn: libraryBooks.isbn,
    availableCopies: sql<number>`coalesce((select count(*)::int from library_copies c where c.book_id = ${libraryBooks.id} and c.tenant_id = ${tenantId} and c.status = 'available'), 0)`,
  })
    .from(libraryBooks)
    .where(and(
      eq(libraryBooks.tenantId, tenantId),
      or(ilike(libraryBooks.title, term), ilike(libraryBooks.author, term), ilike(libraryBooks.isbn, term)),
    ))
    .orderBy(asc(libraryBooks.title))
    .limit(30);

  const ebooks = await db.select({
    id: libraryEbooks.id,
    title: libraryEbooks.title,
    author: libraryEbooks.author,
    url: libraryEbooks.url,
  })
    .from(libraryEbooks)
    .where(and(
      eq(libraryEbooks.tenantId, tenantId),
      or(ilike(libraryEbooks.title, term), ilike(libraryEbooks.author, term)),
    ))
    .orderBy(asc(libraryEbooks.title))
    .limit(20);

  return { books, ebooks };
}

export async function createLibraryReservation(tenantId: string, studentId: string, bookId?: string, ebookId?: string) {
  if (!bookId && !ebookId) throw new BadRequestError("bookId or ebookId required");
  if (bookId) {
    const [book] = await db.select().from(libraryBooks).where(and(eq(libraryBooks.id, bookId), eq(libraryBooks.tenantId, tenantId))).limit(1);
    if (!book) throw new NotFoundError("Book not found");
  }
  if (ebookId) {
    const [eb] = await db.select().from(libraryEbooks).where(and(eq(libraryEbooks.id, ebookId), eq(libraryEbooks.tenantId, tenantId))).limit(1);
    if (!eb) throw new NotFoundError("E-book not found");
  }
  const [row] = await db.insert(libraryReservations).values({
    tenantId,
    studentId,
    bookId: bookId ?? null,
    ebookId: ebookId ?? null,
    status: "pending",
  }).returning();
  return row;
}

export async function cancelLibraryReservation(tenantId: string, studentId: string, reservationId: string) {
  const [row] = await db.select().from(libraryReservations).where(and(
    eq(libraryReservations.id, reservationId),
    eq(libraryReservations.tenantId, tenantId),
    eq(libraryReservations.studentId, studentId),
  )).limit(1);
  if (!row) throw new NotFoundError("Reservation not found");
  if (row.status !== "pending") throw new BadRequestError("Only pending reservations can be cancelled");
  await db.delete(libraryReservations).where(eq(libraryReservations.id, row.id));
}

export async function listStudentMaterials(tenantId: string, studentId: string, opts?: { folder?: string; subjectId?: string }) {
  const classId = await getStudentEnrollmentClassId(tenantId, studentId);
  const conds = [eq(studentMaterials.tenantId, tenantId)];
  if (classId) {
    conds.push(or(eq(studentMaterials.classId, classId), isNull(studentMaterials.classId))!);
  }
  if (opts?.folder) conds.push(eq(studentMaterials.folder, opts.folder));
  if (opts?.subjectId) conds.push(eq(studentMaterials.subjectId, opts.subjectId));

  const rows = await db.select({
    id: studentMaterials.id,
    title: studentMaterials.title,
    subject: studentMaterials.subject,
    subjectId: studentMaterials.subjectId,
    url: studentMaterials.url,
    classId: studentMaterials.classId,
    filePath: studentMaterials.filePath,
    fileName: studentMaterials.fileName,
    mimeType: studentMaterials.mimeType,
    folder: studentMaterials.folder,
    createdAt: studentMaterials.createdAt,
    subjectName: subjects.name,
  })
    .from(studentMaterials)
    .leftJoin(subjects, eq(subjects.id, studentMaterials.subjectId))
    .where(and(...conds))
    .orderBy(desc(studentMaterials.createdAt))
    .limit(100);

  const folders = [...new Set(rows.map((r) => r.folder ?? "general"))].sort();
  return { materials: rows, folders };
}
