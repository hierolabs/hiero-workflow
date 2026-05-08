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
import FounderDashboard from "./pages/founder/FounderDashboard";
import ETFBoard from "./pages/etf/ETFBoard";
import CEOBoard from "./pages/etf/CEOBoard";
import CTOBoard from "./pages/etf/CTOBoard";
import CFOBoard from "./pages/etf/CFOBoard";
import ExecutionDashboard from "./pages/execution/ExecutionDashboard";
import TeamChat from "./pages/TeamChat";
import IssueDetections from "./pages/IssueDetections";
import TodayDashboard from "./pages/TodayDashboard";
import KnowledgeBase from "./pages/wiki/KnowledgeBase";
import MyPage from "./pages/MyPage";
import PriceCalendar from "./pages/PriceCalendar";

function PrivateRoute() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/login" />;
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
            <Route path="/" element={<FounderDashboard />} />
            <Route path="/today" element={<TodayDashboard />} />
            <Route path="/hiero-dashboard" element={<HieroDashboard />} />
            <Route path="/etf-board" element={<ETFBoard />} />
            <Route path="/etf-board/ceo" element={<CEOBoard />} />
            <Route path="/etf-board/cto" element={<CTOBoard />} />
            <Route path="/etf-board/cfo" element={<CFOBoard />} />
            <Route path="/execution/:role" element={<ExecutionDashboard />} />
            <Route path="/chat" element={<TeamChat />} />
            <Route path="/issue-detections" element={<IssueDetections />} />
            <Route path="/wiki" element={<KnowledgeBase />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/dashboard-old" element={<Dashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/price-calendar" element={<PriceCalendar />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/reservations" element={<Reservations />} />
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
