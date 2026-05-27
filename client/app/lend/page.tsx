"use client";

import VariablePool from "../components/lend/VariablePool";
import FixedTerm from "../components/lend/FixedTerm";

export default function LendPage() {
  return (
    <div className="lend-layout">
      <LendStatsBar />

      <div className="lend-grid">
        <VariablePool />
        <FixedTerm />
      </div>
    </div>
  );
}

 
import { useChain } from "../context/ChainContext";

function LendStatsBar() {
  const { poolStats } = useChain();

  if (!poolStats) return null;

  const utilPct = poolStats.utilization ?? 0;
  const utilColor =
    utilPct > 90 ? "red" : utilPct > 70 ? "amber" : "green";

  const stats = [
    {
      label: "Available Liquidity",
      value: poolStats.availableLiquidity + " POT",
      cls: "",
    },
    {
      label: "Total Value Locked",
      value: poolStats.tvl + " POT",
      cls: "",
    },
    {
      label: "Utilization",
      value: utilPct + "%",
      cls: utilColor,
    },
    {
      label: "Borrow Rate APY",
      value: poolStats.borrowRate.toFixed(2) + "%",
      cls: "amber",
    },
    {
      label: "Supply APY",
      value: poolStats.supplyApy.toFixed(2) + "%",
      cls: "green",
    },
  ];

  return (
    <div className="lend-stats-bar">
      {stats.map((s) => (
        <div key={s.label} className="lend-stat-item">
          <div className="stat-label">{s.label}</div>
          <div className={`stat-value ${s.cls}`} style={{ fontSize: 15 }}>
            {s.value}
          </div>
          {s.label === "Utilization" && (
            <div className="util-bar" style={{ marginTop: 6 }}>
              <div
                className={`util-fill ${utilPct > 90 ? "danger" : utilPct > 70 ? "warn" : ""}`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}