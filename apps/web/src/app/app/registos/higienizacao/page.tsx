'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Plus, SprayCan, QrCode, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import ShareQrModal from '@/components/ShareQrModal';

interface HigienizacaoRecord {
  id: string;
  zona: string;
  dia: string;
  itens: Record<string, boolean>;
  observacoes?: string;
  operator: { name: string };
}

type Zona = 'COZINHA' | 'PRODUCAO' | 'ARMAZEM' | 'SERVICO';

const ZONAS: { key: Zona; label: string; emoji: string }[] = [
  { key: 'COZINHA', label: 'Cozinha', emoji: '🍳' },
  { key: 'PRODUCAO', label: 'Produção', emoji: '🏭' },
  { key: 'ARMAZEM', label: 'Armazém', emoji: '📦' },
  { key: 'SERVICO', label: 'Serviço', emoji: '🍽️' },
];

interface ZonaItem { key: string; label: string; period: string }
interface ZonaConfig { zona: Zona; itens: ZonaItem[] }

const DEFAULT_ITENS_ZONA: Record<Zona, ZonaItem[]> = {
  COZINHA: [
    { key: 'bancadas', label: 'Bancadas', period: 'D' },
    { key: 'fogao', label: 'Fogão', period: 'D' },
    { key: 'forno', label: 'Forno', period: 'D' },
    { key: 'fritadeira', label: 'Fritadeira', period: 'D' },
    { key: 'exaustor', label: 'Exaustor', period: 'S' },
    { key: 'equipamentos', label: 'Equipamentos', period: 'S' },
    { key: 'utensilios', label: 'Utensílios', period: 'D' },
    { key: 'lavatorios', label: 'Lavatório', period: 'D' },
    { key: 'caixotesLixo', label: 'Caixotes do Lixo', period: 'D' },
    { key: 'paredes', label: 'Paredes', period: 'T' },
    { key: 'teto', label: 'Teto', period: 'T' },
  ],
  PRODUCAO: [
    { key: 'bancadas', label: 'Bancadas', period: 'D' },
    { key: 'equipamentos', label: 'Equipamentos', period: 'S' },
    { key: 'utensilios', label: 'Utensílios', period: 'S' },
    { key: 'lavatorios', label: 'Lavatório', period: 'D' },
    { key: 'pavimento', label: 'Chão', period: 'D' },
    { key: 'paredes', label: 'Paredes', period: 'S' },
    { key: 'teto', label: 'Teto', period: 'S' },
  ],
  ARMAZEM: [
    { key: 'prateleiras', label: 'Prateleiras', period: 'S' },
    { key: 'pavimento', label: 'Chão', period: 'D' },
    { key: 'paredes', label: 'Paredes', period: 'S' },
    { key: 'teto', label: 'Teto', period: 'S' },
    { key: 'janelas', label: 'Janelas', period: 'S' },
  ],
  SERVICO: [
    { key: 'balcao', label: 'Balcão', period: 'D' },
    { key: 'mesas', label: 'Mesas', period: 'D' },
    { key: 'cadeiras', label: 'Cadeiras', period: 'D' },
    { key: 'pavimento', label: 'Chão', period: 'D' },
    { key: 'paredes', label: 'Paredes', period: 'S' },
    { key: 'teto', label: 'Teto', period: 'S' },
    { key: 'lavatorios', label: 'Lavatório', period: 'D' },
    { key: 'wc', label: 'WC', period: 'D' },
  ],
};

const PERIODO_OPTS = [
  { key: 'D', label: 'Diário' },
  { key: 'S', label: 'Semanal' },
  { key: 'T', label: 'Trimestral' },
] as const;

