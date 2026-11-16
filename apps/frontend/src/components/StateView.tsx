import { AlertCircle, LoaderCircle, PackageOpen } from 'lucide-react';

export function LoadingState({ label = 'Загружаем данные…' }: { label?: string }) {
  return <div className="state-view" role="status"><LoaderCircle className="spin" size={22} />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="state-view state-error" role="alert">
      <AlertCircle size={22} />
      <span>{message}</span>
      {retry && <button className="button button-outline button-small" onClick={retry}>Повторить</button>}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-view state-empty"><PackageOpen size={24} />{label}</div>;
}
