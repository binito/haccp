'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Thermometer, Plus, Pencil, Trash2, CheckCircle, Clock,
  Download, Printer, AlertTriangle, QrCode,
} from 'lucide-react';
import ShareQrModal from '@/components/ShareQrModal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { format, subDays, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Equipment {
  id: string; name: string; type: 'FRIDGE' | 'FREEZER';
  location?: string; minTemp?: number; maxTemp?: number; clientId: string;
  client?: { id: string; name: string; };
}

interface TodayRecord { temperature: number; recordedAt: string; }

interface EquipmentWithToday extends Equipment {
  today: { morning: TodayRecord | null; evening: TodayRecord | null; };
}

interface TempRecord {
  id: string; temperature: number; session: 'MORNING' | 'EVENING';
  notes?: string; recordedAt: string;
  equipment: { id: string; name: string; type: string; minTemp?: number; maxTemp?: number; location?: string; client?: { name: string }; };
  operator: { id: string; name: string; };
}

interface EquipmentForm {
  name: string; type: 'FRIDGE' | 'FREEZER';
  location?: string; minTemp?: number; maxTemp?: number; clientId: string;
}

type TimeRange = 'week' | 'month' | '3months' | 'custom';
const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'week',     label: 'Última semana' },
  { value: 'month',    label: 'Último mês' },
  { value: '3months',  label: 'Últimos 3 meses' },
  { value: 'custom',   label: 'Personalizado' },
];

function getDateRange(range: TimeRange, customStart: string, customEnd: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (range === 'week')    return { start: fmt(subDays(today, 7)),    end: fmt(today) };
  if (range === 'month')   return { start: fmt(subMonths(today, 1)),  end: fmt(today) };
  if (range === '3months') return { start: fmt(subMonths(today, 3)),  end: fmt(today) };
  return { start: customStart, end: customEnd };
}

function tempOk(t: number, min?: number, max?: number) {
  if (min !== undefined && t < min) return false;
  if (max !== undefined && t > max) return false;
  return true;
}

function tempColor(t: number, min?: number, max?: number) {
  return tempOk(t, min, max) ? 'text-green-700' : 'text-red-600 font-bold';
}

// ─── Exportação ─────────────────────────────────────────────────────────────

