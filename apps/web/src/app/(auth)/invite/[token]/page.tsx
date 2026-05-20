'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface InviteInfo {
  email: string | null;
  role: string;
  clientName: string;
  expiresAt: string;
}

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Deve conter letras e números'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As passwords não coincidem',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof schema>;

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { login } = useAuthStore();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api.get(`/invitations/${token}/validate`)
      .then(r => {
        setInfo(r.data);
        if (r.data.email) setValue('email', r.data.email);
      })
      .catch(e => setError(e?.response?.data?.message ?? 'Convite inválido'))
      .finally(() => setLoading(false));
  }, [token, setValue]);

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await api.post<{ access_token: string; user: import('@/types').User }>(`/invitations/${token}/accept`, {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      login(res.data.user, res.data.access_token);
      toast.success(`Bem-vindo, ${res.data.user.name}!`);
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar conta');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-600">Patakus</h1>
          <p className="mt-1 text-sm text-gray-500">Gestão HACCP inteligente</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm">A validar convite...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertTriangle size={40} className="mx-auto mb-3 text-red-400" />
            <p className="font-semibold text-red-700">{error}</p>
            <p className="mt-1 text-sm text-red-500">Este link pode ter expirado ou já sido utilizado.</p>
          </div>
        )}

        {info && !error && (
          <div className="space-y-6">
            {/* Banner do cliente */}
            <div className="rounded-2xl bg-blue-700 px-6 py-5 text-white text-center">
              <ShieldCheck size={32} className="mx-auto mb-2 text-blue-200" />
              <p className="text-sm text-blue-200 mb-1">Foi convidado para gerir</p>
              <p className="text-xl font-bold">{info.clientName}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Criar a sua conta</h2>
              <p className="text-sm text-gray-500 mb-6">Defina as suas credenciais de acesso.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nome completo *"
                  placeholder="O seu nome"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Input
                  label="E-mail *"
                  type="email"
                  placeholder="seu@email.com"
                  readOnly={!!info.email}
                  className={info.email ? 'bg-gray-50 text-gray-500' : ''}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Password *"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirmar password *"
                  type="password"
                  placeholder="Repetir password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />

                <Button type="submit" className="w-full mt-2" size="lg" loading={isSubmitting}>
                  Criar conta e entrar
                </Button>
              </form>
            </div>

            <p className="text-center text-xs text-gray-400">
              Convite válido até {new Date(info.expiresAt).toLocaleDateString('pt-PT')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
