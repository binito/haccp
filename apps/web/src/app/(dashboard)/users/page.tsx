'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCircle, Plus, Pencil, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { User, Client } from '@/types';

interface UserForm {
  name: string;
  email: string;
  password?: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'OPERATOR';
  phone?: string;
  clientId?: string;
}

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', CLIENT_ADMIN: 'Gestor Cliente', OPERATOR: 'Operacional' };
const ROLE_COLORS = { SUPER_ADMIN: 'bg-purple-100 text-purple-700', CLIENT_ADMIN: 'bg-blue-100 text-blue-700', OPERATOR: 'bg-green-500/15 text-green-400' };

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [showPass, setShowPass] = useState(false);

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
          <h1 className="text-2xl font-bold text-gray-100">Utilizadores</h1>
          <p className="text-sm text-gray-500">Gerir logins e permissões</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Utilizador
        </Button>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="space-y-px">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-surface-1" />)}</div>
        ) : !users.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserCircle className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Nenhum utilizador registado</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {users.map(u => (
              <li key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-surface-1">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
                    <UserCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-100">{u.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                      {!u.active && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-gray-500">Inativo</span>}
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
                      className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500">
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(u)} className="rounded p-1.5 text-gray-400 hover:bg-surface-3 hover:text-gray-400">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-400">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Perfil *</label>
              <select {...register('role', { required: true })}
                className="w-full rounded-md border border-border bg-surface-2 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="OPERATOR">Operacional (Equipa limpeza)</option>
                <option value="CLIENT_ADMIN">Gestor Cliente</option>
                {me?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>
            </div>
            <Input label="Telefone" placeholder="+351 900 000 000" {...register('phone')} />
          </div>
          {(role === 'CLIENT_ADMIN' || role === 'OPERATOR') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente *</label>
              <select {...register('clientId', { required: 'Selecione um cliente' })}
                disabled={me?.role === 'CLIENT_ADMIN'}
                className="w-full rounded-md border border-border bg-surface-2 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-surface-1 disabled:text-gray-400">
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
