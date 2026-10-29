import { useState, type ReactNode } from "react";

// Bieu do tu dung bang SVG/HTML (1 chuoi -> 1 mau primary; luoi mo; tooltip khi re chuot; vung bam = ca cot).
// Mau trang thai (do) chi dung khi gia tri MANG nghia nguy co (vd T5), luon kem nhan chu.

const kieuSo = (v: number) => v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

// Truc gon: 1.234.567 -> "1,2 tr", 12.300 -> "12 N".
export function soGon(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} N`;
  return kieuSo(v);
}

function moc(max: number): number[] {
  if (max <= 0) return [0];
  const buoc0 = max / 4;
  const mu = 10 ** Math.floor(Math.log10(buoc0));
  const buoc = [1, 2, 2.5, 5, 10].map((x) => x * mu).find((x) => x >= buoc0) ?? buoc0;
  const ds: number[] = [];
  for (let v = 0; v <= max + buoc * 0.001; v += buoc) ds.push(v);
  if (ds[ds.length - 1] < max) ds.push(ds[ds.length - 1] + buoc);
  return ds;
}

// Cot doc theo thoi gian. Nhan truc X thua dan khi nhieu cot; nhan gia tri chi o cot cuoi + cot cao nhat.
export function BieuDoCot({ data, cao = 220, donVi = "" }: { data: { nhan: string; gia_tri: number; chu_thich?: ReactNode }[]; cao?: number; donVi?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, PL = 44, PR = 8, PT = 18, PB = 26;
  const max = Math.max(0, ...data.map((d) => d.gia_tri));
  const ticks = moc(max);
  const top = ticks[ticks.length - 1] || 1;
  const n = data.length || 1;
  const band = (W - PL - PR) / n;
  const bw = Math.min(36, band * 0.62);
  const y = (v: number) => PT + (cao - PT - PB) * (1 - v / top);
  const iMax = data.reduce((m, d, i) => (d.gia_tri > (data[m]?.gia_tri ?? -1) ? i : m), 0);
  const nhanMoi = Math.ceil(n / 8);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${cao}`} className="w-full" role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-text-secondary)">
              {soGon(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PL + band * i + (band - bw) / 2;
          const h = Math.max(0, cao - PB - y(d.gia_tri));
          const r = Math.min(4, h / 2, bw / 2);
          const yb = cao - PB;
          return (
            <g key={d.nhan} onMouseEnter={() => setHover(i)}>
              <rect x={PL + band * i} y={PT} width={band} height={cao - PT - PB} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${yb} V${yb - h + r} Q${x},${yb - h} ${x + r},${yb - h} H${x + bw - r} Q${x + bw},${yb - h} ${x + bw},${yb - h + r} V${yb} Z`}
                  fill={hover === i ? "var(--chart-series-hover)" : "var(--chart-series)"}
                />
              )}
              {(i === n - 1 || i === iMax) && d.gia_tri > 0 && (
                <text x={x + bw / 2} y={yb - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-text)">
                  {soGon(d.gia_tri)}
                </text>
              )}
              {i % nhanMoi === 0 && (
                <text x={x + bw / 2} y={cao - 8} textAnchor="middle" fontSize={11} fill="var(--color-text-secondary)">
                  {d.nhan}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PL} x2={W - PR} y1={cao - PB} y2={cao - PB} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((PL + band * hover + band / 2) / W) * 100}%`, top: 0 }}
        >
          <div className="font-semibold">{data[hover].nhan}</div>
          <div className="tabular-nums">
            {kieuSo(data[hover].gia_tri)} {donVi}
          </div>
          {data[hover].chu_thich && <div className="text-ink-soft">{data[hover].chu_thich}</div>}
        </div>
      )}
    </div>
  );
}

// Thanh ngang dang danh sach xep hang: nhan | thanh | so. Bam dong -> onClick.
export function BieuDoThanh({
  data, dinhDang = kieuSo, onClick,
}: {
  data: { nhan: ReactNode; gia_tri: number; phu?: ReactNode; nguy_co?: boolean; khoa?: string }[];
  dinhDang?: (v: number) => string;
  onClick?: (khoa: string) => void;
}) {
  const max = Math.max(0, ...data.map((d) => d.gia_tri)) || 1;
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const noi = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink">{d.nhan}</span>
              <span className="shrink-0 tabular-nums font-semibold text-ink">{dinhDang(d.gia_tri)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-subtle">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${Math.max(d.gia_tri > 0 ? 1.5 : 0, (d.gia_tri / max) * 100)}%`, background: d.nguy_co ? "var(--chart-critical)" : "var(--chart-series)" }}
              />
            </div>
            {d.phu && <div className="mt-0.5 text-xs text-ink-soft">{d.phu}</div>}
          </>
        );
        return onClick && d.khoa ? (
          <button key={i} className="block w-full rounded-md p-1 text-left hover:bg-subtle" onClick={() => onClick(d.khoa!)}>
            {noi}
          </button>
        ) : (
          <div key={i} className="p-1">
            {noi}
          </div>
        );
      })}
    </div>
  );
}
