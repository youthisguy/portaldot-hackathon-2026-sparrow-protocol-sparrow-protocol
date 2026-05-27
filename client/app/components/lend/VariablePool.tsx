"use client";

import { useState } from "react";
import { useChain } from "@/app/context/ChainContext";  

export default function VariablePool() {
  const {
    lenderShares,
    lenderValue,
    pendingYield,
    poolStats,
    loading,
    sendTx,
    addToast,
  } = useChain();

  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");

  const toUnit = (amount: string): bigint => {
    if (!amount) return 0n;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n * 1_000_000_000_000));
  };

  const handleDeposit = () => {
    const amt = toUnit(depositAmt);
    if (!amt) return addToast("Enter deposit amount", "error");
    sendTx("lend", "deposit", [], amt, "Deposit");
  };

  const handleWithdraw = () => {
    const shares = BigInt(withdrawShares || "0");
    if (!shares) return addToast("Enter shares to withdraw", "error");
    sendTx("lend", "withdraw", [shares.toString()], 0n, "Withdraw");
  };

  const handleHarvestYield = () => {
    sendTx("lend", "harvestYield", [], 0n, "Harvest Yield");
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      {/* Section header */}
      <div className="section-header">
        <span className="section-title">◈ Variable Pool</span>
        <div className="section-line" />
        {poolStats && (
          <span className="mono green" style={{ fontSize: 11, flexShrink: 0 }}>
            {poolStats.supplyApy.toFixed(2)}% APY
          </span>
        )}
      </div>

      {/* My position summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {[
          { label: "My Shares", value: lenderShares, cls: "" },
          { label: "Pool Value", value: lenderValue + " POT", cls: "" },
          { label: "Pending Yield", value: pendingYield + " POT", cls: "green" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 12px",
            }}
          >
            <div className="stat-label">{s.label}</div>
            <div
              className={`mono ${s.cls}`}
              style={{
                fontSize: 13,
                marginTop: 3,
                color: s.cls ? undefined : "var(--text-secondary)",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Deposit */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="field-label">Deposit Amount (POT)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="0.00"
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              min="0"
              step="0.1"
            />
            <button
              className="btn btn-green"
              onClick={handleDeposit}
              disabled={!!loading}
              style={{ flexShrink: 0 }}
            >
              {loading === "Deposit" ? <div className="spinner" /> : "Deposit"}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div>
          <div className="field-label">Withdraw (shares)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="0"
              value={withdrawShares}
              onChange={(e) => setWithdrawShares(e.target.value)}
              min="0"
            />
            <button
              className="btn btn-ghost"
              onClick={handleWithdraw}
              disabled={!!loading}
              style={{ flexShrink: 0 }}
            >
              {loading === "Withdraw" ? <div className="spinner" /> : "Withdraw"}
            </button>
          </div>
        </div>

        {/* Harvest */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Yield accumulates each block. Harvest anytime.
          </div>
          <button
            className="btn btn-ghost"
            onClick={handleHarvestYield}
            disabled={!!loading}
          >
            {loading === "Harvest Yield" ? (
              <div className="spinner" />
            ) : (
              "◎ Harvest Yield"
            )}
          </button>
        </div>
      </div>

      {/* Info footer */}
      <div
        style={{
          marginTop: 20,
          padding: "12px 14px",
          background: "var(--bg-elevated)",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.7,
        }}
      >
        Shares are minted proportionally to your deposit. Yield accrues from
        borrower interest and is distributed via the MasterChef accumulator.
        Withdraw anytime — no lock-up.
      </div>
    </div>
  );
}