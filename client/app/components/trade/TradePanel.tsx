"use client";

import { useState } from "react";
import { useChain, toUnit } from "@/app/context/ChainContext";
import PositionsTable from "./PositionsTable";

type TradeTab = "long" | "short";

export default function TradePanel() {
  const {
    connected,
    connecting,
    connect,
    freeCollateral,
    currentPrice,
    sendTx,
    loading,
    addToast,
    positions,
  } = useChain();

  const [activeTab, setActiveTab] = useState<TradeTab>("long");
  const [collateralAmt, setCollateralAmt] = useState("");
  const [posLeverage, setPosLeverage] = useState(100);
  const [posCollateral, setPosCollateral] = useState("");
  const [mockPrice, setMockPrice] = useState("");

  const posDirection = activeTab === "long" ? "Long" : "Short";

  const handleDepositCollateral = () => {
    const amt = toUnit(collateralAmt);
    if (!amt) return addToast("Enter collateral amount", "error");
    sendTx("margin", "depositCollateral", [], amt, "Deposit Collateral");
    setCollateralAmt("");
    setMockPrice("");
    setPosCollateral("");
  };

  const token = {
    bgCard: "#171a1c",
    bgElevated: "#1e2225",
    border: "#2a2e32",
    textPrimary: "#e8eaed",
    textMuted: "#4a5260",
    accentAmber: "#f0a500",
    fontMono: "'IBM Plex Mono', monospace",
  };

  const handleOpenPosition = () => {
    const colAmt = toUnit(posCollateral);
    if (!colAmt) return addToast("Enter collateral for position", "error");
    const direction =
      posDirection === "Long" ? { Long: null } : { Short: null };
    sendTx(
      "margin",
      "openPosition",
      [direction, posLeverage, colAmt.toString()],
      0n,
      `Open ${posDirection}`
    );
    setCollateralAmt("");
    setPosCollateral("");
    setMockPrice("");
  };

  const handleSetMockPrice = () => {
    const p = toUnit(mockPrice);
    if (!p) return addToast("Enter price", "error");
    sendTx("margin", "setMockPrice", [p.toString()], 0n, "Set Mock Price");
    setMockPrice("");
    setCollateralAmt("");
    setPosCollateral("");
  };

  if (!connected) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 40,
          gap: 16,
        }}
      >
        <p
          style={{
            color: "var(--text-muted)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
          }}
        >
          Connect your wallet to start trading
        </p>
        <button
          className="btn btn-primary"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <span className="spinner" /> Connecting…
            </>
          ) : (
            "Connect Wallet"
          )}
        </button>
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "none",

    borderRadius: 12,
    overflow: "hidden",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 4,
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "66px 136px" }}>
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
        {/* Long / Short tab bar */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 10px",
          }}
        >
          {(["long", "short"] as TradeTab[]).map((tab) => {
            const isActive = activeTab === tab;
            const isLong = tab === "long";
            const activeColor = isLong ? "#00d084" : "#ff4757";
            const activeDim = isLong
              ? "rgba(0,208,132,0.15)"
              : "rgba(255,71,87,0.15)";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  border: `1px solid ${
                    isActive ? activeColor : "var(--border)"
                  }`,
                  borderRadius: 12,
                  background: isActive ? activeDim : "transparent",
                  color: isActive ? activeColor : "var(--text-muted)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {isLong ? "▲ Long" : "▼ Short"}
              </button>
            );
          })}
        </div>
        {/* Card body */}
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* From token block — collateral to add */}
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 10,
              border: "1px solid var(--border)",
              padding: "12px 14px",
            }}
          >
            {/* Token selector row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                Add Collateral
              </span>
            </div>
            {/* Amount input */}
            <input
              type="text"
              placeholder="0.00"
              value={collateralAmt}
              onChange={(e) => setCollateralAmt(e.target.value)}
              min="0"
              step="0.1"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 22,
                fontWeight: 500,
                color: collateralAmt
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
                width: "100%",
                padding: 0,
              }}
            />
            {/* Balance row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Available:
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                    color: "var(--accent-amber)",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {freeCollateral}{" "}
                  <span style={{ fontSize: 9, opacity: 0.7 }}>POT</span>
                </span>
              </div>
              <button
                onClick={handleDepositCollateral}
                disabled={!!loading}
                style={{
                  background: "var(--accent-amber)",
                  color: "#0d0e0f",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {loading === "Deposit Collateral" ? "…" : "+ Add"}
              </button>
            </div>
          </div>
          <div
            style={{
              background: token.bgElevated,
              borderRadius: 10,
              border: `1px solid ${token.border}`,
              padding: "12px 14px",
            }}
          >
            {/* Label row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: token.textMuted,
                  letterSpacing: "0.05em",
                }}
              >
                Collateral to Use (POT)
              </span>
            </div>
            <input
              type="text"
              placeholder="0.00"
              value={posCollateral}
              onChange={(e) => setPosCollateral(e.target.value)}
              min="0"
              step="0.1"
              style={
                {
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 22,
                  fontWeight: 500,
                  color: posCollateral
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  width: "100%",
                  padding: 0,
                  MozAppearance: "textfield",
                } as React.CSSProperties
              }
            />
            {posCollateral && (
              <div className="position-size-preview">
                Position size ≈{" "}
                {(
                  (parseFloat(posCollateral || "0") * posLeverage) /
                  100
                ).toFixed(3)}{" "}
                POT
              </div>
            )}
          </div>

          {/* Leverage slider */}
          <div style={{ padding: "2px 0" }}>
  <div style={{ ...labelStyle, marginBottom: 8 }}>Leverage</div>
  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
    {[100, 200, 300, 500].map((lev) => {
      const isActive = posLeverage === lev;
      return (
        <button
          key={lev}
          onClick={() => setPosLeverage(lev)}
          style={{
            flex: 1,
            padding: "5px 0",
            borderRadius: 6,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: `1px solid ${isActive ? "var(--accent-amber)" : "var(--border)"}`,
            background: isActive ? "var(--accent-amber)" : "transparent",
            color: isActive ? "#0d0e0f" : "var(--text-muted)",
            transition: "all 0.15s",
          }}
        >
          {lev / 100}×
        </button>
      );
    })}
  </div>

  <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 6,
        borderRadius: 3,
        background: `
          repeating-linear-gradient(-55deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 5px),
          linear-gradient(to right, #2a9d3a, #f0c040, #e03030)
        `,
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 0,
        height: 6,
        borderRadius: "0 3px 3px 0",
        background: "var(--bg-secondary, #1a1b1c)",
        width: `${100 - ((posLeverage - 100) / 400) * 100}%`,
        transition: "width 0.15s",
      }}
    />
    <input
      type="range"
      min="100"
      max="500"
      step="100"
      value={posLeverage}
      onChange={(e) => setPosLeverage(parseInt(e.target.value))}
      style={{
        position: "absolute",
        width: "100%",
        opacity: 0,
        cursor: "pointer",
        margin: 0,
        padding: 0,
        height: "100%",
      }}
    />
  </div>

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 9,
      color: "var(--text-muted)",
      marginTop: 3,
    }}
  >
    {["1×", "2×", "3×", "4×", "5×"].map((l) => (
      <span key={l}>{l}</span>
    ))}
  </div>
