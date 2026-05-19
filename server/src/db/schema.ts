import {
  pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum, integer, uniqueIndex, index
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "trial"]);
export const userStatusEnum   = pgEnum("user_status",   ["active", "inactive", "invited", "suspended", "disabled", "pending"]);

// ─── Platform Tables ─────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id:        uuid("id").primaryKey().defaultRandom(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  status:    tenantStatusEnum("status").notNull().default("trial"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex("tenants_slug_idx").on(t.slug),
}));

/** Global feature catalog — enable per tenant via tenant_features */
export const features = pgTable("features", {
  id:          uuid("id").primaryKey().defaultRandom(),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("features_code_idx").on(t.code),
}));

export const tenantFeatures = pgTable("tenant_features", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  featureId: uuid("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
  enabled:   boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantFeatureIdx: uniqueIndex("tenant_features_tenant_feature_idx").on(t.tenantId, t.featureId),
  tenantIdx:        index("tenant_features_tenant_idx").on(t.tenantId),
}));

export const tenantSettings = pgTable("tenant_settings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  brandingJson:     jsonb("branding_json").$type<Record<string, string>>().default({}),
  /** @deprecated Prefer tenant_features — kept for backward compatibility */
  featureFlagsJson: jsonb("feature_flags_json").$type<Record<string, boolean>>().default({}),
  country:          text("country").notNull().default(""),
  currency:         text("currency").notNull().default("USD"),
  timezone:         text("timezone").notNull().default("UTC"),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: uniqueIndex("tenant_settings_tenant_idx").on(t.tenantId),
}));

// ─── Users & Sessions ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email:        text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name").notNull().default(""),
  lastName:     text("last_name").notNull().default(""),
  status:       userStatusEnum("status").notNull().default("active"),
  deletedAt:    timestamp("deleted_at"),
  deletedBy:    uuid("deleted_by").references((): any => users.id, { onDelete: "set null" }),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantEmailIdx: uniqueIndex("users_tenant_email_idx").on(t.tenantId, t.email),
  tenantIdx:      index("users_tenant_idx").on(t.tenantId),
}));

export const sessions = pgTable("sessions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx:  uniqueIndex("sessions_token_idx").on(t.token),
  userIdx:   index("sessions_user_idx").on(t.userId),
}));

// ─── RBAC ─────────────────────────────────────────────────────────────────────

export const permissions = pgTable("permissions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  code:        text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  module:      text("module").notNull().default(""),
}, (t) => ({
  codeIdx: uniqueIndex("permissions_code_idx").on(t.code),
}));

export const roles = pgTable("roles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  isSystem:  boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantNameIdx: uniqueIndex("roles_tenant_name_idx").on(t.tenantId, t.name),
  tenantIdx:     index("roles_tenant_idx").on(t.tenantId),
}));

export const rolePermissions = pgTable("role_permissions", {
  roleId:       uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: uniqueIndex("role_permissions_pk").on(t.roleId, t.permissionId),
}));

export const userRoles = pgTable("user_roles", {
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId:    uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
}, (t) => ({
  pk:        uniqueIndex("user_roles_pk").on(t.userId, t.roleId),
  tenantIdx: index("user_roles_tenant_idx").on(t.tenantId),
}));

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action:      text("action").notNull(),
  entityType:  text("entity_type").notNull(),
  entityId:    text("entity_id"),
  beforeJson:  jsonb("before_json"),
  afterJson:   jsonb("after_json"),
  ip:          text("ip"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:     index("audit_logs_tenant_idx").on(t.tenantId),
  actorIdx:      index("audit_logs_actor_idx").on(t.actorUserId),
  entityIdx:     index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  createdAtIdx:  index("audit_logs_created_at_idx").on(t.createdAt),
}));

// ─── Students ─────────────────────────────────────────────────────────────────

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const studentStatusEnum = pgEnum("student_status", ["active", "inactive", "graduated", "transferred", "expelled"]);

