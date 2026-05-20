'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, X, AlertTriangle, Send, List, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Anomaly, AnomalyStatus, HigienizacaoZona, zonaLabel } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityOptions = [
  { value: 'LOW', label: 'Baixa', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'MEDIUM', label: 'Média', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'HIGH', label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
];

const severityLabel: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const statusLabel: Record<AnomalyStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
};
const statusColor: Record<AnomalyStatus, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

export default function AnomaliaPage() {
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({ title: '', description: '', severity: 'MEDIUM', zona: '' as HigienizacaoZona | '' });
  const queryClient = useQueryClient();

  const zonaOptions: { value: HigienizacaoZona; label: string }[] = [
    { value: 'COZINHA', label: 'Cozinha' },
    { value: 'PRODUCAO', label: 'Produção' },
    { value: 'ARMAZEM', label: 'Armazém' },
    { value: 'SERVICO', label: 'Serviço' },
  ];

  const { data: anomalies, isLoading } = useQuery<Anomaly[]>({
    queryKey: ['app-anomalies'],
    queryFn: () => api.get('/reports/anomalies').then(r => r.data.data),
  });

  const { mutate: deleteAnomaly } = useMutation({
    mutationFn: (id: string) => api.delete(`/reports/anomalies/${id}`),
    onSuccess: () => {
      toast.success('Anomalia eliminada');
      queryClient.invalidateQueries({ queryKey: ['app-anomalies'] });
    },
    onError: () => toast.error('Erro ao eliminar anomalia'),
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('severity', form.severity);
      fd.append('zona', form.zona);
      photos.forEach(p => fd.append('photos', p));
      return api.post('/reports/anomalies', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Anomalia reportada!');
      setForm({ title: '', description: '', severity: 'MEDIUM', zona: '' });
      setPhotos([]);
      setPreviews([]);
      queryClient.invalidateQueries({ queryKey: ['app-anomalies'] });
      setTab('list');
    },
    onError: () => toast.error('Erro ao reportar anomalia'),
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 4) {
      toast.error('Máximo 4 fotos');
      return;
    }
    setPhotos(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const canSubmit = form.title && form.description && form.zona;

  return (
    <div className="flex flex-col min-h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => setTab('list')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <List size={16} />
          As minhas anomalias
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'report' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <Plus size={16} />
          Reportar
        </button>
      </div>

      {/* Lista */}
      {tab === 'list' && (
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))
          ) : !anomalies?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertTriangle size={40} className="mb-3 opacity-40" />
              <p className="text-sm">Sem anomalias reportadas</p>
              <button
                onClick={() => setTab('report')}
                className="mt-4 text-sm text-blue-600 font-medium"
              >
                Reportar agora
              </button>
            </div>
          ) : (
            anomalies.map(a => (
              <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm leading-snug">{a.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor[a.status]}`}>
                      {statusLabel[a.status]}
                    </span>
                    {a.status === 'RESOLVED' && (
                      <button
                        onClick={() => {
                          if (confirm('Apagar esta anomalia resolvida?')) {
                            deleteAnomaly(a.id);
                          }
                        }}
                        className="text-red-400 active:text-red-600 p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                {a.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{a.zona ? zonaLabel[a.zona] : '—'}</span>
                  <span>·</span>
                  <span>{severityLabel[a.severity]}</span>
                  <span>·</span>
                  <span>{format(new Date(a.createdAt), "d MMM yyyy", { locale: ptBR })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Formulário */}
      {tab === 'report' && (
        <div className="p-4 space-y-4">
          {/* Zona */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Zona *</label>
            <div className="grid grid-cols-2 gap-2">
              {zonaOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, zona: opt.value }))}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    form.zona === opt.value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Título *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Descreva brevemente o problema"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Descrição *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Detalhes da anomalia..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Severidade */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Severidade</label>
            <div className="flex gap-2">
              {severityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, severity: opt.value }))}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    form.severity === opt.value ? opt.color : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Fotos ({photos.length}/4)</label>
            <div className="flex gap-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 active:border-blue-400 active:text-blue-400"
                >
                  <Camera size={20} />
                  <span className="text-xs mt-1">Foto</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhoto}
              className="hidden"
            />
          </div>

          <button
            onClick={() => submit()}
            disabled={isPending || !canSubmit}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {isPending ? 'A enviar...' : 'Reportar Anomalia'}
          </button>
        </div>
      )}
    </div>
  );
}
