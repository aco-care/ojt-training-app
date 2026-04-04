'use client';

import Link from 'next/link';

type UserRole = 'admin' | 'trainer' | 'supervisor' | 'worker' | 'executive';

interface SidebarProps {
  currentPath: string;
  userRole: UserRole;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function WorkersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TrainingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function OjtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: '/', label: 'ダッシュボード', icon: <DashboardIcon className="w-5 h-5" /> },
  { href: '/workers', label: '外国人一覧', icon: <WorkersIcon className="w-5 h-5" /> },
  { href: '/schedule', label: '予定管理', icon: <PlanIcon className="w-5 h-5" /> },
  { href: '/training', label: '研修記録', icon: <TrainingIcon className="w-5 h-5" /> },
  { href: '/ojt', label: 'OJT記録', icon: <OjtIcon className="w-5 h-5" /> },
  { href: '/admin', label: '管理', icon: <AdminIcon className="w-5 h-5" />, adminOnly: true },
];

export default function Sidebar({ currentPath, userRole }: SidebarProps) {
  const filteredItems = navItems.filter((item) => {
    if (item.adminOnly && userRole !== 'admin' && userRole !== 'supervisor') return false;
    // Worker role: only show dashboard (マイページ) - other pages accessed via links
    if (userRole === 'worker' && item.href !== '/') return false;
    return true;
  });

  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    if (href === '/schedule') {
      return currentPath.startsWith('/schedule') || currentPath.startsWith('/training-plans') || currentPath.startsWith('/ojt-plans');
    }
    return currentPath.startsWith(href);
  };

  return (
    <>
      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:hidden">
        <div className="flex items-center justify-around">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className={
                  isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                }
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop left sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center px-4 border-b border-gray-200">
          <h1 className="text-sm font-bold text-gray-900 leading-tight">
            ACO 研修・OJT
            <br />
            マネージャー
          </h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span
                className={
                  isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                }
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
