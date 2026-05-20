'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, AlertTriangle, Package, Home, ClipboardCheck, Settings, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { clsx } from 'clsx';

type NavItem = { href: string; icon: LucideIcon; label: string; exact?: boolean };

const baseNavItems: NavItem[] = [
  { href: '/app', icon: Home, label: 'Início', exact: true },
  { href: '/app/checklists', icon: ClipboardList, label: 'Checklists' },
  { href: '/app/anomalias', icon: AlertTriangle, label: 'Anomalias' },
  { href: '/app/consumiveis', icon: Package, label: 'Consumíveis' },
  { href: '/app/registos', icon: ClipboardCheck, label: 'Registos' },
];

const adminNavItem: NavItem = { href: '/app/gestao', icon: Settings, label: 'Gestão' };

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, hydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) return null;

  const navItems = [...baseNavItems, ...(user?.role === 'SUPER_ADMIN' || user?.role === 'CLIENT_ADMIN' ? [adminNavItem] : [])];

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      {/* Header */}
      <header className="h-14 bg-surface-1 border-b border-border px-4 flex items-center justify-between sticky top-0 z-20">
        <span className="text-sm font-bold text-gray-100 tracking-tight">HACCP</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/20 text-xs font-semibold text-primary-400">
          {user?.name?.split(' ')[0]?.[0]?.toUpperCase() ?? '?'}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface-1 border-t border-border flex z-20">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-primary-400' : 'text-gray-600 hover:text-gray-400'
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
