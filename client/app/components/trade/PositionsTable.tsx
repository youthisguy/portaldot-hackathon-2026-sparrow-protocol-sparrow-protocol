"use client";

import { useChain } from "@/app/context/ChainContext";

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
  accentGreenDim: "rgba(0,208,132,0.12)",
  accentRed: "#ff4757",
  accentRedDim: "rgba(255,71,87,0.12)",
  fontMono: "'IBM Plex Mono', monospace",
};

export default function PositionsTable() {
  const { positions, sendTx, loading } = useChain();

  if (positions.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px 16px",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.3 }}>◌</div>
        <div
          style={{
            fontFamily: token.fontMono,
            fontSize: 11,
            color: token.textMuted,
            marginTop: 8,
          }}
        >
          No open positions
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
      .positions-scroll::-webkit-scrollbar { display: none; }
    `}</style>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              {[
                "#",
                "Direction",
                "Collateral",
                "Borrowed",
                "Leverage",
                "Entry",
                "PnL",
                "Health",
                "",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    fontFamily: token.fontMono,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: token.textMuted,
                    padding: "8px 12px",
                    textAlign: "left",
                    borderBottom: `1px solid ${token.border}`,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const hfNum = parseFloat(pos.healthFactor);
              const hfKey =
                isNaN(hfNum) || hfNum > 1.5
                  ? "green"
                  : hfNum > 1.1
                  ? "amber"
                  : "red";

              const hfColors = {
                green: { bg: token.accentGreenDim, color: token.accentGreen },
                amber: { bg: token.accentAmberDim, color: token.accentAmber },
                red: { bg: token.accentRedDim, color: token.accentRed },
              }[hfKey];

              const directionColors =
                pos.direction === "Long"
                  ? { bg: token.accentGreenDim, color: token.accentGreen }
                  : { bg: token.accentRedDim, color: token.accentRed };

              const pnlColor = pos.isProfit
                ? token.accentGreen
                : token.accentRed;

              const tdBase: React.CSSProperties = {
                fontFamily: token.fontMono,
                fontSize: 12,
                color: token.textSecondary,
                padding: "10px 12px",
                borderBottom: `1px solid ${token.border}`,
                whiteSpace: "nowrap",
              };

              const badgeBase: React.CSSProperties = {
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 3,
                fontFamily: token.fontMono,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              };

              return (
                <tr
                  key={pos.id}
                  style={{ cursor: "default" }}
                  onMouseEnter={(e) => {
                    Array.from(
                      (e.currentTarget as HTMLTableRowElement).cells
                    ).forEach(
                      (td) =>
                        ((td as HTMLElement).style.background =
                          token.bgElevated)
                    );
                  }}
                  onMouseLeave={(e) => {
                    Array.from(
                      (e.currentTarget as HTMLTableRowElement).cells
                    ).forEach(
                      (td) => ((td as HTMLElement).style.background = "")
                    );
                  }}
                >
                  <td style={{ ...tdBase, color: token.textMuted }}>
                    #{pos.id}
                  </td>

                  <td style={tdBase}>
                    <span
                      style={{
                        ...badgeBase,
                        background: directionColors.bg,
                        color: directionColors.color,
                      }}
                    >
                      {pos.direction === "Long" ? "▲" : "▼"} {pos.direction}
                    </span>
                  </td>

                  <td style={tdBase}>{pos.collateral} POT</td>
                  <td style={tdBase}>{pos.borrowed} POT</td>
                  <td style={tdBase}>{pos.leverage}×</td>
                  <td style={tdBase}>{pos.entryPrice} POT</td>

                  <td style={{ ...tdBase, color: pnlColor }}>
                    {pos.isProfit ? "+" : "-"}
                    {pos.pnl} POT
                  </td>

                  <td style={tdBase}>
                    <span
                      style={{
                        ...badgeBase,
                        background: hfColors.bg,
                        color: hfColors.color,
                      }}
                    >
                      {pos.healthFactor}
                    </span>
                  </td>

                  <td style={tdBase}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "4px 10px",
                          borderRadius: 4,
                          fontFamily: token.fontMono,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.4 : 1,
                          border: `1px solid ${token.border}`,
                          color: token.textSecondary,
                          background: "transparent",
                          transition: "all 0.15s",
                          letterSpacing: "0.02em",
                        }}
                        onClick={() =>
                          sendTx(
                            "margin",
                            "closePosition",
                            [pos.id],
                            0n,
                            `Close #${pos.id}`
                          )
                        }
                        disabled={!!loading}
                      >
                        Close
                      </button>

                      {hfKey === "red" && (
                        <button
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px 10px",
                            borderRadius: 4,
                            fontFamily: token.fontMono,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: "pointer",
                            border: `1px solid ${token.accentRed}`,
                            color: token.accentRed,
                            background: token.accentRedDim,
                            transition: "all 0.15s",
                            letterSpacing: "0.02em",
                          }}
                          onClick={() =>
                            sendTx(
                              "margin",
                              "liquidate",
                              [pos.id],
                              0n,
                              `Liquidate #${pos.id}`
                            )
                          }
                        >
                          Liquidate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
