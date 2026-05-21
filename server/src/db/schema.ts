import {
  pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum, integer, bigint, numeric, uniqueIndex, index, date
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "trial"]);
export const userStatusEnum   = pgEnum("user_status",   ["active", "inactive", "invited", "suspended", "disabled", "pending"]);

// ─── Platform Tables ─────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id:             uuid("id").primaryKey().defaultRandom(),
  slug:           text("slug").notNull().unique(),
  name:           text("name").notNull(),
  status:         tenantStatusEnum("status").notNull().default("trial"),
  customDomain:   text("custom_domain"),
  subdomain:      text("subdomain"),
  domainVerified: boolean("domain_verified").notNull().default(false),
  sslConfig:      jsonb("ssl_config").$type<Record<string, unknown>>().default({}),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex("tenants_slug_idx").on(t.slug),
}));

/** Global feature catalog — enable per tenant via tenant_features */
export const features = pgTable("features", {
  id:          uuid("id").primaryKey().defaultRandom(),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  category:    text("category").notNull().default("modules"),
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
  currency:         text("currency").notNull().default("UGX"),
  timezone:         text("timezone").notNull().default("UTC"),
  smtpSettingsJson: jsonb("smtp_settings_json").$type<TenantSmtpSettings>().default({}),
  communicationsJson: jsonb("communications_json").$type<TenantCommunicationsSettings>().default({}),
  curriculumFramework: text("curriculum_framework"),
  latePenaltyPercent: integer("late_penalty_percent").default(0),
  paymentProvidersJson: jsonb("payment_providers_json").$type<Record<string, unknown>>().default({}),
  securityJson: jsonb("security_json").$type<{ ipAllowlist?: string[]; mfaRequired?: boolean }>().default({}),
  brandingExtendedJson: jsonb("branding_extended_json").$type<Record<string, unknown>>().default({}),
  themeJson:            jsonb("theme_json").$type<{ mode?: "light" | "dark"; accent?: string }>().default({}),
  sidebarOrderJson:     jsonb("sidebar_order_json").$type<string[]>().default([]),
  admissionWorkflowJson: jsonb("admission_workflow_json").$type<string[]>().default([]),
  onboardingChecklistJson: jsonb("onboarding_checklist_json").$type<Array<{ label: string; done?: boolean }>>().default([]),
  setupWizardJson:       jsonb("setup_wizard_json").$type<Record<string, unknown>>().default({}),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: uniqueIndex("tenant_settings_tenant_idx").on(t.tenantId),
}));

export type TenantCommunicationsSettings = {
  smsProvider?: string;
  smsSenderId?: string;
  whatsappEnabled?: boolean;
  pushEnabled?: boolean;
  emailBrandingName?: string;
};

export type TenantSmtpSettings = {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  fromEmail?: string;
  fromName?: string;
  /** Stored encrypted-at-rest in future; never returned in full from API */
  password?: string;
};

// ─── Users & Sessions ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email:        text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name").notNull().default(""),
  lastName:     text("last_name").notNull().default(""),
  status:       userStatusEnum("status").notNull().default("active"),
  campusId:     uuid("campus_id").references((): any => tenantCampuses.id, { onDelete: "set null" }),
  mfaEnabled:   boolean("mfa_enabled").notNull().default(false),
  mfaSecret:    text("mfa_secret"),
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
  metadata:  jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
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
  campusId:        uuid("campus_id").references((): any => tenantCampuses.id, { onDelete: "set null" }),
  admissionNumber: text("admission_number").notNull(),
  firstName:       text("first_name").notNull(),
  lastName:        text("last_name").notNull(),
  middleName:      text("middle_name"),
  dob:             timestamp("dob"),
  gender:          genderEnum("gender"),
  nationality:     text("nationality"),
  religion:        text("religion"),
  bloodGroup:      text("blood_group"),
  phone:           text("phone"),
  email:           text("email"),
  address:         text("address"),
  shortBio:        text("short_bio"),
  photoUrl:        text("photo_url"),
  biometricId:     text("biometric_id"),
  medicalJson:     jsonb("medical_json").$type<{ allergies?: string; conditions?: string; emergencyContact?: string; emergencyPhone?: string }>().default({}),
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
  campusId:  uuid("campus_id").references((): any => tenantCampuses.id, { onDelete: "set null" }),
  name:      text("name").notNull(),
  level:     integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("classes_tenant_idx").on(t.tenantId),
}));

export const streams = pgTable("streams", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  tenantId:           uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:            uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  name:               text("name").notNull(),
  classTeacherUserId: uuid("class_teacher_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("streams_tenant_idx").on(t.tenantId),
}));

export const studentLeaveRequests = pgTable("student_leave_requests", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:  uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  startDate:  timestamp("start_date").notNull(),
  endDate:    timestamp("end_date").notNull(),
  reason:     text("reason").notNull(),
  status:     text("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("student_leave_requests_tenant_idx").on(t.tenantId, t.studentId),
}));

export const studentTransfers = pgTable("student_transfers", {
  id:                uuid("id").primaryKey().defaultRandom(),
  tenantId:          uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:         uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  direction:         text("direction").notNull().default("outbound"),
  destinationSchool: text("destination_school").notNull(),
  destinationBranch: text("destination_branch"),
  reason:            text("reason"),
  effectiveDate:     timestamp("effective_date"),
  status:            text("status").notNull().default("pending"),
  tcIssuedAt:        timestamp("tc_issued_at"),
  processedBy:       uuid("processed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("student_transfers_tenant_idx").on(t.tenantId),
}));

export const studentCertificates = pgTable("student_certificates", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  certType:  text("cert_type").notNull(),
  title:     text("title").notNull(),
  body:      text("body"),
  issuedAt:  timestamp("issued_at").notNull().defaultNow(),
  issuedBy:  uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
});

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
  feeType:     text("fee_type").notNull().default("other"),
  description: text("description"),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("fee_heads_tenant_idx").on(t.tenantId),
}));

