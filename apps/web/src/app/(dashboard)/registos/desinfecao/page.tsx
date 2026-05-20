'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Trash2, Download, Printer, QrCode } from 'lucide-react';
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

interface DesinfecaoRecord {
  id: string;
  data: string;
  generosAlimenticios: string;
  nomeDesinfetante: string;
  dose: string;
  quantidadeAgua: string;
  tempoAtuacao: string;
  observacoes?: string;
  operator: { id: string; name: string };
}

interface DesinfecaoForm {
  data: string;
  generosAlimenticios: string;
  nomeDesinfetante: string;
  dose: string;
  quantidadeAgua: string;
  tempoAtuacao: string;
  observacoes?: string;
}

type TimeRange = 'week' | 'month' | '3months' | 'custom';

function getDateRange(range: TimeRange, cs: string, ce: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (range === 'week') return { start: fmt(subDays(today, 7)), end: fmt(today) };
  if (range === 'month') return { start: fmt(subMonths(today, 1)), end: fmt(today) };
  if (range === '3months') return { start: fmt(subMonths(today, 3)), end: fmt(today) };
  return { start: cs, end: ce };
}

function buildPrintHtml(records: DesinfecaoRecord[]) {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const rows = records.map(r => `<tr>
    <td>${format(new Date(r.data), 'dd/MM/yyyy')}</td>
    <td>${r.generosAlimenticios}</td>
    <td>${r.nomeDesinfetante}</td>
    <td>${r.dose}</td>
    <td>${r.quantidadeAgua}</td>
    <td>${r.tempoAtuacao}</td>
    <td>${r.operator.name}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/><title>Registo de Desinfeção</title>
<style>body{font-family:Arial,sans-serif;margin:40px;font-size:12px;color:#111}
h1{font-size:16px;color:#1d4ed8}p.sub{color:#6b7280;font-size:11px;margin-bottom:20px}
table{width:100%;border-collapse:collapse}th{background:#1d4ed8;color:#fff;padding:8px;text-align:left;font-size:11px}
td{padding:7px 8px;border-bottom:1px solid #e5e7eb}footer{margin-top:24px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
@media print{body{margin:20px}@page{margin:15mm}}</style></head><body>
<h1>Registo de Desinfeção de Produtos Destinados a Consumir Crus</h1>
<p class="sub">Gerado em ${now} — Sistema HACCP</p>
<table>
  <thead><tr><th>Data</th><th>Géneros Alimentícios</th><th>Desinfetante</th><th>Dose Aplicada</th><th>Qtd. Água</th><th>Tempo Atuação</th><th>Operador</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer><span>${records.length} registos</span><span>Documento de uso interno / Apresentar às autoridades competentes quando solicitado</span></footer>
</body></html>`;
}

export default function DesinfecaoPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const dateRange = getDateRange(timeRange, customStart, customEnd);

  const { data: records = [], isLoading } = useQuery<DesinfecaoRecord[]>({
    queryKey: ['registos-desinfecao', dateRange.start, dateRange.end],
    queryFn: () =>
      api.get(`/registos/desinfecao?startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.data.data),
    enabled: !!user && !!dateRange.start && !!dateRange.end,
  });

  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DesinfecaoForm>({
    defaultValues: { data: today },
  });

  const createMutation = useMutation({
    mutationFn: (data: DesinfecaoForm) => api.post('/registos/desinfecao', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registos-desinfecao'] });
      toast.success('Registo guardado');
      setModalOpen(false);
      reset({ data: today });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/registos/desinfecao/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registos-desinfecao'] }); toast.success('Eliminado'); },
  });

  function exportCsv() {
    const header = ['Data', 'Géneros Alimentícios', 'Desinfetante', 'Dose', 'Qtd. Água', 'Tempo Atuação', 'Observações', 'Operador'];
    const rows = records.map(r => [
      format(new Date(r.data), 'dd/MM/yyyy'),
      r.generosAlimenticios, r.nomeDesinfetante, r.dose, r.quantidadeAgua, r.tempoAtuacao,
      r.observacoes ?? '', r.operator.name,
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `desinfecao_${dateRange.start}_${dateRange.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const html = buildPrintHtml(records);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Registo de Desinfeção</h1>
          <p className="text-sm text-gray-500">Produtos destinados a consumir crus (R4)</p>
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

      <Card padding="none">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface-3" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FlaskConical className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum registo no período selecionado</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>Adicionar registo</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 bg-surface-1">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Géneros Alimentícios</th>
                  <th className="px-4 py-3">Desinfetante</th>
                  <th className="px-4 py-3">Dose</th>
                  <th className="px-4 py-3">Qtd. Água</th>
                  <th className="px-4 py-3">Tempo</th>
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-surface-1">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{format(new Date(r.data), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-medium text-gray-100">{r.generosAlimenticios}</td>
                    <td className="px-4 py-3 text-gray-400">{r.nomeDesinfetante}</td>
                    <td className="px-4 py-3 text-gray-400">{r.dose}</td>
                    <td className="px-4 py-3 text-gray-400">{r.quantidadeAgua}</td>
                    <td className="px-4 py-3 text-gray-400">{r.tempoAtuacao}</td>
                    <td className="px-4 py-3 text-gray-500">{r.operator.name}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm('Eliminar registo?')) deleteMutation.mutate(r.id); }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Novo Registo de Desinfeção">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Input label="Data *" type="date" error={errors.data?.message}
            {...register('data', { required: 'Campo obrigatório' })} />
          <Input label="Géneros Alimentícios a Desinfetar *"
            placeholder="ex: Alface, Tomate, Pepino"
            error={errors.generosAlimenticios?.message}
            {...register('generosAlimenticios', { required: 'Campo obrigatório' })} />
          <Input label="Nome do Desinfetante *"
            placeholder="ex: Hipoclorito de Sódio"
            error={errors.nomeDesinfetante?.message}
            {...register('nomeDesinfetante', { required: 'Campo obrigatório' })} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Dose Aplicada *"
              placeholder="ex: 50 mg/L"
              error={errors.dose?.message}
              {...register('dose', { required: 'Campo obrigatório' })} />
            <Input label="Qtd. de Água *"
              placeholder="ex: 5 L"
              error={errors.quantidadeAgua?.message}
              {...register('quantidadeAgua', { required: 'Campo obrigatório' })} />
            <Input label="Tempo de Atuação *"
              placeholder="ex: 5 min"
              error={errors.tempoAtuacao?.message}
              {...register('tempoAtuacao', { required: 'Campo obrigatório' })} />
          </div>
          <Input label="Observações" placeholder="Opcional" {...register('observacoes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending}>Guardar Registo</Button>
          </div>
        </form>
      </Modal>

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        type="DESINFECAO"
        label={`Desinfeção: ${dateRange.start} — ${dateRange.end}`}
        params={{ startDate: dateRange.start, endDate: dateRange.end }}
        clientId={user?.clientId}
      />
    </div>
  );
}