export const students = pgTable("students", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  admissionNumber: text("admission_number").notNull(),
  firstName:       text("first_name").notNull(),
  lastName:        text("last_name").notNull(),
  middleName:      text("middle_name"),
  dob:             timestamp("dob"),
  gender:          genderEnum("gender"),
  nationality:     text("nationality"),
  religion:        text("religion"),
  photoUrl:        text("photo_url"),
  status:          studentStatusEnum("status").notNull().default("active"),
  deletedAt:       timestamp("deleted_at"),
  deletedBy:       uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  enrolledAt:      timestamp("enrolled_at").notNull().defaultNow(),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantAdmissionIdx: uniqueIndex("students_tenant_admission_idx").on(t.tenantId, t.admissionNumber),
  tenantIdx:          index("students_tenant_idx").on(t.tenantId),
  statusIdx:          index("students_status_idx").on(t.tenantId, t.status),
}));

export const guardians = pgTable("guardians", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  firstName:    text("first_name").notNull(),
  lastName:     text("last_name").notNull(),
  relationship: text("relationship").notNull(),
  phone:        text("phone"),
  email:        text("email"),
  address:      text("address"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("guardians_tenant_idx").on(t.tenantId),
}));

export const studentGuardians = pgTable("student_guardians", {
  studentId:  uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  isPrimary:  boolean("is_primary").notNull().default(false),
}, (t) => ({
  pk: uniqueIndex("student_guardians_pk").on(t.studentId, t.guardianId),
}));

// ─── Academics ────────────────────────────────────────────────────────────────

export const academicYears = pgTable("academic_years", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate:   timestamp("end_date").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("academic_years_tenant_idx").on(t.tenantId),
}));

export const terms = pgTable("terms", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  startDate:      timestamp("start_date").notNull(),
  endDate:        timestamp("end_date").notNull(),
  isCurrent:      boolean("is_current").notNull().default(false),
}, (t) => ({
  tenantIdx: index("terms_tenant_idx").on(t.tenantId),
}));

export const classes = pgTable("classes", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  level:     integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("classes_tenant_idx").on(t.tenantId),
}));

export const streams = pgTable("streams", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("streams_tenant_idx").on(t.tenantId),
}));

export const studentDocuments = pgTable("student_documents", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:    uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  fileName:     text("file_name").notNull(),
  filePath:     text("file_path").notNull(),
  mimeType:     text("mime_type"),
  uploadedAt:   timestamp("uploaded_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index("student_docs_tenant_idx").on(t.tenantId),
  studentIdx:  index("student_docs_student_idx").on(t.studentId),
}));

export const studentClassHistory = pgTable("student_class_history", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  streamId:  uuid("stream_id").references(() => streams.id),
  termId:    uuid("term_id").references(() => terms.id),
  fromDate:  timestamp("from_date").notNull().defaultNow(),
  toDate:    timestamp("to_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index("sch_tenant_idx").on(t.tenantId),
  studentIdx:  index("sch_student_idx").on(t.studentId),
}));

// ─── Finance ──────────────────────────────────────────────────────────────────

export const feeHeads = pgTable("fee_heads", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  description: text("description"),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("fee_heads_tenant_idx").on(t.tenantId),
}));

export const invoices = pgTable("invoices", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id),
  termId:      uuid("term_id").references(() => terms.id),
  invoiceNo:   text("invoice_no").notNull(),
  totalAmount: integer("total_amount").notNull().default(0),
  paidAmount:  integer("paid_amount").notNull().default(0),
  status:      text("status").notNull().default("unpaid"),
  dueDate:     timestamp("due_date"),
  deletedAt:   timestamp("deleted_at"),
  deletedBy:   uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantInvoiceIdx: uniqueIndex("invoices_tenant_no_idx").on(t.tenantId, t.invoiceNo),
  tenantIdx:        index("invoices_tenant_idx").on(t.tenantId),
  studentIdx:       index("invoices_student_idx").on(t.studentId),
}));