export const feeConcessionPolicies = pgTable("fee_concession_policies", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  category:    text("category").notNull().default("scholarship"),
  percent:     integer("percent"),
  amountMinor: integer("amount_minor"),
  description: text("description"),
  active:      boolean("active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const studentFeeConcessions = pgTable("student_fee_concessions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  policyId:    uuid("policy_id").references(() => feeConcessionPolicies.id, { onDelete: "set null" }),
  termId:      uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  percent:     integer("percent"),
  amountMinor: integer("amount_minor"),
  reason:      text("reason"),
  status:      text("status").notNull().default("active"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const donations = pgTable("donations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  donorName:     text("donor_name").notNull(),
  amountMinor:   integer("amount_minor").notNull(),
  purpose:       text("purpose"),
  paymentMethod: text("payment_method").default("cash"),
  reference:     text("reference"),
  receivedAt:    timestamp("received_at").notNull().defaultNow(),
  createdBy:     uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("donations_tenant_idx").on(t.tenantId) }));

export const invoices = pgTable("invoices", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  campusId:    uuid("campus_id").references((): any => tenantCampuses.id, { onDelete: "set null" }),
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

export const admissionForms = pgTable("admission_forms", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(), // e.g. "O-Level Admission", "Primary Admission"
  description: text("description"),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("admission_forms_tenant_idx").on(t.tenantId) }));

export const admissionFormFields = pgTable("admission_form_fields", {
  id:          uuid("id").primaryKey().defaultRandom(),
  formId:      uuid("form_id").notNull().references(() => admissionForms.id, { onDelete: "cascade" }),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fieldName:   text("field_name").notNull(), // e.g. "PLE Index Number", "Former School", "NIN"
  fieldKey:    text("field_key").notNull(), // e.g. "ple_index_number", snake_case version
  fieldType:   text("field_type").notNull().default("text"), // text, email, phone, number, date, select
  optionsJson: jsonb("options_json").$type<string[]>(), // Array of strings if fieldType is select
  isRequired:  boolean("is_required").notNull().default(false),
  orderIdx:    integer("order_idx").notNull().default(0),
}, (t) => ({ formIdx: index("admission_form_fields_form_idx").on(t.formId) }));

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
  waitingList: boolean("waiting_list").notNull().default(false),
  applicationFeePaid: boolean("application_fee_paid").notNull().default(false),
  interviewAt: timestamp("interview_at"),
  formId:      uuid("form_id").references(() => admissionForms.id),
  customFields:jsonb("custom_fields").$type<Record<string, any>>().default({}),
  convertedTo: uuid("converted_to").references(() => students.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("applicants_tenant_idx").on(t.tenantId),
  stageIdx:  index("applicants_stage_idx").on(t.tenantId, t.stage),
  formIdx:   index("applicants_form_idx").on(t.formId),
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
  periodNo:  integer("period_no"),
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
  subjectId: uuid("subject_id").references(() => subjects.id),
  termId:    uuid("term_id").references(() => terms.id),
  role:      text("role").notNull().default("subject"),
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
  score:        numeric("score", { precision: 8, scale: 2 }),
  maxScore:     numeric("max_score", { precision: 8, scale: 2 }).default("100"),
  feedback:     text("feedback"),
  status:       text("status").notNull().default("submitted"),
  gradedAt:     timestamp("graded_at"),
  gradedBy:     uuid("graded_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt:  timestamp("submitted_at").notNull().defaultNow(),
}, (t) => ({
  uniqueSub: uniqueIndex("assignment_sub_unique").on(t.assignmentId, t.studentId),
}));

// ─── Phase 7: Exams ──────────────────────────────────────────────────────────

export const markStatusEnum = pgEnum("mark_status", ["draft", "submitted", "approved", "published"]);

export const examGroups = pgTable("exam_groups", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  groupType:   text("group_type").notNull().default("term"),
  termId:      uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  description: text("description"),
  published:   boolean("published").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("exam_groups_tenant_idx").on(t.tenantId) }));

export const examAcademicGroups = pgTable("exam_academic_groups", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  description: text("description"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const examAcademicGroupMembers = pgTable("exam_academic_group_members", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  groupId:    uuid("group_id").notNull().references(() => examAcademicGroups.id, { onDelete: "cascade" }),
  memberType: text("member_type").notNull(),
  memberId:   uuid("member_id").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ groupIdx: index("exam_academic_group_members_group_idx").on(t.groupId) }));

export const examAdmitCards = pgTable("exam_admit_cards", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  examGroupId: uuid("exam_group_id").notNull().references(() => examGroups.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  hall:        text("hall"),
  seatNo:      text("seat_no"),
  issuedAt:    timestamp("issued_at").notNull().defaultNow(),
}, (t) => ({
  uniqueAdmit: uniqueIndex("exam_admit_unique").on(t.examGroupId, t.studentId),
}));

export const assessments = pgTable("assessments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  termId:    uuid("term_id").references(() => terms.id),
  examGroupId: uuid("exam_group_id").references(() => examGroups.id, { onDelete: "set null" }),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id),
  name:      text("name").notNull(),
  type:      text("type").notNull().default("exam"),
  sessionLabel: text("session_label"),
  weight:    integer("weight").notNull().default(100),
  maxScore:  integer("max_score").notNull().default(100),
  deadline:  timestamp("deadline"),
  published: boolean("published").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("assessments_tenant_idx").on(t.tenantId) }));

export const examTimetableSlots = pgTable("exam_timetable_slots", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  examGroupId:  uuid("exam_group_id").references(() => examGroups.id, { onDelete: "set null" }),
  classId:      uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId:    uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "set null" }),
  examDate:     timestamp("exam_date").notNull(),
  startTime:    text("start_time").notNull(),
  endTime:      text("end_time").notNull(),
  room:         text("room"),
  published:    boolean("published").notNull().default(false),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("exam_timetable_tenant_idx").on(t.tenantId) }));

export const marks = pgTable("marks", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId:  uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  studentId:     uuid("student_id").notNull().references(() => students.id),
  score:         integer("score"),
  grade:         text("grade"),
  remarks:       text("remarks"),
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
  autoGenerate: boolean("auto_generate").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("fee_structures_tenant_idx").on(t.tenantId) }));

