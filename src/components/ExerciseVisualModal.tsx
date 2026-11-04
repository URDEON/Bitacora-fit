import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Eye, Play, Pause, Trash2, X, Sparkles, AlertTriangle } from 'lucide-react';
import { ExerciseVisualInfo } from '../types';
import { MuscleMapSVG } from './MuscleMapSVG';
import { ConfirmDialogOptions, useDialog } from './ConfirmDialog';
import { compressImageFileToDataUrl } from '../services/storage';
import { SUPPORTED_IMAGE_ACCEPT, validateImageFile } from '../services/imageValidation';

interface ExerciseVisualModalProps {
  info: ExerciseVisualInfo;
  customPhotos: string[];
  onAddCustomPhoto: (exerciseName: string, dataUrl: string) => void;
  onRemoveCustomPhoto: (exerciseName: string, index: number) => void;
  onSelectExercise: (info: ExerciseVisualInfo) => void;
  onClose: () => void;
}

export const ExerciseVisualModal: React.FC<ExerciseVisualModalProps> = ({
  info,
  customPhotos,
  onAddCustomPhoto,
  onRemoveCustomPhoto,
  onSelectExercise,
  onClose,
}) => {
  const allPhotos = [...customPhotos, ...info.images];
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [photoError, setPhotoError] = useState('');
  const { confirm: confirmDialog } = useDialog();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]') || []).filter(item => item.offsetParent !== null);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [onClose]);

  useEffect(() => {
    if (!autoPlay || allPhotos.length < 2) return;
    const id = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % allPhotos.length);
    }, 950);
    return () => window.clearInterval(id);
  }, [autoPlay, allPhotos.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPhotoError('');
    if (files.length + customPhotos.length > 8) { setPhotoError('Puedes guardar hasta 8 fotos propias por ejercicio.'); e.target.value = ''; return; }
    setUploading(true);
    try {
      // Se valida el contenido real de todos los archivos antes de guardar ninguno.
      for (const file of Array.from(files)) await validateImageFile(file);
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFileToDataUrl(files[i]);
        onAddCustomPhoto(info.name, compressed);
      }
      setActiveSlide(0);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'No se pudo procesar la foto.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getSlideCaption = (idx: number) => {
    if (idx < customPhotos.length) {
      return `Mi foto guardada #${idx + 1} (Máquina / Ajuste personal)`;
    }
    const baseIdx = idx - customPhotos.length;
    if (baseIdx === 0) return 'Imagen 1 — Posición Inicial / Preparación';
    if (baseIdx === 1) return 'Imagen 2 — Ejecución / Punto de Contracción';
    if (baseIdx === 2) return 'Imagen 3 — Variante / Ángulo Alternativo (Inicio)';
    return `Imagen ${baseIdx + 1} — Variante / Ángulo Alternativo (Final)`;
  };

  const isCustomSlide = activeSlide < customPhotos.length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-guide-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="visual-modal-header">
          <div>
            <div className="visual-badge-row">
              <span className="s20-badge">{info.category}</span>
              <span className="s20-badge equip">Equipo: {info.equipment}</span>
            </div>
            <h2 id="exercise-guide-title" className="block-title">
              {info.name}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="visual-stage">
          {allPhotos.length > 0 && (
            <img src={allPhotos[activeSlide] || allPhotos[0]} alt={info.name} />
          )}

          <div className="visual-overlay-top">
            <span className="mono-num visual-caption-pill">
              {getSlideCaption(activeSlide)}
            </span>

            {isCustomSlide && (
              <button
                type="button"
                className="visual-float-btn danger"
                onClick={async () => {
                  const slideToRemove = activeSlide;
                  const confirmOpts: ConfirmDialogOptions = {
                    title: 'Eliminar foto',
                    message: '¿Eliminar esta foto del ejercicio?',
                    confirmLabel: 'Eliminar',
                    tone: 'danger',
                  };
                  if (await confirmDialog(confirmOpts)) {
                    onRemoveCustomPhoto(info.name, slideToRemove);
                    setActiveSlide(0);
                  }
                }}
              >
                <Trash2 size={13} /> Borrar foto
              </button>
            )}
          </div>

          <div className="visual-overlay-bottom">
            {allPhotos.length > 1 && (
              <button
                type="button"
                className={`visual-float-btn ${autoPlay ? 'active' : ''}`}
                onClick={() => setAutoPlay((v) => !v)}
              >
                {autoPlay ? <Pause size={13} /> : <Play size={13} />}
                {autoPlay ? 'Pausar demostración' : 'Animar movimiento'}
              </button>
            )}

            <button
              type="button"
              className="visual-float-btn upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera size={13} />
              {uploading ? 'Guardando…' : '+ Mi foto / máquina'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_IMAGE_ACCEPT}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        {!allPhotos.length && (
          <p className="empty-inline">
            Este ejercicio todavía no tiene fotos específicas. Agrega las tuyas para consultarlas sin conexión.
          </p>
        )}
        {photoError && (
          <p role="alert" className="field-error">
            {photoError}
          </p>
        )}

        <div className="visual-thumbs-strip">
          {allPhotos.map((src, idx) => (
            <button
              key={idx}
              type="button"
              className={`visual-thumb-item ${activeSlide === idx ? 'active' : ''}`}
              aria-label={`Ver imagen ${idx + 1} de ${info.name}`}
              aria-pressed={activeSlide === idx}
              onClick={() => {
                setAutoPlay(false);
                setActiveSlide(idx);
              }}
            >
              <img src={src} alt={`Vista ${idx + 1}`} />
              <span className="visual-thumb-idx">#{idx + 1}</span>
            </button>
          ))}
        </div>

        <div className="visual-hint-card">
          <div className="visual-hint-title">
            <Eye size={14} /> ¿Cómo identificarlo en el gimnasio?
          </div>
          <p className="ticket-meta" style={{ color: 'var(--text-main)' }}>
            {info.detectionHint}
          </p>
        </div>

        <div>
          <div className="lbl">
            <span>
              <Sparkles size={14} /> Detección de músculos trabajados
            </span>
          </div>
          <MuscleMapSVG primary={info.primaryMuscles} secondary={info.secondaryMuscles} />
        </div>

        <div className="visual-cues-card">
          <div className="lbl">
            <span>Técnica clave paso a paso</span>
          </div>
          {info.cues.map((cue, idx) => (
            <div key={idx} className="visual-cue-row">
              <CheckCircle2 size={15} />
              <span>{cue}</span>
            </div>
          ))}
          {info.avoid && (
            <div className="visual-avoid-row">
              <AlertTriangle size={15} />
              <span>Evita: {info.avoid}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-main"
          onClick={() => {
            onSelectExercise(info);
            onClose();
          }}
        >
          Usar este ejercicio en mi bitácora
        </button>
      </div>
    </div>
  );
};
