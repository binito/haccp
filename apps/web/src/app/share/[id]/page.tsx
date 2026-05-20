'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

type ReportType = 'ENTRADAS' | 'HIGIENIZACAO' | 'DESINFECAO' | 'OLEOS' | 'TEMPERATURAS' | 'CHECKLISTS';

interface ShareData {
  type: ReportType;
  label: string;
  createdAt: string;
  params: Record<string, string>;
  data: any[];
}

const TYPE_LABELS: Record<ReportType, string> = {
  ENTRADAS: 'Controlo de Entradas (R1)',
  HIGIENIZACAO: 'Registo de Higienização (R3)',
  DESINFECAO: 'Registo de Desinfeção (R4)',
  OLEOS: 'Controlo de Óleos de Fritura (R6)',
  TEMPERATURAS: 'Controlo de Temperaturas (R2)',
  CHECKLISTS: 'Checklists HACCP',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const Tick = ({ ok }: { ok: boolean }) =>
  ok ? <span className="text-green-600 font-bold">C</span> : <span className="text-red-600 font-bold">NC</span>;

function EntradasTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-700 text-white">
          <tr>
            {['Data', 'Matéria Prima', 'Fornecedor', 'Veículo', 'Embalagem', 'Rotulagem', 'Produto', 'Temp.', 'Lote', 'Operador'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const allOk = r.veiculoOk && r.embalagemOk && r.rotulagemOk && r.produtoOk;
            return (
              <tr key={r.id} className={i % 2 === 0 ? (allOk ? 'bg-white' : 'bg-red-50') : (allOk ? 'bg-gray-50' : 'bg-red-100')}>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(r.data)}</td>
                <td className="px-3 py-2 font-medium">{r.materiaPrima}</td>
                <td className="px-3 py-2">{r.fornecedor}{r.faturaN ? ` / ${r.faturaN}` : ''}</td>
                <td className="px-3 py-2 text-center"><Tick ok={r.veiculoOk} /></td>
                <td className="px-3 py-2 text-center"><Tick ok={r.embalagemOk} /></td>
                <td className="px-3 py-2 text-center"><Tick ok={r.rotulagemOk} /></td>
                <td className="px-3 py-2 text-center"><Tick ok={r.produtoOk} /></td>
                <td className="px-3 py-2">{r.temperatura != null ? `${r.temperatura}°C` : '—'}</td>
                <td className="px-3 py-2">{r.lote ?? '—'}</td>
                <td className="px-3 py-2">{r.operator.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HigienizacaoTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-700 text-white">
          <tr>
            {['Data', 'Zona', 'Itens OK / Total', 'Observações', 'Operador'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const itens = r.itens as Record<string, boolean> ?? {};
            const ok = Object.values(itens).filter(Boolean).length;
            const total = Object.values(itens).length;
            return (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(r.dia)}</td>
                <td className="px-3 py-2">{r.zona}</td>
                <td className={`px-3 py-2 font-medium ${ok === total ? 'text-green-600' : 'text-orange-600'}`}>{ok}/{total}</td>
                <td className="px-3 py-2">{r.observacoes ?? '—'}</td>
                <td className="px-3 py-2">{r.operator.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DesinfecaoTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-700 text-white">
          <tr>
            {['Data', 'Géneros Alimentícios', 'Desinfetante', 'Dose', 'Água', 'Tempo', 'Operador'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 whitespace-nowrap">{fmt(r.data)}</td>
              <td className="px-3 py-2">{r.generosAlimenticios}</td>
              <td className="px-3 py-2">{r.nomeDesinfetante}</td>
              <td className="px-3 py-2">{r.dose}</td>
              <td className="px-3 py-2">{r.quantidadeAgua}</td>
              <td className="px-3 py-2">{r.tempoAtuacao}</td>
              <td className="px-3 py-2">{r.operator.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OleosTable({ data }: { data: any[] }) {
  const resultLabel = (n: number) => ['', 'Bom (<5%)', 'Aceitável (5-10%)', 'Moderado (10-15%)', 'Mau (15-20%)', 'Inutilizável (>20%)'][n] ?? n;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-700 text-white">
          <tr>
            {['Data', 'Fritadeira', 'Temperatura', 'Resultado', 'Ações', 'Responsável'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 whitespace-nowrap">{fmt(r.data)}</td>
              <td className="px-3 py-2 font-medium">{r.fritadeira}</td>
              <td className="px-3 py-2">{r.temperatura}°C</td>
              <td className={`px-3 py-2 font-medium ${r.resultado <= 2 ? 'text-green-600' : r.resultado <= 3 ? 'text-orange-500' : 'text-red-600'}`}>
                {r.resultado} — {resultLabel(r.resultado)}
              </td>
              <td className="px-3 py-2">{r.acoes ?? '—'}</td>
              <td className="px-3 py-2">{r.responsavel.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemperaturasTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-700 text-white">
          <tr>
            {['Data/Hora', 'Equipamento', 'Tipo', 'Sessão', 'Temperatura', 'Operador'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 whitespace-nowrap">{fmtDt(r.recordedAt)}</td>
              <td className="px-3 py-2 font-medium">{r.equipment.name}</td>
              <td className="px-3 py-2">{r.equipment.type === 'FREEZER' ? 'Arca/Congelador' : 'Frigorífico'}</td>
              <td className="px-3 py-2">{r.session === 'MORNING' ? 'Manhã' : 'Tarde'}</td>
              <td className="px-3 py-2 font-medium">{r.temperature}°C</td>
              <td className="px-3 py-2">{r.operator.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistsTable({ data }: { data: any[] }) {
  return (
    <div className="space-y-3">
      {data.map(entry => {
        const done = entry.taskResults.filter((r: any) => r.done).length;
        const total = entry.taskResults.length;
        return (
          <div key={entry.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-semibold text-gray-900 text-sm">{entry.template.name}</span>
                <span className="text-xs text-gray-500 ml-2">· {entry.area.name} · {entry.operator.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${done === total ? 'text-green-600' : 'text-orange-500'}`}>{done}/{total} tarefas</span>
                <span className="text-xs text-gray-400">{fmtDt(entry.completedAt)}</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {entry.taskResults.map((r: any) => (
                <div key={r.id} className={`flex items-center gap-3 px-4 py-2 ${r.done ? 'bg-green-50/40' : 'bg-red-50/40'}`}>
                  {r.done
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span className="text-xs text-gray-700">{r.task.description}</span>
                  {r.notes && <span className="text-xs text-gray-400 ml-auto">{r.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/shares/${id}`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Image src="/logo.png" alt="HACCP" width={140} height={40} className="h-10 w-auto object-contain" />
          <span className="text-sm text-gray-400">Sistema HACCP</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-gray-500">A carregar relatório...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <p className="text-lg font-medium text-gray-600">Relatório não encontrado</p>
            <p className="text-sm">Este link pode ter expirado ou ser inválido.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Banner */}
            <div className="bg-blue-700 text-white rounded-2xl px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-200 mb-1">Registo HACCP</p>
              <h1 className="text-xl font-bold">{TYPE_LABELS[data.type]}</h1>
              <p className="text-sm text-blue-200 mt-1">{data.label}</p>
            </div>

            {/* Metadados */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Total de registos</p>
                <p className="font-bold text-gray-900 text-lg">{data.data.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Período</p>
                <p className="font-medium text-gray-700">
                  {data.params.startDate && data.params.endDate
                    ? `${fmt(data.params.startDate)} — ${fmt(data.params.endDate)}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Link gerado em</p>
                <p className="font-medium text-gray-700">{fmtDt(data.createdAt)}</p>
              </div>
            </div>

            {/* Dados */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {data.data.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-400">
                  <p className="text-sm">Nenhum registo no período</p>
                </div>
              ) : (
                <>
                  {data.type === 'ENTRADAS' && <EntradasTable data={data.data} />}
                  {data.type === 'HIGIENIZACAO' && <HigienizacaoTable data={data.data} />}
                  {data.type === 'DESINFECAO' && <DesinfecaoTable data={data.data} />}
                  {data.type === 'OLEOS' && <OleosTable data={data.data} />}
                  {data.type === 'TEMPERATURAS' && <TemperaturasTable data={data.data} />}
                  {data.type === 'CHECKLISTS' && <ChecklistsTable data={data.data} />}
                </>
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 pb-8">
              Documento gerado pelo sistema HACCP — Apresentar às autoridades competentes quando solicitado
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