export const recurringFeeSchedules = pgTable("recurring_fee_schedules", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  feeStructureId: uuid("fee_structure_id").notNull().references(() => feeStructures.id, { onDelete: "cascade" }),
  termId:         uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  classId:        uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  frequency:      text("frequency").notNull().default("term"),
  dueDaysAfter:   integer("due_days_after").notNull().default(14),
  enabled:        boolean("enabled").notNull().default(true),
  lastRunAt:      timestamp("last_run_at"),
  nextRunAt:      timestamp("next_run_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

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
  jobTitle:   text("job_title"),
  photoUrl:   text("photo_url"),
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
  grossPay:       integer("gross_pay").notNull(),
  deductions:     integer("deductions").notNull().default(0),
  deductionsJson: jsonb("deductions_json").$type<Record<string, unknown>>().default({}),
  netPay:         integer("net_pay").notNull(),
  deletedAt:      timestamp("deleted_at"),
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

export const libraryCards = pgTable("library_cards", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  cardNumber: text("card_number").notNull(),
  memberType: text("member_type").notNull().default("student"),
  studentId:  uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  staffId:    uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  status:     text("status").notNull().default("active"),
  issuedAt:   timestamp("issued_at").notNull().defaultNow(),
  expiresAt:  timestamp("expires_at"),
  notes:      text("notes"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantCardIdx: uniqueIndex("library_cards_number_idx").on(t.tenantId, t.cardNumber),
  tenantIdx: index("library_cards_tenant_idx").on(t.tenantId),
}));

export const libraryLoans = pgTable("library_loans", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  copyId:        uuid("copy_id").notNull().references(() => libraryCopies.id),
  studentId:     uuid("student_id").references(() => students.id),
  staffId:       uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  libraryCardId: uuid("library_card_id").references(() => libraryCards.id, { onDelete: "set null" }),
  loanedAt:      timestamp("loaned_at").notNull().defaultNow(),
  dueAt:         timestamp("due_at"),
  returnedAt:    timestamp("returned_at"),
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
  lat:      text("lat"),
  lng:      text("lng"),
}, (t) => ({ tenantIdx: index("transport_stops_tenant_idx").on(t.tenantId) }));

export const transportVehicles = pgTable("transport_vehicles", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routeId:      uuid("route_id").references(() => transportRoutes.id),
  registration: text("registration").notNull(),
  capacity:     integer("capacity"),
}, (t) => ({
  tenantRegIdx: uniqueIndex("vehicles_reg_idx").on(t.tenantId, t.registration),
}));

export const transportDrivers = pgTable("transport_drivers", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  phone:      text("phone"),
  licenseNo:  text("license_no"),
  vehicleId:  uuid("vehicle_id").references(() => transportVehicles.id),
  status:     text("status").notNull().default("active"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const vehicleGpsPings = pgTable("vehicle_gps_pings", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId:  uuid("vehicle_id").notNull().references(() => transportVehicles.id, { onDelete: "cascade" }),
  lat:        text("lat").notNull(),
  lng:        text("lng").notNull(),
  speedKph:   text("speed_kph"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const transportFuelLogs = pgTable("transport_fuel_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId:  uuid("vehicle_id").notNull().references(() => transportVehicles.id),
  liters:     text("liters").notNull(),
  costMinor:  integer("cost_minor"),
  odometerKm: integer("odometer_km"),
  loggedAt:   timestamp("logged_at").notNull().defaultNow(),
});

export const vehicleMaintenanceLogs = pgTable("vehicle_maintenance_logs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId:   uuid("vehicle_id").notNull().references(() => transportVehicles.id),
  description: text("description").notNull(),
  costMinor:   integer("cost_minor"),
  serviceDate: date("service_date").notNull(),
  nextDueDate: date("next_due_date"),
});

export const transportAlerts = pgTable("transport_alerts", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routeId:   uuid("route_id").references(() => transportRoutes.id),
  studentId: uuid("student_id").references(() => students.id),
  alertType: text("alert_type").notNull(),
  message:   text("message").notNull(),
  sentAt:    timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const routeAssignments = pgTable("route_assignments", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routeId:   uuid("route_id").notNull().references(() => transportRoutes.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  stopId:    uuid("stop_id").references(() => transportStops.id),
}, (t) => ({ tenantIdx: index("route_assign_tenant_idx").on(t.tenantId) }));

export const facilityRooms = pgTable("facility_rooms", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  roomType:  text("room_type").notNull().default("general"),
  building:  text("building"),
  floor:     text("floor"),
  capacity:  integer("capacity"),
  status:    text("status").notNull().default("available"),
  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("facility_rooms_tenant_idx").on(t.tenantId) }));

export const gatePasses = pgTable("gate_passes", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  tenantId:             uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  passNumber:           text("pass_number").notNull(),
  visitorName:          text("visitor_name").notNull(),
  visitorMobile:        text("visitor_mobile"),
  relationToStudent:    text("relation_to_student"),
  studentId:            uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId:              uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  streamId:             uuid("stream_id").references(() => streams.id, { onDelete: "set null" }),
  passDate:             date("pass_date").notNull().defaultNow(),
  inTime:               timestamp("in_time").notNull().defaultNow(),
  outTime:              timestamp("out_time"),
  authorizedByStaffId:  uuid("authorized_by_staff_id").notNull().references(() => staff.id),
  purpose:              text("purpose"),
  status:               text("status").notNull().default("active"),
  notes:                text("notes"),
  createdBy:            uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantPassIdx: uniqueIndex("gate_passes_number_idx").on(t.tenantId, t.passNumber),
  tenantDateIdx: index("gate_passes_tenant_date_idx").on(t.tenantId, t.passDate),
  studentIdx:    index("gate_passes_student_idx").on(t.tenantId, t.studentId),
}));

