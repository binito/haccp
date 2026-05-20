'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Plus, Trash2, Download, Printer, QrCode } from 'lucide-react';
import ShareQrModal from '@/components/ShareQrModal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { format, subDays, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

interface OleoRecord {
  id: string;
  data: string;
  fritadeira: string;
  temperatura: number;
  resultado: number; // 1-5
  acoes?: string;
  responsavel: { id: string; name: string };
}

interface OleoForm {
  data: string;
  fritadeira: string;
  temperatura: number;
  resultado: number;
  acoes?: string;
}

type TimeRange = 'week' | 'month' | '3months' | 'custom';

const RESULTADO_LABELS: Record<number, { label: string; desc: string; color: string; bg: string }> = {
  1: { label: '< 5%', desc: 'Bom', color: 'text-green-700', bg: 'bg-green-100' },
  2: { label: '6–12%', desc: 'Aceitável', color: 'text-lime-700', bg: 'bg-lime-100' },
  3: { label: '13–16%', desc: 'Atenção', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  4: { label: '17–23%', desc: 'Mau', color: 'text-orange-700', bg: 'bg-orange-100' },
  5: { label: '> 24%', desc: 'Substituir', color: 'text-red-700', bg: 'bg-red-100' },
};

function getDateRange(range: TimeRange, cs: string, ce: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (range === 'week') return { start: fmt(subDays(today, 7)), end: fmt(today) };
  if (range === 'month') return { start: fmt(subMonths(today, 1)), end: fmt(today) };
  if (range === '3months') return { start: fmt(subMonths(today, 3)), end: fmt(today) };
  return { start: cs, end: ce };
}

function buildPrintHtml(records: OleoRecord[]) {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const rows = records.map(r => {
    const res = RESULTADO_LABELS[r.resultado];
    return `<tr>
      <td>${format(new Date(r.data), 'dd/MM/yyyy')}</td>
      <td>${r.fritadeira}</td>
      <td>${r.temperatura}°C</td>
      <td>${r.resultado}</td>
      <td>${res.label}</td>
      <td>${res.desc}</td>
      <td>${r.acoes ?? '—'}</td>
      <td>${r.responsavel.name}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/><title>Controlo do Óleo da Fritura</title>
<style>body{font-family:Arial,sans-serif;margin:40px;font-size:12px;color:#111}
h1{font-size:16px;color:#1d4ed8}p.sub{color:#6b7280;font-size:11px;margin-bottom:20px}
table{width:100%;border-collapse:collapse}th{background:#1d4ed8;color:#fff;padding:8px;text-align:left;font-size:11px}
td{padding:7px 8px;border-bottom:1px solid #e5e7eb}footer{margin-top:24px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
@media print{body{margin:20px}@page{margin:15mm}}</style></head><body>
<h1>Controlo do Óleo da Fritura</h1>
<p class="sub">Gerado em ${now} — Sistema HACCP</p>
<table>
  <thead><tr><th>Data</th><th>Fritadeira</th><th>Temperatura</th><th>Resultado (1-5)</th><th>% Compostos Polares</th><th>Classificação</th><th>Ações</th><th>Responsável</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer>
  <span>Escala: 1=&lt;5% Bom · 2=6-12% · 3=13-16% · 4=17-23% · 5=&gt;24% Mau</span>
  <span>Documento de uso interno</span>
</footer>
</body></html>`;
}

export default function OleosPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const dateRange = getDateRange(timeRange, customStart, customEnd);

  const { data: records = [], isLoading } = useQuery<OleoRecord[]>({
    queryKey: ['registos-oleos', dateRange.start, dateRange.end],
    queryFn: () =>
      api.get(`/registos/oleos?startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.data.data),
    enabled: !!user && !!dateRange.start && !!dateRange.end,
  });

  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, reset, formState: { errors } } = useForm<OleoForm>({
    defaultValues: { data: today, resultado: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data: OleoForm) => api.post('/registos/oleos', { ...data, temperatura: Number(data.temperatura), resultado: Number(data.resultado) }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registos-oleos'] });
      toast.success('Registo guardado');
      setModalOpen(false);
      reset({ data: today, resultado: 1 });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/registos/oleos/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registos-oleos'] }); toast.success('Eliminado'); },
  });

  function exportCsv() {
    const header = ['Data', 'Fritadeira', 'Temperatura (°C)', 'Resultado (1-5)', '% Compostos Polares', 'Classificação', 'Ações', 'Responsável'];
    const rows = records.map(r => {
      const res = RESULTADO_LABELS[r.resultado];
      return [format(new Date(r.data), 'dd/MM/yyyy'), r.fritadeira, r.temperatura, r.resultado, res.label, res.desc, r.acoes ?? '', r.responsavel.name];
    });
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `oleos_${dateRange.start}_${dateRange.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const html = buildPrintHtml(records);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  const maus = records.filter(r => r.resultado >= 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Controlo do Óleo da Fritura</h1>
          <p className="text-sm text-gray-500">Controlo de compostos polares (R6)</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Registo
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Período</label>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value as TimeRange)}
              className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
              <option value="3months">Últimos 3 meses</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {timeRange === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">De</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Até</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" className="gap-2" onClick={exportCsv} disabled={!records.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => setShowShare(true)} disabled={!records.length}>
              <QrCode className="h-4 w-4" /> Partilhar
            </Button>
            <Button className="gap-2" onClick={printReport} disabled={!records.length}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Legenda escala */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(RESULTADO_LABELS).map(([k, v]) => (
          <span key={k} className={`text-xs px-2.5 py-1 rounded-full font-medium ${v.color} ${v.bg}`}>
            {k} — {v.label} {v.desc}
          </span>
        ))}
      </div>

      {records.length > 0 && maus.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>{maus.length}</strong> registo(s) com classificação Mau ou Substituir — ação imediata necessária.
        </div>
      )}

      <Card padding="none">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface-3" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Flame className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum registo no período selecionado</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>Adicionar registo</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 bg-surface-1">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Fritadeira</th>
                  <th className="px-4 py-3">Temperatura</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">Ações</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {records.map(r => {
                  const res = RESULTADO_LABELS[r.resultado];
                  return (
                    <tr key={r.id} className={r.resultado >= 4 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-surface-1'}>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{format(new Date(r.data), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3 font-medium text-gray-100">{r.fritadeira}</td>
                      <td className="px-4 py-3 text-gray-400">{r.temperatura}°C</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${res.color} ${res.bg}`}>{r.resultado}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${res.color}`}>{res.label} — {res.desc}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.acoes ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.responsavel.name}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (window.confirm('Eliminar registo?')) deleteMutation.mutate(r.id); }}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Novo Registo — Óleo de Fritura">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" type="date" error={errors.data?.message}
              {...register('data', { required: 'Campo obrigatório' })} />
            <Input label="Fritadeira *" placeholder="ex: Fritadeira 1"
              error={errors.fritadeira?.message}
              {...register('fritadeira', { required: 'Campo obrigatório' })} />
          </div>
          <Input label="Temperatura (°C) *" type="number" step="0.1" placeholder="ex: 180"
            error={errors.temperatura?.message}
            {...register('temperatura', { required: 'Campo obrigatório', valueAsNumber: true })} />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resultado (compostos polares) *</label>
            <div className="space-y-2">
              {Object.entries(RESULTADO_LABELS).map(([k, v]) => (
                <label key={k} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${v.bg} border-transparent`}>
                  <input type="radio" value={k} {...register('resultado', { required: true, valueAsNumber: true })}
                    className="h-4 w-4" />
                  <span className="flex-1">
                    <span className={`font-semibold ${v.color}`}>{k} — {v.label}</span>
                    <span className="text-gray-500 text-sm ml-2">{v.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Input label="Ações tomadas" placeholder="ex: Substituição do óleo, ajuste de temperatura"
            {...register('acoes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending}>Guardar Registo</Button>
          </div>
        </form>
      </Modal>

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        type="OLEOS"
        label={`Óleos de Fritura: ${dateRange.start} — ${dateRange.end}`}
        params={{ startDate: dateRange.start, endDate: dateRange.end }}
        clientId={user?.clientId}
      />
    </div>
  );
}