function buildCsv(records: TempRecord[]) {
  const header = ['Data', 'Hora', 'Sessão', 'Equipamento', 'Tipo', 'Localização', 'Temperatura (°C)', 'Mín. Aceitável', 'Máx. Aceitável', 'Conforme', 'Operador', 'Observações'];
  const rows = records.map(r => [
    format(new Date(r.recordedAt), 'dd/MM/yyyy'),
    format(new Date(r.recordedAt), 'HH:mm'),
    r.session === 'MORNING' ? 'Manhã' : 'Tarde',
    r.equipment.name,
    r.equipment.type === 'FREEZER' ? 'Arca/Congelador' : 'Frigorífico',
    r.equipment.location ?? '',
    String(r.temperature).replace('.', ','),
    r.equipment.minTemp !== undefined ? String(r.equipment.minTemp).replace('.', ',') : '',
    r.equipment.maxTemp !== undefined ? String(r.equipment.maxTemp).replace('.', ',') : '',
    tempOk(r.temperature, r.equipment.minTemp, r.equipment.maxTemp) ? 'Sim' : 'NÃO',
    r.operator.name,
    r.notes ?? '',
  ]);
  return [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
}

function buildPrintHtml(records: TempRecord[], startDate: string, endDate: string, clientName?: string) {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  // agrupar por equipamento e depois por data
  const byEquipment = new Map<string, { eq: TempRecord['equipment']; records: TempRecord[] }>();
  records.forEach(r => {
    if (!byEquipment.has(r.equipment.id)) byEquipment.set(r.equipment.id, { eq: r.equipment, records: [] });
    byEquipment.get(r.equipment.id)!.records.push(r);
  });

  const nonConformCount = records.filter(r => !tempOk(r.temperature, r.equipment.minTemp, r.equipment.maxTemp)).length;

  const sections = Array.from(byEquipment.values()).map(({ eq, records: recs }) => {
    // agrupar por dia
    const byDay = new Map<string, TempRecord[]>();
    recs.forEach(r => {
      const day = format(new Date(r.recordedAt), 'yyyy-MM-dd');
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(r);
    });

    const rows = Array.from(byDay.entries()).map(([day, dayRecs]) => {
      const morning = dayRecs.find(r => r.session === 'MORNING');
      const evening = dayRecs.find(r => r.session === 'EVENING');
      const fmtRec = (rec?: TempRecord) => rec
        ? `${rec.temperature}°C ${!tempOk(rec.temperature, eq.minTemp, eq.maxTemp) ? '<span class="nok">⚠ Fora do intervalo</span>' : '<span class="ok">✓</span>'}<br><small>${format(new Date(rec.recordedAt), 'HH:mm')} · ${rec.operator.name}</small>`
        : '<span class="missing">—</span>';

      return `<tr>
        <td>${format(new Date(day), "EEEE, d 'de' MMMM", { locale: pt })}</td>
        <td>${fmtRec(morning)}</td>
        <td>${fmtRec(evening)}</td>
      </tr>`;
    }).join('');

    return `
    <div class="equipment-block">
      <h2>${eq.name}
        <span class="eq-type">${eq.type === 'FREEZER' ? 'Arca / Congelador' : 'Frigorífico'}${eq.location ? ' · ' + eq.location : ''}</span>
      </h2>
      ${(eq.minTemp !== undefined || eq.maxTemp !== undefined)
        ? `<p class="range">Intervalo aceitável: <b>${eq.minTemp ?? '—'}°C</b> a <b>${eq.maxTemp ?? '—'}°C</b></p>`
        : ''}
      <table>
        <thead><tr><th>Data</th><th>Manhã</th><th>Tarde</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Registo de Temperaturas</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:13px}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:16px;margin-bottom:24px}
  .logo-area h1{font-size:20px;color:#1d4ed8;margin:0}
  .logo-area p{font-size:12px;color:#6b7280;margin:4px 0 0}
  .meta-box{text-align:right;font-size:12px;color:#374151}
  .meta-box b{color:#111}
  .summary{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin-bottom:28px;display:flex;gap:40px;font-size:13px}
  .summary .s-item{text-align:center}
  .summary .s-num{font-size:22px;font-weight:800;color:#1d4ed8}
  .summary .s-nok{color:#dc2626}
  .equipment-block{margin-bottom:36px;page-break-inside:avoid}
  h2{font-size:15px;margin:0 0 4px;color:#1e3a8a}
  .eq-type{font-size:12px;font-weight:400;color:#6b7280;margin-left:8px}
  .range{font-size:12px;color:#374151;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1d4ed8;color:#fff;text-align:left;padding:8px 12px}
  td{padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .ok{color:#16a34a;font-weight:600}
  .nok{color:#dc2626;font-weight:600}
  .missing{color:#9ca3af}
  small{color:#6b7280;font-size:11px}
  footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{margin:20px}@page{margin:15mm}}
</style></head><body>
<header>
  <div class="logo-area">
    <h1>Registo de Temperaturas</h1>
    <p>${clientName ? clientName + ' · ' : ''}Período: ${format(new Date(startDate), "d 'de' MMMM yyyy", { locale: pt })} a ${format(new Date(endDate), "d 'de' MMMM yyyy", { locale: pt })}</p>
  </div>
  <div class="meta-box">
    <p><b>Total de registos:</b> ${records.length}</p>
    <p><b>Equipamentos:</b> ${byEquipment.size}</p>
    ${nonConformCount > 0 ? `<p style="color:#dc2626"><b>Não conformidades:</b> ${nonConformCount}</p>` : `<p style="color:#16a34a"><b>Não conformidades:</b> 0</p>`}
  </div>
</header>
<div class="summary">
  <div class="s-item"><div class="s-num">${records.length}</div><div>Registos</div></div>
  <div class="s-item"><div class="s-num">${byEquipment.size}</div><div>Equipamentos</div></div>
  <div class="s-item"><div class="s-num ${nonConformCount > 0 ? 's-nok' : ''}">${nonConformCount}</div><div>Não conformidades</div></div>
</div>
${sections}
<footer>
  <span>Gerado em ${now} — Sistema Patakus</span>
  <span>Documento de uso interno / Apresentar às autoridades competentes quando solicitado</span>
</footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TemperaturePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'today' | 'report'>('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showShare, setShowShare] = useState(false);

  // filtros relatório
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterEq, setFilterEq] = useState('');

  const { data: equipmentToday = [], isLoading: todayLoading } = useQuery<EquipmentWithToday[]>({
    queryKey: ['temperature-today', user?.clientId],
    queryFn: () => api.get('/temperature/today').then(r => r.data),
    enabled: !!user && tab === 'today',
    refetchInterval: 60_000,
  });

  const dateRange = getDateRange(timeRange, customStart, customEnd);
  const { data: records = [], isLoading: recLoading } = useQuery<TempRecord[]>({
    queryKey: ['temperature-records', dateRange.start, dateRange.end, filterEq],
    queryFn: () => api.get(`/temperature/records?startDate=${dateRange.start}&endDate=${dateRange.end}${filterEq ? `&equipmentId=${filterEq}` : ''}`).then(r => r.data),
    enabled: !!user && tab === 'report' && !!dateRange.start && !!dateRange.end,
  });

  const { data: allEquipment = [] } = useQuery<Equipment[]>({
    queryKey: ['temperature-equipment'],
    queryFn: () => api.get('/temperature/equipment').then(r => r.data),
    enabled: !!user,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<EquipmentForm>({
    defaultValues: { type: 'FRIDGE', clientId: user?.clientId ?? '' },
  });

  const saveMutation = useMutation({
    mutationFn: (data: EquipmentForm) =>
      editing
        ? api.patch(`/temperature/equipment/${editing.id}`, data).then(r => r.data)
        : api.post('/temperature/equipment', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temperature-today'] });
      qc.invalidateQueries({ queryKey: ['temperature-equipment'] });
      toast.success(editing ? 'Equipamento atualizado' : 'Equipamento criado');
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/temperature/equipment/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temperature-today'] });
      qc.invalidateQueries({ queryKey: ['temperature-equipment'] });
      toast.success('Equipamento eliminado');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao eliminar'),
  });

  function openNew() {
    setEditing(null);
    reset({ type: 'FRIDGE', clientId: user?.clientId ?? '' });
    setModalOpen(true);
  }

  function openEdit(eq: Equipment) {
    setEditing(eq);
    setValue('name', eq.name);
    setValue('type', eq.type);
    setValue('location', eq.location ?? '');
    setValue('minTemp', eq.minTemp ?? undefined);
    setValue('maxTemp', eq.maxTemp ?? undefined);
    setValue('clientId', eq.clientId);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); reset({ type: 'FRIDGE', clientId: user?.clientId ?? '' }); }

  function confirmDelete(eq: Equipment) {
    if (window.confirm(`Eliminar "${eq.name}"? Todos os registos históricos serão apagados.`)) {
      deleteMutation.mutate(eq.id);
    }
  }

  function exportCsv() {
    const csv = '\uFEFF' + buildCsv(records); // BOM para Excel abrir bem
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temperaturas_${dateRange.start}_${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const html = buildPrintHtml(records, dateRange.start, dateRange.end);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const nonConform = records.filter(r => !tempOk(r.temperature, r.equipment.minTemp, r.equipment.maxTemp));
  const total = equipmentToday.length;
  const complete = equipmentToday.filter(e => e.today.morning && e.today.evening).length;
  const incomplete = equipmentToday.filter(e => !e.today.morning || !e.today.evening);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Temperaturas</h1>
          <p className="text-sm text-gray-500">Controlo de arcas e frigoríficos</p>
        </div>
        {user?.role !== 'OPERATOR' && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Equipamento
          </Button>
        )}
      </div>

      {/* Banner — leituras em falta */}
      {incomplete.length > 0 && !todayLoading && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                {incomplete.length === 1
                  ? '1 equipamento sem leitura completa hoje'
                  : `${incomplete.length} equipamentos sem leitura completa hoje`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {incomplete.map(eq => (
                  <li key={eq.id} className="text-sm text-orange-700">
                    <span className="font-medium">{eq.name}</span>
                    {' — '}
                    {!eq.today.morning && !eq.today.evening
                      ? 'sem leituras'
                      : !eq.today.morning
                      ? 'falta manhã'
                      : 'falta tarde'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[{ id: 'today', label: 'Hoje' }, { id: 'report', label: 'Relatório' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Hoje ── */}
      {tab === 'today' && (
        <>
          {total > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Equipamentos', value: total, icon: Thermometer, color: 'bg-blue-100 text-blue-600' },
                { label: 'Completos hoje', value: complete, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
                { label: 'Com registos em falta', value: total - complete, icon: Clock, color: total - complete > 0 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600' },
              ].map(s => (
                <Card key={s.label}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {todayLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Card key={i}><div className="h-28 animate-pulse rounded-md bg-gray-100" /></Card>)}
            </div>
          ) : !equipmentToday.length ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Thermometer className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">Nenhum equipamento registado</p>
                {user?.role !== 'OPERATOR' && (
                  <Button variant="secondary" size="sm" className="mt-4" onClick={openNew}>Adicionar primeiro equipamento</Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {equipmentToday.map(eq => (
                <Card key={eq.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${eq.type === 'FREEZER' ? 'bg-blue-100' : 'bg-cyan-100'}`}>
                        <Thermometer className={`h-4 w-4 ${eq.type === 'FREEZER' ? 'text-blue-600' : 'text-cyan-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{eq.name}</p>
                        <p className="text-xs text-gray-400">{eq.type === 'FREEZER' ? 'Arca / Congelador' : 'Frigorífico'}{eq.location ? ` · ${eq.location}` : ''}</p>
                        {user?.role === 'SUPER_ADMIN' && eq.client && (
                          <p className="text-xs font-medium text-blue-600 truncate">{eq.client.name}</p>
                        )}
                      </div>
                    </div>
                    {user?.role !== 'OPERATOR' && (
                      <div className="flex gap-0.5 shrink-0 ml-2">
                        <button onClick={() => openEdit(eq)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirmDelete(eq)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                  {(eq.minTemp !== undefined || eq.maxTemp !== undefined) && (
                    <p className="text-xs text-gray-400 mb-3">Intervalo: {eq.minTemp ?? '—'}°C a {eq.maxTemp ?? '—'}°C</p>
                  )}
                  <div className="space-y-1.5 border-t border-gray-50 pt-3">
                    {(['morning', 'evening'] as const).map(s => {
                      const rec = eq.today[s];
                      return (
                        <div key={s} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{s === 'morning' ? 'Manhã' : 'Tarde'}</span>
                          {rec ? (
                            <span className={`text-sm ${tempColor(rec.temperature, eq.minTemp, eq.maxTemp)}`}>
                              {rec.temperature}°C
                              <span className="ml-1 text-xs font-normal text-gray-400">
                                {format(new Date(rec.recordedAt), 'HH:mm', { locale: pt })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 italic">Por registar</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Relatório ── */}
      {tab === 'report' && (
        <div className="space-y-4">
          {/* Filtros */}
          <Card>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                <select value={timeRange} onChange={e => setTimeRange(e.target.value as TimeRange)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {timeRanges.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {timeRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Equipamento</label>
                <select value={filterEq} onChange={e => setFilterEq(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todos</option>
                  {allEquipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
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
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <p className="text-2xl font-bold text-gray-900">{records.length}</p>
                <p className="text-xs text-gray-500">Registos no período</p>
              </Card>
              <Card>
                <p className="text-2xl font-bold text-green-600">{records.length - nonConform.length}</p>
                <p className="text-xs text-gray-500">Conformes</p>
              </Card>
              <Card>
                <p className={`text-2xl font-bold ${nonConform.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{nonConform.length}</p>
                <p className="text-xs text-gray-500">Não conformidades</p>
              </Card>
            </div>
          )}

          {/* Tabela */}
          <Card padding="none">
            {recLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />)}
              </div>
            ) : !records.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Thermometer className="mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm">Nenhum registo no período selecionado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-3">Data / Hora</th>
                      <th className="px-4 py-3">Sessão</th>
                      {user?.role === 'SUPER_ADMIN' && <th className="px-4 py-3">Cliente</th>}
                      <th className="px-4 py-3">Equipamento</th>
                      <th className="px-4 py-3">Temperatura</th>
                      <th className="px-4 py-3">Intervalo</th>
                      <th className="px-4 py-3">Conforme</th>
                      <th className="px-4 py-3">Operador</th>
                      <th className="px-4 py-3">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map(r => {
                      const ok = tempOk(r.temperature, r.equipment.minTemp, r.equipment.maxTemp);
                      return (
                        <tr key={r.id} className={ok ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'}>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {format(new Date(r.recordedAt), 'dd/MM/yyyy HH:mm', { locale: pt })}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {r.session === 'MORNING' ? 'Manhã' : 'Tarde'}
                          </td>
                          {user?.role === 'SUPER_ADMIN' && (
                            <td className="px-4 py-3 text-gray-500 text-xs">{r.equipment.client?.name ?? '—'}</td>
                          )}
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{r.equipment.name}</p>
                            {r.equipment.location && <p className="text-xs text-gray-400">{r.equipment.location}</p>}
                          </td>
                          <td className={`px-4 py-3 font-bold ${ok ? 'text-green-700' : 'text-red-600'}`}>
                            {r.temperature}°C
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {r.equipment.minTemp ?? '—'}°C · {r.equipment.maxTemp ?? '—'}°C
                          </td>
                          <td className="px-4 py-3">
                            {ok
                              ? <span className="text-green-600 font-semibold text-xs">✓ Sim</span>
                              : <span className="flex items-center gap-1 text-red-600 font-semibold text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Não</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{r.operator.name}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{r.notes ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        type="TEMPERATURAS"
        label={`Temperaturas: ${dateRange.start} — ${dateRange.end}`}
        params={{ startDate: dateRange.start, endDate: dateRange.end, ...(filterEq ? { equipmentId: filterEq } : {}) }}
        clientId={user?.clientId}
      />

      {/* Modal equipamento */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Equipamento' : 'Novo Equipamento'}>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <Input label="Nome *" placeholder="ex: Arca Frigorífica 1, Frigorífico Bebidas"
            error={errors.name?.message} {...register('name', { required: 'Nome obrigatório' })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select {...register('type')} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="FRIDGE">Frigorífico</option>
              <option value="FREEZER">Arca / Congelador</option>
            </select>
          </div>
          <Input label="Localização" placeholder="ex: Cozinha, Bar, Cave" {...register('location')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Temp. mínima (°C)" type="number" placeholder="ex: 2" {...register('minTemp', { valueAsNumber: true })} />
            <Input label="Temp. máxima (°C)" type="number" placeholder="ex: 8" {...register('maxTemp', { valueAsNumber: true })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'Guardar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