export const schoolTickets = pgTable("school_tickets", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  tenantId:            uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ticketNumber:        text("ticket_number").notNull(),
  category:            text("category").notNull().default("maintenance"),
  title:               text("title").notNull(),
  description:         text("description"),
  priority:            text("priority").notNull().default("normal"),
  status:              text("status").notNull().default("open"),
  reportedBy:          uuid("reported_by").references(() => users.id, { onDelete: "set null" }),
  assignedToStaffId:   uuid("assigned_to_staff_id").references(() => staff.id, { onDelete: "set null" }),
  resolutionNotes:     text("resolution_notes"),
  resolvedAt:          timestamp("resolved_at"),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantTicketIdx: uniqueIndex("school_tickets_number_idx").on(t.tenantId, t.ticketNumber),
  tenantStatusIdx: index("school_tickets_tenant_status_idx").on(t.tenantId, t.status),
}));

export const staffHostelBlocks = pgTable("staff_hostel_blocks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffHostelRooms = pgTable("staff_hostel_rooms", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  blockId:   uuid("block_id").notNull().references(() => staffHostelBlocks.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  capacity:  integer("capacity").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffHostelAllocations = pgTable("staff_hostel_allocations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomId:    uuid("room_id").notNull().references(() => staffHostelRooms.id, { onDelete: "cascade" }),
  staffId:   uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  fromDate:  timestamp("from_date").notNull().defaultNow(),
  toDate:    timestamp("to_date"),
  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("staff_hostel_alloc_tenant_idx").on(t.tenantId) }));

export const facilityRoomBookings = pgTable("facility_room_bookings", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomId:    uuid("room_id").notNull().references(() => facilityRooms.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  bookedBy:  uuid("booked_by").references(() => users.id, { onDelete: "set null" }),
  startsAt:  timestamp("starts_at").notNull(),
  endsAt:    timestamp("ends_at"),
  status:    text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("facility_room_bookings_tenant_idx").on(t.tenantId) }));

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

export const hostelVisitors = pgTable("hostel_visitors", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  visitorName: text("visitor_name").notNull(),
  studentId:   uuid("student_id").references(() => students.id),
  checkIn:     timestamp("check_in").notNull().defaultNow(),
  checkOut:    timestamp("check_out"),
  purpose:     text("purpose"),
});

export const hostelAttendance = pgTable("hostel_attendance", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id),
  date:      date("date").notNull(),
  status:    text("status").notNull().default("present"),
  notes:     text("notes"),
});

export const hostelMeals = pgTable("hostel_meals", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  date:            date("date").notNull(),
  mealType:        text("meal_type").notNull(),
  menuJson:        jsonb("menu_json").$type<Record<string, unknown>>().default({}),
  attendanceCount: integer("attendance_count").default(0),
});

export const hostelDisciplinary = pgTable("hostel_disciplinary", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id),
  incident:    text("incident").notNull(),
  actionTaken: text("action_taken"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const boardingRoomHistory = pgTable("boarding_room_history", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:  uuid("student_id").notNull().references(() => students.id),
  fromRoomId: uuid("from_room_id").references(() => boardingRooms.id),
  toRoomId:   uuid("to_room_id").references(() => boardingRooms.id),
  changedAt:  timestamp("changed_at").notNull().defaultNow(),
  changedBy:  uuid("changed_by").references(() => users.id),
});

export const campusDepartments = pgTable("campus_departments", {
  id:       uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  campusId: uuid("campus_id").notNull().references(() => tenantCampuses.id, { onDelete: "cascade" }),
  name:     text("name").notNull(),
  parentId: uuid("parent_id").references((): any => campusDepartments.id),
});

export const tenantApiKeys = pgTable("tenant_api_keys", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  keyPrefix:  text("key_prefix").notNull(),
  keyHash:    text("key_hash").notNull(),
  scopesJson: jsonb("scopes_json").$type<string[]>().default([]),
  lastUsedAt: timestamp("last_used_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const tenantWebhookEndpoints = pgTable("tenant_webhook_endpoints", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  url:        text("url").notNull(),
  eventsJson: jsonb("events_json").$type<string[]>().default([]),
  secret:     text("secret"),
  active:     boolean("active").notNull().default(true),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:          uuid("user_id").references(() => users.id),
  parentAccountId: uuid("parent_account_id"),
  endpoint:        text("endpoint").notNull(),
  keysJson:        jsonb("keys_json").notNull(),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

// ─── Phase B: Teacher workspace & portal messaging ───────────────────────────

export const lessonPlans = pgTable("lesson_plans", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  title:     text("title").notNull(),
  content:   text("content").notNull().default(""),
  weekNo:    integer("week_no"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("lesson_plans_tenant_idx").on(t.tenantId) }));

export const schemeOfWork = pgTable("scheme_of_work", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId:    uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  subjectId:  uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  termId:     uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
  weekNo:     integer("week_no").notNull().default(1),
  topic:      text("topic").notNull(),
  objectives: text("objectives"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("scheme_of_work_tenant_idx").on(t.tenantId) }));

export const teacherMeetings = pgTable("teacher_meetings", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("teacher_meetings_tenant_idx").on(t.tenantId) }));

export const portalMessages = pgTable("portal_messages", {
  id:                uuid("id").primaryKey().defaultRandom(),
  tenantId:          uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:         uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  senderType:        text("sender_type").notNull(),
  staffUserId:       uuid("staff_user_id").references(() => users.id, { onDelete: "set null" }),
  parentAccountId:   uuid("parent_account_id").references((): any => parentAccounts.id, { onDelete: "set null" }),
  body:              text("body").notNull(),
  readAt:            timestamp("read_at"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("portal_messages_tenant_student_idx").on(t.tenantId, t.studentId) }));

