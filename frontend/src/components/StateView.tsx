import { useState } from 'react';
import { AlertCircle, LoaderCircle, PackageOpen } from 'lucide-react';

export function LoadingState({ label = 'Загружаем данные…' }: { label?: string }) {
  return <div className="state-view" role="status"><LoaderCircle className="spin" size={22} />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);

  async function retryRequest() {
    if (!retry || retrying) return;
    setRetrying(true);
    try {
      const result = await retry();
      if (result && typeof result === 'object' && 'isError' in result && result.isError) {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="state-view state-error" role="alert">
      <AlertCircle size={22} />
      <span>{message}</span>
      {retry && <button className="button button-outline button-small" onClick={() => void retryRequest()} disabled={retrying}>{retrying ? <><LoaderCircle className="spin" size={15} /> {'\u041f\u043e\u0432\u0442\u043e\u0440\u043d\u0430\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026'}</> : '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c'}</button>}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-view state-empty"><PackageOpen size={24} />{label}</div>;
}
