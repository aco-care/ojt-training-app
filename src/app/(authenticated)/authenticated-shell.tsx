'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';

type UserRole = 'admin' | 'trainer' | 'supervisor' | 'worker' | 'executive';

interface AuthenticatedShellProps {
  currentPath: string;
  userRole: UserRole;
  userName: string;
  children: React.ReactNode;
}

export default function AuthenticatedShell({
  currentPath,
  userRole,
  children,
}: AuthenticatedShellProps) {
  const pathname = usePathname();
  const activePath = pathname ?? currentPath;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPath={activePath} userRole={userRole} />

      {/* Main content area */}
      <div className="pb-16 md:pb-0 md:pl-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