export const seatingLayouts = pgTable("seating_layouts", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  streamId:  uuid("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  rows:      integer("rows").notNull().default(5),
  cols:      integer("cols").notNull().default(6),
  seatsJson: jsonb("seats_json").$type<Array<{ row: number; col: number; studentId?: string }>>().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lessonLogs = pgTable("lesson_logs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:   uuid("class_id").notNull().references(() => classes.id),
  subjectId: uuid("subject_id").references(() => subjects.id),
  userId:    uuid("user_id").references(() => users.id),
  logDate:   timestamp("log_date").notNull().defaultNow(),
  topic:            text("topic").notNull(),
  notes:            text("notes"),
  progressPercent:  integer("progress_percent").default(0),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("lesson_logs_tenant_idx").on(t.tenantId) }));

export const smartDevices = pgTable("smart_devices", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomId:     uuid("room_id").references(() => rooms.id),
  name:       text("name").notNull(),
  deviceType: text("device_type").notNull().default("smartboard"),
  serialNo:   text("serial_no"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const staffAttendance = pgTable("staff_attendance", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:     uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
  userId:      uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  date:        text("date").notNull(),
  status:      text("status").notNull().default("present"),
  checkedInAt: timestamp("checked_in_at").notNull().defaultNow(),
  notes:       text("notes"),
}, (t) => ({
  tenantStaffDateIdx: index("staff_attendance_staff_date_idx").on(t.tenantId, t.staffId, t.date),
}));

export const substituteAssignments = pgTable("substitute_assignments", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  absentUserId:     uuid("absent_user_id").notNull().references(() => users.id),
  substituteUserId: uuid("substitute_user_id").notNull().references(() => users.id),
  classId:          uuid("class_id").references(() => classes.id),
  date:             text("date").notNull(),
  notes:            text("notes"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export const internalMessages = pgTable("internal_messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").notNull().references(() => users.id),
  toUserId:   uuid("to_user_id").references(() => users.id),
  body:       text("body").notNull(),
  readAt:     timestamp("read_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("internal_messages_tenant_idx").on(t.tenantId) }));

export const cbtPapers = pgTable("cbt_papers", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:           text("title").notNull(),
  classId:         uuid("class_id").references(() => classes.id),
  subjectId:       uuid("subject_id").references(() => subjects.id),
  termId:          uuid("term_id").references(() => terms.id),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  mode:            text("mode").notNull().default("graded"),
  randomize:       boolean("randomize").notNull().default(false),
  lockdown:        boolean("lockdown").notNull().default(false),
  published:       boolean("published").notNull().default(false),
  createdBy:       uuid("created_by").references(() => users.id),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

export const cbtQuestions = pgTable("cbt_questions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paperId:      uuid("paper_id").notNull().references(() => cbtPapers.id, { onDelete: "cascade" }),
  prompt:       text("prompt").notNull(),
  questionType: text("question_type").notNull().default("mcq"),
  optionsJson:  jsonb("options_json").$type<string[]>().default([]),
  correctIndex: integer("correct_index").notNull().default(0),
  points:       integer("points").notNull().default(1),
  orderNo:      integer("order_no").notNull().default(0),
  maxWords:     integer("max_words"),
});

// ─── Phase C: Curriculum ─────────────────────────────────────────────────────

export const curriculumFrameworks = pgTable("curriculum_frameworks", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code:         text("code").notNull(),
  name:         text("name").notNull(),
  examBoard:    text("exam_board"),
  version:      text("version").default("1.0"),
  active:       boolean("active").notNull().default(true),
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().default({}),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const curriculumUnits = pgTable("curriculum_units", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  frameworkId: uuid("framework_id").notNull().references(() => curriculumFrameworks.id, { onDelete: "cascade" }),
  subjectId:   uuid("subject_id").references(() => subjects.id),
  classId:     uuid("class_id").references(() => classes.id),
  title:       text("title").notNull(),
  orderNo:     integer("order_no").notNull().default(0),
  termId:      uuid("term_id").references(() => terms.id),
});

export const curriculumCompetencies = pgTable("curriculum_competencies", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  frameworkId: uuid("framework_id").notNull().references(() => curriculumFrameworks.id, { onDelete: "cascade" }),
  code:        text("code").notNull(),
  name:        text("name").notNull(),
  description: text("description"),
});

export const curriculumOutcomes = pgTable("curriculum_outcomes", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  unitId:       uuid("unit_id").notNull().references(() => curriculumUnits.id, { onDelete: "cascade" }),
  competencyId: uuid("competency_id").references(() => curriculumCompetencies.id),
  description:  text("description").notNull(),
  orderNo:      integer("order_no").notNull().default(0),
});

export const studentCompetencyTracking = pgTable("student_competency_tracking", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:    uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  competencyId: uuid("competency_id").notNull().references(() => curriculumCompetencies.id, { onDelete: "cascade" }),
  termId:       uuid("term_id").references(() => terms.id),
  level:        text("level").notNull().default("developing"),
  notes:        text("notes"),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export const curriculumCrossLinks = pgTable("curriculum_cross_links", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fromUnitId: uuid("from_unit_id").notNull().references(() => curriculumUnits.id, { onDelete: "cascade" }),
  toUnitId:   uuid("to_unit_id").notNull().references(() => curriculumUnits.id, { onDelete: "cascade" }),
  note:       text("note"),
});

export const gradingScales = pgTable("grading_scales", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  frameworkId: uuid("framework_id").references(() => curriculumFrameworks.id),
  name:        text("name").notNull(),
  bandsJson:   jsonb("bands_json").$type<{ label: string; min: number; max: number }[]>().default([]),
});

export const curriculumPacks = pgTable("curriculum_packs", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  frameworkCode: text("framework_code").notNull(),
  packJson:      jsonb("pack_json").notNull(),
  importedAt:    timestamp("imported_at").notNull().defaultNow(),
});

export const questionBanks = pgTable("question_banks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionBankItems = pgTable("question_bank_items", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  bankId:        uuid("bank_id").notNull().references(() => questionBanks.id, { onDelete: "cascade" }),
  prompt:        text("prompt").notNull(),
  questionType:  text("question_type").notNull().default("mcq"),
  optionsJson:   jsonb("options_json").$type<string[]>().default([]),
  correctIndex:  integer("correct_index").default(0),
  points:        integer("points").notNull().default(1),
});

