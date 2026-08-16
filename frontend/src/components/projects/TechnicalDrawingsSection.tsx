import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { TechnicalDrawing } from '../../api/client';
import { api } from '../../api/client';
import SmartImage from '../ui/SmartImage';

export const DRAWING_GROUP_ORDER = ['fasad', 'plan', 'kesim', 'kommunikatsiya', 'fundament'] as const;

export const DRAWING_TYPE_OPTIONS = [
  { value: 'fasad', label: 'Fasad chizmasi' },
  { value: 'plan', label: 'Qavat rejasi' },
  { value: 'kesim', label: 'Kesim chizmasi' },
  { value: 'kommunikatsiya', label: 'Kommunikatsiya sxemasi' },
  { value: 'fundament', label: 'Fundament rejasi' },
] as const;

export const DRAWING_SUBTYPE_OPTIONS = [
  { value: 'elektr', label: 'Elektr sxemasi' },
  { value: 'vodoprovod', label: 'Suv ta’minoti sxemasi' },
] as const;

export const DRAWING_GROUP_LABEL: Record<string, string> = {
  fasad: 'Fasad chizmalari',
  plan: 'Qavat rejalari',
  kesim: 'Kesim chizmalari',
  kommunikatsiya: 'Kommunikatsiya sxemalari',
  fundament: 'Fundament rejalari',
};

export const DRAWING_SUBTYPE_LABEL: Record<string, string> = {
  elektr: 'Elektr sxemasi',
  vodoprovod: 'Suv ta’minoti sxemasi',
};

const IMAGE_EXTS = new Set(['jpg', 'png', 'webp']);
const CAD_EXTS = new Set(['dwg', 'dxf']);

interface Subgroup {
  label: string;
  list: TechnicalDrawing[];
}

interface Group {
  type: string;
  label: string;
  subgroups: Subgroup[];
}

function isImage(d: TechnicalDrawing): boolean {
  return IMAGE_EXTS.has(d.file_ext.toLowerCase());
}
function isPdf(d: TechnicalDrawing): boolean {
  return d.file_ext.toLowerCase() === 'pdf';
}

function fmtBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-effort file size for CAD/raw attachments (HEAD request). */
function useFileSize(url: string): number | null {
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: 'HEAD' })
      .then((r) => {
        const len = Number(r.headers.get('content-length'));
        if (!cancelled && Number.isFinite(len) && len > 0) setSize(len);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  return size;
}

function CardMeta({ drawing }: { drawing: TechnicalDrawing }) {
  const ext = drawing.file_ext.toUpperCase();
  return (
    <span className="drawing-card-meta">
      <span className="drawing-card-title">{drawing.title || ext}</span>
      <span className="drawing-card-sub">
        {ext}
        {drawing.floor_number != null && ` · ${drawing.floor_number}-qavat`}
      </span>
    </span>
  );
}

/** Thumbnail card for one drawing. */
function DrawingCard({ drawing, onOpen }: { drawing: TechnicalDrawing; onOpen: () => void }) {
  if (isCad(drawing)) {
    return <CadCard drawing={drawing} />;
  }
  const preview = isImage(drawing) ? drawing.file_url : drawing.preview_url;
  return (
    <button type="button" className="drawing-card" onClick={onOpen} aria-label={drawing.title || 'Chizma'}>
      {preview ? (
        <SmartImage
          src={preview}
          alt={drawing.title || (DRAWING_GROUP_LABEL[drawing.type] ?? 'Chizma')}
          fallback={<DrawingFallback drawing={drawing} />}
        />
      ) : (
        <DrawingFallback drawing={drawing} />
      )}
      <CardMeta drawing={drawing} />
    </button>
  );
}

function isCad(drawing: TechnicalDrawing): boolean {
  return CAD_EXTS.has(drawing.file_ext.toLowerCase());
}

/** CAD source files (DWG/DXF) are raw downloads — no inline preview. */
function CadCard({ drawing }: { drawing: TechnicalDrawing }) {
  const size = useFileSize(drawing.file_url);
  return (
    <a className="drawing-card drawing-card-file" href={drawing.file_url} download aria-label={drawing.title || 'CAD fayl'}>
      <span className="drawing-file-icon">
        <FileText className="w-6 h-6" />
        <em>{drawing.file_ext.toUpperCase()}</em>
      </span>
      <CardMeta drawing={drawing} />
      <span className="drawing-card-dl">
        <Download className="w-4 h-4" />
      </span>
    </a>
  );
}

function DrawingFallback({ drawing }: { drawing: TechnicalDrawing }) {
  return (
    <span className="drawing-fallback">
      <FileText className="w-7 h-7" />
      <em>{drawing.file_ext.toUpperCase()}</em>
    </span>
  );
}

/** Accordion group: labeled sub-section with a count and collapsible cards. */
function DrawingGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div className="drawing-group">
      <button
        type="button"
        className="transparency-toggle drawing-group-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="drawing-group-count">({count})</span>
        <ChevronDown className={`w-4 h-4 chevron${open ? ' open' : ''}`} />
      </button>
      {open && <div className="drawing-group-body fade-in">{children}</div>}
    </div>
  );
}

