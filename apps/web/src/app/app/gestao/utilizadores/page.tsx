'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCircle, List, Plus, Pencil, Eye, EyeOff, X, ShieldOff, Trash2, UserPlus, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User, Client } from '@/types';

interface Invitation {
  id: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
}

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', CLIENT_ADMIN: 'Gestor', OPERATOR: 'Operacional' };
const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  CLIENT_ADMIN: 'bg-blue-100 text-blue-700',
  OPERATOR: 'bg-green-100 text-green-700',
};

const emptyForm = { name: '', email: '', password: '', role: 'OPERATOR' as User['role'], phone: '', clientId: '' };

export default function UtilizadoresMobilePage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'list' | 'form' | 'invite'>('list');
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ ...emptyForm, clientId: me?.clientId ?? '' });
  const [showPass, setShowPass] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: !!me,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => {
      if (me?.role === 'CLIENT_ADMIN' && me?.clientId) {
        return api.get(`/clients/${me.clientId}`).then(r => [r.data]);
      }
      return api.get('/clients').then(r => r.data);
    },
    enabled: !!me && me.role !== 'OPERATOR',
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilizador desativado'); },
    onError: () => toast.error('Erro ao desativar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}/permanent`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilizador eliminado'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao eliminar'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => {
      const payload = { ...data, ...((!data.password || editing) && !data.password ? { password: undefined } : {}) };
      return editing
        ? api.patch(`/users/${editing.id}`, payload).then(r => r.data)
        : api.post('/users', payload).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'Utilizador atualizado' : 'Utilizador criado');
      closeForm();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, clientId: me?.clientId ?? '' });
    setShowPass(false);
    setTab('form');
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone ?? '', clientId: u.clientId ?? me?.clientId ?? '' });
    setShowPass(false);
    setTab('form');
  }

  function closeForm() {
    setTab('list');
    setEditing(null);
    setForm({ ...emptyForm, clientId: me?.clientId ?? '' });
  }

  const { data: pendingInvites = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations', me?.clientId],
    queryFn: () => api.get(`/invitations?clientId=${me!.clientId}`).then(r => r.data),
    enabled: me?.role === 'CLIENT_ADMIN' && !!me?.clientId && tab === 'invite',
  });

  const createInviteMutation = useMutation({
    mutationFn: () => api.post('/invitations', {
      clientId: me!.clientId,
      email: inviteEmail || undefined,
    }).then(r => r.data),
    onSuccess: (data) => {
      setGeneratedLink(data.link);
      qc.invalidateQueries({ queryKey: ['invitations', me?.clientId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao gerar convite'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', me?.clientId] });
      toast.success('Convite revogado');
    },
  });

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 3000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    if (!form.email.trim()) { toast.error('Email obrigatório'); return; }
    if (!editing && !form.password.trim()) { toast.error('Password obrigatória'); return; }
    saveMutation.mutate(form);
  }

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

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
          Utilizadores ({users.length})
        </button>
        <button
          onClick={openNew}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'form' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          <Plus size={16} />
          {editing ? 'Editar' : 'Novo'}
        </button>
        {me?.role === 'CLIENT_ADMIN' && (
          <button
            onClick={() => { setTab('invite'); setGeneratedLink(null); setInviteEmail(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              tab === 'invite' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            <UserPlus size={16} />
            Convidar
          </button>
        )}
      </div>

      {/* Lista */}
      {tab === 'list' && (
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))
          ) : !users.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <UserCircle size={40} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum utilizador registado</p>
              <button onClick={openNew} className="mt-4 text-sm text-blue-600 font-medium">
                Adicionar primeiro utilizador
              </button>
            </div>
          ) : (
            users.map(u => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                      <UserCircle size={18} className="text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      {u.clientId && clientMap[u.clientId] && (
                        <p className="text-xs text-gray-400 truncate">{clientMap[u.clientId]}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                    {u.id !== me?.id && (
                      <>
                        {u.active && (
                          <button
                            onClick={() => { if (confirm(`Desativar ${u.name}?`)) deactivateMutation.mutate(u.id); }}
                            className="p-2 text-gray-400 active:text-orange-500"
                            title="Desativar"
                          >
                            <ShieldOff size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm(`Apagar permanentemente ${u.name}? Esta ação não pode ser desfeita.`)) deleteMutation.mutate(u.id); }}
                          className="p-2 text-gray-400 active:text-red-500"
                          title="Apagar"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button onClick={() => openEdit(u)} className="p-2 text-gray-400 active:text-blue-600">
                          <Pencil size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Convidar */}
      {tab === 'invite' && (
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Convidar Operacional</p>
            <p className="text-xs text-gray-500">Gera um link para um novo operacional se registar na plataforma.</p>
          </div>
          <div className="space-y-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email do convidado (opcional)"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { setGeneratedLink(null); createInviteMutation.mutate(); }}
              disabled={createInviteMutation.isPending}
              className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50"
            >
              {createInviteMutation.isPending ? 'A gerar...' : 'Gerar Link de Convite'}
            </button>
          </div>

          {generatedLink && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-600 font-medium mb-2">Link gerado — partilha com o novo operacional:</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-blue-800 font-mono break-all">{generatedLink}</p>
                <button onClick={copyLink} className="shrink-0 p-2 rounded-lg bg-blue-100 active:bg-blue-200 text-blue-700">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Convites pendentes</p>
              <div className="space-y-2">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
                    <div>
                      <p className="text-sm text-gray-800">{inv.email ?? 'Sem email'}</p>
                      <p className="text-xs text-gray-400">Expira {new Date(inv.expiresAt).toLocaleDateString('pt-PT')}</p>
                    </div>
                    <button
                      onClick={() => revokeInviteMutation.mutate(inv.id)}
                      className="p-2 text-gray-300 active:text-red-500"
                      title="Revogar"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulário */}
      {tab === 'form' && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {editing && (
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-600">A editar: <span className="text-gray-900">{editing.name}</span></p>
              <button type="button" onClick={closeForm} className="p-1 text-gray-400">
                <X size={18} />
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nome *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="utilizador@email.com"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Password {editing ? '(deixar em branco para não alterar)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? 'Nova password (opcional)' : 'Password'}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Telefone</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+351 900 000 000"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Perfil</label>
            <div className="flex gap-2">
              {(me?.role === 'SUPER_ADMIN'
                ? (['SUPER_ADMIN', 'CLIENT_ADMIN', 'OPERATOR'] as const)
                : (['CLIENT_ADMIN', 'OPERATOR'] as const)
              ).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    form.role === role
                      ? ROLE_COLORS[role] + ' border-transparent'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {form.role !== 'SUPER_ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cliente</label>
              <select
                value={form.clientId}
                onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {editing && (
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 active:bg-gray-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'A guardar...' : editing ? 'Guardar' : 'Criar Utilizador'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