export const payments = pgTable("payments", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId:   uuid("invoice_id").notNull().references(() => invoices.id),
  studentId:   uuid("student_id").notNull().references(() => students.id),
  amount:      integer("amount").notNull(),
  method:      text("method").notNull().default("cash"),
  reference:   text("reference"),
  receiptNo:   text("receipt_no"),
  paidAt:      timestamp("paid_at").notNull().defaultNow(),
  createdBy:   uuid("created_by").references(() => users.id),
  deletedAt:   timestamp("deleted_at"),
  deletedBy:   uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index("payments_tenant_idx").on(t.tenantId),
  invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
}));

// ─── Jobs (in-process queue) ───────────────────────────────────────────────────

export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const jobs = pgTable("jobs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  type:      text("type").notNull(),
  payload:   jsonb("payload"),
  status:    jobStatusEnum("status").notNull().default("pending"),
  result:    jsonb("result"),
  error:     text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("jobs_status_idx").on(t.status),
  tenantIdx: index("jobs_tenant_idx").on(t.tenantId),
}));

// ─── Admissions ───────────────────────────────────────────────────────────────

export const applicants = pgTable("applicants", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  firstName:   text("first_name").notNull(),
  lastName:    text("last_name").notNull(),
  dob:         timestamp("dob"),
  gender:      genderEnum("gender"),
  email:       text("email"),
  phone:       text("phone"),
  stage:       text("stage").notNull().default("inquiry"),
  notes:       text("notes"),
  convertedTo: uuid("converted_to").references(() => students.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("applicants_tenant_idx").on(t.tenantId),
  stageIdx:  index("applicants_stage_idx").on(t.tenantId, t.stage),
}));

export const applicantDocuments = pgTable("applicant_documents", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  applicantId:  uuid("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // e.g., 'birth_cert', 'transcripts'
  fileUrl:      text("file_url").notNull(),
  status:       text("status").notNull().default("pending"), // pending, verified, rejected
  uploadedAt:   timestamp("uploaded_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index("app_docs_tenant_idx").on(t.tenantId),
  applicantIdx: index("app_docs_applicant_idx").on(t.applicantId),
}));

export const applicantEvents = pgTable("applicant_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  applicantId: uuid("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" }),
  eventType:   text("event_type").notNull(), // e.g., 'interview_scheduled', 'offer_sent'
  eventDate:   timestamp("event_date"),
  notes:       text("notes"),
  createdBy:   uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index("app_events_tenant_idx").on(t.tenantId),
  applicantIdx: index("app_events_applicant_idx").on(t.applicantId),
}));

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "excused"]);

export const attendanceSessions = pgTable("attendance_sessions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  streamId:  uuid("stream_id").references(() => streams.id),
  date:      timestamp("date").notNull(),
  takenBy:   uuid("taken_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index("att_sessions_tenant_idx").on(t.tenantId),
  classDateIdx: uniqueIndex("att_sessions_class_date_idx").on(t.classId, t.date),
}));

export const attendanceRecords = pgTable("attendance_records", {
  id:        uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  status:    attendanceStatusEnum("status").notNull().default("present"),
  note:      text("note"),
}, (t) => ({
  sessionStudentIdx: uniqueIndex("att_records_session_student_idx").on(t.sessionId, t.studentId),
  tenantIdx:         index("att_records_tenant_idx").on(t.tenantId),
}));

// ─── Phase 6: Academics extended ─────────────────────────────────────────────

export const subjects = pgTable("subjects", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code:      text("code").notNull(),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantCodeIdx: uniqueIndex("subjects_tenant_code_idx").on(t.tenantId, t.code),
  tenantIdx:     index("subjects_tenant_idx").on(t.tenantId),
}));

