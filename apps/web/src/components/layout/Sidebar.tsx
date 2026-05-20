'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, UserCog, MapPin, ClipboardList,
  AlertTriangle, Package, Box, Thermometer,
  ChevronRight, ChevronDown, PackageCheck, SprayCan,
  FlaskConical, Flame, BookOpen, LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';

interface NavItem { href: string; label: string; icon: React.ElementType; roles?: string[]; }
interface NavGroup { label: string; icon: React.ElementType; prefix: string; roles?: string[]; children: NavItem[]; }
type NavEntry = NavItem | NavGroup;

function isGroup(e: NavEntry): e is NavGroup { return 'children' in e; }

const navEntries: NavEntry[] = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users, roles: ['SUPER_ADMIN'] },
  { href: '/users', label: 'Utilizadores', icon: UserCog, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN'] },
  { href: '/areas', label: 'Áreas', icon: MapPin },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/anomalies', label: 'Anomalias', icon: AlertTriangle },
  { href: '/consumables', label: 'Consumíveis', icon: Package },
  {
    label: 'Registos', icon: BookOpen, prefix: '/registos',
    children: [
      { href: '/registos/entradas', label: 'Entradas', icon: PackageCheck },
      { href: '/registos/temperaturas', label: 'Temperaturas', icon: Thermometer },
      { href: '/registos/higienizacao', label: 'Higienização', icon: SprayCan },
      { href: '/registos/desinfecao', label: 'Desinfeção', icon: FlaskConical },
      { href: '/registos/oleos', label: 'Óleos de Fritura', icon: Flame },
    ],
  },
];

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({ registos: pathname.startsWith('/registos') });

  const { data: stats } = useQuery<{ openShortageReports: number }>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  function isVisible(e: NavEntry) {
    return !e.roles || !!(user && e.roles.includes(user.role));
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface-1 shrink-0">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-border">
        <Image src="/logo.png" alt="HACCP" width={110} height={38} priority />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navEntries.filter(isVisible).map((entry) => {
          if (isGroup(entry)) {
            const key = entry.prefix.replace('/', '');
            const isExpanded = groupOpen[key] ?? pathname.startsWith(entry.prefix);
            const isActive = pathname.startsWith(entry.prefix);
            const Icon = entry.icon;

            return (
              <div key={entry.prefix}>
                <button
                  onClick={() => setGroupOpen(p => ({ ...p, [key]: !p[key] }))}
                  className={clsx(
                    'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive ? 'text-gray-100 bg-surface-3' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-2'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{entry.label}</span>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                    {entry.children.filter(isVisible).map((child) => {
                      const active = pathname === child.href || pathname.startsWith(child.href + '/');
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={clsx(
                            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                            active
                              ? 'text-primary-400 bg-primary-500/10'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-surface-2'
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const item = entry as NavItem;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                isActive
                  ? 'text-gray-100 bg-surface-3 font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-2/60'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}
              <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-primary-400' : '')} />
              <span className="flex-1">{item.label}</span>
              {item.href === '/consumables' && (stats?.openShortageReports ?? 0) > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {stats!.openShortageReports > 9 ? '9+' : stats!.openShortageReports}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-xs font-semibold text-primary-400">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-300">{user.name}</p>
              <p className="truncate text-[10px] text-gray-600">
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'CLIENT_ADMIN' ? 'Administrador' : 'Operador'}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-md p-1 text-gray-600 hover:bg-surface-3 hover:text-gray-400 transition-colors"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
