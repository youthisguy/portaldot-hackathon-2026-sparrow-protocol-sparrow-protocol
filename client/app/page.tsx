"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const SPARROWLEND_ADDRESS = "5EiRyzh5RK6GtPRNhJszYDM9JcsyAhNYqUc4bdaQSvGxc4nP";
const SPARROWMARGIN_ADDRESS = "5D3cq4kYqACT721DftgJGG7XKam8gZHGM6RAtfqwV729jPzy";
const WS_ENDPOINT = "ws://127.0.0.1:9944";

// Units: 1 UNIT = 1_000_000_000_000 (pico)
const UNIT = 1_000_000_000_000n;

function formatUnit(pico: bigint | string | number): string {
  try {
    const val = BigInt(pico.toString());
    const whole = val / UNIT;
    const frac = (val % UNIT) * 1000n / UNIT;
    return `${whole}.${frac.toString().padStart(3, '0')}`;
  } catch {
    return "0.000";
  }
}

function toUnit(amount: string): bigint {
  if (!amount) return 0n;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return 0n;
  return BigInt(Math.floor(n * 1_000_000_000_000));
}

// ─── Types -->────────────────
type ToastType = "success" | "error" | "info";
interface Toast { id: number; msg: string; type: ToastType; }
interface PoolStats {
  availableLiquidity: string;
  tvl: string;
  utilization: number;
  borrowRate: number;
  supplyApy: number;
}
interface Position {
  id: number;
  direction: string;
  collateral: string;
  borrowed: string;
  leverage: number;
  entryPrice: string;
  isActive: boolean;
  healthFactor: string;
}

// ─── Main Component -->───────
export default function Home() {
  // Connection state
  const [api, setApi] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [balance, setBalance] = useState("0.000");

  // Pool stats
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [freeCollateral, setFreeCollateral] = useState("0.000");
  const [positions, setPositions] = useState<Position[]>([]);
  const [lenderShares, setLenderShares] = useState("0");
  const [lenderValue, setLenderValue] = useState("0.000");
  const [pendingYield, setPendingYield] = useState("0.000");

  // UI state
  const [activeTab, setActiveTab] = useState<"lend" | "trade" | "positions">("lend");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const toastId = useRef(0);

  // Form state — Lend
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [fixedAmt, setFixedAmt] = useState("");
  const [fixedBlocks, setFixedBlocks] = useState("500");

  // Form state — Trade
  const [collateralAmt, setCollateralAmt] = useState("");
  const [posDirection, setPosDirection] = useState<"Long" | "Short">("Long");
  const [posLeverage, setPosLeverage] = useState(100);
  const [posCollateral, setPosCollateral] = useState("");
  const [currentPrice, setCurrentPrice] = useState("1.000");
  const [mockPrice, setMockPrice] = useState("");

  // ── Toast helpers -->──────
  const addToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // ── Connect to chain via Polkadot extension ────────────────────────────────
  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // Dynamically import polkadot libs (they're browser-only)
      const { ApiPromise, WsProvider } = await import("@polkadot/api");
      const { web3Accounts, web3Enable } = await import("@polkadot/extension-dapp");

      const provider = new WsProvider(WS_ENDPOINT);
      const apiInstance = await ApiPromise.create({ provider });
      setApi(apiInstance);

      // Request wallet access
      const extensions = await web3Enable("Sparrow Protocol");
      if (extensions.length === 0) {
        addToast("No Polkadot wallet extension found. Install Talisman or SubWallet.", "error");
        setConnecting(false);
        return;
      }

      const allAccounts = await web3Accounts();
      setAccounts(allAccounts);
      if (allAccounts.length > 0) setSelectedAccount(allAccounts[0]);

      setConnected(true);
      addToast("Connected to local node", "success");
    } catch (err: any) {
      addToast(`Connection failed: ${err.message}`, "error");
    }
    setConnecting(false);
  }, [addToast]);


