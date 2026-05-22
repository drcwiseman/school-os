import { Navigate, Route } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";
import { StudentsLayout } from "../layout/StudentsLayout";
import { StudentsList } from "../pages/StudentsList";
import { StudentDetail } from "../pages/StudentDetail";
import { StudentAdmission } from "../pages/StudentAdmission";
import { StudentPromotion } from "../pages/StudentPromotion";
import { StudentLeavesPage } from "../pages/students/StudentLeavesPage";
import { StudentBirthdaysPage } from "../pages/students/StudentBirthdaysPage";
import { StudentTransfersPage } from "../pages/students/StudentTransfersPage";
import { StudentNoticeboardPage } from "../pages/students/StudentNoticeboardPage";
import { Parents } from "../pages/Parents";
import { Teachers } from "../pages/Teachers";
import { Admissions } from "../pages/Admissions";
import { AdmissionSettings } from "../pages/AdmissionSettings";
import { Attendance } from "../pages/Attendance";
import { Admin } from "../pages/Admin";
import { Finance } from "../pages/Finance";
import { Academics } from "../pages/Academics";
import { Exams } from "../pages/Exams";
import { HR } from "../pages/HR";
import { Payroll } from "../pages/Payroll";
import { OperationModulePage } from "../pages/OperationModulePage";
import { Facilities } from "../pages/Facilities";
import { Campuses } from "../pages/Campuses";
import { Security } from "../pages/Security";
import { Messaging } from "../pages/Messaging";
import { Reports } from "../pages/Reports";
import { AiAdmin } from "../pages/AiAdmin";
import { Help } from "../pages/Help";
import { Settings } from "../pages/Settings";
import { TeacherWorkspace } from "../pages/TeacherWorkspace";
import { Curriculum } from "../pages/Curriculum";
import { StudentCbtExam } from "../pages/StudentCbtExam";
import { FeatureRoute } from "../components/FeatureRoute";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";
import { facilitiesPath, type FacilitiesTabId } from "../../lib/facilities-nav";
import { useSchoolSlug } from "../hooks/useSchoolSlug";
function FacilitiesTabRedirect({ tab }: { tab: FacilitiesTabId }) {
  const schoolSlug = useSchoolSlug();
  if (!schoolSlug) return <Navigate to="/login" replace />;
  return <Navigate to={facilitiesPath(schoolSlug, tab)} replace />;
}

/** Shared staff app routes (under /s/:slug/* or clean custom-domain paths). */
export function SchoolDashboardRoutes() {
  return (
    <>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="students" element={<FeatureRoute feature={MODULE_FEATURE_CODES.students}><StudentsLayout /></FeatureRoute>}>
        <Route index element={<StudentsList />} />
        <Route path="leaves" element={<StudentLeavesPage />} />
        <Route path="birthdays" element={<StudentBirthdaysPage />} />
        <Route path="noticeboard" element={<StudentNoticeboardPage />} />
        <Route path="transfers" element={<StudentTransfersPage />} />
        <Route path="new" element={<StudentAdmission />} />
        <Route path="promote" element={<StudentPromotion />} />
      </Route>
      <Route path="students/:studentId" element={<FeatureRoute feature={MODULE_FEATURE_CODES.students}><StudentDetail /></FeatureRoute>} />
      <Route path="parents" element={<FeatureRoute feature={MODULE_FEATURE_CODES.students}><Parents /></FeatureRoute>} />
      <Route path="teachers" element={<FeatureRoute feature={MODULE_FEATURE_CODES.hr}><Teachers /></FeatureRoute>} />
      <Route path="admissions" element={<FeatureRoute feature={MODULE_FEATURE_CODES.admissions}><Admissions /></FeatureRoute>} />
      <Route path="admissions/settings" element={<FeatureRoute feature={MODULE_FEATURE_CODES.admissions}><AdmissionSettings /></FeatureRoute>} />
      <Route path="attendance" element={<FeatureRoute feature={MODULE_FEATURE_CODES.attendance}><Attendance /></FeatureRoute>} />
      <Route path="academics" element={<FeatureRoute feature={MODULE_FEATURE_CODES.academics}><Academics /></FeatureRoute>} />
      <Route path="curriculum" element={<FeatureRoute feature={MODULE_FEATURE_CODES.academics}><Curriculum /></FeatureRoute>} />
      <Route path="teacher" element={<TeacherWorkspace />} />
      <Route path="exams" element={<FeatureRoute feature={MODULE_FEATURE_CODES.exams}><Exams /></FeatureRoute>} />
      <Route path="exam" element={<FeatureRoute feature={MODULE_FEATURE_CODES.exams}><StudentCbtExam /></FeatureRoute>} />
      <Route path="finance" element={<FeatureRoute feature={MODULE_FEATURE_CODES.finance}><Finance /></FeatureRoute>} />
      <Route path="hr" element={<FeatureRoute feature={MODULE_FEATURE_CODES.hr}><HR /></FeatureRoute>} />
      <Route path="payroll" element={<FeatureRoute feature={MODULE_FEATURE_CODES.payroll}><Payroll /></FeatureRoute>} />
      <Route path="ops/discipline" element={<FeatureRoute feature={MODULE_FEATURE_CODES.discipline}><OperationModulePage moduleId="discipline" /></FeatureRoute>} />
      <Route path="ops/health" element={<FeatureRoute feature={MODULE_FEATURE_CODES.health}><OperationModulePage moduleId="health" /></FeatureRoute>} />
      <Route path="facilities" element={<Facilities />} />
      <Route path="ops/library" element={<FacilitiesTabRedirect tab="library" />} />
      <Route path="ops/inventory" element={<FeatureRoute feature={MODULE_FEATURE_CODES.inventory}><OperationModulePage moduleId="inventory" /></FeatureRoute>} />
      <Route path="ops/transport" element={<FacilitiesTabRedirect tab="transport" />} />
      <Route path="ops/boarding" element={<FacilitiesTabRedirect tab="hostel" />} />
      <Route path="campuses" element={<Campuses />} />
      <Route path="security" element={<Security />} />
      <Route path="operations" element={<Navigate to="ops/discipline" replace />} />
      <Route path="messaging" element={<FeatureRoute feature={MODULE_FEATURE_CODES.messaging}><Messaging /></FeatureRoute>} />
      <Route path="reports" element={<FeatureRoute feature={MODULE_FEATURE_CODES.reports}><Reports /></FeatureRoute>} />
      <Route path="ai-admin" element={<AiAdmin />} />
      <Route path="help" element={<Help />} />
      <Route path="admin" element={<Admin />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </>
  );
}