export const rooms = pgTable("rooms", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  capacity:  integer("capacity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("rooms_tenant_idx").on(t.tenantId) }));

export const teacherAssignments = pgTable("teacher_assignments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").notNull().references(() => users.id),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id),
  termId:    uuid("term_id").references(() => terms.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("teacher_assign_tenant_idx").on(t.tenantId) }));

export const timetables = pgTable("timetables", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  termId:    uuid("term_id").references(() => terms.id),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("timetables_tenant_idx").on(t.tenantId) }));

export const timetablePeriods = pgTable("timetable_periods", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  timetableId:  uuid("timetable_id").notNull().references(() => timetables.id, { onDelete: "cascade" }),
  dayOfWeek:    integer("day_of_week").notNull(),
  periodNo:     integer("period_no").notNull(),
  subjectId:    uuid("subject_id").references(() => subjects.id),
  teacherUserId: uuid("teacher_user_id").references(() => users.id),
  roomId:       uuid("room_id").references(() => rooms.id),
  startTime:    text("start_time"),
  endTime:      text("end_time"),
}, (t) => ({ tenantIdx: index("tt_periods_tenant_idx").on(t.tenantId) }));

export const assignments = pgTable("assignments", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:     uuid("class_id").notNull().references(() => classes.id),
  subjectId:   uuid("subject_id").notNull().references(() => subjects.id),
  title:       text("title").notNull(),
  description: text("description"),
  dueDate:     timestamp("due_date"),
  createdBy:   uuid("created_by").references(() => users.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("assignments_tenant_idx").on(t.tenantId) }));

export const assignmentSubmissions = pgTable("assignment_submissions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId:    uuid("student_id").notNull().references(() => students.id),
  content:      text("content"),
  submittedAt:  timestamp("submitted_at").notNull().defaultNow(),
}, (t) => ({
  uniqueSub: uniqueIndex("assignment_sub_unique").on(t.assignmentId, t.studentId),
}));

// ─── Phase 7: Exams ──────────────────────────────────────────────────────────

export const markStatusEnum = pgEnum("mark_status", ["draft", "submitted", "approved", "published"]);

export const assessments = pgTable("assessments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  termId:    uuid("term_id").references(() => terms.id),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id),
  name:      text("name").notNull(),
  type:      text("type").notNull().default("exam"),
  weight:    integer("weight").notNull().default(100),
  maxScore:  integer("max_score").notNull().default(100),
  deadline:  timestamp("deadline"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("assessments_tenant_idx").on(t.tenantId) }));

export const marks = pgTable("marks", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId:  uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  studentId:     uuid("student_id").notNull().references(() => students.id),
  score:         integer("score"),
  status:        markStatusEnum("status").notNull().default("draft"),
  enteredBy:     uuid("entered_by").references(() => users.id),
  deletedAt:     timestamp("deleted_at"),
  deletedBy:     uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueMark: uniqueIndex("marks_assessment_student_idx").on(t.assessmentId, t.studentId),
  tenantIdx:  index("marks_tenant_idx").on(t.tenantId),
}));

export const markSubmissions = pgTable("mark_submissions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
  submittedBy:  uuid("submitted_by").references(() => users.id),
  submittedAt:  timestamp("submitted_at").notNull().defaultNow(),
  locked:       boolean("locked").notNull().default(true),
}, (t) => ({ tenantIdx: index("mark_sub_tenant_idx").on(t.tenantId) }));

export const moderationNotes = pgTable("moderation_notes", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
  markId:       uuid("mark_id").references(() => marks.id),
  note:         text("note").notNull(),
  createdBy:    uuid("created_by").references(() => users.id),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("mod_notes_tenant_idx").on(t.tenantId) }));

export const reportCards = pgTable("report_cards", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id),
  termId:    uuid("term_id").notNull().references(() => terms.id),
  dataJson:  jsonb("data_json").$type<Record<string, unknown>>().default({}),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueRc: uniqueIndex("report_cards_student_term_idx").on(t.studentId, t.termId),
  tenantIdx: index("report_cards_tenant_idx").on(t.tenantId),
}));