function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function slugify(label: string) {
  return label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const ZONA_LABELS: Record<string, string> = { COZINHA: 'Cozinha', PRODUCAO: 'Produção', ARMAZEM: 'Armazém', SERVICO: 'Serviço' };

export default function HigienizacaoPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'CLIENT_ADMIN';

  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [showShare, setShowShare] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [zona, setZona] = useState<Zona>('COZINHA');
  const [periodo, setPeriodo] = useState<'D' | 'S' | 'T'>('D');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [obs, setObs] = useState('');

  // config state
  const [configItens, setConfigItens] = useState<ZonaItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newPeriod, setNewPeriod] = useState<'D' | 'S' | 'T'>('D');

  const startDate = new Date(); startDate.setDate(startDate.getDate() - 30);

  const { data: configs = [] } = useQuery<ZonaConfig[]>({
    queryKey: ['higienizacao-config'],
    queryFn: () => api.get('/registos/higienizacao/config').then(r => r.data),
  });

  const { data: records = [], isLoading } = useQuery<HigienizacaoRecord[]>({
    queryKey: ['app-higienizacao'],
    queryFn: () => api.get(`/registos/higienizacao?startDate=${startDate.toISOString().split('T')[0]}&endDate=${today()}`).then(r => r.data.data),
  });

  const configMap = Object.fromEntries(configs.map(c => [c.zona, c.itens])) as Partial<Record<Zona, ZonaItem[]>>;
  const itensZona: ZonaItem[] = configMap[zona] ?? DEFAULT_ITENS_ZONA[zona];
  const checkedCount = itensZona.filter(i => checks[i.key]).length;

  function toggleZona(z: Zona) {
    setZona(z);
    setChecks({});
  }

  function openConfig() {
    setConfigItens([...(configMap[zona] ?? DEFAULT_ITENS_ZONA[zona])]);
    setNewLabel('');
    setNewPeriod('D');
    setShowConfig(true);
  }

  function addConfigItem() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const key = slugify(trimmed);
    if (configItens.some(i => i.key === key)) { toast.error('Já existe'); return; }
    setConfigItens(prev => [...prev, { key, label: trimmed, period: newPeriod }]);
    setNewLabel('');
  }

  const { mutate: saveConfig, isPending: isSavingConfig } = useMutation({
    mutationFn: () => api.put(`/registos/higienizacao/config/${zona}`, { itens: configItens }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['higienizacao-config'] });
      toast.success('Configuração guardada');
      setShowConfig(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => {
      const itensFinal: Record<string, boolean> = {};
      itensZona.forEach(i => { itensFinal[i.key] = !!checks[i.key]; });
      return api.post('/registos/higienizacao', {
        zona,
        dia: today(),
        periodo,
        itens: itensFinal,
        observacoes: obs.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Registo guardado!');
      setChecks({}); setObs('');
      qc.invalidateQueries({ queryKey: ['app-higienizacao'] });
      setTab('list');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button onClick={() => setTab('list')} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${tab === 'list' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}>
          <List size={16} /> Histórico
        </button>
        <button onClick={() => setTab('new')} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${tab === 'new' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}>
          <Plus size={16} /> Novo Registo
        </button>
        {tab === 'list' && records.length > 0 && (
          <button onClick={() => setShowShare(true)} className="px-3 text-gray-400 border-l border-gray-100">
            <QrCode size={18} />
          </button>
        )}
        {isManager && (
          <button onClick={openConfig} className="px-3 text-gray-400 border-l border-gray-100 relative">
            <Settings size={18} />
            {configMap[zona] && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-500" />}
          </button>
        )}
      </div>

      {tab === 'list' && (
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
          ) : !records.length ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <SprayCan size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Sem registos nos últimos 30 dias</p>
            </div>
          ) : records.map(r => {
            const total = Object.keys(r.itens).length;
            const done = Object.values(r.itens).filter(Boolean).length;
            return (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ZONA_LABELS[r.zona] ?? r.zona}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.dia)} · {r.operator.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${done === total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {done}/{total}
                  </span>
                </div>
                <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'new' && (
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-400">Data: {new Date().toLocaleDateString('pt-PT')}</p>

          {/* Zona */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Zona</p>
            <div className="grid grid-cols-2 gap-2">
              {ZONAS.map(z => (
                <button key={z.key} type="button" onClick={() => toggleZona(z.key)}
                  className={`py-3 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${zona === z.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  <span>{z.emoji}</span> {z.label}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Período</p>
            <div className="flex gap-2">
              {PERIODO_OPTS.map(p => (
                <button key={p.key} type="button" onClick={() => setPeriodo(p.key)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${periodo === p.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Itens ({checkedCount}/{itensZona.length})</p>
              <button type="button" onClick={() => {
                const allChecked = checkedCount === itensZona.length;
                const newChecks: Record<string, boolean> = {};
                itensZona.forEach(i => { newChecks[i.key] = !allChecked; });
                setChecks(newChecks);
              }} className="text-xs text-green-600 font-medium">
                {checkedCount === itensZona.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {itensZona.map(item => (
                <label key={item.key} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!checks[item.key]} onChange={e => setChecks(c => ({ ...c, [item.key]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-green-600" />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-2 bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${itensZona.length ? (checkedCount / itensZona.length) * 100 : 0}%` }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" rows={2}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>

          <button onClick={() => submit()} disabled={isPending}
            className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 active:bg-green-700 disabled:opacity-50">
            {isPending ? 'A guardar...' : 'Guardar Registo'}
          </button>
        </div>
      )}

      {/* Bottom-sheet de configuração de itens */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfig(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">Gerir Itens</p>
                <p className="text-xs text-gray-500">{ZONAS.find(z => z.key === zona)?.label}</p>
              </div>
              <button onClick={() => setShowConfig(false)} className="p-1 text-gray-400"><X size={20} /></button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1">
              {configItens.map(item => (
                <div key={item.key} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm text-gray-800">{item.label}</span>
                  <select
                    value={item.period}
                    onChange={e => setConfigItens(prev => prev.map(i => i.key === item.key ? { ...i, period: e.target.value } : i))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                  >
                    <option value="D">D · Diário</option>
                    <option value="S">S · Semanal</option>
                    <option value="T">T · Trimestral</option>
                  </select>
                  <button onClick={() => setConfigItens(prev => prev.filter(i => i.key !== item.key))} className="text-gray-300 active:text-red-500 p-1">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {configItens.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum item. Adiciona abaixo.</p>
              )}
            </div>

            {/* Adicionar */}
            <div className="px-4 py-3 border-t border-gray-100 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addConfigItem(); } }}
                  placeholder="Novo item (ex: Micro-ondas)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <select
                  value={newPeriod}
                  onChange={e => setNewPeriod(e.target.value as 'D' | 'S' | 'T')}
                  className="border border-gray-200 rounded-xl px-2 text-sm bg-white focus:outline-none"
                >
                  <option value="D">D</option>
                  <option value="S">S</option>
                  <option value="T">T</option>
                </select>
                <button
                  onClick={addConfigItem}
                  disabled={!newLabel.trim()}
                  className="bg-green-600 text-white rounded-xl px-3 disabled:opacity-40 active:bg-green-700"
                >
                  <Plus size={18} />
                </button>
              </div>

              {configMap[zona] && (
                <button
                  onClick={() => { if (window.confirm('Repor predefinições?')) setConfigItens([...DEFAULT_ITENS_ZONA[zona]]); }}
                  className="text-xs text-gray-400 underline"
                >
                  Repor predefinições
                </button>
              )}

              <button
                onClick={() => saveConfig()}
                disabled={isSavingConfig}
                className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 active:bg-green-700 disabled:opacity-50"
              >
                {isSavingConfig ? 'A guardar...' : 'Guardar Configuração'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        variant="sheet"
        type="HIGIENIZACAO"
        label="Higienização — últimos 30 dias"
        params={{
          startDate: startDate.toISOString().split('T')[0],
          endDate: today(),
        }}
        clientId={user?.clientId}
      />
    </div>
  );
}