interface LightboxProps {
  drawings: TechnicalDrawing[];
  startIndex: number;
  onClose: () => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Full-screen viewer:
 *  - images: scroll-to-zoom (desktop) / pinch-to-zoom (mobile) + pan while zoomed
 *  - PDFs: browser-native embedded viewer + download
 *  - CAD: plain download card
 * Swipe / arrows move between the open group's drawings.
 */
function DrawingsLightbox({ drawings, startIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(() => clamp(startIndex, 0, Math.max(0, drawings.length - 1)));
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [broken, setBroken] = useState(false);
  const touchRef = useRef<{ x: number; y: number; dist: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const current = drawings[idx];

  const go = (dir: number) => {
    setIdx((i) => clamp(i + dir, 0, drawings.length - 1));
    setScale(1);
    setPan({ x: 0, y: 0 });
    setBroken(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, drawings.length]);

  const zoomAt = (factor: number) => {
    setScale((s) => clamp(s * factor, 1, 6));
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (scale > 1 || Math.abs(e.deltaY) > 2) e.preventDefault();
    setScale((s) => clamp(s * (e.deltaY < 0 ? 1.12 : 0.89), 1, 6));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = Math.abs(e.touches[0]!.clientX - e.touches[1]!.clientX);
      const dy = Math.abs(e.touches[0]!.clientY - e.touches[1]!.clientY);
      touchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, dist: Math.hypot(dx, dy) };
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, tx: pan.x, ty: pan.y };
      touchRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, dist: 0 };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const dx = Math.abs(e.touches[0]!.clientX - e.touches[1]!.clientX);
      const dy = Math.abs(e.touches[0]!.clientY - e.touches[1]!.clientY);
      const dist = Math.hypot(dx, dy);
      const ratio = touchRef.current.dist > 0 ? dist / touchRef.current.dist : 1;
      setScale((s) => clamp(s * ratio, 1, 6));
      touchRef.current.dist = dist;
    } else if (e.touches.length === 1 && scale > 1 && panStart.current) {
      const dx = e.touches[0]!.clientX - panStart.current.x;
      const dy = e.touches[0]!.clientY - panStart.current.y;
      setPan({ x: panStart.current.tx + dx, y: panStart.current.ty + dy });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (scale > 1) {
      touchRef.current = null;
      panStart.current = null;
      return;
    }
    const start = touchRef.current;
    const end = e.changedTouches[0];
    if (start && end) {
      const dx = end.clientX - start.x;
      const dy = end.clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        go(dx < 0 ? 1 : -1);
      }
    }
    touchRef.current = null;
    panStart.current = null;
  };

  const renderBody = () => {
    if (!current) return null;
    if (isImage(current)) {
      if (broken) {
        return (
          <div className="drawing-lightbox-error">
            <AlertTriangle className="w-8 h-8" />
            <p>Fayl ochilmadi</p>
          </div>
        );
      }
      return (
        <img
          className="drawing-lightbox-img"
          src={current.file_url}
          alt={current.title || 'Chizma'}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          draggable={false}
          onError={() => setBroken(true)}
        />
      );
    }
    if (isPdf(current)) {
      return (
        <iframe
          className="drawing-lightbox-pdf"
          src={current.file_url}
          title={current.title || 'PDF chizma'}
        />
      );
    }
    return (
      <div className="drawing-lightbox-cad">
        <FileText className="w-12 h-12" />
        <p className="drawing-lightbox-cad-name">{current.title || current.file_ext.toUpperCase()}</p>
        <a className="btn btn-primary" href={current.file_url} download>
          <Download className="w-4 h-4" />
          Yuklab olish
        </a>
      </div>
    );
  };

  return (
    <div className="lightbox drawing-lightbox" role="dialog" aria-modal="true" aria-label="Chizma kattalashtirilgan ko’rinish">
      <div className="drawing-lightbox-top">
        <span className="drawing-lightbox-title">
          {current?.title || (current ? DRAWING_GROUP_LABEL[current.type] ?? '' : '')}
          {current?.floor_number != null && ` · ${current.floor_number}-qavat`}
        </span>
        <div className="drawing-lightbox-tools">
          {current && isImage(current) && (
            <>
              <button type="button" aria-label="Kattalashtirish" onClick={() => zoomAt(1.25)}>
                <ZoomIn className="w-5 h-5" />
              </button>
              <button type="button" aria-label="Kichiklashtirish" onClick={() => zoomAt(0.8)}>
                <ZoomOut className="w-5 h-5" />
              </button>
              <button type="button" aria-label="Asl holatga qaytarish" onClick={resetView}>
                <Maximize2 className="w-5 h-5" />
              </button>
            </>
          )}
          {current && (
            <a className="drawing-lightbox-dl" href={current.file_url} download aria-label="Yuklab olish">
              <Download className="w-5 h-5" />
            </a>
          )}
          <button type="button" aria-label="Yopish" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {drawings.length > 1 && (
        <>
          <button type="button" className="lightbox-arrow prev" aria-label="Oldingi chizma" onClick={() => go(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" className="lightbox-arrow next" aria-label="Keyingi chizma" onClick={() => go(1)}>
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div
        className="lightbox-body drawing-lightbox-body"
        onClick={() => (current && isImage(current) && scale === 1 ? onClose() : undefined)}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {renderBody()}
      </div>
      {drawings.length > 1 && (
        <span className="lightbox-count">
          {idx + 1} / {drawings.length}
        </span>
      )}
    </div>
  );
}

interface Props {
  drawings: TechnicalDrawing[];
  projectId: number;
  /** Called when the "Chizma qo’shish" CTA is pressed on the empty state. */
  onAddDrawing?: () => void;
}

/**
 * "Texnik hujjatlar" tab content — grouped by drawing type with accordion
 * sections, thumbnail cards, full-screen lightbox and a ZIP download.
 * Mounted lazily by ProjectModal (only when the tab is opened).
 */
export default function TechnicalDrawingsSection({ drawings, projectId, onAddDrawing }: Props) {
  const [openLightbox, setOpenLightbox] = useState<{ list: TechnicalDrawing[]; index: number } | null>(null);
  const [zipBusy, setZipBusy] = useState(false);

  const groups: Group[] = useMemo(() => {
    return DRAWING_GROUP_ORDER.map((type) => {
      const inGroup = drawings.filter((d) => d.type === type);
      if (type !== 'kommunikatsiya' || inGroup.length === 0) {
        return { type, label: DRAWING_GROUP_LABEL[type] ?? type, subgroups: [{ label: DRAWING_GROUP_LABEL[type] ?? type, list: inGroup }] };
      }
      const elektr = inGroup.filter((d) => d.subtype === 'elektr');
      const vodoprovod = inGroup.filter((d) => d.subtype === 'vodoprovod');
      const rest = inGroup.filter((d) => d.subtype !== 'elektr' && d.subtype !== 'vodoprovod');
      return {
        type,
        label: DRAWING_GROUP_LABEL[type] ?? type,
        subgroups: [
          { label: DRAWING_SUBTYPE_LABEL.elektr ?? 'Elektr sxemasi', list: elektr },
          { label: DRAWING_SUBTYPE_LABEL.vodoprovod ?? 'Suv ta’minoti sxemasi', list: vodoprovod },
          { label: DRAWING_GROUP_LABEL.kommunikatsiya ?? 'Kommunikatsiya sxemalari', list: rest },
        ].filter((g) => g.list.length > 0),
      };
    });
  }, [drawings]);

  const hasDrawings = drawings.length > 0;

  const handleZip = () => {
    if (zipBusy) return;
    setZipBusy(true);
    const url = api.projectDrawingsZipUrl(projectId);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chizmalar.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => setZipBusy(false), 800);
  };

  if (!hasDrawings) {
    return (
      <div className="saved-empty fade-in">
        <FolderOpen size={140} style={{ color: 'var(--text-muted)' }} />
        <p>Bu loyiha uchun texnik chizmalar hali yuklanmagan</p>
        {onAddDrawing && (
          <button type="button" className="btn btn-secondary mt-3" onClick={onAddDrawing}>
            <FileText className="w-4 h-4" />
            Chizma qo’shish
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="drawings-section fade-in">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Texnik hujjatlar
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleZip} disabled={zipBusy}>
          <FileArchive className="w-4 h-4" />
          {zipBusy ? 'Tayyorlanmoqda…' : 'Barchasini yuklab olish (ZIP)'}
        </button>
      </div>

      <div className="drawing-groups">
        {groups.map((group) => {
          const count = group.subgroups.reduce((s, g) => s + g.list.length, 0);
          if (count === 0) return null;
          return (
            <DrawingGroup key={group.type} label={group.label} count={count}>
              {group.subgroups.map((sub) => (
                <div key={sub.label} className="drawing-subgroup">
                  {group.subgroups.length > 1 && <h4 className="drawing-subgroup-label">{sub.label}</h4>}
                  <div className="drawing-grid">
                    {sub.list.map((d, i) => (
                      <DrawingCard
                        key={d.file_url}
                        drawing={d}
                        onOpen={() => setOpenLightbox({ list: sub.list, index: i })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </DrawingGroup>
          );
        })}
      </div>

      {openLightbox && (
        <DrawingsLightbox
          drawings={openLightbox.list}
          startIndex={openLightbox.index}
          onClose={() => setOpenLightbox(null)}
        />
      )}
    </section>
  );
}