// ─── Phase 8: Finance extended ───────────────────────────────────────────────

export const tenantCounters = pgTable("tenant_counters", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  key:      text("key").notNull(),
  value:    integer("value").notNull().default(0),
}, (t) => ({ pk: uniqueIndex("tenant_counters_pk").on(t.tenantId, t.key) }));

export const feeStructures = pgTable("fee_structures", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  termId:    uuid("term_id").references(() => terms.id),
  classId:   uuid("class_id").references(() => classes.id),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("fee_structures_tenant_idx").on(t.tenantId) }));

export const feeStructureItems = pgTable("fee_structure_items", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  feeStructureId: uuid("fee_structure_id").notNull().references(() => feeStructures.id, { onDelete: "cascade" }),
  feeHeadId:      uuid("fee_head_id").notNull().references(() => feeHeads.id),
  amount:         integer("amount").notNull(),
}, (t) => ({ tenantIdx: index("fee_struct_items_tenant_idx").on(t.tenantId) }));

export const invoiceItems = pgTable("invoice_items", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId:  uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  feeHeadId:  uuid("fee_head_id").references(() => feeHeads.id),
  description:text("description").notNull(),
  amount:     integer("amount").notNull(),
}, (t) => ({ tenantIdx: index("invoice_items_tenant_idx").on(t.tenantId) }));

export const paymentAllocations = pgTable("payment_allocations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  amount:    integer("amount").notNull(),
}, (t) => ({ tenantIdx: index("pay_alloc_tenant_idx").on(t.tenantId) }));

export const receipts = pgTable("receipts", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  receiptNo: text("receipt_no").notNull(),
  amount:    integer("amount").notNull(),
  issuedAt:  timestamp("issued_at").notNull().defaultNow(),
}, (t) => ({
  tenantReceiptIdx: uniqueIndex("receipts_tenant_no_idx").on(t.tenantId, t.receiptNo),
  tenantIdx:        index("receipts_tenant_idx").on(t.tenantId),
}));

export const expenses = pgTable("expenses", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount:      integer("amount").notNull(),
  category:    text("category"),
  spentAt:     timestamp("spent_at").notNull().defaultNow(),
  createdBy:   uuid("created_by").references(() => users.id),
}, (t) => ({ tenantIdx: index("expenses_tenant_idx").on(t.tenantId) }));

// ─── Phase 9: HR & Payroll ───────────────────────────────────────────────────

export const staff = pgTable("staff", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:     uuid("user_id").references(() => users.id),
  employeeNo: text("employee_no").notNull(),
  firstName:  text("first_name").notNull(),
  lastName:   text("last_name").notNull(),
  email:      text("email"),
  department: text("department"),
  status:     text("status").notNull().default("active"),
  hiredAt:    timestamp("hired_at"),
  deletedAt:  timestamp("deleted_at"),
  deletedBy:  uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantEmpIdx: uniqueIndex("staff_tenant_emp_idx").on(t.tenantId, t.employeeNo),
  tenantIdx:    index("staff_tenant_idx").on(t.tenantId),
}));

export const staffContracts = pgTable("staff_contracts", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:   uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  salary:    integer("salary").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate:   timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("staff_contracts_tenant_idx").on(t.tenantId) }));

export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);

export const leaveRequests = pgTable("leave_requests", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:   uuid("staff_id").notNull().references(() => staff.id),
  startDate: timestamp("start_date").notNull(),
  endDate:   timestamp("end_date").notNull(),
  reason:    text("reason"),
  status:    leaveStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("leave_requests_tenant_idx").on(t.tenantId) }));

export const payrollStatusEnum = pgEnum("payroll_status", ["draft", "pending_approval", "approved", "paid"]);