</div>

          {/* Open position button */}
          <button
            onClick={handleOpenPosition}
            disabled={!!loading}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 10,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              background:
                activeTab === "long"
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
              color: "#0d0e0f",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading?.startsWith("Open") ? (
              <span className="spinner" />
            ) : (
              `Open ${posDirection} ${posLeverage / 100}× Position`
            )}
          </button>

          {/* Trade summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              padding: "2px 0",
            }}
          >
            {[
              { label: "POT Price", value: `${currentPrice} POT` },
              { label: "Utilization", value: "0.00%" },
              {
                label: "Position Size",
                value: posCollateral
                  ? `${(
                      (parseFloat(posCollateral) * posLeverage) /
                      100
                    ).toFixed(3)} POT`
                  : "--",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Admin: oracle price */}
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>
              Set Oracle Price (admin)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="1.00"
                value={mockPrice}
                onChange={(e) => setMockPrice(e.target.value)}
                min="0"
                step="0.01"
              />
              <button
                className="btn btn-ghost"
                onClick={handleSetMockPrice}
                disabled={!!loading}
                style={{ flexShrink: 0, fontSize: 11 }}
              >
                {loading === "Set Mock Price" ? (
                  <span className="spinner" />
                ) : (
                  "Set"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Positions section — inside card, separated */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", padding: "0 16px" }}>
            {["Positions"].map((tab, i) => (
              <div
                key={tab}
                style={{
                  padding: "10px 14px 10px 0",
                  marginRight: 16,

                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  fontWeight: 500,
                  color: i === 0 ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom:
                    i === 0
                      ? "2px solid var(--accent-amber)"
                      : "2px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tab}
                {i === 0 && positions.length > 0 && (
                  <span
                    style={{
                      background: "var(--accent-amber)",
                      color: "#0d0e0f",
                      borderRadius: 3,
                      padding: "0 5px",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {positions.length}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "0 0 16px 0" }}>
            <PositionsTable />
          </div>
        </div>
      </div>
    </div>
  );
}
