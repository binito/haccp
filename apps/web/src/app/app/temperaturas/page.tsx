'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Thermometer, CheckCircle2, Clock, Plus, List, QrCode, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import ShareQrModal from '@/components/ShareQrModal';

interface TodayRecord {
  temperature: number;
  recordedAt: string;
}

interface Equipment {
  id: string;
  name: string;
  type: 'FRIDGE' | 'FREEZER';
  location?: string;
  minTemp?: number;
  maxTemp?: number;
  today: {
    morning: TodayRecord | null;
    evening: TodayRecord | null;
  };
}

type Session = 'MORNING' | 'EVENING';

function currentSession(): Session {
  return new Date().getHours() < 13 ? 'MORNING' : 'EVENING';
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function tempOk(temp: number, min?: number, max?: number) {
  if (min !== undefined && temp < min) return false;
  if (max !== undefined && temp > max) return false;
  return true;
}

interface TempRecord {
  id: string;
  temperature: number;
  session: 'MORNING' | 'EVENING';
  notes?: string;
  recordedAt: string;
  equipment: { id: string; name: string; minTemp?: number; maxTemp?: number; };
  operator: { name: string; };
}

interface EquipmentForm {
  name: string;
  type: 'FRIDGE' | 'FREEZER';
  location: string;
  minTemp: string;
  maxTemp: string;
}

const emptyForm = (): EquipmentForm => ({ name: '', type: 'FRIDGE', location: '', minTemp: '', maxTemp: '' });

function today() { return new Date().toISOString().split('T')[0]; }
function thirtyDaysAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }

