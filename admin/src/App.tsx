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
import Messages from "./pages/Messages";
import MessageAnalysis from "./pages/MessageAnalysis";
import CalendarPage from "./features/calendar/components/CalendarPage";
import Layout from "./components/Layout";

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
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
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
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/property-order" element={<PropertyOrder />} />
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
