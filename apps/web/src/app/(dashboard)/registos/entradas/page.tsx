'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Plus, Trash2, Download, Printer, CheckCircle, XCircle, QrCode } from 'lucide-react';
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

interface EntradaRecord {
  id: string;
  data: string;
  materiaPrima: string;
  fornecedor: string;
  faturaN?: string;
  veiculoOk: boolean;
  embalagemOk: boolean;
  rotulagemOk: boolean;
  produtoOk: boolean;
  temperatura?: number;
  lote?: string;
  observacoes?: string;
  createdAt: string;
  operator: { id: string; name: string };
}

interface EntradaForm {
  data: string;
  materiaPrima: string;
  fornecedor: string;
  faturaN?: string;
  veiculoOk: boolean;
  embalagemOk: boolean;
  rotulagemOk: boolean;
  produtoOk: boolean;
  temperatura?: number;
  lote?: string;
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

const Tick = ({ ok }: { ok: boolean }) =>
  ok
    ? <CheckCircle className="h-4 w-4 text-green-600" />
    : <XCircle className="h-4 w-4 text-red-500" />;

function buildPrintHtml(records: EntradaRecord[]) {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const nc = records.filter(r => !r.veiculoOk || !r.embalagemOk || !r.rotulagemOk || !r.produtoOk || (r.temperatura !== undefined && r.temperatura !== null && (r.temperatura > 6 || r.temperatura < -23)));
  const rows = records.map(r => {
    const conformes = [r.veiculoOk, r.embalagemOk, r.rotulagemOk, r.produtoOk];
    const allOk = conformes.every(Boolean);
    return `<tr class="${allOk ? '' : 'nok-row'}">
      <td>${format(new Date(r.data), 'dd/MM/yyyy')}</td>
      <td>${r.materiaPrima}</td>
      <td>${r.fornecedor}${r.faturaN ? ' / ' + r.faturaN : ''}</td>
      <td class="${r.veiculoOk ? 'ok' : 'nok'}">${r.veiculoOk ? 'C' : 'NC'}</td>
      <td class="${r.embalagemOk ? 'ok' : 'nok'}">${r.embalagemOk ? 'C' : 'NC'}</td>
      <td class="${r.rotulagemOk ? 'ok' : 'nok'}">${r.rotulagemOk ? 'C' : 'NC'}</td>
      <td class="${r.produtoOk ? 'ok' : 'nok'}">${r.produtoOk ? 'C' : 'NC'}</td>
      <td>${r.temperatura !== undefined && r.temperatura !== null ? r.temperatura + '°C' : '—'}</td>
      <td>${r.lote ?? '—'}</td>
      <td>${r.operator.name}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Registo de Entradas</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:12px}
  h1{font-size:18px;color:#1d4ed8;margin:0 0 4px}
  .sub{font-size:12px;color:#6b7280;margin-bottom:20px}
  .summary{display:flex;gap:32px;margin-bottom:20px;padding:10px 16px;background:#f3f4f6;border-radius:6px}
  .s-item{text-align:center}.s-num{font-size:20px;font-weight:800;color:#1d4ed8}
  .s-nok{color:#dc2626}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1d4ed8;color:#fff;padding:7px 10px;text-align:left}
  td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
  .ok{color:#16a34a;font-weight:700}.nok{color:#dc2626;font-weight:700}
  .nok-row td{background:#fef2f2}
  footer{margin-top:24px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{margin:20px}@page{margin:15mm}}
</style></head><body>
<h1>Registo de Controlo dos Produtos à Receção</h1>
<p class="sub">Rastreabilidade — Gerado em ${now} — Sistema HACCP</p>
<div class="summary">
  <div class="s-item"><div class="s-num">${records.length}</div><div>Entradas</div></div>
  <div class="s-item"><div class="s-num ${nc.length > 0 ? 's-nok' : ''}">${nc.length}</div><div>Não conformidades</div></div>
</div>
<table>
  <thead><tr><th>Data</th><th>Matéria Prima</th><th>Fornecedor / Fatura</th><th>Veículo</th><th>Embalagem</th><th>Rotulagem</th><th>Produto</th><th>Temp.</th><th>Lote</th><th>Operador</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer>
  <span>LEGENDA: C - Conforme / NC - Não Conforme</span>
  <span>Documento de uso interno / Apresentar às autoridades competentes quando solicitado</span>
</footer>
</body></html>`;
}

export default function EntradasPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const dateRange = getDateRange(timeRange, customStart, customEnd);

  const { data: records = [], isLoading } = useQuery<EntradaRecord[]>({
    queryKey: ['registos-entradas', dateRange.start, dateRange.end],
    queryFn: () =>
      api.get(`/registos/entradas?startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.data.data),
    enabled: !!user && !!dateRange.start && !!dateRange.end,
  });

  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EntradaForm>({
    defaultValues: { data: today, veiculoOk: true, embalagemOk: true, rotulagemOk: true, produtoOk: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: EntradaForm) => api.post('/registos/entradas', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registos-entradas'] });
      toast.success('Registo guardado');
      setModalOpen(false);
      reset({ data: today, veiculoOk: true, embalagemOk: true, rotulagemOk: true, produtoOk: true });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/registos/entradas/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registos-entradas'] });
      toast.success('Registo eliminado');
    },
  });

  function confirmDelete(r: EntradaRecord) {
    if (window.confirm(`Eliminar registo de "${r.materiaPrima}" de ${format(new Date(r.data), 'dd/MM/yyyy')}?`)) {
      deleteMutation.mutate(r.id);
    }
  }

  function exportCsv() {
    const header = ['Data', 'Matéria Prima', 'Fornecedor', 'Fatura', 'Veículo', 'Embalagem', 'Rotulagem', 'Produto', 'Temp.(°C)', 'Lote', 'Observações', 'Operador'];
    const rows = records.map(r => [
      format(new Date(r.data), 'dd/MM/yyyy'),
      r.materiaPrima, r.fornecedor, r.faturaN ?? '',
      r.veiculoOk ? 'C' : 'NC', r.embalagemOk ? 'C' : 'NC',
      r.rotulagemOk ? 'C' : 'NC', r.produtoOk ? 'C' : 'NC',
      r.temperatura ?? '', r.lote ?? '', r.observacoes ?? '', r.operator.name,
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `entradas_${dateRange.start}_${dateRange.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const html = buildPrintHtml(records);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  const nonConform = records.filter(r => !r.veiculoOk || !r.embalagemOk || !r.rotulagemOk || !r.produtoOk);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Registo de Entradas</h1>
          <p className="text-sm text-gray-500">Controlo dos produtos à receção (R1)</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Entrada
        </Button>
      </div>

      {/* Filtros + exportação */}
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

      {/* Sumário */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-2xl font-bold text-gray-100">{records.length}</p>
            <p className="text-xs text-gray-500">Entradas no período</p>
          </Card>
          <Card>
            <p className={`text-2xl font-bold ${nonConform.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{nonConform.length}</p>
            <p className="text-xs text-gray-500">Não conformidades</p>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface-3" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <PackageCheck className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum registo no período selecionado</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>Adicionar primeiro registo</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 bg-surface-1">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Matéria Prima</th>
                  <th className="px-4 py-3">Fornecedor / Fatura</th>
                  <th className="px-4 py-3 text-center">Veículo</th>
                  <th className="px-4 py-3 text-center">Embalagem</th>
                  <th className="px-4 py-3 text-center">Rotulagem</th>
                  <th className="px-4 py-3 text-center">Produto</th>
                  <th className="px-4 py-3">Temp.</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {records.map(r => {
                  const allOk = r.veiculoOk && r.embalagemOk && r.rotulagemOk && r.produtoOk;
                  return (
                    <tr key={r.id} className={allOk ? 'hover:bg-surface-1' : 'bg-red-50 hover:bg-red-100'}>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{format(new Date(r.data), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3 font-medium text-gray-100">{r.materiaPrima}</td>
                      <td className="px-4 py-3 text-gray-400">{r.fornecedor}{r.faturaN ? <span className="text-gray-400 text-xs ml-1">/ {r.faturaN}</span> : ''}</td>
                      <td className="px-4 py-3 text-center"><Tick ok={r.veiculoOk} /></td>
                      <td className="px-4 py-3 text-center"><Tick ok={r.embalagemOk} /></td>
                      <td className="px-4 py-3 text-center"><Tick ok={r.rotulagemOk} /></td>
                      <td className="px-4 py-3 text-center"><Tick ok={r.produtoOk} /></td>
                      <td className="px-4 py-3 text-gray-400">{r.temperatura !== undefined && r.temperatura !== null ? `${r.temperatura}°C` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.lote ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.operator.name}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => confirmDelete(r)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
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

      {/* Modal novo registo */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="Nova Entrada">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" type="date" error={errors.data?.message}
              {...register('data', { required: 'Campo obrigatório' })} />
            <Input label="Matéria Prima *" placeholder="ex: Alface, Carne de frango"
              error={errors.materiaPrima?.message}
              {...register('materiaPrima', { required: 'Campo obrigatório' })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fornecedor *" placeholder="Nome do fornecedor"
              error={errors.fornecedor?.message}
              {...register('fornecedor', { required: 'Campo obrigatório' })} />
            <Input label="Fatura N.º" placeholder="Opcional" {...register('faturaN')} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">Nível de Higiene e Segurança</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'veiculoOk', label: 'Veículo' },
                { key: 'embalagemOk', label: 'Embalagem' },
                { key: 'rotulagemOk', label: 'Rotulagem' },
                { key: 'produtoOk', label: 'Produto' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-surface-1">
                  <input type="checkbox" {...register(key as any)} className="h-4 w-4 rounded text-blue-600" />
                  <span className="text-sm text-gray-300">{label} Conforme</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Temperatura (°C)" type="number" step="0.1" placeholder="ex: 4.5"
              {...register('temperatura', { valueAsNumber: true })} />
            <Input label="Lote do Produto" placeholder="Número do lote" {...register('lote')} />
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
        type="ENTRADAS"
        label={`Entradas: ${dateRange.start} — ${dateRange.end}`}
        params={{ startDate: dateRange.start, endDate: dateRange.end }}
        clientId={user?.clientId}
      />
    </div>
  );
}
