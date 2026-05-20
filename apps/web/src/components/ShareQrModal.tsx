'use client';

import { useEffect, useRef, useState } from 'react';
import { QrCode, X, Printer, Copy, Check, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '@/lib/api';

export type ShareReportType =
  | 'ENTRADAS'
  | 'HIGIENIZACAO'
  | 'DESINFECAO'
  | 'OLEOS'
  | 'TEMPERATURAS'
  | 'CHECKLISTS';

interface Props {
  open: boolean;
  onClose: () => void;
  type: ShareReportType;
  label: string;
  params: Record<string, string | undefined>;
  clientId?: string;
  variant?: 'modal' | 'sheet';
}

const TYPE_LABELS: Record<ShareReportType, string> = {
  ENTRADAS: 'Controlo de Entradas (R1)',
  HIGIENIZACAO: 'Registo de Higienização (R3)',
  DESINFECAO: 'Registo de Desinfeção (R4)',
  OLEOS: 'Controlo de Óleos de Fritura (R6)',
  TEMPERATURAS: 'Controlo de Temperaturas (R2)',
  CHECKLISTS: 'Checklists HACCP',
};

export default function ShareQrModal({ open, onClose, type, label, params, clientId, variant = 'modal' }: Props) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const shareUrl = shareId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareId}` : '';

  useEffect(() => {
    if (!open) { setShareId(null); return; }
    setLoading(true);
    api.post('/shares', { type, label, params, clientId })
      .then(r => setShareId(r.data.id))
      .catch(() => {/* silencioso */})
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function copy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printQr() {
    const svgEl = qrRef.current?.querySelector('svg');
    const svgHtml = svgEl?.outerHTML ?? '';
    const logoUrl = `${window.location.origin}/logo.png`;
    const now = new Date().toLocaleString('pt-PT');

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>QR Code HACCP — HACCP</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;background:#fff}
  .logo{max-height:60px;margin-bottom:24px}
  .type{font-size:13px;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
  h1{font-size:22px;color:#1d4ed8;margin-bottom:4px;text-align:center}
  .period{font-size:14px;color:#374151;margin-bottom:28px}
  .qr{padding:16px;border:2px solid #e5e7eb;border-radius:12px;margin-bottom:20px}
  .url{font-size:11px;color:#9ca3af;word-break:break-all;max-width:340px;text-align:center;margin-bottom:24px}
  .footer{font-size:11px;color:#d1d5db;text-align:center}
  @media print{@page{margin:10mm}}
</style></head><body>
<img class="logo" src="${logoUrl}" alt="HACCP" />
<p class="type">Controlo HACCP</p>
<h1>${TYPE_LABELS[type]}</h1>
<p class="period">${label}</p>
<div class="qr">${svgHtml}</div>
<p class="url">${shareUrl}</p>
<p class="footer">Documento gerado em ${now} via HACCP</p>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  if (!open) return null;

  const isSheet = variant === 'sheet';

  const content = (
    <div className={isSheet ? 'bg-surface-2 rounded-t-2xl p-6 pb-10 space-y-4' : 'space-y-4'} onClick={e => e.stopPropagation()}>
      {isSheet && <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />}

      <div className="flex items-start justify-between">
        <div>
          <p className={`font-bold text-gray-900 ${isSheet ? 'text-lg' : 'text-base'}`}>
            <QrCode className="inline h-5 w-5 mr-1.5 text-blue-600" />
            Partilhar via QR Code
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-400 hover:bg-surface-3">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500">A gerar link...</p>
        </div>
      )}

      {!loading && shareId && (
        <>
          <div ref={qrRef} className="flex justify-center p-4 bg-surface-2 border border-gray-200 rounded-xl">
            <QRCode value={shareUrl} size={180} />
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <span className="flex-1 text-xs text-gray-400 truncate">{shareUrl}</span>
            <button onClick={copy} className="shrink-0 p-1 text-gray-400 hover:text-blue-600">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            O inspector pode digitalizar o QR code para aceder ao relatório sem necessidade de login.
          </p>

          <button
            type="button"
            onClick={printQr}
            className={`w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700 ${isSheet ? 'py-4 text-base' : 'py-2.5 text-sm'}`}
          >
            <Printer className="h-4 w-4" /> Imprimir QR Code
          </button>
        </>
      )}
    </div>
  );

  if (isSheet) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface-2 rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
