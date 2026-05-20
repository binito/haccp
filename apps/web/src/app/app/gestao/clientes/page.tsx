'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, List, Plus, Pencil, X, UserPlus, Copy, Check, Trash2, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Client } from '@/types';

const SECTORS = ['Hotel', 'Restaurante', 'Café', 'Clínica', 'Farmácia', 'Escritório', 'Indústria', 'Outro'];
const emptyForm = { name: '', nif: '', email: '', phone: '', address: '', sector: '' };

interface Invitation {
  id: string; email: string | null; expiresAt: string;
}

export default function ClientesMobilePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'list' | 'form' | 'invite'>('list');
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteClient, setInviteClient] = useState<Client | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/app/gestao');
  }, [user, router]);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: pendingInvites = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations', inviteClient?.id],
    queryFn: () => api.get(`/invitations?clientId=${inviteClient!.id}`).then(r => r.data),
    enabled: !!inviteClient && tab === 'invite',
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      editing
        ? api.patch(`/clients/${editing.id}`, data).then(r => r.data)
        : api.post('/clients', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(editing ? 'Cliente atualizado' : 'Cliente criado');
      closeForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  const createInviteMutation = useMutation({
    mutationFn: () => api.post('/invitations', {
      clientId: inviteClient!.id,
      email: inviteEmail || undefined,
    }).then(r => r.data),
    onSuccess: (data) => {
      setGeneratedLink(data.link);
      qc.invalidateQueries({ queryKey: ['invitations', inviteClient?.id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao gerar convite'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', inviteClient?.id] });
      toast.success('Convite revogado');
    },
  });

  function openNew() { setEditing(null); setForm(emptyForm); setTab('form'); }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, nif: c.nif ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', sector: c.sector ?? '' });
    setTab('form');
  }

  function closeForm() { setTab('list'); setEditing(null); setForm(emptyForm); }

  function openInvite(c: Client) {
    setInviteClient(c);
    setInviteEmail('');
    setGeneratedLink(null);
    setCopied(false);
    setTab('invite');
  }

  function closeInvite() { setTab('list'); setInviteClient(null); setGeneratedLink(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    saveMutation.mutate(form);
  }

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 3000);
  }

  if (!user || user.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => { setTab('list'); setEditing(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <List size={16} />
          Clientes ({clients.length})
        </button>
        <button
          onClick={openNew}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'form' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <Plus size={16} />
          {editing ? 'Editar' : 'Novo Cliente'}
        </button>
      </div>

      {/* ── Lista ── */}
      {tab === 'list' && (
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))
          ) : !clients.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Building2 size={40} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum cliente registado</p>
              <button onClick={openNew} className="mt-4 text-sm text-blue-600 font-medium">
                Adicionar primeiro cliente
              </button>
            </div>
          ) : (
            clients.map(c => (
              <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[c.sector, c.nif && `NIF ${c.nif}`, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      onClick={() => openInvite(c)}
                      className="p-2 text-gray-400 active:text-blue-600"
                      title="Convidar gestor"
                    >
                      <UserPlus size={16} />
                    </button>
                    <button onClick={() => openEdit(c)} className="p-2 text-gray-400 active:text-blue-600">
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
                {c.address && <p className="text-xs text-gray-400 mt-2">{c.address}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Formulário ── */}
      {tab === 'form' && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {editing && (
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-600">A editar: <span className="text-gray-900">{editing.name}</span></p>
              <button type="button" onClick={closeForm} className="p-1 text-gray-400"><X size={18} /></button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome da empresa"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">NIF</label>
              <input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))}
                placeholder="123456789"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Telefone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+351 900 000 000"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="geral@empresa.pt"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Morada</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Rua, Localidade"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Setor</label>
            <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Selecionar setor...</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            {editing && (
              <button type="button" onClick={closeForm}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 active:bg-gray-50">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={saveMutation.isPending}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50">
              {saveMutation.isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      )}

      {/* ── Convite ── */}
      {tab === 'invite' && inviteClient && (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={closeInvite} className="p-1.5 text-gray-400 active:text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p className="font-semibold text-gray-900">Convidar gestor</p>
              <p className="text-xs text-gray-500">{inviteClient.name}</p>
            </div>
          </div>

          {!generatedLink ? (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  Gere um link de convite e partilhe-o com o novo gestor via WhatsApp ou email. O link expira em <strong>7 dias</strong>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Email do gestor <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="gestor@empresa.pt"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Se preenchido, fica pré-preenchido no formulário de registo.</p>
              </div>

              {pendingInvites.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Convites pendentes</p>
                  <div className="space-y-2">
                    {pendingInvites.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-sm text-gray-700">{inv.email ?? 'Sem email'}</p>
                          <p className="text-xs text-gray-400">Expira {new Date(inv.expiresAt).toLocaleDateString('pt-PT')}</p>
                        </div>
                        <button
                          onClick={() => revokeInviteMutation.mutate(inv.id)}
                          className="p-2 text-red-400 active:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserPlus size={18} />
                {createInviteMutation.isPending ? 'A gerar...' : 'Gerar convite'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800">Convite criado!</p>
                <p className="text-xs text-green-600 mt-0.5">Copie o link e partilhe com o gestor.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Link de convite</label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 font-mono break-all">
                  {generatedLink}
                </div>
              </div>

              <button
                onClick={copyLink}
                className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white active:bg-blue-700'
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>

              <button
                onClick={() => { setGeneratedLink(null); setInviteEmail(''); }}
                className="w-full py-3 rounded-xl font-medium text-gray-600 border border-gray-200 active:bg-gray-50"
              >
                Gerar novo convite
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
