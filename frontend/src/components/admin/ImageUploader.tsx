import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Trash2, UploadCloud } from 'lucide-react';
import { prepareUploads, MAX_IMAGE_COUNT } from '../../lib/image';
import type { UploadImage } from '../../api/client';

interface ImageUploaderProps {
  /** Current ordered image URLs; the first entry is the primary. */
  images: string[];
  /** Local state update after upload / reorder / removal. */
  onChange: (images: string[]) => void;
  /** Uploads files (parent chooses the endpoint), returns the full ordered list. */
  onUpload: (files: UploadImage[], onProgress: (done: number, total: number) => void) => Promise<string[]>;
  /** Persists order/removals through the backend reorder endpoint. */
  onPersist: (images: string[]) => Promise<void>;
  disabled?: boolean;
}

export default function ImageUploader({
  images,
  onChange,
  onUpload,
  onPersist,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleFiles = async (list: FileList | File[] | null) => {
    if (!list || !list.length || disabled) return;
    setError('');
    if (images.length + list.length > MAX_IMAGE_COUNT) {
      setError(`Maksimal ${MAX_IMAGE_COUNT} ta rasm yuklash mumkin`);
      return;
    }
    try {
      const prepared = await prepareUploads([...list]);
      const next = await onUpload(prepared, (done, total) => {
        setProgress(total ? Math.round((done / total) * 100) : null);
      });
      setProgress(null);
      onChange(next);
      void onPersist(next).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuklashda xato');
    } finally {
      setProgress(null);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    const a = next[i]!;
    const b = next[j]!;
    next[i] = b;
    next[j] = a;
    onChange(next);
    void onPersist(next).catch(() => {});
  };

  const remove = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange(next);
    void onPersist(next).catch(() => {});
  };

  return (
    <div className="admin-img-upload" role="group" aria-label="Mahsulot rasmlari">
      {images.length > 0 && (
        <div className="admin-img-grid">
          {images.map((src, i) => (
            <div key={src} className="admin-img-item">
              <img src={src} alt={`Rasm ${i + 1}`} loading="lazy" />
              {i === 0 && (
                <span className="admin-img-primary">
                  <Star className="w-3 h-3" />
                  Asosiy rasm
                </span>
              )}
              <span className="admin-img-index">{i + 1}</span>
              <div className="admin-img-item-actions">
                <button
                  type="button"
                  aria-label="Chapga surish"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="O'ngga surish"
                  disabled={i === images.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button type="button" aria-label="O'chirish" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled && images.length < MAX_IMAGE_COUNT && (
        <button
          type="button"
          className={`admin-img-dropzone${dragOver ? ' is-dragover' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <UploadCloud className="w-6 h-6" />
          <span>{dragOver ? 'Qo‘yib yuboring' : 'Rasmlarni shu yerga tashlang yoki tanlang'}</span>
          <em>JPG · PNG · WebP · har biri 5 MB gacha</em>
        </button>
      )}

      {disabled && (
        <p className="admin-img-hint">Mahsulotni saqlagach, rasmlarni qo‘shishingiz mumkin.</p>
      )}

      {progress !== null && (
        <div className="admin-img-progress-wrap">
          <div className="admin-img-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="admin-img-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
      )}

      {error && <p className="store-order-error">{error}</p>}
    </div>
  );
}
