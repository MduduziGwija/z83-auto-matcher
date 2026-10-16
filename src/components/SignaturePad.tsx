import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  hint?: string;
}

/** Trim transparent margins so the ink fills its box on the Z83. */
function trim(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 10) {
        any = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (!any) return '';
  const pad = 6;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export default function SignaturePad({ label, value, onChange, height = 160, hint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827'; // dark ink on the form regardless of theme
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = ref.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Render onto a transparent copy at device resolution, then trim.
    onChange(trim(ref.current!));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange('');
  };

  return (
    <div className="sigpad">
      <div className="sigpad-head">
        <span className="label" id={`${label}-lbl`}>{label}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          <Eraser size={16} aria-hidden /> Clear
        </button>
      </div>
      <canvas
        ref={ref}
        className="sigpad-canvas"
        style={{ height }}
        aria-labelledby={`${label}-lbl`}
        role="img"
        aria-description="Drawing area. Use your finger, a stylus or a mouse."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      />
      {value && !hasInk && (
        <div className="sigpad-saved">
          <img src={value} alt={`Saved ${label.toLowerCase()}`} />
          <span>Saved on this device. Draw again to replace it.</span>
        </div>
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
