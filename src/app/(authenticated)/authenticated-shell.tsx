'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { SidebarProvider, useSidebar } from '@/components/sidebar-context';

type UserRole = 'admin' | 'trainer' | 'supervisor' | 'worker' | 'executive';

interface AuthenticatedShellProps {
  currentPath: string;
  userRole: UserRole;
  userName: string;
  children: React.ReactNode;
}

function ShellInner({
  currentPath,
  userRole,
  children,
}: Omit<AuthenticatedShellProps, 'userName'>) {
  const pathname = usePathname();
  const activePath = pathname ?? currentPath;
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath={activePath} userRole={userRole} />
      <div
        className={`pb-16 md:pb-0 transition-all duration-200 ${
          collapsed ? 'md:pl-16' : 'md:pl-60'
        }`}
      >
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

export default function AuthenticatedShell({
  currentPath,
  userRole,
  children,
}: AuthenticatedShellProps) {
  return (
    <SidebarProvider>
      <ShellInner currentPath={currentPath} userRole={userRole}>
        {children}
      </ShellInner>
    </SidebarProvider>
  );
}
