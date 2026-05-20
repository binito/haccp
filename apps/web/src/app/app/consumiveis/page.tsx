'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, AlertCircle, Send, ChevronDown, ChevronUp,
  Clock, Truck, CheckCircle2, List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ConsumableStock } from '@/types';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

type ReportStatus = 'OPEN' | 'ORDERED' | 'RESOLVED';

interface ShortageReport {
  id: string; quantity?: number; notes?: string;
  status: ReportStatus; createdAt: string;
  stock?: { product?: { name: string; unit: string } };
}

const statusConfig: Record<ReportStatus, { label: string; color: string; icon: React.ElementType }> = {
  OPEN:     { label: 'Em aberto',        color: 'bg-red-100 text-red-600 border-red-200',    icon: Clock },
  ORDERED:  { label: 'Em processamento', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Truck },
  RESOLVED: { label: 'Entregue',         color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
};

export default function ConsumiveisPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'report' | 'orders'>('report');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: stocks, isLoading: stocksLoading } = useQuery<ConsumableStock[]>({
    queryKey: ['app-consumable-stocks'],
    queryFn: () => api.get('/consumables/stock').then(r => r.data),
  });

  const { data: myReports, isLoading: reportsLoading } = useQuery<ShortageReport[]>({
    queryKey: ['app-consumable-reports'],
    queryFn: () => api.get('/consumables/reports').then(r => r.data),
    enabled: tab === 'orders',
  });

  const { mutate: report, isPending } = useMutation({
    mutationFn: ({ stock }: { stock: ConsumableStock }) =>
      api.post('/consumables/reports', {
        stockId: stock.id,
        quantity: quantities[stock.id] ? Number(quantities[stock.id]) : undefined,
        notes: notes[stock.id] || undefined,
      }),
    onSuccess: (_, { stock }) => {
      toast.success('Falta reportada com sucesso!');
      setQuantities(prev => { const n = { ...prev }; delete n[stock.id]; return n; });
      setNotes(prev => { const n = { ...prev }; delete n[stock.id]; return n; });
      setExpanded(null);
      qc.invalidateQueries({ queryKey: ['app-consumable-stocks'] });
      qc.invalidateQueries({ queryKey: ['app-consumable-reports'] });
    },
    onError: () => toast.error('Erro ao reportar falta'),
  });

  const lowStocks = stocks?.filter(s => s.quantity <= s.minQuantity) ?? [];
  const pendingCount = myReports?.filter(r => r.status !== 'RESOLVED').length ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button type="button" onClick={() => setTab('report')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'report' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <Package size={16} /> Reportar falta
        </button>
        <button type="button" onClick={() => setTab('orders')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
            tab === 'orders' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <List size={16} /> Os meus pedidos
          {pendingCount > 0 && (
            <span className="absolute top-2 right-6 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Reportar falta ── */}
      {tab === 'report' && (
        <div className="p-4 space-y-4">
          {lowStocks.length > 0 && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500 shrink-0" />
              <p className="text-sm text-orange-700 font-medium">
                {lowStocks.length} produto{lowStocks.length !== 1 ? 's' : ''} com stock baixo
              </p>
            </div>
          )}

          {stocksLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!stocksLoading && (!stocks || stocks.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum produto atribuído</p>
            </div>
          )}

          <div className="space-y-2">
            {stocks?.map(stock => {
              const low = stock.quantity <= stock.minQuantity;
              const isOpen = expanded === stock.id;

              return (
                <div key={stock.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden ${low ? 'border-red-200' : 'border-gray-100'}`}
                >
                  <button type="button"
                    onClick={() => setExpanded(isOpen ? null : stock.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{stock.product?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Stock: <span className={`font-semibold ${low ? 'text-red-500' : 'text-gray-600'}`}>
                          {stock.quantity}
                        </span> {stock.product?.unit}
                        {stock.minQuantity > 0 && ` · mín. ${stock.minQuantity} ${stock.product?.unit}`}
                      </p>
                    </div>
                    {low && (
                      <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        Stock baixo
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">Reportar falta de <strong>{stock.product?.name}</strong>:</p>
                      <div className="flex gap-2 items-center">
                        <label className="text-sm text-gray-600 shrink-0">Quantidade em falta:</label>
                        <input type="number" min={1} placeholder="ex: 5"
                          value={quantities[stock.id] ?? ''}
                          onChange={e => setQuantities(prev => ({ ...prev, [stock.id]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-400 shrink-0">{stock.product?.unit}</span>
                      </div>
                      <input
                        value={notes[stock.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [stock.id]: e.target.value }))}
                        placeholder="Nota (opcional)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button"
                        onClick={() => report({ stock })}
                        disabled={isPending}
                        className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Send size={14} />
                        {isPending ? 'A enviar...' : 'Reportar falta'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Os meus pedidos ── */}
      {tab === 'orders' && (
        <div className="p-4 space-y-3">
          {reportsLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!reportsLoading && (!myReports || myReports.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <List size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum pedido feito ainda</p>
              <button type="button" onClick={() => setTab('report')}
                className="mt-3 text-sm text-blue-600 font-medium">
                Reportar uma falta
              </button>
            </div>
          )}

          {myReports?.map(r => {
            const cfg = statusConfig[r.status];
            const Icon = cfg.icon;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-800 text-sm leading-snug">
                    {r.stock?.product?.name ?? '—'}
                  </p>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color} shrink-0`}>
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {r.quantity != null && (
                    <span>{r.quantity} {r.stock?.product?.unit ?? ''} pedido{r.quantity !== 1 ? 's' : ''}</span>
                  )}
                  {r.notes && <span>· {r.notes}</span>}
                </div>

                <p className="text-xs text-gray-400">
                  {format(new Date(r.createdAt), "d 'de' MMMM 'às' HH:mm", { locale: pt })}
                </p>

                {/* Barra de progresso do estado */}
                <div className="flex items-center gap-1 pt-1">
                  {(['OPEN', 'ORDERED', 'RESOLVED'] as ReportStatus[]).map((s, i) => {
                    const steps = ['OPEN', 'ORDERED', 'RESOLVED'];
                    const currentIdx = steps.indexOf(r.status);
                    const stepIdx = steps.indexOf(s);
                    const done = stepIdx <= currentIdx;
                    return (
                      <div key={s} className="flex items-center gap-1 flex-1">
                        <div className={`h-1.5 rounded-full flex-1 ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                        {i < 2 && <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                  <span>Em aberto</span>
                  <span>Em processamento</span>
                  <span>Entregue</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