export const gradingRules = pgTable("grading_rules", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  classId:      uuid("class_id").references(() => classes.id),
  termId:       uuid("term_id").references(() => terms.id),
  name:         text("name").notNull(),
  rulesJson:    jsonb("rules_json").$type<{ assessmentType: string; weight: number }[]>().default([]),
  gpaScaleJson: jsonb("gpa_scale_json").$type<Record<string, number>>(),
});

export const cbtSessions = pgTable("cbt_sessions", {
  id:                uuid("id").primaryKey().defaultRandom(),
  tenantId:          uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paperId:           uuid("paper_id").notNull().references(() => cbtPapers.id, { onDelete: "cascade" }),
  studentId:         uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  startedAt:         timestamp("started_at").notNull().defaultNow(),
  endsAt:            timestamp("ends_at"),
  submittedAt:       timestamp("submitted_at"),
  ipAddress:         text("ip_address"),
  deviceFingerprint: text("device_fingerprint"),
  score:             integer("score"),
  maxScore:          integer("max_score"),
  status:            text("status").notNull().default("in_progress"),
});

export const cbtAnswers = pgTable("cbt_answers", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sessionId:  uuid("session_id").notNull().references(() => cbtSessions.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => cbtQuestions.id, { onDelete: "cascade" }),
  answerJson: jsonb("answer_json"),
  score:      integer("score"),
  gradedAt:   timestamp("graded_at"),
  gradedBy:   uuid("graded_by").references(() => users.id),
});

export const installmentPlans = pgTable("installment_plans", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId:        uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  installmentsJson: jsonb("installments_json").$type<{ dueDate: string; amountMinor: number; paid?: boolean }[]>().notNull(),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export const feeDiscounts = pgTable("fee_discounts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").references(() => students.id),
  invoiceId:   uuid("invoice_id").references(() => invoices.id),
  name:        text("name").notNull(),
  percent:     integer("percent"),
  amountMinor: integer("amount_minor"),
  reason:      text("reason"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const feeSponsorships = pgTable("fee_sponsorships", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId:   uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  sponsorName: text("sponsor_name").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  termId:      uuid("term_id").references(() => terms.id),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const financeRefunds = pgTable("finance_refunds", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paymentId:   uuid("payment_id").notNull().references(() => payments.id),
  amountMinor: integer("amount_minor").notNull(),
  status:      text("status").notNull().default("pending"),
  reason:      text("reason"),
  createdBy:   uuid("created_by").references(() => users.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code:        text("code").notNull(),
  name:        text("name").notNull(),
  accountType: text("account_type").notNull().default("asset"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  entryDate:   date("entry_date").notNull(),
  description: text("description").notNull(),
  reference:   text("reference"),
  createdBy:   uuid("created_by").references(() => users.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const journalLines = pgTable("journal_lines", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  entryId:    uuid("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  accountId:  uuid("account_id").notNull().references(() => chartOfAccounts.id),
  debitMinor: integer("debit_minor").notNull().default(0),
  creditMinor: integer("credit_minor").notNull().default(0),
});

export const budgets = pgTable("budgets", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fiscalYear:  integer("fiscal_year").notNull(),
  category:    text("category").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  spentMinor:  integer("spent_minor").notNull().default(0),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

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
  notifyChannels: jsonb("notify_channels").$type<string[]>().default([]),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ tenantIdx: index("announcements_tenant_idx").on(t.tenantId) }));

export const systemNotifications = pgTable("system_notifications", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  body:      text("body").notNull(),
  category:  text("category").notNull().default("general"),
  link:      text("link"),
  readAt:    timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantUserIdx: index("system_notifications_tenant_user_idx").on(t.tenantId, t.userId),
}));

export const campaigns = pgTable("campaigns", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  channel:    text("channel").notNull().default("sms"),
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

export const platformPayouts = pgTable("platform_payouts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  amount:      integer("amount").notNull(),
  currency:    text("currency").notNull(),
  status:      text("status").notNull().default("pending"),
  reference:   text("reference"),
  note:        text("note"),
  periodFrom:  timestamp("period_from"),
  periodTo:    timestamp("period_to"),
  createdBy:   uuid("created_by").references(() => platformAdmins.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index("platform_payouts_tenant_idx").on(t.tenantId),
  statusIdx:  index("platform_payouts_status_idx").on(t.status),
}));

export const tenantPlans = pgTable("tenant_plans", {
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId:         uuid("plan_id").notNull().references(() => plans.id),
  startedAt:      timestamp("started_at").notNull().defaultNow(),
  billingInterval: text("billing_interval").notNull().default("monthly"),
  renewsAt:       timestamp("renews_at"),
  /** One-time buyoff amount in minor units (when billing_interval = lifetime) */
  oneTimeAmount:  integer("one_time_amount"),
}, (t) => ({
  pk: uniqueIndex("tenant_plans_pk").on(t.tenantId),
}));

// ─── SaaS Enterprise Architecture Extensions ──────────────────────────────────

export const tenantCampuses = pgTable("tenant_campuses", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  code:      text("code").notNull(),
  address:   text("address").default(""),
  status:    text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("tenant_campuses_tenant_idx").on(t.tenantId),
}));

export const addonFeatures = pgTable("addon_features", {
  id:          uuid("id").primaryKey().defaultRandom(),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  priceMonthly: integer("price_monthly").notNull().default(0),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const tenantAddons = pgTable("tenant_addons", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  addonId:   uuid("addon_id").notNull().references(() => addonFeatures.id, { onDelete: "cascade" }),
  status:    text("status").notNull().default("active"), // active, suspended, pending_payment
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  tenantAddonIdx: uniqueIndex("tenant_addons_tenant_addon_idx").on(t.tenantId, t.addonId),
}));

export const tenantBillingUsage = pgTable("tenant_billing_usage", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  metric:       text("metric").notNull(), // 'sms_volume', 'ai_credits', 'storage_bytes'
  quantityUsed: integer("quantity_used").notNull().default(0),
  billingCycle: text("billing_cycle").notNull(), // '2026-05'
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  metricIdx: uniqueIndex("tenant_billing_usage_metric_idx").on(t.tenantId, t.metric, t.billingCycle),
}));