const refreshData = useCallback(async () => {
  if (!api || !selectedAccount) return;

  const addr = selectedAccount.address;
  console.log("🔄 Refreshing data for:", addr);

  try {
    const lend = await loadContract(api, SPARROWLEND_ADDRESS, "sparrowlend");
    const margin = await loadContract(api, SPARROWMARGIN_ADDRESS, "sparrowmargin");

    const opts = { 
      gasLimit: api.registry.createType("WeightV2", { 
        refTime: 40_000_000_000n, 
        proofSize: 524288n 
      }) 
    };

    // ── Pool Stats ─────────────────────────────────────
    try {
      const result = await lend.query.getPoolStats(addr, opts);
      if (result?.result.isOk && result.output) {
        const raw = (result.output as any).toJSON();
        const data = raw?.ok || raw;
        const [avail, tvl, util, rate, apy] = Array.isArray(data) ? data : [];

        setPoolStats({
          availableLiquidity: formatUnit(BigInt(avail || 0)),
          tvl: formatUnit(BigInt(tvl || 0)),
          utilization: Number(util || 0),
          borrowRate: Number(rate || 0) / 100,
          supplyApy: Number(apy || 0) / 100,
        });
      }
    } catch (e) { console.error("Pool stats failed:", e); }

    // ── Lender Position (Fixed Hex Shares) ─────────────────────────────────────
    try {
      const result = await lend.query.getLenderPosition(addr, opts, addr);
      if (result?.result.isOk && result.output) {
        const raw = (result.output as any).toJSON();
        const data = raw?.ok || raw;
        const [sharesRaw, val, pending] = Array.isArray(data) ? data : [];

        // Handle shares properly (could be hex or BigInt)
        let shares = "0";
        if (sharesRaw) {
          if (typeof sharesRaw === 'string' && sharesRaw.startsWith('0x')) {
            shares = BigInt(sharesRaw).toString();
          } else {
            shares = sharesRaw.toString();
          }
        }

        setLenderShares(shares);
        setLenderValue(formatUnit(BigInt(val || 0)));
        setPendingYield(formatUnit(BigInt(pending || 0)));
      }
    } catch (e) { 
      console.error("Lender position failed:", e); 
    }

    // ── Free Collateral (Fixed) ─────────────────────────────────────
    try {
      const result = await margin.query.getFreeCollateral(addr, opts, addr);
      if (result?.result.isOk && result.output) {
        const raw = (result.output as any).toJSON();
        let value = raw?.ok || raw;

        // Handle possible object wrapper
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          value = value.ok || value.value || Object.values(value)[0];
        }

        setFreeCollateral(formatUnit(BigInt(value || 0)));
      }
    } catch (e) { 
      console.warn("Free collateral failed:", e); 
    }

    // ── Current Price ─────────────────────────────────────
    try {
      const result = await margin.query.getCurrentPrice(addr, opts);
      if (result?.result.isOk && result.output) {
        const raw = (result.output as any).toJSON();
        let value = raw?.ok || raw;
        if (value && typeof value === 'object') value = value.ok || Object.values(value)[0];

        setCurrentPrice(formatUnit(BigInt(value || 0)));
      }
    } catch (e) { 
      console.warn("Price failed:", e); 
    }

    // ── Native Balance ─────────────────────────────────────
    try {
      const accountData = await api.query.system.account(addr);
      setBalance(formatUnit(accountData.data.free));
    } catch (e) { 
      console.error("Balance failed:", e); 
    }

  } catch (err) {
    console.error("❌ Major refresh error:", err);
  }
}, [api, selectedAccount]);


  useEffect(() => {
    if (connected) {
      refreshData();
      const interval = setInterval(refreshData, 8000);
      return () => clearInterval(interval);
    }
  }, [connected, refreshData]);

