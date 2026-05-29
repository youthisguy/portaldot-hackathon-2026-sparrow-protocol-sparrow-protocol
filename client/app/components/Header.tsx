"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChain } from "../context/ChainContext";

export default function Header() {
  const pathname = usePathname();
  const {
    connected,
    connecting,
    accounts,
    selectedAccount,
    setSelectedAccount,
    balance,
    connect,
  } = useChain();

  return (
    <>
      <header
        style={{
          height: 52,
          padding: "0 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 100,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* ── LEFT: Logo + Nav ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo.png" alt="Sparrow logo" style={{ height: 58, width: "auto" }} />

          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[
              { href: "/trade", label: "Trade" },
              { href: "/lend", label: "Lend" },
            ].map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    padding: "6px 12px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    color: isActive ? "var(--accent-amber)" : "var(--text-muted)",
                    background: isActive ? "var(--accent-amber-dim)" : "transparent",
                    textDecoration: "none",
                    borderRadius: 12,
                    transition: "color 0.15s, background 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ── RIGHT: Wallet ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {connected && selectedAccount && (
            <>
              {/* Balance */}
              <div className="header-balance">
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    display: "block",
                  }}
                >
                  BALANCE
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--accent-amber)",
                  }}
                >
                  {balance} POT
                </span>
              </div>

              {/* Account selector  */}
              <select
                className="header-account-select"
                value={selectedAccount.address}
                onChange={(e) =>
                  setSelectedAccount(
                    accounts.find((a) => a.address === e.target.value)
                  )
                }
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  padding: "5px 10px",
                  borderRadius: 4,
                  maxWidth: 160,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {accounts.map((a) => (
                  <option key={a.address} value={a.address}>
                    {a.meta.name || a.address.slice(0, 12) + "…"}
                  </option>
                ))}
              </select>
            </>
          )}

          {!connected ? (
            <button
              className="btn btn-primary"
              onClick={connect}
              disabled={connecting}
              style={{ whiteSpace: "nowrap" }}
            >
              {connecting ? (
                <><span className="spinner" /> Connecting…</>
              ) : (
                <>
                  <span className="header-connect-full">Connect Wallet</span>
                  <span className="header-connect-short">Connect</span>
                </>
              )}
            </button>
          ) : (
            <div
              className="header-status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 12px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--bg-elevated)",
              }}
            >
              <span className="status-dot" />
              <span
                className="header-status-url"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  letterSpacing: "0.03em",
                }}
              >
                ws://127.0.0.1:9944
              </span>
            </div>
          )}
        </div>
      </header>

      <style>{`
        .header-connect-short { display: none; }

        @media (max-width: 768px) {
          .header-balance { display: none; }
          .header-account-select { display: none; }
          .header-status-url { display: none; }
          .header-connect-full { display: none; }
          .header-connect-short { display: inline; }
        }
      `}</style>
    </>
  );
}