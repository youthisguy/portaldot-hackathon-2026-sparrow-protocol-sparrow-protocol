"use client";

import ChartPanel from "../components/ChartPanel";
import TradePanel from "../components/trade/TradePanel";

export default function TradePage() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        height: "calc(100vh - 52px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "60%",
          flexShrink: 0,
          borderRight: "1px solid #2a2e32",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChartPanel />
      </div>

      <div
        style={{
          width: "40%",
          overflowY: "auto",
          background: "var(--bg-primary)",
        }}
      >
        <TradePanel />
      </div>
    </div>
  );
}
