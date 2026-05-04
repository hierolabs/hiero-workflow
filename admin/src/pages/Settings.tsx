import { Link } from "react-router-dom";

const settingsMenus = [
  {
    to: "/settings/property-order",
    title: "숙소 표시 순서",
    description: "캘린더·공간관리에서 숙소가 표시되는 순서를 조정합니다",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    ),
  },
  {
    to: "/settings/property-costs",
    title: "숙소별 비용 설정",
    description: "소유구조·월세·위탁료·공과금 등 고정비용을 설정합니다",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: "준비중",
  },
  {
    to: "/settings/notifications",
    title: "알림 설정",
    description: "이슈·청소·예약 알림 수신 채널과 조건을 설정합니다",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    badge: "준비중",
  },
  {
    to: "/settings/categories",
    title: "카테고리 관리",
    description: "이슈 유형·청소 유형·비용 카테고리를 관리합니다",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
    badge: "준비중",
  },
];

export default function Settings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-500">시스템 설정을 관리합니다</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {settingsMenus.map((menu) => (
          <Link
            key={menu.to}
            to={menu.to}
            className="group relative flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              {menu.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{menu.title}</h3>
                {menu.badge && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {menu.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{menu.description}</p>
            </div>
            <svg className="h-5 w-5 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
