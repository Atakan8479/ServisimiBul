import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Button, Card } from './ui';

export function LoadingState({ label = 'İçerik hazırlanıyor…' }: { label?: string }) {
  return <Card className="screen-state"><LoaderCircle className="spin" size={24}/><strong>{label}</strong><span>Lütfen kısa bir süre bekle.</span></Card>;
}

export function ErrorState({ title = 'Bir sorun oluştu', detail = 'Örnek içerik yüklenemedi.', onRetry }: { title?: string; detail?: string; onRetry?: () => void }) {
  return <Card className="screen-state error-state"><AlertCircle size={25}/><strong>{title}</strong><span>{detail}</span>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Yeniden dene</Button>}</Card>;
}

export function SuccessState({ title, detail }: { title: string; detail?: string }) {
  return <Card className="success-state"><CheckCircle2 size={20}/><div><strong>{title}</strong>{detail && <p>{detail}</p>}</div></Card>;
}