export const payrollRuns = pgTable("payroll_runs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  period:    text("period").notNull(),
  status:    payrollStatusEnum("status").notNull().default("draft"),
  runAt:     timestamp("run_at").notNull().defaultNow(),
  approvedBy: uuid("approved_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("payroll_runs_tenant_idx").on(t.tenantId) }));

export const payrollItems = pgTable("payroll_items", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: "cascade" }),
  staffId:      uuid("staff_id").notNull().references(() => staff.id),
  grossPay:     integer("gross_pay").notNull(),
  deductions:   integer("deductions").notNull().default(0),
  netPay:       integer("net_pay").notNull(),
  deletedAt:    timestamp("deleted_at"),
  deletedBy:    uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({ tenantIdx: index("payroll_items_tenant_idx").on(t.tenantId) }));

export const payslips = pgTable("payslips", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  payrollItemId: uuid("payroll_item_id").notNull().references(() => payrollItems.id),
  staffId:      uuid("staff_id").notNull().references(() => staff.id),
  dataJson:     jsonb("data_json").$type<Record<string, unknown>>().default({}),
  issuedAt:     timestamp("issued_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("payslips_tenant_idx").on(t.tenantId) }));

// ─── Phase 10: Operations ────────────────────────────────────────────────────

export const disciplineIncidents = pgTable("discipline_incidents", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id),
  incidentDate: timestamp("incident_date").notNull().defaultNow(),
  category:    text("category").notNull(),
  description: text("description").notNull(),
  severity:    text("severity").notNull().default("minor"),
  createdBy:   uuid("created_by").references(() => users.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("discipline_inc_tenant_idx").on(t.tenantId) }));

export const disciplineActions = pgTable("discipline_actions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  incidentId: uuid("incident_id").notNull().references(() => disciplineIncidents.id, { onDelete: "cascade" }),
  action:     text("action").notNull(),
  actionDate: timestamp("action_date").notNull().defaultNow(),
  notes:      text("notes"),
}, (t) => ({ tenantIdx: index("discipline_act_tenant_idx").on(t.tenantId) }));

export const sickbayVisits = pgTable("sickbay_visits", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:  uuid("student_id").notNull().references(() => students.id),
  visitDate:  timestamp("visit_date").notNull().defaultNow(),
  complaint:  text("complaint").notNull(),
  treatment:  text("treatment"),
  dischargedAt: timestamp("discharged_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("sickbay_tenant_idx").on(t.tenantId) }));

export const healthFlags = pgTable("health_flags", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id),
  flag:      text("flag").notNull(),
  notes:     text("notes"),
  active:    boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("health_flags_tenant_idx").on(t.tenantId) }));

export const libraryBooks = pgTable("library_books", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  isbn:      text("isbn"),
  title:     text("title").notNull(),
  author:    text("author"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("library_books_tenant_idx").on(t.tenantId) }));

export const libraryCopies = pgTable("library_copies", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  bookId:   uuid("book_id").notNull().references(() => libraryBooks.id, { onDelete: "cascade" }),
  barcode:  text("barcode").notNull(),
  status:   text("status").notNull().default("available"),
}, (t) => ({
  tenantBarcodeIdx: uniqueIndex("library_copies_barcode_idx").on(t.tenantId, t.barcode),
}));

export const libraryLoans = pgTable("library_loans", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  copyId:     uuid("copy_id").notNull().references(() => libraryCopies.id),
  studentId:  uuid("student_id").references(() => students.id),
  loanedAt:   timestamp("loaned_at").notNull().defaultNow(),
  dueAt:      timestamp("due_at"),
  returnedAt: timestamp("returned_at"),
}, (t) => ({ tenantIdx: index("library_loans_tenant_idx").on(t.tenantId) }));

export const libraryFines = pgTable("library_fines", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  loanId:   uuid("loan_id").notNull().references(() => libraryLoans.id),
  amount:   integer("amount").notNull(),
  paid:     boolean("paid").notNull().default(false),
}, (t) => ({ tenantIdx: index("library_fines_tenant_idx").on(t.tenantId) }));

