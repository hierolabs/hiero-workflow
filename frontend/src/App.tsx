import { Routes, Route } from "react-router-dom";
import LandingLayout from "./components/LandingLayout";
import Home from "./pages/Home";
import Service from "./pages/Service";
import Matching from "./pages/Matching";
import Review from "./pages/Review";
import Hosting from "./pages/Hosting";
import ThingDone from "./pages/ThingDone";

export default function App() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/service" element={<Service />} />
        <Route path="/matching" element={<Matching />} />
        <Route path="/review" element={<Review />} />
        <Route path="/hosting" element={<Hosting />} />
        <Route path="/thingdone" element={<ThingDone />} />
      </Route>
    </Routes>
  );
}
