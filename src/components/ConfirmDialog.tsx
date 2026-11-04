import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export interface AlertDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
}

export interface ActiveDialogEntry {
  id: number;
  kind: 'confirm' | 'alert';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: 'default' | 'danger';
  resolve: (accepted: boolean) => void;
}

export interface DialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions) => Promise<void>;
}

const fallbackDialogApi: DialogContextValue = {
  confirm: async () => false,
  alert: async () => undefined,
};

export const DialogContext = createContext<DialogContextValue>(fallbackDialogApi);

export function useDialog(): DialogContextValue {
  return useContext(DialogContext);
}

export function useDialogController() {
  const [dialog, setDialog] = useState<ActiveDialogEntry | null>(null);
  const activeRef = useRef<ActiveDialogEntry | null>(null);
  const queueRef = useRef<ActiveDialogEntry[]>([]);
  const nextIdRef = useRef(1);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setDialog(next);
  }, []);

  const enqueue = useCallback((entry: Omit<ActiveDialogEntry, 'id'>) => {
    const fullEntry: ActiveDialogEntry = { ...entry, id: nextIdRef.current++ };
    if (!activeRef.current) {
      activeRef.current = fullEntry;
      setDialog(fullEntry);
    } else {
      queueRef.current.push(fullEntry);
    }
  }, []);

  const resolveCurrent = useCallback(
    (accepted: boolean) => {
      const current = activeRef.current;
      if (!current) return false;
      showNext();
      current.resolve(accepted);
      return true;
    },
    [showNext],
  );

  const dismissCurrentDialog = useCallback(() => resolveCurrent(false), [resolveCurrent]);

  const confirm = useCallback(
    (options: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({
          kind: 'confirm',
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || 'Confirmar',
          cancelLabel: options.cancelLabel || 'Cancelar',
          tone: options.tone || 'default',
          resolve,
        });
      }),
    [enqueue],
  );

  const alert = useCallback(
    (options: AlertDialogOptions) =>
      new Promise<void>((resolve) => {
        enqueue({
          kind: 'alert',
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || 'Entendido',
          tone: 'default',
          resolve: () => resolve(),
        });
      }),
    [enqueue],
  );

  const dialogApi = useMemo<DialogContextValue>(() => ({ confirm, alert }), [confirm, alert]);

  return {
    dialog,
    dialogApi,
    resolveCurrent,
    dismissCurrentDialog,
  };
}

interface ConfirmDialogProps {
  dialog: ActiveDialogEntry | null;
  onResolve: (accepted: boolean) => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ dialog, onResolve }) => {
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (dialog.kind === 'confirm' && dialog.tone === 'danger' && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    } else {
      confirmBtnRef.current?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onResolve(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') || [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        event.stopImmediatePropagation();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [dialog, onResolve]);

  if (!dialog) return null;

  const isDanger = dialog.tone === 'danger';

  return (
    <div
      className="dialog-backdrop"
      onClick={() => onResolve(false)}
    >
      <div
        ref={cardRef}
        className="dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <span className={`dialog-icon ${isDanger ? 'danger' : ''}`} aria-hidden="true">
            {isDanger ? <AlertTriangle size={20} /> : <Info size={20} />}
          </span>
          <h2 id={titleId} className="title-heavy dialog-title">
            {dialog.title}
          </h2>
        </div>
        <p id={descId} className="dialog-message">
          {dialog.message}
        </p>
        <div className={`dialog-actions ${dialog.kind === 'alert' ? 'single' : ''}`}>
          {dialog.kind === 'confirm' && (
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn-main subtle"
              onClick={() => onResolve(false)}
            >
              {dialog.cancelLabel || 'Cancelar'}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn-main ${isDanger ? 'danger-solid' : ''}`}
            onClick={() => onResolve(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
