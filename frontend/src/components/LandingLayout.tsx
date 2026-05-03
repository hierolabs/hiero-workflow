import { Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/service", label: "서비스" },
  { to: "/matching", label: "매칭플랫폼" },
  { to: "/review", label: "평가시스템" },
  { to: "/hosting", label: "고객확보" },
  { to: "/thingdone", label: "띵똥" },
];

export default function LandingLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">
            HIERO
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === item.to
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/#cta"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              진단받기
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-gray-100 px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-medium ${
                    location.pathname === item.to ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/#cta"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-lg bg-slate-900 px-5 py-2.5 text-center text-sm font-medium text-white"
              >
                진단받기
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-slate-950 text-gray-400">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-lg font-bold text-white">HIERO</p>
              <p className="mt-2 text-sm leading-relaxed">
                빈집을 수익형 숙소로 바꾸는<br />위탁운영 시스템
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">서비스</p>
              <div className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">문의</p>
              <p className="text-sm">contact@hiero.kr</p>
            </div>
          </div>
          <div className="mt-10 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
            &copy; {new Date().getFullYear()} HIERO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
