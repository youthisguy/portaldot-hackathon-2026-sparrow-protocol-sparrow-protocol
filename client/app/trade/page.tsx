"use client";

import ChartPanel from "../components/ChartPanel";
import TradePanel from "../components/trade/TradePanel";

export default function TradePage() {
  return (
    <>
      <div className="trade-page-layout">
        <div className="chart-panel-wrapper">
          <ChartPanel />
        </div>
        <div className="trade-panel-wrapper">
          <TradePanel />
        </div>
      </div>

      <style>{`
        .trade-page-layout {
          display: flex;
          flex-direction: row;
          flex: 1;
          height: calc(100vh - 52px);
          overflow: hidden;
        }

        .chart-panel-wrapper {
          width: 60%;
          flex-shrink: 0;
          border-right: 1px solid #2a2e32;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .trade-panel-wrapper {
          width: 40%;
          flex-shrink: 0;
          overflow-y: auto;
          background: var(--bg-primary);
        }

        @media (max-width: 768px) {
          .trade-page-layout {
            flex-direction: column;
            height: auto;
            min-height: calc(100vh - 52px);
            overflow: visible;
          }

          .chart-panel-wrapper {
            width: 100%;
            height: 45vh;
            flex-shrink: 0;
            border-right: none;
            border-bottom: 1px solid #2a2e32;
            overflow-y: hidden;
          }

          @media (max-width: 768px) {
        .chart-panel-wrapper {
            width: 100%;
            height: auto;         
            max-height: 60vh;      
            overflow-y: auto;     
            border-right: none;
            border-bottom: 1px solid #2a2e32;
            flex-shrink: 0;
            }
          }

          .trade-panel-wrapper {
            width: 100%;
            height: auto;
            overflow-y: visible;
            flex-shrink: 0;
          }
        }
      `}</style>
    </>
  );
}