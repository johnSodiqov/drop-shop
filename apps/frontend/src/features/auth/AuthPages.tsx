import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, LockKeyhole, Phone, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from './AuthProvider';
import { errorMessage } from '../../lib/api';

const phoneSchema = z.string().regex(/^\+998\d{9}$/, 'Введите номер в формате +998XXXXXXXXX');
const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Введите пароль'),
});
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(80),
  phone: phoneSchema,
  password: z.string().min(10, 'Минимум 10 символов').max(72),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({
    mutationFn: (values: LoginValues) => login(values.phone, values.password),
    onSuccess: () => navigate((location.state as { from?: string } | null)?.from ?? '/'),
  });
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Каталог</Link>
        <div className="auth-icon"><LockKeyhole size={21} /></div>
        <h1>С возвращением</h1>
        <p className="muted">Войдите, чтобы продолжить работу с DropStore.</p>
        <form className="form-stack" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="field">
            <span>Номер телефона</span>
            <span className="input-icon"><Phone size={17} /><input placeholder="+998901234567" {...form.register('phone')} /></span>
            {form.formState.errors.phone && <small className="field-error">{form.formState.errors.phone.message}</small>}
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" placeholder="Ваш пароль" {...form.register('password')} />
            {form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}
          </label>
          {mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}
          <button className="button button-primary button-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Входим…' : <>Войти <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-switch">Впервые здесь? <Link to="/register">Создать аккаунт</Link></p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const mutation = useMutation({
    mutationFn: (values: RegisterValues) => register(values.name, values.phone, values.password),
    onSuccess: () => navigate((location.state as { from?: string } | null)?.from ?? '/'),
  });
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Каталог</Link>
        <div className="auth-icon"><UserRound size={21} /></div>
        <h1>Создайте аккаунт</h1>
        <p className="muted">Регистрация покупателя. Доступ агента назначает администратор.</p>
        <form className="form-stack" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="field"><span>Ваше имя</span><input placeholder="Например, Али" {...form.register('name')} />
            {form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}
          </label>
          <label className="field"><span>Номер телефона</span><input placeholder="+998901234567" {...form.register('phone')} />
            {form.formState.errors.phone && <small className="field-error">{form.formState.errors.phone.message}</small>}
          </label>
          <label className="field"><span>Пароль</span><input type="password" placeholder="Не менее 10 символов" {...form.register('password')} />
            {form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}
          </label>
          {mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}
          <button className="button button-primary button-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Создаём аккаунт…' : <>Зарегистрироваться <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="auth-switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </div>
    </div>
  );
}
