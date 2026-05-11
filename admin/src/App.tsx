import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Checklist from "./pages/Checklist";
import Properties from "./pages/Properties";
import Reservations from "./pages/Reservations";
import HostexSync from "./pages/HostexSync";
import Cleaning from "./pages/Cleaning";
import Issues from "./pages/Issues";
import Settlement from "./pages/Settlement";
import Revenue from "./pages/Revenue";
import Diagnosis from "./pages/Diagnosis";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import PropertyOrder from "./pages/settings/PropertyOrder";
import SidebarSettings from "./pages/settings/SidebarSettings";
import Messages from "./pages/Messages";
import MessageAnalysis from "./pages/MessageAnalysis";
import CalendarPage from "./features/calendar/components/CalendarPage";
import Layout from "./components/Layout";
import HieroDashboard from "./pages/HieroDashboard";
import Profit from "./pages/Profit";
import Team from "./pages/Team";
import HieroToday from "./pages/founder/HieroToday";
import FounderDashboard from "./pages/founder/FounderDashboard";
import OrgChart from "./pages/founder/OrgChart";
import ETFBoard from "./pages/etf/ETFBoard";
import CEOBoard from "./pages/etf/CEOBoard";
import CTOBoard from "./pages/etf/CTOBoard";
import CFOBoard from "./pages/etf/CFOBoard";
import AttendancePage from "./pages/etf/AttendancePage";
import ExecutionDashboard from "./pages/execution/ExecutionDashboard";
import TeamChat from "./pages/TeamChat";
import IssueDetections from "./pages/IssueDetections";
import TodayDashboard from "./pages/TodayDashboard";
import KnowledgeBase from "./pages/wiki/KnowledgeBase";
import GrowthStory from "./pages/wiki/GrowthStory";
import MyPage from "./pages/MyPage";
import PriceCalendar from "./pages/PriceCalendar";
import OrgDocs from "./pages/OrgDocs";
import PropertyOnboarding from "./pages/onboarding/PropertyOnboarding";
import GuestAnalytics from "./pages/GuestAnalytics";
import ListingStudio from "./pages/ListingStudio";

function PrivateRoute() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/login" />;
}

// 역할별 접근 제한 — 허용 안 되면 / 로 리다이렉트
function RoleGuard({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      const layer = user.role_layer || "";
      const role = user.role_title || "";
      const userRole = user.role || "";
      // founder 또는 super_admin은 모든 페이지 접근 가능
      if (layer === "founder" || userRole === "super_admin") {
        return <>{children}</>;
      }
      if (allowed.includes(layer) || allowed.includes(role)) {
        return <>{children}</>;
      }
    }
  } catch { /* ignore */ }
  return <Navigate to="/" replace />;
}

function PrivateLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route element={<PrivateLayout />}>
            {/* 전체 공개 */}
            <Route path="/" element={<HieroToday />} />
            <Route path="/today" element={<TodayDashboard />} />

            {/* GOT — founder만 */}
            <Route path="/founder" element={<RoleGuard allowed={['founder']}><FounderDashboard /></RoleGuard>} />
            <Route path="/got" element={<RoleGuard allowed={['founder', 'etf']}><OrgChart /></RoleGuard>} />
            <Route path="/org" element={<RoleGuard allowed={['founder', 'etf']}><OrgChart /></RoleGuard>} />

            {/* ETF — founder + etf */}
            <Route path="/etf-board" element={<RoleGuard allowed={['founder', 'etf']}><ETFBoard /></RoleGuard>} />
            <Route path="/etf-board/ceo" element={<RoleGuard allowed={['founder', 'etf']}><CEOBoard /></RoleGuard>} />
            <Route path="/etf-board/cto" element={<RoleGuard allowed={['founder', 'etf']}><CTOBoard /></RoleGuard>} />
            <Route path="/etf-board/cfo" element={<RoleGuard allowed={['founder', 'etf']}><CFOBoard /></RoleGuard>} />
            <Route path="/etf-board/attendance" element={<RoleGuard allowed={['founder', 'etf']}><AttendancePage /></RoleGuard>} />

            {/* 기존 */}
            <Route path="/hiero-dashboard" element={<HieroDashboard />} />
            <Route path="/execution/:role" element={<ExecutionDashboard />} />
            <Route path="/chat" element={<TeamChat />} />
            <Route path="/issue-detections" element={<IssueDetections />} />
            <Route path="/wiki" element={<KnowledgeBase />} />
            <Route path="/growth-story" element={<GrowthStory />} />
            <Route path="/org-docs" element={<OrgDocs />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/dashboard-old" element={<Dashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/price-calendar" element={<PriceCalendar />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/listing-studio" element={<ListingStudio />} />
            <Route path="/properties/:id/onboarding" element={<PropertyOnboarding />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/guest-analytics" element={<GuestAnalytics />} />
            <Route path="/hostex" element={<HostexSync />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/analysis" element={<MessageAnalysis />} />
            <Route path="/cleaning" element={<Cleaning />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/settlement" element={<Settlement />} />
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/diagnosis" element={<Diagnosis />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/profit" element={<Profit />} />
            <Route path="/team" element={<Team />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/property-order" element={<PropertyOrder />} />
            <Route path="/settings/sidebar" element={<SidebarSettings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        이 페이지는 준비 중입니다.
      </p>
    </div>
  );
}

export default App;
