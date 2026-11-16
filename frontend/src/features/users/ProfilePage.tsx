import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Save, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageContainer } from '../../components/Layout';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage } from '../../lib/api';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Введите имя').max(80) });
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '' } });
  const mutation = useMutation({ mutationFn: (values: ProfileValues) => updateProfile(values.name) });
  return <PageContainer><div className="page-heading"><span className="eyebrow">ВАШ АККАУНТ</span><h1>Профиль</h1><p>Управление личными данными и сессией.</p></div>
    <div className="profile-card panel-card"><div className="profile-avatar"><UserRound size={25} /></div><div className="profile-info"><span className="eyebrow">{user?.role === 'ADMIN' ? 'АДМИНИСТРАТОР' : user?.role === 'AGENT' ? 'АГЕНТ' : 'ПОКУПАТЕЛЬ'}</span><b>{user?.phone}</b></div></div>
    <form className="profile-form form-stack" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <label className="field"><span>Имя</span><input {...form.register('name')} />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>
      {mutation.isSuccess && <p className="success-text">Данные профиля обновлены.</p>}
      {mutation.isError && <p className="form-error">{errorMessage(mutation.error)}</p>}
      <button className="button button-primary" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? 'Сохраняем…' : 'Сохранить профиль'}</button>
    </form>
    <button className="button button-outline profile-logout" onClick={() => void logout()}><LogOut size={16} /> Выйти из аккаунта</button>
  </PageContainer>;
}
