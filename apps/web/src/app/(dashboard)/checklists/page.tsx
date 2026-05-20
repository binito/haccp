'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, ClipboardCheck, Plus, Trash2, GripVertical,
  Eye, Download, Printer, CheckCircle2, XCircle, Pencil, Star, QrCode,
} from 'lucide-react';
import ShareQrModal from '@/components/ShareQrModal';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { ChecklistTemplate, Area } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import toast from 'react-hot-toast';

const freqLabel: Record<string, string> = {
  DAILY: 'Diária', WEEKLY: 'Semanal', MONTHLY: 'Mensal',
};
const freqColor: Record<string, string> = {
  DAILY: 'bg-blue-100 text-blue-700',
  WEEKLY: 'bg-purple-100 text-purple-700',
  MONTHLY: 'bg-orange-100 text-orange-700',
};

type TimeRange = 'all' | 'today' | 'week' | 'month' | '3months';
const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mês' },
  { value: '3months', label: 'Últimos 3 meses' },
];

interface TaskDraft { id: string; description: string; }

interface TaskResult {
  id: string; done: boolean; notes?: string;
  task: { id: string; description: string; order: number };
}

interface EntryDetail {
  id: string; completedAt: string; notes?: string;
  templateId: string; areaId: string; operatorId: string;
  template: { name: string; frequency: string; tasks: { id: string; description: string; order: number }[] };
  area: { name: string };
  operator: { name: string; email: string };
  taskResults: TaskResult[];
}

interface EntryRow {
  id: string; completedAt: string; notes?: string;
  templateId: string; areaId: string; operatorId: string;
  template?: { name: string; frequency: string };
  area?: { name: string };
  operator?: { name: string };
  taskResults?: TaskResult[];
}

// ─── helpers de exportação ────────────────────────────────────────────────────