export default function TemperaturasPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === 'CLIENT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [showShare, setShowShare] = useState(false);

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['app-temperature-today'],
    queryFn: () => api.get('/temperature/today').then(r => r.data),
    refetchInterval: 60_000,
  });

  // Record temperature sheet
  const [sheet, setSheet] = useState<{ eq: Equipment; session: Session } | null>(null);
  const [tempInput, setTempInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New equipment sheet
  const [showNewEq, setShowNewEq] = useState(false);
  const [eqForm, setEqForm] = useState<EquipmentForm>(emptyForm());
  const [savingEq, setSavingEq] = useState(false);

  function openSheet(eq: Equipment, session: Session) {
    setSheet({ eq, session });
    setTempInput('');
    setNotes('');
  }

  const submit = useCallback(async () => {
    if (!sheet) return;
    const temp = parseFloat(tempInput.replace(',', '.'));
    if (isNaN(temp)) { toast.error('Temperatura inválida'); return; }

    setSubmitting(true);
    try {
      await api.post('/temperature/records', {
        equipmentId: sheet.eq.id,
        temperature: temp,
        session: sheet.session,
        notes: notes.trim() || undefined,
      });
      toast.success('Temperatura registada!');
      setSheet(null);
      qc.invalidateQueries({ queryKey: ['app-temperature-today'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally {
      setSubmitting(false);
    }
  }, [sheet, tempInput, notes, qc]);

  const saveEquipment = useCallback(async () => {
    if (!eqForm.name.trim()) { toast.error('Nome obrigatório'); return; }

    const minTemp = eqForm.minTemp ? parseFloat(eqForm.minTemp.replace(',', '.')) : undefined;
    const maxTemp = eqForm.maxTemp ? parseFloat(eqForm.maxTemp.replace(',', '.')) : undefined;

    if (eqForm.minTemp && isNaN(minTemp!)) { toast.error('Temperatura mínima inválida'); return; }
    if (eqForm.maxTemp && isNaN(maxTemp!)) { toast.error('Temperatura máxima inválida'); return; }

    setSavingEq(true);
    try {
      await api.post('/temperature/equipment', {
        name: eqForm.name.trim(),
        type: eqForm.type,
        location: eqForm.location.trim() || undefined,
        minTemp,
        maxTemp,
        clientId: user!.clientId,
      });
      toast.success('Equipamento criado!');
      setShowNewEq(false);
      setEqForm(emptyForm());
      qc.invalidateQueries({ queryKey: ['app-temperature-today'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar equipamento');
    } finally {
      setSavingEq(false);
    }
  }, [eqForm, user, qc]);

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery<TempRecord[]>({
    queryKey: ['app-temperature-history'],
    queryFn: () => api.get(`/temperature/records?startDate=${thirtyDaysAgo()}&endDate=${today()}`).then(r => r.data),
    enabled: tab === 'history',
  });

  const total = equipment.length;
  const complete = equipment.filter(e => e.today.morning && e.today.evening).length;
  const pending = total - complete;
  const incomplete = equipment.filter(e => !e.today.morning || !e.today.evening);

  return (
    <>
      {/* Tab header */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button onClick={() => setTab('today')} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${tab === 'today' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          <Thermometer size={16} /> Hoje
        </button>
        <button onClick={() => setTab('history')} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${tab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          <List size={16} /> Histórico
        </button>
        {tab === 'history' && historyRecords.length > 0 && (
          <button onClick={() => setShowShare(true)} className="px-3 text-gray-400 hover:text-blue-600 border-l border-gray-100">
            <QrCode size={18} />
          </button>
        )}
      </div>

      {tab === 'history' && (
        <div className="p-4 space-y-3">
          {historyLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
          ) : !historyRecords.length ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Thermometer size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Sem registos nos últimos 30 dias</p>
            </div>
          ) : historyRecords.map(r => {
            const ok = tempOk(r.temperature, r.equipment.minTemp, r.equipment.maxTemp);
            const dt = new Date(r.recordedAt);
            return (
              <div key={r.id} className={`bg-white rounded-xl p-4 shadow-sm border ${ok ? 'border-gray-100' : 'border-l-4 border-l-red-500 border-gray-100'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.equipment.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {dt.toLocaleDateString('pt-PT')} · {dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {r.session === 'MORNING' ? 'Manhã' : 'Tarde'} · {r.operator.name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-lg font-bold ${ok ? 'text-green-600' : 'text-red-600'}`}>{r.temperature}°C</span>
                    <span className={`text-xs font-semibold ${ok ? 'text-green-600' : 'text-red-600'}`}>{ok ? '✓ OK' : '⚠ NC'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'today' && (<div className="p-4 space-y-4">
        {/* Banner — leituras em falta */}
        {incomplete.length > 0 && !isLoading && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  {incomplete.length === 1 ? '1 equipamento' : `${incomplete.length} equipamentos`} sem leitura completa
                </p>
                <ul className="mt-1 space-y-0.5">
                  {incomplete.map(eq => (
                    <li key={eq.id} className="text-xs text-orange-700">
                      <span className="font-medium">{eq.name}</span>
                      {' — '}
                      {!eq.today.morning && !eq.today.evening ? 'sem leituras' : !eq.today.morning ? 'falta manhã' : 'falta tarde'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Resumo */}
        {total > 0 && (
          <div className={`rounded-xl p-4 ${pending === 0 ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
            <p className="font-bold text-base">Controlo de Temperatura</p>
            <p className="text-sm mt-1 opacity-90">
              {pending === 0
                ? 'Todos os registos de hoje estão completos ✓'
                : `${pending} equipamento${pending !== 1 ? 's' : ''} com registos em falta`}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && equipment.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Thermometer size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum equipamento configurado</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowNewEq(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
              >
                <Plus size={16} /> Adicionar equipamento
              </button>
            )}
          </div>
        )}

        {equipment.map(eq => (
          <div key={eq.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${eq.type === 'FREEZER' ? 'bg-blue-100' : 'bg-cyan-100'}`}>
                <Thermometer size={20} className={eq.type === 'FREEZER' ? 'text-blue-600' : 'text-cyan-600'} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{eq.name}</p>
                <p className="text-xs text-gray-400">
                  {eq.type === 'FREEZER' ? 'Arca / Congelador' : 'Frigorífico'}
                  {eq.location ? ` · ${eq.location}` : ''}
                  {(eq.minTemp != null || eq.maxTemp != null) ? ` · ${eq.minTemp ?? '—'}°C a ${eq.maxTemp ?? '—'}°C` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
              {(['morning', 'evening'] as const).map(sess => {
                const record = eq.today[sess];
                const sessionKey: Session = sess === 'morning' ? 'MORNING' : 'EVENING';
                const label = sess === 'morning' ? '🌅 Manhã' : '🌙 Tarde';
                const ok = record ? tempOk(record.temperature, eq.minTemp, eq.maxTemp) : null;

                return (
                  <button
                    key={sess}
                    type="button"
                    onClick={() => openSheet(eq, sessionKey)}
                    className="bg-white active:bg-gray-50 flex flex-col items-center justify-center py-4 gap-1"
                  >
                    <span className="text-xs text-gray-500 font-medium">{label}</span>
                    {record ? (
                      <>
                        <span className={`text-xl font-bold ${ok ? 'text-green-600' : 'text-red-600'}`}>
                          {record.temperature}°C
                        </span>
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-green-500" />
                          {fmtTime(record.recordedAt)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock size={20} className="text-gray-300" />
                        <span className="text-xs text-gray-400">Por registar</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>)}

      {/* FAB — só para gestores */}
      {canManage && equipment.length > 0 && (
        <button
          type="button"
          onClick={() => setShowNewEq(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg active:bg-blue-700"
          aria-label="Novo equipamento"
        >
          <Plus size={26} />
        </button>
      )}

      {/* Bottom sheet — registar temperatura */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={() => setSheet(null)}>
          <div className="bg-white rounded-t-2xl p-6 pb-10 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />

            <div>
              <p className="font-bold text-gray-900 text-lg">{sheet.eq.name}</p>
              <p className="text-sm text-gray-500">
                {sheet.session === 'MORNING' ? '🌅 Manhã' : '🌙 Tarde'}
              </p>
            </div>

            <div className="flex gap-2">
              {(['MORNING', 'EVENING'] as Session[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSheet(prev => prev ? { ...prev, session: s } : null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    sheet.session === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {s === 'MORNING' ? '🌅 Manhã' : '🌙 Tarde'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Temperatura (°C)</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="ex: 4.5"
                value={tempInput}
                onChange={e => setTempInput(e.target.value)}
                autoFocus
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-3xl font-bold text-center text-gray-900 focus:outline-none focus:border-blue-500"
              />
              {(sheet.eq.minTemp != null || sheet.eq.maxTemp != null) && (
                <p className="text-xs text-center text-gray-400 mt-1">
                  Intervalo: {sheet.eq.minTemp ?? '—'}°C a {sheet.eq.maxTemp ?? '—'}°C
                </p>
              )}
            </div>

            <input
              type="text"
              placeholder="Observação (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !tempInput}
              className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-base active:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'A guardar...' : 'Guardar registo'}
            </button>
          </div>
        </div>
      )}

      <ShareQrModal
        open={showShare}
        onClose={() => setShowShare(false)}
        variant="sheet"
        type="TEMPERATURAS"
        label="Temperaturas — últimos 30 dias"
        params={{ startDate: thirtyDaysAgo(), endDate: today() }}
        clientId={user?.clientId}
      />

      {/* Bottom sheet — novo equipamento */}
      {showNewEq && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={() => setShowNewEq(false)}>
          <div className="bg-white rounded-t-2xl p-6 pb-10 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />
            <p className="font-bold text-gray-900 text-lg">Novo equipamento</p>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                placeholder="ex: Frigorífico cozinha"
                value={eqForm.name}
                onChange={e => setEqForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="flex gap-2">
                {(['FRIDGE', 'FREEZER'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEqForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      eqForm.type === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {t === 'FRIDGE' ? '🧊 Frigorífico' : '❄️ Arca / Congelador'}
                  </button>
                ))}
              </div>
            </div>

            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                type="text"
                placeholder="ex: Cozinha, Armazém..."
                value={eqForm.location}
                onChange={e => setEqForm(f => ({ ...f, location: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Temperaturas limite */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Temp. mínima (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="ex: 2"
                  value={eqForm.minTemp}
                  onChange={e => setEqForm(f => ({ ...f, minTemp: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Temp. máxima (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="ex: 8"
                  value={eqForm.maxTemp}
                  onChange={e => setEqForm(f => ({ ...f, maxTemp: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={saveEquipment}
              disabled={savingEq || !eqForm.name.trim()}
              className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-base active:bg-blue-700 disabled:opacity-50"
            >
              {savingEq ? 'A guardar...' : 'Criar equipamento'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