export const inventoryItems = pgTable("inventory_items", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sku:       text("sku").notNull(),
  name:      text("name").notNull(),
  quantity:  integer("quantity").notNull().default(0),
  unit:      text("unit").default("pcs"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantSkuIdx: uniqueIndex("inventory_sku_idx").on(t.tenantId, t.sku),
}));

export const inventoryStockMoves = pgTable("inventory_stock_moves", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  itemId:   uuid("item_id").notNull().references(() => inventoryItems.id),
  delta:    integer("delta").notNull(),
  reason:   text("reason"),
  movedAt:  timestamp("moved_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("stock_moves_tenant_idx").on(t.tenantId) }));

export const inventorySuppliers = pgTable("inventory_suppliers", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  contact:   text("contact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("suppliers_tenant_idx").on(t.tenantId) }));

export const purchaseRequests = pgTable("purchase_requests", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").references(() => inventorySuppliers.id),
  itemName:   text("item_name").notNull(),
  quantity:   integer("quantity").notNull(),
  status:     text("status").notNull().default("pending"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("purchase_req_tenant_idx").on(t.tenantId) }));

export const transportRoutes = pgTable("transport_routes", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("transport_routes_tenant_idx").on(t.tenantId) }));

export const transportStops = pgTable("transport_stops", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routeId:  uuid("route_id").notNull().references(() => transportRoutes.id, { onDelete: "cascade" }),
  name:     text("name").notNull(),
  orderNo:  integer("order_no").notNull().default(0),
}, (t) => ({ tenantIdx: index("transport_stops_tenant_idx").on(t.tenantId) }));

export const transportVehicles = pgTable("transport_vehicles", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  registration: text("registration").notNull(),
  capacity:     integer("capacity"),
}, (t) => ({
  tenantRegIdx: uniqueIndex("vehicles_reg_idx").on(t.tenantId, t.registration),
}));

export const routeAssignments = pgTable("route_assignments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routeId:   uuid("route_id").notNull().references(() => transportRoutes.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  stopId:    uuid("stop_id").references(() => transportStops.id),
}, (t) => ({ tenantIdx: index("route_assign_tenant_idx").on(t.tenantId) }));

export const boardingHouses = pgTable("boarding_houses", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("boarding_houses_tenant_idx").on(t.tenantId) }));

export const boardingRooms = pgTable("boarding_rooms", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  houseId:  uuid("house_id").notNull().references(() => boardingHouses.id, { onDelete: "cascade" }),
  name:     text("name").notNull(),
  capacity: integer("capacity").notNull().default(4),
}, (t) => ({ tenantIdx: index("boarding_rooms_tenant_idx").on(t.tenantId) }));

export const boardingAllocations = pgTable("boarding_allocations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomId:    uuid("room_id").notNull().references(() => boardingRooms.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  fromDate:  timestamp("from_date").notNull().defaultNow(),
  toDate:    timestamp("to_date"),
}, (t) => ({ tenantIdx: index("boarding_alloc_tenant_idx").on(t.tenantId) }));

export const welfareNotes = pgTable("welfare_notes", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id),
  note:      text("note").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("welfare_notes_tenant_idx").on(t.tenantId) }));

// ─── Phase 11: Messaging ─────────────────────────────────────────────────────

export const messageTemplates = pgTable("message_templates", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  channel:   text("channel").notNull().default("sms"),
  subject:   text("subject"),
  body:      text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("msg_templates_tenant_idx").on(t.tenantId) }));

export const announcements = pgTable("announcements", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  body:      text("body").notNull(),
  audience:  text("audience").notNull().default("all"),
  published: boolean("published").notNull().default(false),
  publishAt: timestamp("publish_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("announcements_tenant_idx").on(t.tenantId) }));

export const campaigns = pgTable("campaigns", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  templateId: uuid("template_id").references(() => messageTemplates.id),
  audience:   text("audience").notNull().default("parents"),
  audienceFilter: jsonb("audience_filter").$type<Record<string, string>>().default({}),
  status:     text("status").notNull().default("draft"),
  sentAt:     timestamp("sent_at"),
  createdBy:  uuid("created_by").references(() => users.id),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("campaigns_tenant_idx").on(t.tenantId) }));

