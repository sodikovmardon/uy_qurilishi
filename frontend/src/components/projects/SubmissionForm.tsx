import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import { DEFAULT_REGION_ID, REGIONS } from '../../config/regions';
import { PROJECT_FEATURE_OPTIONS, type ProjectFeature } from '../../lib/calculator';
import { submitProject } from '../../lib/submissions';
import { useApp } from '../../context/AppContext';
import { vibrate } from '../../lib/haptics';
import Button from '../ui/Button';
import CompassWidget from './CompassWidget';
import { ORIENTATION_BY_ID, type OrientationId } from '../../lib/orientation';
import { DRAWING_SUBTYPE_OPTIONS, DRAWING_TYPE_OPTIONS } from './TechnicalDrawingsSection';
import FloorPlanGenerator from '../floorplan/FloorPlanGenerator';

interface ImageEntry {
  name: string;
  dataUrl: string;
  progress: number;
}

/** A technical drawing attached during submission (PDF / JPG / PNG / DWG / DXF). */
interface DrawingDraft {
  id: string;
  name: string;
  ext: string;
  size: number;
  type: string;
  subtype: string;
  title: string;
  floorNumber: string;
  /** Previewable content (image/pdf under 2 MB); '' for large raw files. */
  dataUrl: string;
}

interface Errors {
  title?: string;
  description?: string;
  rooms?: string;
  area?: string;
  storeys?: string;
  region?: string;
  images?: string;
}

/**
 * "Loyiha yuklash" — submission form with validation, drag-and-drop multi-image
 * upload with per-image progress, and redirect to "Mening loyihalarim".
 *
 * NOTE: uploads are stored locally (dataURLs). Replace with real multipart
 * upload to POST /api/projects/submit/ when the backend supports it.
 */
