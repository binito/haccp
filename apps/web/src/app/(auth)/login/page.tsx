'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShaderBackground } from '@/components/ui/ShaderBackground';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, hydrated } = useAuthStore();
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace(isMobile() ? '/app' : '/dashboard');
  }, [hydrated, isAuthenticated, router]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await api.post<{ user: import('@/types').User }>('/auth/login', data);
      login(res.data.user);
      toast.success('Bem-vindo!');
      router.replace(isMobile() ? '/app' : '/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Credenciais inválidas';
      toast.error(message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <ShaderBackground />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-8 shadow-2xl backdrop-blur-xl">
          {/* Brand */}
          <div className="mb-8">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary-400" />
              <span className="text-xs font-medium text-primary-400 tracking-widest uppercase">HACCP</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Entrar na conta</h1>
            <p className="mt-1 text-sm text-white/50">Gestão HACCP</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="pt-1">
              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                Entrar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
