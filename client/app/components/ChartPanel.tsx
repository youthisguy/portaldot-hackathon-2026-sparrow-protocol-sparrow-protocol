"use client";

import { useChain } from "../context/ChainContext";

const MOCK_POINTS = [
  0.82, 0.85, 0.84, 0.88, 0.91, 0.89, 0.93, 0.97, 0.95, 0.99,
  1.01, 1.00, 1.03, 1.05, 1.04, 1.07, 1.06, 1.09, 1.08, 1.10,
  1.09, 1.12, 1.11, 1.14, 1.13, 1.15, 1.14, 1.16, 1.15, 1.00,
];

function buildPath(points: number[], w: number, h: number): string {
  const min = Math.min(...points) * 0.97;
  const max = Math.max(...points) * 1.02;
  const range = max - min;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: h - ((p - min) / range) * h,
  }));
  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
}

function buildFill(points: number[], w: number, h: number): string {
  const line = buildPath(points, w, h);
  return `${line} L ${w} ${h} L 0 ${h} Z`;
}

const W = 600;
const H = 200;
const linePath = buildPath(MOCK_POINTS, W, H);
const fillPath = buildFill(MOCK_POINTS, W, H);

const token = {
  bgCard: "#171a1c",
  bgElevated: "#1e2225",
  border: "#2a2e32",
  textPrimary: "#e8eaed",
  textSecondary: "#8a9099",
  textMuted: "#4a5260",
  accentAmber: "#f0a500",
  accentAmberDim: "rgba(240,165,0,0.08)",
  accentGreen: "#00d084",
  accentRed: "#ff4757",
  fontMono: "'IBM Plex Mono', monospace",
};

export default function ChartPanel() {
  const { connected, poolStats, currentPrice } = useChain();

  const utilPct = poolStats?.utilization ?? 0;
  const utilFillColor =
    utilPct > 90 ? token.accentRed : utilPct > 70 ? token.accentAmber : token.accentGreen;

  const endDotY = (() => {
    const min = Math.min(...MOCK_POINTS) * 0.97;
    const max = Math.max(...MOCK_POINTS) * 1.02;
    const last = MOCK_POINTS[MOCK_POINTS.length - 1];
    return H - ((last - min) / (max - min)) * H;
  })();

  return (
    // Fills the full height of whatever parent it's in
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: token.bgCard,
        overflow: "hidden",
      }}
    >
      {/* ── Header ── fixed height */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          marginBottom: "90px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, color: token.accentAmber, lineHeight: 1 }}>◈</span>
          <span
            style={{
              fontFamily: token.fontMono,
              fontSize: 13,
              fontWeight: 600,
              color: token.textPrimary,
              letterSpacing: "0.04em",
            }}
          >
            POT / USD
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontFamily: token.fontMono,
              fontSize: 22,
              fontWeight: 500,
              color: token.accentAmber,
            }}
          >
            {currentPrice}
          </span>
          <span
            style={{
              fontFamily: token.fontMono,
              fontSize: 11,
              color: token.textMuted,
              letterSpacing: "0.06em",
            }}
          >
            POT
          </span>
        </div>
      </div>

 
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px 0",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", flex: 1, minHeight: 0, display: "block" }}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={token.accentAmber} stopOpacity="0.3" />
              <stop offset="100%" stopColor={token.accentAmber} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#chartFill)" />
          <path
            d={linePath}
            fill="none"
            stroke={token.accentAmber}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={W} cy={endDotY} r="1.5" fill={token.accentAmber} />
        </svg>

        {/* X-axis labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0 10px",
            flexShrink: 0,
          }}
        >
          {["22", "23", "24", "25", "26"].map((d) => (
            <span
              key={d}
              style={{
                fontFamily: token.fontMono,
                fontSize: 10,
                color: token.textMuted,
                letterSpacing: "0.04em",
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* ── Time range selector ── fixed height */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "10px 20px 14px",
 
          flexShrink: 0,
        }}
      >
        {["1H", "1D", "1W", "1M"].map((t) => {
          const isActive = t === "1D";
          return (
            <button
              key={t}
              style={{
                padding: "4px 12px",
                borderRadius: 3,
                fontFamily: token.fontMono,
                fontSize: 11,
                cursor: "pointer",
                border: `1px solid ${isActive ? token.accentAmber : token.border}`,
                color: isActive ? token.accentAmber : token.textMuted,
                background: isActive ? token.accentAmberDim : "transparent",
                transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

{/* ── Pool stats ── always visible */}
<div
  style={{
 
    display: "flex",
    flexShrink: 0,
    marginBottom:16
  }}
>
  {[
    {
      label: "Avail. Liquidity",
      value: poolStats?.availableLiquidity,
      suffix: "POT",
      color: token.textPrimary,
    },
    {
      label: "TVL",
      value: poolStats?.tvl,
      suffix: "POT",
      color: token.textPrimary,
    },
    {
      label: "Utilization",
      value: poolStats ? `${utilPct}%` : null,
      color: utilFillColor,
    },
    {
      label: "Borrow APY",
      value: poolStats ? `${poolStats.borrowRate.toFixed(2)}%` : null,
      color: token.accentAmber,
    },
    {
      label: "Supply APY",
      value: poolStats ? `${poolStats.supplyApy.toFixed(2)}%` : null,
      color: token.accentGreen,
    },
  ].map((stat, i, arr) => (
    <div
      key={stat.label}
      style={{
        flex: 1,
        padding: "10px 14px",
        borderRight: i < arr.length - 1 ? `1px solid ${token.border}` : "none",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: token.fontMono,
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: token.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {stat.label}
      </span>
      <span
        style={{
          fontFamily: token.fontMono,
          fontSize: 13,
          fontWeight: 500,
          color: stat.value ? stat.color : token.textMuted,
        }}
      >
        {stat.value ?? "—"}
        {stat.value && stat.suffix && (
          <em style={{ fontStyle: "normal", color: token.textMuted, fontSize: 10, marginLeft: 3 }}>
            {stat.suffix}
          </em>
        )}
      </span>
    </div>
  ))}
</div>

 
    </div>
  );
}