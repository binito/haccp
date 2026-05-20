'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCircle, Plus, Pencil, ShieldCheck, Eye, EyeOff, Trash2, UserPlus, Copy, Check, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { User, Client } from '@/types';

interface Invitation {
  id: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
}

interface UserForm {
  name: string;
  email: string;
  password?: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'OPERATOR';
  phone?: string;
  clientId?: string;
}

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', CLIENT_ADMIN: 'Gestor Cliente', OPERATOR: 'Operacional' };
const ROLE_COLORS = { SUPER_ADMIN: 'bg-purple-100 text-purple-700', CLIENT_ADMIN: 'bg-blue-100 text-blue-700', OPERATOR: 'bg-green-100 text-green-700' };

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients', me?.role, me?.clientId],
    queryFn: () => {
      if (me?.role === 'CLIENT_ADMIN' && me?.clientId) {
        return api.get(`/clients/${me.clientId}`).then(r => [r.data]);
      }
      return api.get('/clients').then(r => r.data);
    },
    enabled: !!me?.role && (me.role === 'SUPER_ADMIN' || (me.role === 'CLIENT_ADMIN' && !!me?.clientId)),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserForm>({
    defaultValues: { role: 'OPERATOR' },
  });

  const role = watch('role');

  const saveMutation = useMutation({
    mutationFn: (data: UserForm) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      return editing
        ? api.patch(`/users/${editing.id}`, payload).then(r => r.data)
        : api.post('/users', payload).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'Utilizador atualizado' : 'Utilizador criado');
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar'),
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

  const { data: pendingInvites = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations', me?.clientId],
    queryFn: () => api.get(`/invitations?clientId=${me!.clientId}`).then(r => r.data),
    enabled: me?.role === 'CLIENT_ADMIN' && !!me?.clientId,
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

  function openNew() {
    setEditing(null);
    reset({
      role: 'OPERATOR',
      clientId: me?.role === 'CLIENT_ADMIN' ? (me.clientId ?? '') : '',
    });
    setShowPass(false);
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setValue('name', u.name);
    setValue('email', u.email);
    setValue('role', u.role);
    setValue('phone', u.phone ?? '');
    setValue('clientId', u.clientId ?? '');
    setValue('password', '');
    setShowPass(false);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); reset({ role: 'OPERATOR' }); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilizadores</h1>
          <p className="text-sm text-gray-500">Gerir logins e permissões</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Utilizador
        </Button>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="space-y-px">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
        ) : !users.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserCircle className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum utilizador registado</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map(u => (
              <li key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <UserCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                      {!u.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inativo</span>}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {u.email}
                      {clients.find(c => c.id === u.clientId) && ` · ${clients.find(c => c.id === u.clientId)?.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {u.id !== me?.id && u.active && (
                    <button onClick={() => { if (confirm(`Desativar ${u.name}?`)) deactivateMutation.mutate(u.id); }}
                      className="rounded p-1.5 text-gray-300 hover:bg-orange-50 hover:text-orange-500"
                      title="Desativar">
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                  )}
                  {u.id !== me?.id && (
                    <button onClick={() => { if (confirm(`Apagar permanentemente ${u.name}? Esta ação não pode ser desfeita.`)) deleteMutation.mutate(u.id); }}
                      className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                      title="Apagar permanentemente">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(u)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {me?.role === 'CLIENT_ADMIN' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" /> Convidar Operacional por Link
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Gera um link de convite para um novo operacional se registar</p>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email do convidado (opcional)"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={() => { setGeneratedLink(null); createInviteMutation.mutate(); }} loading={createInviteMutation.isPending}>
              Gerar Convite
            </Button>
          </div>
          {generatedLink && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 mb-4">
              <span className="flex-1 text-xs text-blue-700 truncate font-mono">{generatedLink}</span>
              <button onClick={copyLink} className="shrink-0 text-blue-600 hover:text-blue-800">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
          {pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Convites pendentes</p>
              <ul className="space-y-1">
                {pendingInvites.map(inv => (
                  <li key={inv.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-700">{inv.email ?? 'Sem email'}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        Expira {new Date(inv.expiresAt).toLocaleDateString('pt-PT')}
                      </span>
                      <button onClick={() => revokeInviteMutation.mutate(inv.id)} className="text-gray-300 hover:text-red-500" title="Revogar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Utilizador' : 'Novo Utilizador'}>
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <Input label="Nome *" placeholder="Nome completo" error={errors.name?.message}
            {...register('name', { required: 'Nome obrigatório' })} />
          <Input label="Email *" type="email" placeholder="utilizador@empresa.pt" error={errors.email?.message}
            {...register('email', { required: 'Email obrigatório' })} />
          <div className="relative">
            <Input
              label={editing ? 'Nova password (deixar em branco para manter)' : 'Password *'}
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              error={errors.password?.message}
              {...register('password', { required: !editing ? 'Password obrigatória' : false, minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
            />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perfil *</label>
              <select {...register('role', { required: true })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="OPERATOR">Operacional (Equipa limpeza)</option>
                <option value="CLIENT_ADMIN">Gestor Cliente</option>
                {me?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin (Pataku's)</option>}
              </select>
            </div>
            <Input label="Telefone" placeholder="+351 900 000 000" {...register('phone')} />
          </div>
          {(role === 'CLIENT_ADMIN' || role === 'OPERATOR') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select {...register('clientId', { required: 'Selecione um cliente' })}
                disabled={me?.role === 'CLIENT_ADMIN'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600">
                <option value="">Selecionar cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.clientId && <p className="text-xs text-red-500 mt-1">{errors.clientId.message}</p>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editing ? 'Guardar' : 'Criar Utilizador'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