export const deliveryLogs = pgTable("delivery_logs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  campaignId:   uuid("campaign_id").references(() => campaigns.id),
  announcementId: uuid("announcement_id").references(() => announcements.id),
  recipient:    text("recipient").notNull(),
  channel:      text("channel").notNull().default("console"),
  status:       text("status").notNull().default("sent"),
  providerRef:  text("provider_ref"),
  error:        text("error"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("delivery_logs_tenant_idx").on(t.tenantId) }));

// ─── Portal (NOT staff — ownership-based access; separate from users/RBAC) ───

/** Parent portal login — linked to guardian → children via student_guardians */
export const parentAccounts = pgTable("parent_accounts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email:        text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  guardianId:   uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  status:       userStatusEnum("status").notNull().default("active"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantEmailIdx: uniqueIndex("parent_accounts_tenant_email_idx").on(t.tenantId, t.email),
  tenantIdx:      index("parent_accounts_tenant_idx").on(t.tenantId),
}));

/** Student portal login — linked to exactly one student row */
export const studentAccounts = pgTable("student_accounts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email:        text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  studentId:    uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status:       userStatusEnum("status").notNull().default("active"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantEmailIdx: uniqueIndex("student_accounts_tenant_email_idx").on(t.tenantId, t.email),
  tenantIdx:      index("student_accounts_tenant_idx").on(t.tenantId),
}));

export const parentSessions = pgTable("parent_sessions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  parentAccountId: uuid("parent_account_id").notNull().references(() => parentAccounts.id, { onDelete: "cascade" }),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  token:           text("token").notNull().unique(),
  expiresAt:       timestamp("expires_at").notNull(),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex("parent_sessions_token_idx").on(t.token),
}));

export const studentSessions = pgTable("student_sessions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  studentAccountId: uuid("student_account_id").notNull().references(() => studentAccounts.id, { onDelete: "cascade" }),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  token:            text("token").notNull().unique(),
  expiresAt:        timestamp("expires_at").notNull(),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex("student_sessions_token_idx").on(t.token),
}));

// ─── Phase 14: Platform SaaS ─────────────────────────────────────────────────

/** SaaS operator accounts — no tenant_id */
export const platformAdmins = pgTable("platform_admins", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name:         text("name").notNull().default("Platform Admin"),
  role:         text("role").notNull().default("super_admin"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const platformSessions = pgTable("platform_sessions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  adminId:   uuid("admin_id").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tokenIdx: uniqueIndex("platform_sessions_token_idx").on(t.token) }));

export const platformSettings = pgTable("platform_settings", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  id:           uuid("id").primaryKey().defaultRandom(),
  code:         text("code").notNull().unique(),
  name:         text("name").notNull(),
  priceMonthly: integer("price_monthly").notNull().default(0),
  featuresJson: jsonb("features_json").$type<Record<string, boolean>>().default({}),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const planRegionalPrices = pgTable("plan_regional_prices", {
  id:           uuid("id").primaryKey().defaultRandom(),
  planId:       uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  countryCode:  text("country_code").notNull().default("*"),
  currency:     text("currency").notNull(),
  priceMonthly: integer("price_monthly").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("plan_regional_prices_plan_country_currency_idx").on(t.planId, t.countryCode, t.currency),
  planIdx: index("plan_regional_prices_plan_idx").on(t.planId),
}));

export const tenantPlans = pgTable("tenant_plans", {
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId:    uuid("plan_id").notNull().references(() => plans.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
}, (t) => ({
  pk: uniqueIndex("tenant_plans_pk").on(t.tenantId),
}));
