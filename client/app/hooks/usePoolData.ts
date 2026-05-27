import { useChain } from "@/app/context/ChainContext";
 
export function usePoolData() {
  const {
    poolStats,
    freeCollateral,
    positions,
    lenderShares,
    lenderValue,
    pendingYield,
    currentPrice,
    refreshData,
  } = useChain();
 
  return {
    poolStats,
    freeCollateral,
    positions,
    lenderShares,
    lenderValue,
    pendingYield,
    currentPrice,
    refreshData,
    // Derived helpers
    utilPct: poolStats?.utilization ?? 0,
    utilClass:
      (poolStats?.utilization ?? 0) > 90
        ? "danger"
        : (poolStats?.utilization ?? 0) > 70
        ? "warn"
        : "",
    hasPositions: positions.length > 0,
  };
}