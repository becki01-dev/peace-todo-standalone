// 手写 SVG 折线图(无图表库):多系列共享标尺,0 值画连续线,单桶只画点
import { formatNumber } from "./units";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // 已换算为显示单位
}

interface Props {
  series: TrendSeries[];
  ariaLabel: string;
  xLabels: (string | null)[]; // 与 values 等长,非空处画 x 轴标签
  height?: number;
}

const W = 600;
const PAD_L = 40; // y 刻度
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18; // x 标签

/** 取 ≥ v 的最小"好看"上限(步长 1/2/2.5/5/10 × 10^k) */
const niceCeil = (v: number): number => {
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const s of [1, 2, 2.5, 5, 10]) {
    if (s * base >= v) return s * base;
  }
  return 10 * base;
};

export const TrendChart = ({ series, ariaLabel, xLabels, height = 160 }: Props) => {
  const n = series[0]?.values.length ?? 0;
  if (n === 0 || series.length === 0) return null;

  const top = niceCeil(Math.max(1, ...series.flatMap((s) => s.values))); // 跨系列共享标尺
  const plotW = W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH * (1 - v / top);

  const ticks = [0, top / 2, top];
  const showDots = n <= 30; // 60 桶时点距太密

  return (
    <div>
      {series.length >= 2 && (
        <div className="flex items-center gap-4 mb-2">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-fit-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${height}`} className="w-full h-auto">
        {/* 网格线 + y 刻度 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              strokeWidth={1}
              style={{ stroke: "hsl(var(--fit-border))" }}
            />
            <text
              x={PAD_L - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={9}
              style={{ fill: "hsl(var(--fit-muted))" }}
            >
              {formatNumber(t, t % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {/* x 轴标签 */}
        {xLabels.map((label, i) =>
          label ? (
            <text
              key={i}
              x={x(i)}
              y={height - 5}
              textAnchor="middle"
              fontSize={9}
              style={{ fill: "hsl(var(--fit-muted))" }}
            >
              {label}
            </text>
          ) : null,
        )}

        {/* 折线 + 数据点(0 值天画线不画点) */}
        {series.map((s) => (
          <g key={s.key}>
            {n > 1 && (
              <polyline
                points={s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                data-testid={`line-${s.key}`}
              />
            )}
            {showDots &&
              s.values.map((v, i) =>
                v > 0 ? (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={4}
                    fill={s.color}
                    style={{ stroke: "hsl(var(--fit-card))", strokeWidth: 2 }}
                    data-testid={`dot-${s.key}-${i}`}
                  />
                ) : null,
              )}
          </g>
        ))}
      </svg>
    </div>
  );
};
