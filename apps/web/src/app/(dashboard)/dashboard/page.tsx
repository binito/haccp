'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MapPin, ClipboardList, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import api from '@/lib/api';
import { Anomaly } from '@/types';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { clsx } from 'clsx';

interface DashboardStats {
  totalClients: number; totalAreas: number; openAnomalies: number;
  openShortageReports: number; checklistsThisMonth: number;
}

interface ShortageReport {
  id: string; quantity?: number; notes?: string; status: string; createdAt: string;
  stock?: { product?: { name: string; unit: string }; clientId: string };
  reporter?: { name: string };
}

function StatCard({ label, value, icon: Icon, accentClass, iconColorClass, href }: {
  label: string; value: number | string; icon: React.ElementType;
  accentClass: string; iconColorClass: string; href?: string;
}) {
  const inner = (
    <div className={clsx(
      'group relative overflow-hidden rounded-2xl p-5 transition-all duration-150',
      'bg-gradient-to-b from-surface-2 to-[#17171a] ring-1 ring-white/[0.07]',
      href && 'hover:ring-white/[0.12] hover:-translate-y-0.5 cursor-pointer'
    )}>
      {/* Left accent bar */}
      <span className={clsx('absolute left-0 top-3 bottom-3 w-[3px] rounded-full', accentClass)} />
      {/* Watermark icon */}
      <Icon className={clsx('absolute -right-3 -bottom-2 h-20 w-20 rotate-12 opacity-[0.06]', iconColorClass)} />
      <p className="text-3xl font-bold tabular-nums text-gray-100">{value}</p>
      <p className="mt-1.5 text-xs text-gray-500">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: recentAnomalies, isLoading: anomaliesLoading } = useQuery<Anomaly[]>({
    queryKey: ['recent-anomalies'],
    queryFn: () => api.get('/reports/anomalies?status=OPEN').then(r => r.data),
  });

  const { data: openShortages, isLoading: shortagesLoading } = useQuery<ShortageReport[]>({
    queryKey: ['open-shortages'],
    queryFn: () => api.get('/consumables/reports').then(r => r.data.filter((r: ShortageReport) => r.status === 'OPEN')),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-gray-100">Visão geral</h2>
        <p className="mt-0.5 text-sm text-gray-400">Operações em tempo real</p>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: isSuperAdmin ? 5 : 4 }).map((_, i) => (
            <Card key={i}><div className="h-14 animate-pulse rounded-lg bg-surface-3" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {isSuperAdmin && (
            <StatCard label="Clientes" value={stats?.totalClients ?? 0}
              icon={MapPin} accentClass="bg-primary-500" iconColorClass="text-primary-500" />
          )}
          <StatCard label="Áreas" value={stats?.totalAreas ?? 0}
            icon={MapPin} accentClass="bg-blue-500" iconColorClass="text-blue-500" />
          <StatCard label="Anomalias" value={stats?.openAnomalies ?? 0}
            icon={AlertTriangle} accentClass="bg-red-500" iconColorClass="text-red-500" href="/anomalies" />
          <StatCard label="Faltas" value={stats?.openShortageReports ?? 0}
            icon={Package}
            accentClass={stats?.openShortageReports ? 'bg-red-500' : 'bg-green-500'}
            iconColorClass={stats?.openShortageReports ? 'text-red-500' : 'text-green-500'}
            href="/consumables" />
          <StatCard label="Checklists/mês" value={stats?.checklistsThisMonth ?? 0}
            icon={ClipboardList} accentClass="bg-green-500" iconColorClass="text-green-500" href="/checklists" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Faltas */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5 pb-0 mb-0">
            <CardTitle>Faltas de consumíveis</CardTitle>
            {(openShortages?.length ?? 0) > 0 && (
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500/25">
                {openShortages!.length}
              </span>
            )}
          </CardHeader>
          <div className="mt-3">
            {shortagesLoading ? (
              <div className="space-y-2 px-5 pb-5">
                {[1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-3" />)}
              </div>
            ) : !openShortages?.length ? (
              <p className="px-5 pb-5 pt-3 text-sm text-gray-400">Sem faltas reportadas</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {openShortages.slice(0, 5).map(r => (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-surface-2/[0.02] transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{r.stock?.product?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {r.reporter?.name}{r.quantity ? ` · ${r.quantity} ${r.stock?.product?.unit ?? ''}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">
                        {format(new Date(r.createdAt), 'd MMM', { locale: pt })}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border px-5 py-3">
                  <Link href="/consumables" className="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
                    Ver todas →
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Anomalias */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5 pb-0 mb-0">
            <CardTitle>Anomalias abertas</CardTitle>
            <Badge status="OPEN" />
          </CardHeader>
          <div className="mt-3">
            {anomaliesLoading ? (
              <div className="space-y-2 px-5 pb-5">
                {[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-3" />)}
              </div>
            ) : !recentAnomalies?.length ? (
              <p className="px-5 pb-5 pt-3 text-sm text-gray-400">Nenhuma anomalia aberta</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {recentAnomalies.slice(0, 5).map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/[0.02] transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{a.title}</p>
                        <p className="text-xs text-gray-400">{a.area?.name ?? '—'}</p>
                      </div>
                      <Badge status={a.severity} />
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border px-5 py-3">
                  <Link href="/anomalies" className="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors">
                    Ver todas →
                  </Link>
                </div>
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