export const usageBillingThresholds = pgTable("usage_billing_thresholds", {
  id:               uuid("id").primaryKey().defaultRandom(),
  metric:           text("metric").notNull().unique(),
  includedQuantity: bigint("included_quantity", { mode: "number" }).notNull().default(0),
  overageUnitPrice: integer("overage_unit_price").notNull().default(0),
  currency:         text("currency").notNull().default("UGX"),
});

export const saasBillingLines = pgTable("saas_billing_lines", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  billingCycle: text("billing_cycle").notNull(),
  lineType:     text("line_type").notNull(),
  description:  text("description").notNull(),
  quantity:     integer("quantity").notNull().default(1),
  unitAmount:   integer("unit_amount").notNull().default(0),
  amount:       integer("amount").notNull().default(0),
  metric:       text("metric"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantCycleIdx: index("saas_billing_lines_tenant_cycle_idx").on(t.tenantId, t.billingCycle),
}));

export const platformAuditLogs = pgTable("platform_audit_logs", {
  id:              uuid("id").primaryKey().defaultRandom(),
  platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id, { onDelete: "set null" }),
  tenantId:        uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  action:          text("action").notNull(),
  entityType:      text("entity_type").notNull(),
  entityId:        text("entity_id"),
  beforeJson:      jsonb("before_json"),
  afterJson:       jsonb("after_json"),
  ip:              text("ip"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  createdIdx: index("platform_audit_logs_created_idx").on(t.createdAt),
}));

export const platformSupportTickets = pgTable("platform_support_tickets", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  subject:          text("subject").notNull(),
  description:      text("description").notNull(),
  status:           text("status").notNull().default("open"),
  priority:         text("priority").notNull().default("normal"),
  category:         text("category").notNull().default("general"),
  requesterName:    text("requester_name"),
  requesterEmail:   text("requester_email"),
  assignedAdminId:  uuid("assigned_admin_id").references(() => platformAdmins.id, { onDelete: "set null" }),
  createdByAdminId: uuid("created_by_admin_id").references(() => platformAdmins.id, { onDelete: "set null" }),
  resolvedAt:       timestamp("resolved_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx:  index("platform_support_tickets_status_idx").on(t.status),
  tenantIdx:  index("platform_support_tickets_tenant_idx").on(t.tenantId),
  updatedIdx: index("platform_support_tickets_updated_idx").on(t.updatedAt),
}));

export const platformSupportTicketMessages = pgTable("platform_support_ticket_messages", {
  id:              uuid("id").primaryKey().defaultRandom(),
  ticketId:        uuid("ticket_id").notNull().references(() => platformSupportTickets.id, { onDelete: "cascade" }),
  platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id, { onDelete: "set null" }),
  body:            text("body").notNull(),
  isInternal:      boolean("is_internal").notNull().default(false),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index("platform_support_ticket_messages_ticket_idx").on(t.ticketId),
}));

export const platformMedia = pgTable("platform_media", {
  id:          uuid("id").primaryKey().defaultRandom(),
  fileName:    text("file_name").notNull(),
  storedPath:  text("stored_path").notNull(),
  mimeType:    text("mime_type").notNull(),
  sizeBytes:   integer("size_bytes").notNull().default(0),
  altText:     text("alt_text"),
  title:       text("title"),
  uploadedBy:  uuid("uploaded_by").references(() => platformAdmins.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  createdIdx: index("platform_media_created_idx").on(t.createdAt),
  mimeIdx:    index("platform_media_mime_idx").on(t.mimeType),
}));

export const platformEmailTemplates = pgTable("platform_email_templates", {
  code:          text("code").primaryKey(),
  name:          text("name").notNull(),
  description:   text("description"),
  category:      text("category").notNull().default("transactional"),
  subject:       text("subject").notNull(),
  bodyHtml:      text("body_html").notNull(),
  bodyText:      text("body_text"),
  variablesJson: jsonb("variables_json").$type<string[]>().notNull().default([]),
  enabled:       boolean("enabled").notNull().default(true),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

export const platformEmailLogs = pgTable("platform_email_logs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  templateCode: text("template_code"),
  recipient:    text("recipient").notNull(),
  subject:      text("subject").notNull(),
  status:       text("status").notNull().default("sent"),
  error:        text("error"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  createdIdx: index("platform_email_logs_created_idx").on(t.createdAt),
  statusIdx:  index("platform_email_logs_status_idx").on(t.status),
}));

export const platformBackups = pgTable("platform_backups", {
  id:               uuid("id").primaryKey().defaultRandom(),
  label:            text("label").notNull(),
  trigger:          text("trigger").notNull().default("manual"),
  status:           text("status").notNull().default("pending"),
  includesDatabase: boolean("includes_database").notNull().default(true),
  includesUploads:  boolean("includes_uploads").notNull().default(true),
  fileName:         text("file_name"),
  storedPath:       text("stored_path"),
  offsiteKey:       text("offsite_key"),
  offsiteStatus:    text("offsite_status"),
  sizeBytes:        integer("size_bytes").notNull().default(0),
  error:            text("error"),
  createdBy:        uuid("created_by").references(() => platformAdmins.id, { onDelete: "set null" }),
  completedAt:      timestamp("completed_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx:  index("platform_backups_status_idx").on(t.status),
  createdIdx: index("platform_backups_created_idx").on(t.createdAt),
}));

export const platformEmailCampaigns = pgTable("platform_email_campaigns", {
  id:               uuid("id").primaryKey().defaultRandom(),
  name:             text("name").notNull(),
  subject:          text("subject").notNull(),
  bodyHtml:         text("body_html").notNull().default(""),
  bodyText:         text("body_text"),
  audience:         text("audience").notNull().default("operators"),
  recipientEmails:  jsonb("recipient_emails").notNull().default([]),
  status:           text("status").notNull().default("draft"),
  scheduledAt:      timestamp("scheduled_at"),
  sentAt:           timestamp("sent_at"),
  stats:            jsonb("stats").notNull().default({}),
  createdBy:        uuid("created_by").references(() => platformAdmins.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("platform_email_campaigns_status_idx").on(t.status),
}));

export const platformWebhookEvents = pgTable("platform_webhook_events", {
  id:         uuid("id").primaryKey().defaultRandom(),
  provider:   text("provider").notNull(),
  externalId: text("external_id").notNull(),
  tenantId:   uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  paymentId:  uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
  invoiceId:  uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  status:     text("status").notNull().default("processed"),
  payload:    jsonb("payload"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  providerExtIdx: uniqueIndex("platform_webhook_events_provider_ext_idx").on(t.provider, t.externalId),
}));

export const savedReports = pgTable("saved_reports", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  reportType:  text("report_type").notNull(),
  configJson:  jsonb("config_json").$type<Record<string, unknown>>().default({}),
  createdBy:   uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("saved_reports_tenant_idx").on(t.tenantId),
}));

