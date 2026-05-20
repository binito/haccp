'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SprayCan, Plus, Trash2, Printer, CheckCircle, XCircle, QrCode } from 'lucide-react';
import ShareQrModal from '@/components/ShareQrModal';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { format, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';

type Zona = 'COZINHA' | 'PRODUCAO' | 'ARMAZEM' | 'SERVICO';

const ZONAS: { value: Zona; label: string }[] = [
  { value: 'COZINHA', label: 'Cozinha' },
  { value: 'PRODUCAO', label: 'Zona de Produção' },
  { value: 'ARMAZEM', label: 'Armazém / Balneários' },
  { value: 'SERVICO', label: 'Serviço / Sala Refeições / Inst. Sanitárias' },
];

// Itens por zona com periodicidade (D=diário, S=semanal, T=trimestral)
const ITENS_ZONA: Record<Zona, { key: string; label: string; period: 'D' | 'S' | 'T' }[]> = {
  COZINHA: [
    { key: 'fogao', label: 'Fogão', period: 'D' },
    { key: 'forno', label: 'Forno', period: 'D' },
    { key: 'fritadeira', label: 'Fritadeira', period: 'D' },
    { key: 'grelhador', label: 'Grelhador', period: 'D' },
    { key: 'exaustor', label: 'Exaustor', period: 'S' },
    { key: 'equipamentos', label: 'Equipamentos', period: 'S' },
    { key: 'maqLavarLoica', label: 'Máq. lavar loiça', period: 'S' },
    { key: 'lavatorios', label: 'Lavatórios', period: 'D' },
    { key: 'utensílios', label: 'Utensílios', period: 'D' },
    { key: 'caixotesLixo', label: 'Caixotes do Lixo', period: 'D' },
    { key: 'armarios', label: 'Armários', period: 'S' },
    { key: 'prateleiras', label: 'Prateleiras', period: 'S' },
    { key: 'gavetas', label: 'Gavetas', period: 'S' },
    { key: 'paredes', label: 'Paredes', period: 'T' },
    { key: 'teto', label: 'Teto', period: 'T' },
    { key: 'portasPuxadores', label: 'Portas/Puxadores', period: 'S' },
    { key: 'janelasVidros', label: 'Janelas/Vidros', period: 'S' },
    { key: 'superficies', label: 'Superfícies', period: 'S' },
    { key: 'bancadas', label: 'Bancadas', period: 'D' },
    { key: 'armariosProdLimpeza', label: 'Armários prod. limpeza', period: 'D' },
    { key: 'eq9', label: 'Eq. 9', period: 'S' },
    { key: 'eq10', label: 'Eq. 10', period: 'S' },
    { key: 'eq11', label: 'Eq. 11', period: 'S' },
    { key: 'eq12', label: 'Eq. 12', period: 'S' },
  ],
  PRODUCAO: [
    { key: 'pavimento', label: 'Pavimento', period: 'D' },
    { key: 'equipamentos', label: 'Equipamentos', period: 'S' },
    { key: 'utensilios', label: 'Utensílios', period: 'S' },
    { key: 'lavatorios', label: 'Lavatórios', period: 'D' },
    { key: 'bancadas', label: 'Bancadas', period: 'D' },
    { key: 'superficies', label: 'Superfícies', period: 'S' },
    { key: 'paredesTeto', label: 'Paredes/Teto', period: 'S' },
    { key: 'forno', label: 'Forno', period: 'D' },
    { key: 'janelasVidros', label: 'Janelas/Vidros', period: 'S' },
    { key: 'estantes', label: 'Estantes/Prateleiras', period: 'S' },
    { key: 'gavetas', label: 'Gavetas', period: 'S' },
    { key: 'armarios', label: 'Armários', period: 'S' },
    { key: 'caixotesLixo', label: 'Caixotes do Lixo', period: 'D' },
    { key: 'eq1', label: 'Eq. 1', period: 'S' },
    { key: 'eq2', label: 'Eq. 2', period: 'S' },
    { key: 'eq3', label: 'Eq. 3', period: 'S' },
    { key: 'zonaLavagemSuperficies', label: 'Lavagem - Superfícies', period: 'D' },
    { key: 'zonaLavagemTeto', label: 'Lavagem - Teto', period: 'S' },
    { key: 'zonaLavagemParedes', label: 'Lavagem - Paredes', period: 'S' },
    { key: 'zonaLavagemJanelas', label: 'Lavagem - Janelas/Vidros', period: 'S' },
    { key: 'zonaLavagemBancadas', label: 'Lavagem - Bancadas', period: 'D' },
    { key: 'eq4', label: 'Eq. 4', period: 'S' },
  ],
  ARMAZEM: [
    { key: 'pavimentoArmazem', label: 'Pavimento (Armazém)', period: 'D' },
    { key: 'equipamentosArmazem', label: 'Equipamentos (Armazém)', period: 'S' },
    { key: 'utensiliosArmazem', label: 'Utensílios', period: 'S' },
    { key: 'superficiesArmazem', label: 'Superfícies', period: 'D' },
    { key: 'bancadasArmazem', label: 'Bancadas', period: 'D' },
    { key: 'lavatoriosArmazem', label: 'Lavatórios', period: 'D' },
    { key: 'paredesArmazem', label: 'Paredes', period: 'S' },
    { key: 'caixotesLixoArmazem', label: 'Caixotes do Lixo', period: 'D' },
    { key: 'janelasArmazem', label: 'Janelas', period: 'S' },
    { key: 'vidrosArmazem', label: 'Vidros', period: 'S' },
    { key: 'prateleirasArmazem', label: 'Prateleiras/Estantes', period: 'S' },
    { key: 'estantesEscritorio', label: 'Estantes (Escritório)', period: 'S' },
    { key: 'eq19', label: 'Eq. 19', period: 'S' },
    { key: 'eq20', label: 'Eq. 20', period: 'S' },
    { key: 'eq21', label: 'Eq. 21', period: 'S' },
    { key: 'eq22', label: 'Eq. 22', period: 'S' },
    { key: 'eq23', label: 'Eq. 23', period: 'S' },
    { key: 'pavimentoBalneiros', label: 'Pavimento (Balneários)', period: 'D' },
    { key: 'loucasBalneiros', label: 'Louças (Balneários)', period: 'D' },
    { key: 'sanitariosBalneiros', label: 'Inst. Sanitárias', period: 'D' },
    { key: 'espelhos', label: 'Espelhos', period: 'S' },
  ],
  SERVICO: [
    { key: 'pavimentoServico', label: 'Pavimentos', period: 'D' },
    { key: 'superficiesServico', label: 'Superfícies', period: 'D' },
    { key: 'bancadasServico', label: 'Bancadas', period: 'D' },
    { key: 'mesasCadeiras', label: 'Mesas/Cadeiras', period: 'D' },
    { key: 'equipamentosServico', label: 'Equipamentos', period: 'S' },
    { key: 'utensiliosServico', label: 'Utensílios', period: 'D' },
    { key: 'maqLavarLoicaServico', label: 'Máq. lavar loiça', period: 'S' },
    { key: 'lavatoriosServico', label: 'Lavatórios', period: 'D' },
    { key: 'caixotesLixoServico', label: 'Caixotes do Lixo', period: 'D' },
    { key: 'eq5', label: 'Eq. 5', period: 'S' },
    { key: 'eq6', label: 'Eq. 6', period: 'S' },
    { key: 'eq7', label: 'Eq. 7', period: 'S' },
    { key: 'eq8', label: 'Eq. 8', period: 'S' },
    { key: 'mesasSalaRefeicoes', label: 'Sala - Mesas', period: 'D' },
    { key: 'cadeirasEsotantesSala', label: 'Sala - Cadeiras/Estantes', period: 'S' },
    { key: 'paredesTeto', label: 'Sala - Paredes/Teto', period: 'S' },
    { key: 'vidrosJanelas', label: 'Sala - Vidros/Janelas', period: 'S' },
    { key: 'portasPuxadoresSala', label: 'Sala - Portas/Puxadores', period: 'S' },
    { key: 'pavimentoSan', label: 'San. - Pavimento', period: 'D' },
    { key: 'loucasSan', label: 'San. - Louças', period: 'D' },
    { key: 'paredesSan', label: 'San. - Paredes', period: 'S' },
    { key: 'espelhosSan', label: 'San. - Espelhos', period: 'S' },
  ],
};

const PERIOD_LABELS = { D: 'Diário', S: 'Semanal', T: 'Trimestral' };
const PERIOD_COLORS = {
  D: 'bg-green-500/15 text-green-400',
  S: 'bg-blue-100 text-blue-700',
  T: 'bg-purple-100 text-purple-700',
};

interface HigienizacaoRecord {
  id: string;
  zona: Zona;
  dia: string;
  itens: Record<string, boolean>;
  observacoes?: string;
  operator: { id: string; name: string };
}

export default function HigienizacaoPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [zona, setZona] = useState<Zona>('COZINHA');
  const [modalOpen, setModalOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));

  // itens checked no modal
  const [itens, setItens] = useState<Record<string, boolean>>({});
  const [diaModal, setDiaModal] = useState(() => new Date().toISOString().split('T')[0]);
  const [obsModal, setObsModal] = useState('');

  const startDate = `${mes}-01`;
  const endDate = (() => {
    const [y, m] = mes.split('-').map(Number);
    return format(new Date(y, m, 0), 'yyyy-MM-dd');
  })();

  const { data: records = [], isLoading } = useQuery<HigienizacaoRecord[]>({
    queryKey: ['registos-higienizacao', zona, startDate, endDate],
    queryFn: () =>
      api.get(`/registos/higienizacao?zona=${zona}&startDate=${startDate}&endDate=${endDate}`).then(r => r.data.data),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/registos/higienizacao', { zona, dia: diaModal, itens, observacoes: obsModal || undefined }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registos-higienizacao'] });
      toast.success('Registo guardado');
      setModalOpen(false);
      setItens({}); setObsModal('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/registos/higienizacao/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registos-higienizacao'] }); toast.success('Eliminado'); },
  });

  function openModal() {
    const defaults: Record<string, boolean> = {};
    ITENS_ZONA[zona].forEach(i => { defaults[i.key] = false; });
    setItens(defaults);
    setDiaModal(new Date().toISOString().split('T')[0]);
    setObsModal('');
    setModalOpen(true);
  }

  function printReport() {
    const zonaLabel = ZONAS.find(z => z.value === zona)?.label ?? zona;
    const itensZona = ITENS_ZONA[zona];
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const rows = records.map(r => {
      const cols = itensZona.map(item => `<td class="${r.itens[item.key] ? 'ok' : 'nok'}">${r.itens[item.key] ? '✓' : '—'}</td>`).join('');
      return `<tr><td>${format(new Date(r.dia), 'dd/MM')}</td>${cols}<td>${r.operator.name}</td></tr>`;
    }).join('');
    const headers = itensZona.map(i => `<th title="${PERIOD_LABELS[i.period]}">${i.label}<br/><small>${i.period}</small></th>`).join('');
    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/><title>Higienização - ${zonaLabel}</title>
<style>body{font-family:Arial,sans-serif;margin:30px;font-size:10px}h1{font-size:16px;color:#1d4ed8;margin-bottom:4px}
.sub{color:#6b7280;margin-bottom:16px;font-size:11px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:center}
th{background:#1d4ed8;color:#fff;font-size:9px}td:first-child{font-weight:600;background:#f9fafb}
.ok{color:#16a34a;font-weight:700}.nok{color:#9ca3af}
small{font-size:8px}@media print{@page{margin:10mm;size:landscape}}</style></head><body>
<h1>Registo de Higienização — ${zonaLabel}</h1>
<p class="sub">Mês: ${format(new Date(startDate), 'MMMM yyyy', { locale: pt })} — Gerado em ${now} — Sistema HACCP</p>
<table><thead><tr><th>Dia</th>${headers}<th>Operador</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  const itensZona = ITENS_ZONA[zona];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Registo de Higienização</h1>
          <p className="text-sm text-gray-500">Controlo de higienização por zona (R3)</p>
        </div>
        <Button onClick={openModal} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Registo
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Zona</label>
            <select value={zona} onChange={e => setZona(e.target.value as Zona)}
              className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {ZONAS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Mês</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" className="gap-2" onClick={() => setShowShare(true)} disabled={!records.length}>
              <QrCode className="h-4 w-4" /> Partilhar
            </Button>
            <Button className="gap-2" onClick={printReport} disabled={!records.length}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Legenda periodicidade */}
      <div className="flex gap-2">
        {Object.entries(PERIOD_LABELS).map(([k, v]) => (
          <span key={k} className={`text-xs px-2 py-1 rounded-full font-medium ${PERIOD_COLORS[k as 'D' | 'S' | 'T']}`}>{k} — {v}</span>
        ))}
      </div>

      {/* Tabela */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface-3" />)}</div>
        ) : !records.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <SprayCan className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum registo este mês para esta zona</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={openModal}>Adicionar registo</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead className="border-b border-border/50 bg-surface-1">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Dia</th>
                  {itensZona.map(item => (
                    <th key={item.key} className="px-2 py-2 font-medium text-gray-500 text-center">
                      <span className="block" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 80, minWidth: 20 }}>
                        {item.label}
                      </span>
                      <span className={`mt-1 inline-block text-[9px] px-1 rounded ${PERIOD_COLORS[item.period]}`}>{item.period}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium text-gray-500">Operador</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-surface-1">
                    <td className="px-3 py-2 font-medium text-gray-300 whitespace-nowrap">
                      {format(new Date(r.dia), 'dd MMM', { locale: pt })}
                    </td>
                    {itensZona.map(item => (
                      <td key={item.key} className="px-2 py-2 text-center">
                        {r.itens[item.key]
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" />
                          : <XCircle className="h-3.5 w-3.5 text-gray-200 mx-auto" />}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-gray-500">{r.operator.name}</td>
                    <td className="px-3 py-2">
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

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Novo Registo — ${ZONAS.find(z => z.value === zona)?.label}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Data *</label>
              <input type="date" value={diaModal} onChange={e => setDiaModal(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">Itens higienizados</p>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-3">
              {itensZona.map(item => (
                <label key={item.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-surface-1 rounded px-2">
                  <input type="checkbox" checked={itens[item.key] ?? false}
                    onChange={e => setItens(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="h-4 w-4 rounded text-blue-600" />
                  <span className="text-sm text-gray-300 flex-1">{item.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PERIOD_COLORS[item.period]}`}>{item.period}</span>
                </label>
              ))}
            </div>
            <button onClick={() => {
              const all = itensZona.every(i => itens[i.key]);
              const next: Record<string, boolean> = {};
              itensZona.forEach(i => { next[i.key] = !all; });
              setItens(next);
            }} className="mt-2 text-xs text-blue-600 hover:underline">
              {itensZona.every(i => itens[i.key]) ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Observações</label>
            <textarea value={obsModal} onChange={e => setObsModal(e.target.value)} rows={2}
              placeholder="Opcional"
              className="w-full rounded-md border border-border bg-surface-2 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Guardar Registo</Button>
          </div>
        </div>
      </Modal>

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        type="HIGIENIZACAO"
        label={`Higienização (${zona}) — ${mes}`}
        params={{ startDate, endDate, zona }}
        clientId={user?.clientId}
      />
    </div>
  );
}