export default function SubmissionForm() {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rooms, setRooms] = useState('4');
  const [area, setArea] = useState('120');
  const [storeys, setStoreys] = useState('1');
  const [region, setRegion] = useState(DEFAULT_REGION_ID);
  const [features, setFeatures] = useState<ProjectFeature[]>([]);
  const [orientation, setOrientation] = useState<OrientationId | null>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [drawings, setDrawings] = useState<DrawingDraft[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [dragOver, setDragOver] = useState(false);
  const [drawDragOver, setDrawDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();
  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
  const CAD_EXTS = ['dwg', 'dxf'];
  const DRAWING_ACCEPT = ['pdf', ...IMAGE_EXTS, ...CAD_EXTS];

  const addDrawings = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming: DrawingDraft[] = Array.from(files).map((f) => {
      const ext = extOf(f.name);
      const previewable = IMAGE_EXTS.includes(ext) || (ext === 'pdf' && f.size <= 2 * 1024 * 1024);
      return {
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        ext,
        size: f.size,
        type: 'plan',
        subtype: '',
        title: f.name.replace(/\.[^.]+$/, ''),
        floorNumber: '',
        dataUrl: '',
      };
    });
    setDrawings((prev) => [...prev, ...incoming]);
    incoming.forEach((d) => {
      const previewable = IMAGE_EXTS.includes(d.ext) || (d.ext === 'pdf' && d.size <= 2 * 1024 * 1024);
      if (!previewable) return;
      const file = Array.from(files).find((f) => f.name === d.name);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setDrawings((prev) => prev.map((x) => (x.id === d.id ? { ...x, dataUrl: String(reader.result) } : x)));
      };
      reader.readAsDataURL(file);
    });
  };

  const patchDrawing = (id: string, patch: Partial<DrawingDraft>) => {
    setDrawings((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDrawing = (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming: ImageEntry[] = Array.from(files).slice(0, 6).map((f) => ({
      name: f.name,
      dataUrl: '',
      progress: 0,
    }));
    // Read each as a dataURL (simulates an upload that will be stored locally).
    incoming.forEach((entry, i) => {
      const file = Array.from(files)[i]!;
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => prev.map((im) => (im.name === entry.name ? { ...im, dataUrl: String(reader.result) } : im)));
      };
      reader.readAsDataURL(file);
    });
    setImages((prev) => [...prev, ...incoming].slice(0, 6));
    setErrors((e) => ({ ...e, images: undefined }));
  };

  const removeImage = (name: string) => {
    setImages((prev) => prev.filter((im) => im.name !== name));
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (title.trim().length < 3) errs.title = 'Loyiha nomi kamida 3 belgi bo’lishi kerak';
    if (description.trim().length < 10) errs.description = 'Tavsif kamida 10 belgi bo’lishi kerak';
    const r = Number(rooms);
    if (!Number.isFinite(r) || r < 1 || r > 50) errs.rooms = 'Xonalar soni 1–50 oralig’ida bo’lishi kerak';
    const a = Number(area);
    if (!Number.isFinite(a) || a < 20 || a > 5000) errs.area = 'Maydon 20–5000 m² oralig’ida bo’lishi kerak';
    const s = Number(storeys);
    if (!Number.isFinite(s) || s < 1 || s > 5) errs.storeys = 'Qavatlar soni 1–5 bo’lishi kerak';
    if (images.length === 0) errs.images = 'Kamida 1 ta rasm/chizma yuklang';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    // Simulate async per-image upload progress.
    const done = images.map((img) => new Promise<void>((resolve) => {
      const tick = () => {
        setImages((prev) =>
          prev.map((im) => (im.name === img.name ? { ...im, progress: Math.min(100, im.progress + 30) } : im)),
        );
      };
      const iv = setInterval(() => {
        tick();
      }, 120);
      setTimeout(() => {
        clearInterval(iv);
        setImages((prev) => prev.map((im) => (im.name === img.name ? { ...im, progress: 100 } : im)));
        resolve();
      }, 700);
    }));
    await Promise.all(done);

    submitProject({
      title: title.trim(),
      description: description.trim(),
      rooms: Number(rooms),
      area: Number(area),
      storeys: Number(storeys),
      region,
      features,
      orientation: orientation ? ORIENTATION_BY_ID[orientation].label : undefined,
      images: images.filter((im) => im.dataUrl).map(({ name, dataUrl }) => ({ name, dataUrl })),
      technicalDrawings: drawings.map(({ id: _id, ...rest }) => rest),
    });
    vibrate(10);
    showToast('Loyiha yuborildi, ko’rib chiqilmoqda', 'success');
    navigate('/profil?tab=loyihalarim');
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const onDropDrawings = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrawDragOver(false);
    addDrawings(e.dataTransfer.files);
  };

  const inputClass = (field: string) => `control${errors[field as keyof Errors] ? ' is-invalid' : ''}`;

  return (
    <form className="card-surface submission-form fade-in" onSubmit={handleSubmit} noValidate>
      <div className="section-head" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24 }}>Loyiha yuklash</h2>
        <p>Loyihangizni yuboring — mutaxassislar ko’rib chiqib, katalogga qo’shadi</p>
      </div>

      <div className="submission-grid">
        <div className="flex flex-col gap-5">
          <div className="field">
            <label htmlFor="sub-title">
              Loyiha nomi <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              id="sub-title"
              className={inputClass('title')}
              value={title}
              placeholder="Masalan: 2 qavatli oilaviy uy"
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="field">
            <label htmlFor="sub-desc">
              Tavsif <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <textarea
              id="sub-desc"
              className={`control control-area${errors.description ? ' is-invalid' : ''}`}
              rows={3}
              value={description}
              placeholder="Uy rejasi, xonalar, qurilish materiallari haqida qisqacha"
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="calc-row-2">
            <div className="field">
              <label htmlFor="sub-rooms">
                Xonalar <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input id="sub-rooms" className={inputClass('rooms')} type="number" min={1} max={50} value={rooms} onChange={(e) => setRooms(e.target.value)} />
              {errors.rooms && <span className="error-text">{errors.rooms}</span>}
            </div>
            <div className="field">
              <label htmlFor="sub-area">
                Maydon (m²) <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input id="sub-area" className={inputClass('area')} type="number" min={20} max={5000} value={area} onChange={(e) => setArea(e.target.value)} />
              {errors.area && <span className="error-text">{errors.area}</span>}
            </div>
          </div>

          <div className="calc-row-2">
            <div className="field">
              <label htmlFor="sub-storeys">
                Qavatlar <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <select id="sub-storeys" className="control" value={storeys} onChange={(e) => setStoreys(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} qavat</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sub-region">
                Viloyat <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <select id="sub-region" className="control" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="tile-label">Qo’shimcha xususiyatlar</span>
            <div className="feature-chip-grid">
              {PROJECT_FEATURE_OPTIONS.map((opt) => {
                const active = features.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    className={`feature-chip${active ? ' is-active' : ''}`}
                    onClick={() =>
                      setFeatures((prev) =>
                        active ? prev.filter((f) => f !== opt.value) : [...prev, opt.value],
                      )
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <span className="tile-label" id="sub-orientation-label">
              Quyosh yo'nalishi <span className="hint-muted">(ixtiyoriy)</span>
            </span>
            <div className="submission-orientation">
              <CompassWidget
                value={orientation}
                onChange={setOrientation}
                size={180}
                labelledBy="sub-orientation-label"
              />
              <div className="submission-orientation-side">
                {orientation ? (
                  <>
                    <p className="submission-orientation-selected">
                      Tanlangan: <strong>{ORIENTATION_BY_ID[orientation].label}</strong>
                    </p>
                    <p className="submission-orientation-hint">{ORIENTATION_BY_ID[orientation].summary}</p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setOrientation(null)}
                    >
                      Tozalash
                    </button>
                  </>
                ) : (
                  <p className="submission-orientation-hint">
                    Kompasdan bino qaysi tomonga qaraganini belgilang — maslahat loyihangizga ilova qilinadi.
                  </p>
                )}
              </div>
            </div>
          </div>

          <FloorPlanGenerator
            totalArea={Number(area) || 120}
            rooms={Number(rooms) || 4}
            storeys={Number(storeys) || 1}
            hasGarage={features.includes('garage')}
            hasPool={features.includes('pool')}
            hasTerrace={features.includes('terrace')}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="tile-label">Rasmlar / chizmalar</span>
            <div
              className={`upload-dropzone${dragOver ? ' is-dragging' : ''}${errors.images ? ' is-invalid' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Rasm yuklash"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
              }}
            >
              <UploadCloud className="w-8 h-8" />
              <p>Rasmlarni shu yerga tashlang yoki bosing</p>
              <span>PNG, JPG — har biriga 5 MB gacha</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            {errors.images && <span className="error-text">{errors.images}</span>}
          </div>

          {images.length > 0 && (
            <div className="upload-thumbs">
              {images.map((img) => (
                <div key={img.name} className="upload-thumb">
                  {img.dataUrl ? <img src={img.dataUrl} alt={img.name} /> : (
                    <span className="upload-thumb-empty">
                      <ImagePlus className="w-5 h-5" />
                    </span>
                  )}
                  <button type="button" className="upload-thumb-remove" aria-label={`${img.name} ni olib tashlash`} onClick={() => removeImage(img.name)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="upload-thumb-name">{img.name}</span>
                  <span className="upload-thumb-bar">
                    <span className="upload-thumb-fill" style={{ width: `${img.progress}%` }} />
                  </span>
                  {img.progress < 100 && <Loader2 className="upload-thumb-spin w-4 h-4 animate-spin" />}
                </div>
              ))}
            </div>
          )}

          <div>
            <span className="tile-label">Texnik chizmalar</span>
            <div
              className={`upload-dropzone${drawDragOver ? ' is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrawDragOver(true);
              }}
              onDragLeave={() => setDrawDragOver(false)}
              onDrop={onDropDrawings}
              onClick={() => drawingRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Texnik chizma yuklash"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') drawingRef.current?.click();
              }}
            >
              <FileText className="w-8 h-8" />
              <p>Texnik chizmalarni shu yerga tashlang yoki bosing</p>
              <span>PDF, JPG, PNG, DWG, DXF</span>
              <input
                ref={drawingRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.dwg,.dxf"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  addDrawings(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {drawings.length > 0 && (
            <div className="drawing-drafts">
              {drawings.map((d) => (
                <div key={d.id} className="drawing-draft">
                  <div className="drawing-draft-head">
                    <span className="drawing-draft-file">
                      {d.dataUrl && IMAGE_EXTS.includes(d.ext) ? (
                        <img src={d.dataUrl} alt={d.name} />
                      ) : (
                        <span className="drawing-draft-icon">
                          <FileText className="w-5 h-5" />
                          <em>{d.ext.toUpperCase()}</em>
                        </span>
                      )}
                      <span className="drawing-draft-name" title={d.name}>{d.name}</span>
                    </span>
                    <button type="button" className="upload-thumb-remove" aria-label={`${d.name} ni olib tashlash`} onClick={() => removeDrawing(d.id)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="drawing-draft-fields">
                    <label className="field">
                      <span className="drawing-draft-lbl">Turi</span>
                      <select
                        className="control"
                        value={d.type}
                        onChange={(e) => patchDrawing(d.id, { type: e.target.value, subtype: '' })}
                      >
                        {DRAWING_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    {d.type === 'kommunikatsiya' && (
                      <label className="field">
                        <span className="drawing-draft-lbl">Tur</span>
                        <select
                          className="control"
                          value={d.subtype}
                          onChange={(e) => patchDrawing(d.id, { subtype: e.target.value })}
                        >
                          <option value="">Umumiy</option>
                          {DRAWING_SUBTYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {d.type === 'plan' && (
                      <label className="field">
                        <span className="drawing-draft-lbl">Qavat</span>
                        <input
                          className="control"
                          type="number"
                          min={0}
                          max={50}
                          value={d.floorNumber}
                          placeholder="1"
                          onChange={(e) => patchDrawing(d.id, { floorNumber: e.target.value })}
                        />
                      </label>
                    )}
                    <label className="field">
                      <span className="drawing-draft-lbl">Nomi</span>
                      <input
                        className="control"
                        value={d.title}
                        maxLength={200}
                        onChange={(e) => patchDrawing(d.id, { title: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Yuborilmoqda…' : 'Loyihani yuborish'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/loyihalar')}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}