export const aiUsageLog = pgTable("ai_usage_log", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  feature:   text("feature").notNull(),
  credits:   integer("credits").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("ai_usage_log_tenant_idx").on(t.tenantId),
}));

export const tenantHelpArticles = pgTable("tenant_help_articles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  category:  text("category").notNull().default("general"),
  bodyMd:    text("body_md").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollTaxRules = pgTable("payroll_tax_rules", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  ratePercent:    integer("rate_percent").notNull().default(0),
  thresholdMinor: integer("threshold_minor").notNull().default(0),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

export const jobPosts = pgTable("job_posts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  department:  text("department"),
  description: text("description").notNull().default(""),
  status:      text("status").notNull().default("open"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const jobApplicants = pgTable("job_applicants", {
  id:         uuid("id").primaryKey().defaultRandom(),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  jobPostId:  uuid("job_post_id").notNull().references(() => jobPosts.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  email:      text("email"),
  phone:      text("phone"),
  status:     text("status").notNull().default("applied"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const libraryEbooks = pgTable("library_ebooks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  author:    text("author"),
  url:       text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const libraryReservations = pgTable("library_reservations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  bookId:    uuid("book_id").references(() => libraryBooks.id, { onDelete: "set null" }),
  ebookId:   uuid("ebook_id").references(() => libraryEbooks.id, { onDelete: "set null" }),
  status:    text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studentMaterials = pgTable("student_materials", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  subject:   text("subject"),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  url:       text("url"),
  classId:   uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  filePath:  text("file_path"),
  fileName:  text("file_name"),
  mimeType:  text("mime_type"),
  folder:    text("folder").default("general"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const onlineClassLinks = pgTable("online_class_links", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  tenantId:            uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:               text("title").notNull(),
  url:                 text("url").notNull(),
  classId:             uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  subjectId:           uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  scheduledAt:         timestamp("scheduled_at"),
  durationMinutes:     integer("duration_minutes").default(60),
  attendanceSessionId: uuid("attendance_session_id").references(() => attendanceSessions.id, { onDelete: "set null" }),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
});

export const onlineClassAttendance = pgTable("online_class_attendance", {
  id:               uuid("id").primaryKey().defaultRandom(),
  tenantId:         uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  onlineClassId:    uuid("online_class_id").notNull().references(() => onlineClassLinks.id, { onDelete: "cascade" }),
  studentId:        uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status:           text("status").notNull().default("present"),
  joinedAt:         timestamp("joined_at"),
  durationMinutes:  integer("duration_minutes"),
  performanceScore: integer("performance_score"),
  notes:            text("notes"),
  markedBy:         uuid("marked_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("online_class_attendance_unique").on(t.onlineClassId, t.studentId),
  tenantIdx: index("online_class_attendance_tenant_idx").on(t.tenantId),
}));

export const schoolEvents = pgTable("school_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  description: text("description"),
  eventType:   text("event_type").notNull().default("academic"),
  venue:       text("venue"),
  startsAt:    timestamp("starts_at").notNull(),
  endsAt:      timestamp("ends_at"),
  audience:    text("audience").notNull().default("all"),
  published:   boolean("published").notNull().default(true),
  createdBy:   uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tenantStartsIdx: index("school_events_tenant_starts_idx").on(t.tenantId, t.startsAt),
}));

export const examExternalTokens = pgTable("exam_external_tokens", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assessmentId:  uuid("assessment_id").notNull(),
  token:         text("token").notNull().unique(),
  examinerEmail: text("examiner_email").notNull(),
  expiresAt:     timestamp("expires_at").notNull(),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

export const cbtProctorEvents = pgTable("cbt_proctor_events", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull(),
  eventType: text("event_type").notNull(),
  detail:    text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffDisciplinary = pgTable("staff_disciplinary", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:      uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  incidentDate: timestamp("incident_date").notNull().defaultNow(),
  description:  text("description").notNull(),
  action:       text("action"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const staffDocuments = pgTable("staff_documents", {
  id:           uuid("id").primaryKey().defaultRandom(),
  tenantId:     uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:      uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  fileName:     text("file_name").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const staffBenefits = pgTable("staff_benefits", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:     uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  amountMinor: integer("amount_minor").notNull().default(0),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export const performanceReviews = pgTable("performance_reviews", {
  id:        uuid("id").primaryKey().defaultRandom(),
  tenantId:  uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  staffId:   uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  period:    text("period").notNull(),
  score:     integer("score"),
  comments:  text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const platformImpersonationTokens = pgTable("platform_impersonation_tokens", {
  id:              uuid("id").primaryKey().defaultRandom(),
  token:           text("token").notNull().unique(),
  tenantId:        uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  targetUserId:    uuid("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platformAdminId: uuid("platform_admin_id").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
  readOnly:        boolean("read_only").notNull().default(true),
  expiresAt:       timestamp("expires_at").notNull(),
  usedAt:          timestamp("used_at"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex("platform_impersonation_tokens_token_idx").on(t.token),
}));