// ── Contract TX helper -->
const sendTx = useCallback(
  async (method: "lend" | "margin", fn: string, args: any[], value: bigint = 0n, label = fn) => {
    if (!api || !selectedAccount) return;
    setLoading(label);

    try {
      const { web3FromAddress } = await import("@polkadot/extension-dapp");

      const contractName = method === "lend" ? "sparrowlend" : "sparrowmargin";
      const contractAddress = method === "lend" ? SPARROWLEND_ADDRESS : SPARROWMARGIN_ADDRESS;

      // Load real contract metadata
      const contract = await loadContract(api, contractAddress, contractName);

      const injector = await web3FromAddress(selectedAccount.address);

      const gasLimit = api.registry.createType("WeightV2", {
        refTime: 30_000_000_000n,
        proofSize: 524288n,
      });

      await new Promise<void>((resolve, reject) => {
        let unsub: any;

        const txArgs = value > 0n
          ? [{ gasLimit, storageDepositLimit: null, value: value.toString() }, ...args]
          : [{ gasLimit, storageDepositLimit: null }, ...args];

        (contract.tx[fn] as any)(...txArgs)
          .signAndSend(
            selectedAccount.address,
            { signer: injector.signer },
            (result: any) => {
              if (result.status.isInBlock) {
                addToast(`✓ ${label} included in block`, "success");
                resolve();
                unsub?.();
                setTimeout(refreshData, 2000);
              } else if (result.status.isFinalized) {
                unsub?.();
              } else if (result.dispatchError) {
                reject(new Error(result.dispatchError.toString()));
                unsub?.();
              }
            }
          )
          .then((u: any) => { unsub = u; })
          .catch(reject);
      });
    } catch (err: any) {
      console.error("Transaction error:", err);
      addToast(`✗ ${label} failed: ${err.message}`, "error");
    } finally {
      setLoading(null);
    }
  },
  [api, selectedAccount, addToast, refreshData]
);

  // ── Action handlers -->───
  const handleDeposit = () => {
    const amt = toUnit(depositAmt);
    if (!amt) return addToast("Enter deposit amount", "error");
    sendTx("lend", "deposit", [], amt, "deposit");
  };
  
  const handleWithdraw = () => {
    const shares = BigInt(withdrawShares || "0");
    if (!shares) return addToast("Enter shares to withdraw", "error");
    sendTx("lend", "withdraw", [shares.toString()], 0n, "withdraw");
  };
  
  const handleHarvestYield = () => {
    sendTx("lend", "harvest_yield", [], 0n, "harvest yield");
  };
  
  const handleFixedDeposit = () => {
    const amt = toUnit(fixedAmt);
    const blocks = parseInt(fixedBlocks);
    if (!amt) return addToast("Enter deposit amount", "error");
    if (blocks < 200) return addToast("Min lock is 200 blocks", "error");
    sendTx("lend", "deposit_fixed", [blocks], amt, "fixed deposit");
  };
  
  const handleWithdrawFixed = () => {
    sendTx("lend", "withdraw_fixed", [], 0n, "withdraw fixed");
  };
  
  const handleDepositCollateral = () => {
    const amt = toUnit(collateralAmt);
    if (!amt) return addToast("Enter collateral amount", "error");
    sendTx("margin", "deposit_collateral", [], amt, "deposit collateral");
  };
  
  const handleOpenPosition = () => {
    const colAmt = toUnit(posCollateral);
    if (!colAmt) return addToast("Enter collateral for position", "error");
  
    const direction = posDirection === "Long" 
      ? { Long: null } 
      : { Short: null };
  
    sendTx("margin", "open_position", [direction, posLeverage, colAmt.toString()], 0n, `open ${posDirection} ${posLeverage/100}x`);
  };
  
  const handleClosePosition = (id: number) => {
    sendTx("margin", "close_position", [id], 0n, `close position #${id}`);
  };
  
  const handleLiquidate = (id: number) => {
    sendTx("margin", "liquidate", [id], 0n, `liquidate #${id}`);
  };
  
  const handleSetMockPrice = () => {
    const p = toUnit(mockPrice);
    if (!p) return addToast("Enter price", "error");
    sendTx("margin", "set_mock_price", [p.toString()], 0n, "set price");
  };

  // -->─────────────────────
  const utilPct = poolStats?.utilization ?? 0;
  const utilClass = utilPct > 90 ? "danger" : utilPct > 70 ? "warn" : "";

 
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      {/* ── HEADER ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="var(--accent-amber)" opacity="0.2" stroke="var(--accent-amber)" strokeWidth="1.5"/>
              <path d="M9 12l2 2 4-4" stroke="var(--accent-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
              SPARROW <span style={{ color: "var(--accent-amber)" }}>PROTOCOL</span>
            </span>
          </div>
          {connected && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                 {WS_ENDPOINT} 
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {connected && selectedAccount && (
            <>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>BALANCE</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--accent-amber)", fontWeight: 500 }}>{balance} UNIT</div>
              </div>
              <select
                value={selectedAccount.address}
                onChange={(e) => setSelectedAccount(accounts.find((a) => a.address === e.target.value))}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 4,
                  maxWidth: 180,
                }}
              >
                {accounts.map((a) => (
                  <option key={a.address} value={a.address}>
                    {a.meta.name || a.address.slice(0, 16) + "…"}
                  </option>
                ))}
              </select>
            </>
          )}
          {!connected ? (
            <button className="btn btn-primary" onClick={connect} disabled={connecting}>
              {connecting ? <><div className="spinner" /> Connecting…</> : "Connect Wallet"}
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={refreshData}>↻ Refresh</button>
          )}
        </div>
      </header>

      {!connected ? (
        // ── LANDING -->──────
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          padding: 40,
        }}>
          <div style={{ textAlign: "center", maxWidth: 520 }}>
            <div style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--accent-amber)",
              marginBottom: 16,
              textTransform: "uppercase",
            }}>
              ▸ Portaldot Hackathon 2026
            </div>
            <h1 style={{
              fontFamily: "'IBM Plex Mono'",
              fontSize: 42,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
              marginBottom: 16,
            }}>
              Money Market &<br />
              <span style={{ color: "var(--accent-amber)" }}>Margin Trading</span>
            </h1>
            <p style={{
              color: "var(--text-secondary)",
              fontSize: 15,
              lineHeight: 1.7,
              marginBottom: 32,
            }}>
              Sparrow Protocol delivers composable DeFi primitives on Substrate.
              Lend assets for yield or trade with leverage — all onchain, all atomic.
            </p>
            <button className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 13 }} onClick={connect} disabled={connecting}>
              {connecting ? <><div className="spinner" /> Connecting to node…</> : "▸ Connect to Local Node"}
            </button>
            <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
              Requires Talisman / SubWallet + node at {WS_ENDPOINT}
            </div>
          </div>

          {/* Feature grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, width: "100%", maxWidth: 640 }}>
            {[
              { icon: "◈", title: "Variable Deposits", desc: "MasterChef yield accumulator with proportional share minting", color: "var(--accent-green)" },
              { icon: "◆", title: "Fixed-Term APY", desc: "Rate-locked deposits with guaranteed return and early-exit penalties", color: "var(--accent-amber)" },
              { icon: "◉", title: "Isolated Margin", desc: "Long/Short up to 5× leverage with health-factor liquidations", color: "var(--accent-blue)" },
            ].map((f) => (
              <div key={f.title} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 22, color: f.color, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Contract addresses */}
          <div className="card" style={{ padding: "14px 20px", width: "100%", maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "SparrowLend", addr: SPARROWLEND_ADDRESS },
                { label: "SparrowMargin", addr: SPARROWMARGIN_ADDRESS },
              ].map((c) => (
                <div key={c.label}>
                  <div className="stat-label">{c.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {c.addr.slice(0, 14)}…{c.addr.slice(-6)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ── DASHBOARD -->─────
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", gap: 20, maxWidth: 1200, width: "100%", margin: "0 auto" }}>

          {/* ── POOL STATS BAR ── */}
          {poolStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {[
                { label: "Available Liquidity", value: poolStats.availableLiquidity + " UNIT", cls: "" },
                { label: "Total Value Locked", value: poolStats.tvl + " UNIT", cls: "" },
                { label: "Utilization", value: poolStats.utilization + "%", cls: utilPct > 90 ? "red" : utilPct > 70 ? "amber" : "green" },
                { label: "Borrow Rate APY", value: poolStats.borrowRate.toFixed(2) + "%", cls: "amber" },
                { label: "Supply APY", value: poolStats.supplyApy.toFixed(2) + "%", cls: "green" },
              ].map((s) => (
                <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                  <div className="stat-label">{s.label}</div>
                  <div className={`stat-value ${s.cls}`} style={{ fontSize: 16, marginTop: 4 }}>{s.value}</div>
                  {s.label === "Utilization" && (
                    <div className="util-bar" style={{ marginTop: 8 }}>
                      <div className={`util-fill ${utilClass}`} style={{ width: `${utilPct}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── TABS ── */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tab-bar">
              {(["lend", "trade", "positions"] as const).map((t) => (
                <div key={t} className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                  {t === "lend" && "◈ "}{t === "trade" && "◉ "}{t === "positions" && "▦ "}
                  {t.toUpperCase()}
                  {t === "positions" && positions.length > 0 && (
                    <span style={{ marginLeft: 6, background: "var(--accent-amber)", color: "#000", borderRadius: 3, padding: "0 5px", fontSize: 10 }}>
                      {positions.length}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: 24 }}>

              {/* ══ LEND TAB ══════════════════════════════════════════════════ */}
              {activeTab === "lend" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                  {/* Variable pool */}
                  <div>
                    <div className="section-header">
                      <span className="section-title">Variable Pool</span>
                      <div className="section-line" />
                    </div>

                    {/* My position summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                      {[
                        { label: "My Shares", value: lenderShares },
                        { label: "Pool Value", value: lenderValue + " UNIT" },
                        { label: "Pending Yield", value: pendingYield + " UNIT", cls: "green" },
                      ].map((s) => (
                        <div key={s.label} className="card" style={{ padding: "10px 12px", background: "var(--bg-elevated)" }}>
                          <div className="stat-label">{s.label}</div>
                          <div className={`mono ${s.cls || ""}`} style={{ fontSize: 13, marginTop: 3, color: s.cls ? undefined : "var(--text-secondary)" }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div className="field-label">Deposit Amount (UNIT)</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" placeholder="0.00" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} min="0" step="0.1" />
                          <button className="btn btn-green" onClick={handleDeposit} disabled={!!loading} style={{ flexShrink: 0 }}>
                            {loading === "deposit" ? <div className="spinner" /> : "Deposit"}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Withdraw (shares)</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" placeholder="0" value={withdrawShares} onChange={(e) => setWithdrawShares(e.target.value)} min="0" />
                          <button className="btn btn-ghost" onClick={handleWithdraw} disabled={!!loading} style={{ flexShrink: 0 }}>
                            {loading === "withdraw" ? <div className="spinner" /> : "Withdraw"}
                          </button>
                        </div>
                      </div>

                      <button className="btn btn-ghost" onClick={handleHarvestYield} disabled={!!loading} style={{ alignSelf: "flex-start" }}>
                        {loading === "harvest yield" ? <div className="spinner" /> : "◎ Harvest Yield"}
                      </button>
                    </div>
                  </div>

                  {/* Fixed term */}
                  <div>
                    <div className="section-header">
                      <span className="section-title">Fixed-Term Deposit</span>
                      <div className="section-line" />
                    </div>

                    <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)", marginBottom: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div className="stat-label">Current Rate Locked At</div>
                          <div className="mono amber" style={{ fontSize: 16, marginTop: 2 }}>{poolStats?.borrowRate.toFixed(2) ?? "—"}% APY</div>
                        </div>
                        <div>
                          <div className="stat-label">Early Exit Penalty</div>
                          <div className="mono red" style={{ fontSize: 16, marginTop: 2 }}>10.00%</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                        Rate is locked at deposit time. Withdraw early and forfeit 10% of earned interest.
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div className="field-label">Deposit Amount (UNIT)</div>
                        <input type="number" placeholder="0.00" value={fixedAmt} onChange={(e) => setFixedAmt(e.target.value)} min="0" step="0.1" />
                      </div>
                      <div>
                        <div className="field-label">Lock Duration (blocks, min 200)</div>
                        <input type="number" placeholder="500" value={fixedBlocks} onChange={(e) => setFixedBlocks(e.target.value)} min="200" />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-green" onClick={handleFixedDeposit} disabled={!!loading}>
                          {loading === "fixed deposit" ? <div className="spinner" /> : "Lock & Deposit"}
                        </button>
                        <button className="btn btn-ghost" onClick={handleWithdrawFixed} disabled={!!loading}>
                          {loading === "withdraw fixed" ? <div className="spinner" /> : "Unlock & Withdraw"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ TRADE TAB ══════════════════════════════════════════════════ */}
              {activeTab === "trade" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                  {/* Collateral deposit */}
                  <div>
                    <div className="section-header">
                      <span className="section-title">Collateral</span>
                      <div className="section-line" />
                    </div>

                    <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div className="stat-label">Free Collateral</div>
                        <div className="stat-value amber" style={{ fontSize: 20 }}>{freeCollateral} <span style={{ fontSize: 13 }}>UNIT</span></div>
                      </div>
                      <div>
                        <div className="stat-label">Oracle Price</div>
                        <div className="stat-value" style={{ fontSize: 20 }}>{currentPrice} <span style={{ fontSize: 13, color: "var(--text-muted)" }}>UNIT</span></div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div className="field-label">Deposit Collateral (UNIT)</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" placeholder="0.00" value={collateralAmt} onChange={(e) => setCollateralAmt(e.target.value)} min="0" step="0.1" />
                          <button className="btn btn-primary" onClick={handleDepositCollateral} disabled={!!loading} style={{ flexShrink: 0 }}>
                            {loading === "deposit collateral" ? <div className="spinner" /> : "+ Add"}
                          </button>
                        </div>
                      </div>

                      <div className="divider" style={{ margin: "4px 0" }} />

                      <div>
                        <div className="field-label">Set Oracle Price (admin)</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="number" placeholder="1.00" value={mockPrice} onChange={(e) => setMockPrice(e.target.value)} min="0" step="0.01" />
                          <button className="btn btn-ghost" onClick={handleSetMockPrice} disabled={!!loading} style={{ flexShrink: 0, fontSize: 11 }}>
                            {loading === "set price" ? <div className="spinner" /> : "Set"}
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          Admin only — updates mock oracle price
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Open position */}
                  <div>
                    <div className="section-header">
                      <span className="section-title">Open Position</span>
                      <div className="section-line" />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Direction */}
                      <div>
                        <div className="field-label">Direction</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn"
                            style={{ flex: 1, fontSize: 13, fontWeight: 600, background: posDirection === "Long" ? "var(--accent-green-dim)" : "transparent", color: posDirection === "Long" ? "var(--accent-green)" : "var(--text-muted)", border: `1px solid ${posDirection === "Long" ? "var(--accent-green)" : "var(--border)"}` }}
                            onClick={() => setPosDirection("Long")}
                          >▲ LONG</button>
                          <button
                            className="btn"
                            style={{ flex: 1, fontSize: 13, fontWeight: 600, background: posDirection === "Short" ? "var(--accent-red-dim)" : "transparent", color: posDirection === "Short" ? "var(--accent-red)" : "var(--text-muted)", border: `1px solid ${posDirection === "Short" ? "var(--accent-red)" : "var(--border)"}` }}
                            onClick={() => setPosDirection("Short")}
                          >▼ SHORT</button>
                        </div>
                      </div>

                      {/* Leverage */}
                      <div>
                        <div className="field-label">Leverage (contract unit: 100 = 1×)</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[100, 200, 300, 500].map((lev) => (
                            <button
                              key={lev}
                              className={`leverage-btn ${posLeverage === lev ? "active" : ""}`}
                              onClick={() => setPosLeverage(lev)}
                            >
                              {lev / 100}×
                            </button>
                          ))}
                          <input
                            type="number"
                            value={posLeverage}
                            onChange={(e) => setPosLeverage(parseInt(e.target.value) || 100)}
                            min="100"
                            max="500"
                            style={{ width: 70 }}
                            placeholder="100"
                          />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          Max 5× (&lt;10k UNIT), 3× above. Contract value: {posLeverage}
                        </div>
                      </div>

                      {/* Collateral to use */}
                      <div>
                        <div className="field-label">Collateral to Use (UNIT)</div>
                        <input type="number" placeholder="0.00" value={posCollateral} onChange={(e) => setPosCollateral(e.target.value)} min="0" step="0.1" />
                        {posCollateral && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            Position size ≈ {(parseFloat(posCollateral || "0") * posLeverage / 100).toFixed(3)} UNIT
                          </div>
                        )}
                      </div>

                      <button
                        className={`btn ${posDirection === "Long" ? "btn-green" : "btn-red"}`}
                        style={{ padding: "12px", fontSize: 13, fontWeight: 600 }}
                        onClick={handleOpenPosition}
                        disabled={!!loading}
                      >
                        {loading?.startsWith("open") ? <div className="spinner" /> : `Open ${posDirection} ${posLeverage / 100}× Position`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ POSITIONS TAB ══════════════════════════════════════════════ */}
              {activeTab === "positions" && (
                <div>
                  <div className="section-header">
                    <span className="section-title">Active Positions</span>
                    <div className="section-line" />
                  </div>

                  {positions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>◌</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12 }}>No active positions</div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>Open a position in the Trade tab</div>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Direction</th>
                          <th>Collateral</th>
                          <th>Borrowed</th>
                          <th>Leverage</th>
                          <th>Entry Price</th>
                          <th>Health</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos) => {
                          const hfNum = parseInt(pos.healthFactor);
                          const hfClass = isNaN(hfNum) || hfNum > 150 ? "green" : hfNum > 110 ? "amber" : "red";
                          return (
                            <tr key={pos.id}>
                              <td>#{pos.id}</td>
                              <td>
                                <span className={`badge ${pos.direction === "Long" ? "badge-green" : "badge-red"}`}>
                                  {pos.direction === "Long" ? "▲" : "▼"} {pos.direction}
                                </span>
                              </td>
                              <td>{pos.collateral} UNIT</td>
                              <td>{pos.borrowed} UNIT</td>
                              <td>{pos.leverage}×</td>
                              <td>{pos.entryPrice} UNIT</td>
                              <td>
                                <span className={`badge badge-${hfClass}`}>{pos.healthFactor}</span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                                    onClick={() => handleClosePosition(pos.id)} disabled={!!loading}>
                                    {loading === `close position #${pos.id}` ? <div className="spinner" /> : "Close"}
                                  </button>
                                  {hfClass === "red" && (
                                    <button className="btn btn-red" style={{ fontSize: 11, padding: "4px 10px" }}
                                      onClick={() => handleLiquidate(pos.id)} disabled={!!loading}>
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
                  )}

                  <div style={{ marginTop: 24 }}>
                    <div className="section-header">
                      <span className="section-title">Contract References</span>
                      <div className="section-line" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "SparrowLend", addr: SPARROWLEND_ADDRESS, color: "var(--accent-green)" },
                        { label: "SparrowMargin", addr: SPARROWMARGIN_ADDRESS, color: "var(--accent-amber)" },
                      ].map((c) => (
                        <div key={c.label} className="card" style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                            <span className="stat-label">{c.label}</span>
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>{c.addr}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── TOASTS ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}>
            {t.type === "success" && "✓ "}{t.type === "error" && "✗ "}{t.type === "info" && "▸ "}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// load contract metedata 
// Improved loadContract with debugging
const loadContract = async (api: any, address: string, contractName: string) => {
  try {
    console.log(`📂 Loading contract: ${contractName} from /contracts/${contractName}.contract`);

    const response = await fetch(`/contracts/${contractName}.contract`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${contractName}.contract - Status: ${response.status}`);
    }

    const contractJson = await response.json();
    console.log(`✅ Loaded ${contractName}.contract successfully`);
    console.log(`📋 Available messages:`, Object.keys(contractJson?.V3?.spec?.messages || {}));

    const { ContractPromise } = await import("@polkadot/api-contract");
    const contract = new ContractPromise(api, contractJson, address);

    // Debug: Show available query methods
    console.log(`🔍 Available query methods on ${contractName}:`, 
      Object.keys(contract.query || {}));

    return contract;
  } catch (err: any) {
    console.error(`❌ Failed to load ${contractName} contract:`, err.message || err);
    throw err;
  }
};