function buildCsvRows(entries: EntryRow[]) {
  const rows: string[][] = [];
  entries.forEach((ex, idx) => {
    if (idx > 0) rows.push([]);
    rows.push(['Checklist', ex.template?.name ?? '']);
    rows.push(['Área', ex.area?.name ?? '']);
    rows.push(['Operador', ex.operator?.name ?? '']);
    rows.push(['Data/Hora', format(new Date(ex.completedAt), 'dd/MM/yyyy HH:mm:ss')]);
    if (ex.notes) rows.push(['Notas', ex.notes]);
    rows.push([]);
    rows.push(['Tarefa', 'Estado', 'Notas']);
    (ex.taskResults ?? []).forEach(r => rows.push([
      r.task?.description ?? '',
      r.done ? 'Concluída' : 'Não concluída',
      r.notes ?? '',
    ]));
  });
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function buildPrintHtml(entries: EntryRow[]) {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const sections = entries.map(ex => {
    const done = (ex.taskResults ?? []).filter(r => r.done).length;
    const total = (ex.taskResults ?? []).length;
    return `
    <div class="entry">
      <h2>${ex.template?.name ?? ''}</h2>
      <div class="meta">
        <span><b>Área:</b> ${ex.area?.name ?? ''}</span>
        <span><b>Operador:</b> ${ex.operator?.name ?? ''}</span>
        <span><b>Data/Hora:</b> ${format(new Date(ex.completedAt), "dd/MM/yyyy 'às' HH:mm:ss")}</span>
        <span><b>Progresso:</b> ${done}/${total}</span>
        ${ex.notes ? `<span><b>Notas:</b> ${ex.notes}</span>` : ''}
      </div>
      <table>
        <thead><tr><th>#</th><th>Tarefa</th><th>Estado</th><th>Notas</th></tr></thead>
        <tbody>
          ${(ex.taskResults ?? []).map((r, i) => `
          <tr class="${r.done ? 'done-row' : 'fail-row'}">
            <td>${i + 1}</td>
            <td>${r.task?.description ?? ''}</td>
            <td class="${r.done ? 'done' : 'notdone'}">${r.done ? '✓ Concluída' : '✗ Não concluída'}</td>
            <td>${r.notes ?? ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }).join('<div class="page-break"></div>');

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Relatório Checklists</title>
<style>
  body{font-family:Arial,sans-serif;margin:36px;color:#111;font-size:13px}
  h1{font-size:18px;margin-bottom:24px;color:#1d4ed8}
  h2{font-size:15px;margin:0 0 8px}
  .meta{display:flex;flex-wrap:wrap;gap:8px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#374151}
  .entry{margin-bottom:32px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  th{background:#f3f4f6;text-align:left;padding:7px 10px;border-bottom:2px solid #e5e7eb}
  td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .done-row td{background:#f0fdf4}
  .fail-row td{background:#fff5f5}
  .done{color:#16a34a;font-weight:600}
  .notdone{color:#dc2626}
  .page-break{page-break-after:always;margin:32px 0;border-top:1px dashed #d1d5db}
  footer{margin-top:24px;font-size:11px;color:#9ca3af}
  @media print{.page-break{page-break-after:always}}
</style></head><body>
<h1>Relatório de Checklists — HACCP</h1>
${sections}
<footer>Gerado em ${now} — HACCP</footer>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ChecklistsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [showShare, setShowShare] = useState(false);
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ChecklistTemplate | null>(null);
  const [reportEntry, setReportEntry] = useState<EntryDetail | null>(null);

  // filtros do histórico
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [filterTemplate, setFilterTemplate] = useState('');

  // multi-selecção
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const taskSeq = useRef(1);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('DAILY');
  const [areaId, setAreaId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [tasks, setTasks] = useState<TaskDraft[]>([{ id: 't-0', description: '' }]);

  const { data: templates, isLoading: tplLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get('/checklists/templates').then(r => r.data),
    enabled: tab === 'templates',
  });

  const { data: executions, isLoading: execLoading } = useQuery<EntryRow[]>({
    queryKey: ['checklist-entries'],
    queryFn: () => api.get('/checklists/entries').then(r => r.data),
    enabled: tab === 'history',
  });

  const { data: areas } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => api.get('/areas').then(r => r.data),
  });

  // ── execuções filtradas (calculado directamente, sem memo) ────────────────
  const getFiltered = (): EntryRow[] => {
    if (!executions) return [];
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cutoffs: Record<string, number> = {
      week: now - 7 * 86400000,
      month: now - 30 * 86400000,
      '3months': now - 90 * 86400000,
    };
    return executions.filter(ex => {
      const t = new Date(ex.completedAt).getTime();
      if (timeRange === 'today' && t < todayStart.getTime()) return false;
      if (timeRange === 'week' && t < cutoffs.week) return false;
      if (timeRange === 'month' && t < cutoffs.month) return false;
      if (timeRange === '3months' && t < cutoffs['3months']) return false;
      if (filterTemplate && ex.templateId !== filterTemplate) return false;
      return true;
    });
  };
  const filtered = getFiltered();

  const allSelected = filtered.length > 0 && filtered.every(ex => selected.has(ex.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(ex => ex.id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── mutações ──────────────────────────────────────────────────────────────
  const { mutate: createTemplate, isPending } = useMutation({
    mutationFn: () => api.post('/checklists/templates', {
      name, frequency, areaId,
      isDefault: isSuperAdmin ? isDefault : undefined,
      tasks: tasks.filter(t => t.description.trim()).map((t, i) => ({ description: t.description.trim(), order: i + 1 })),
    }),
    onSuccess: () => { toast.success('Template criado!'); qc.invalidateQueries({ queryKey: ['checklist-templates'] }); closeModal(); },
    onError: () => toast.error('Erro ao criar template'),
  });

  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: () => api.patch(`/checklists/templates/${editingTemplate!.id}`, {
      name, frequency, areaId,
      isDefault: isSuperAdmin ? isDefault : undefined,
      tasks: tasks.filter(t => t.description.trim()).map((t, i) => ({ description: t.description.trim(), order: i + 1 })),
    }),
    onSuccess: () => { toast.success('Template actualizado!'); qc.invalidateQueries({ queryKey: ['checklist-templates'] }); closeModal(); },
    onError: () => toast.error('Erro ao actualizar template'),
  });

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/checklists/templates/${id}`),
    onSuccess: () => { toast.success('Template eliminado'); qc.invalidateQueries({ queryKey: ['checklist-templates'] }); setDeleteConfirm(null); },
    onError: () => toast.error('Erro ao eliminar template'),
  });

  const openEdit = (tpl: ChecklistTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name); setFrequency(tpl.frequency); setAreaId(tpl.areaId);
    setIsDefault(tpl.isDefault ?? false);
    setTasks(tpl.tasks?.map(t => ({ id: t.id, description: t.description })) ?? [{ id: `t-${taskSeq.current++}`, description: '' }]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false); setEditingTemplate(null);
    setName(''); setFrequency('DAILY'); setAreaId(''); setIsDefault(false);
    setTasks([{ id: `t-${taskSeq.current++}`, description: '' }]);
  };

  const addTask = () => setTasks(prev => [...prev, { id: `t-${taskSeq.current++}`, description: '' }]);
  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const updateTask = (id: string, description: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, description } : t));
  const canSubmit = name.trim() && areaId && tasks.some(t => t.description.trim());

  // ── ver relatório individual ──────────────────────────────────────────────
  const openReport = async (id: string) => {
    try {
      const res = await api.get(`/checklists/entries/${id}`);
      setReportEntry(res.data);
    } catch {
      toast.error('Erro ao carregar relatório');
    }
  };

  // ── exportar individual ───────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!reportEntry) return;
    const csv = buildCsvRows([reportEntry as unknown as EntryRow]);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist_${reportEntry.template.name.replace(/\s+/g, '_')}_${format(new Date(reportEntry.completedAt), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportEntry]);

  const printReport = useCallback(() => {
    if (!reportEntry) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintHtml([reportEntry as unknown as EntryRow]));
    w.document.close(); w.focus(); w.print();
  }, [reportEntry]);

  // ── exportar múltiplos ────────────────────────────────────────────────────
  const exportSelectedCsv = () => {
    const entries = filtered.filter(ex => selected.has(ex.id));
    const csv = buildCsvRows(entries);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklists_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSelected = () => {
    const entries = filtered.filter(ex => selected.has(ex.id));
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintHtml(entries));
    w.document.close(); w.focus(); w.print();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Checklists</h1>
          <p className="text-sm text-gray-500">Templates e histórico de execuções</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(['templates', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-primary-400 text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'templates' ? <ClipboardList className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
            {t === 'templates' ? 'Templates' : 'Histórico'}
          </button>
        ))}
      </div>

      {/* ── Tab Templates ── */}
      {tab === 'templates' && (
        <div>
          {tplLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><div className="h-20 animate-pulse rounded-md bg-surface-3" /></Card>
              ))}
            </div>
          ) : !templates?.length ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ClipboardList className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">Nenhum template criado</p>
                <button onClick={() => setModalOpen(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                  Criar primeiro template
                </button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map(tpl => (
                <Card key={tpl.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-gray-100 leading-snug">{tpl.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(tpl)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteConfirm(tpl)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${freqColor[tpl.frequency] ?? 'bg-surface-3 text-gray-400'}`}>
                      {freqLabel[tpl.frequency] ?? tpl.frequency}
                    </span>
                    <span className="text-xs text-gray-400">{tpl.tasks?.length ?? 0} tarefas</span>
                    {tpl.isDefault && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        <Star className="h-3 w-3" /> Padrão
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Histórico ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {/* intervalo de tempo */}
            <div className="flex gap-1.5 flex-wrap">
              {timeRangeOptions.map(opt => (
                <button type="button" key={opt.value} onClick={() => { setTimeRange(opt.value); setSelected(new Set()); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    timeRange === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-2 border border-border text-gray-400 hover:bg-surface-1'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* filtro por template */}
            {executions && executions.length > 0 && (
              <select
                value={filterTemplate}
                onChange={e => { setFilterTemplate(e.target.value); setSelected(new Set()); }}
                className="rounded-lg border border-border px-3 py-1 text-xs bg-surface-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todas as checklists</option>
                {Array.from(new Map(executions.map(ex => [ex.templateId, ex.template?.name ?? ex.templateId]))).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={() => setShowShare(true)}
              disabled={!filtered.length}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-surface-1 disabled:opacity-40"
            >
              <QrCode className="h-3.5 w-3.5" /> Partilhar
            </button>
          </div>

          {/* Barra de acções quando há selecção */}
          {someSelected && (
            <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
              <span className="text-sm font-medium text-blue-700">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={exportSelectedCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-surface-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
                <button onClick={printSelected}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700 ml-1">
                  Limpar
                </button>
              </div>
            </div>
          )}

          <Card padding="none">
            {execLoading ? (
              <div className="space-y-px p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-surface-3" />
                ))}
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ClipboardCheck className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">Nenhuma execução encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50 bg-surface-1">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-3">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll}
                          className="rounded border-border text-blue-600 focus:ring-primary-500 cursor-pointer" />
                      </th>
                      <th className="px-4 py-3">Checklist</th>
                      <th className="px-4 py-3">Área</th>
                      <th className="px-4 py-3">Executado por</th>
                      <th className="px-4 py-3">Data/Hora</th>
                      <th className="px-4 py-3">Tarefas</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filtered.map(ex => {
                      const doneCount = ex.taskResults?.filter(r => r.done).length ?? 0;
                      const total = ex.taskResults?.length ?? 0;
                      const isSelected = selected.has(ex.id);
                      return (
                        <tr key={ex.id} className={`hover:bg-surface-1 ${isSelected ? 'bg-blue-50/60' : ''}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleOne(ex.id)}
                              className="rounded border-border text-blue-600 focus:ring-primary-500 cursor-pointer" />
                          </td>
                          <td className="px-4 py-4 font-medium text-gray-100">{ex.template?.name ?? '—'}</td>
                          <td className="px-4 py-4 text-gray-500">{ex.area?.name ?? '—'}</td>
                          <td className="px-4 py-4 text-gray-500">{ex.operator?.name ?? '—'}</td>
                          <td className="px-4 py-4 text-gray-500">
                            {format(new Date(ex.completedAt), "d MMM yyyy 'às' HH:mm", { locale: pt })}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-xs font-medium ${doneCount === total && total > 0 ? 'text-green-600' : 'text-orange-500'}`}>
                              {doneCount}/{total}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <button onClick={() => openReport(ex.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800">
                              <Eye className="h-3.5 w-3.5" /> Ver
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
        </div>
      )}

      {/* Modal criar/editar template */}
      <Modal open={modalOpen} onClose={closeModal} title={editingTemplate ? 'Editar Template' : 'Novo Template de Checklist'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Limpeza diária cozinha"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Área *</label>
              <select value={areaId} onChange={e => setAreaId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-2">
                <option value="">Seleccionar...</option>
                {areas?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Frequência</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-2">
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Tarefas *</label>
              <button onClick={addTask} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <Plus className="h-3 w-3" /> Adicionar tarefa
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {tasks.map((task, i) => (
                <div key={task.id} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                  <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                  <input value={task.description} onChange={e => updateTask(task.id, e.target.value)}
                    placeholder="Descrição da tarefa"
                    className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} />
                  {tasks.length > 1 && (
                    <button onClick={() => removeTask(task.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-amber-900">Template padrão</p>
                <p className="text-xs text-amber-700">Clonado automaticamente para novos clientes</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDefault(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDefault ? 'bg-amber-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-surface-2 shadow transition-transform ${isDefault ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
            {editingTemplate
              ? <Button onClick={() => saveEdit()} loading={isSaving} disabled={!canSubmit}>Guardar alterações</Button>
              : <Button onClick={() => createTemplate()} loading={isPending} disabled={!canSubmit}>Criar Template</Button>}
          </div>
        </div>
      </Modal>

      {/* Modal confirmação eliminar */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Eliminar Template" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Tens a certeza que queres eliminar <span className="font-semibold">"{deleteConfirm?.name}"</span>?
            Esta acção não pode ser revertida.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <button onClick={() => deleteConfirm && deleteTemplate(deleteConfirm.id)} disabled={isDeleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'A eliminar...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal relatório individual */}
      {reportEntry && (
        <Modal open={!!reportEntry} onClose={() => setReportEntry(null)} title="Relatório de Checklist" size="lg">
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-1 border border-border p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">Checklist:</span> <span className="font-medium">{reportEntry.template.name}</span></div>
              <div><span className="text-gray-500">Área:</span> <span className="font-medium">{reportEntry.area.name}</span></div>
              <div><span className="text-gray-500">Operador:</span> <span className="font-medium">{reportEntry.operator.name}</span></div>
              <div><span className="text-gray-500">Data/Hora:</span> <span className="font-medium">
                {format(new Date(reportEntry.completedAt), "d MMM yyyy 'às' HH:mm:ss", { locale: pt })}
              </span></div>
              {reportEntry.notes && (
                <div className="col-span-2"><span className="text-gray-500">Notas:</span> <span className="font-medium">{reportEntry.notes}</span></div>
              )}
              <div className="col-span-2">
                <span className="text-gray-500">Progresso:</span>{' '}
                <span className={`font-semibold ${reportEntry.taskResults.filter(r => r.done).length === reportEntry.taskResults.length ? 'text-green-600' : 'text-orange-500'}`}>
                  {reportEntry.taskResults.filter(r => r.done).length}/{reportEntry.taskResults.length} tarefas concluídas
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 border-b border-border">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Tarefa</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reportEntry.taskResults.map((r, i) => (
                    <tr key={r.id} className={r.done ? 'bg-green-50/40' : 'bg-red-50/40'}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 text-gray-800">{r.task.description}</td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${r.done ? 'text-green-600' : 'text-red-500'}`}>
                          {r.done ? <><CheckCircle2 className="h-3.5 w-3.5" /> Concluída</> : <><XCircle className="h-3.5 w-3.5" /> Não concluída</>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
              <Button variant="ghost" onClick={() => setReportEntry(null)}>Fechar</Button>
              <button onClick={exportCsv}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-300 hover:bg-surface-1">
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
              <button onClick={printReport}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        type="CHECKLISTS"
        label={`Checklists — ${timeRangeOptions.find(o => o.value === timeRange)?.label ?? 'Todos'}`}
        params={(() => {
          const now = new Date();
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          if (timeRange === 'today') return { startDate: fmt(now), endDate: fmt(now) };
          if (timeRange === 'week') return { startDate: fmt(new Date(Date.now() - 7 * 86400000)), endDate: fmt(now) };
          if (timeRange === 'month') return { startDate: fmt(new Date(Date.now() - 30 * 86400000)), endDate: fmt(now) };
          if (timeRange === '3months') return { startDate: fmt(new Date(Date.now() - 90 * 86400000)), endDate: fmt(now) };
          return {};
        })()}
        clientId={user?.clientId}
      />
    </div>
  );
}
