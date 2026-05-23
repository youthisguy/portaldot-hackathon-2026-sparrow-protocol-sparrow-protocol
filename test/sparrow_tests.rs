
#[cfg(test)]
mod sparrowmargin_tests {
    use super::*;

    // ── Helpers ──────────────────────────────────────────────────

    fn alice() -> AccountId {
        ink::env::test::default_accounts::<ink::env::DefaultEnvironment>().alice
    }
    fn bob() -> AccountId {
        ink::env::test::default_accounts::<ink::env::DefaultEnvironment>().bob
    }
    fn lend_addr() -> AccountId { AccountId::from([0x99; 32]) }

    fn set_caller(a: AccountId) {
        ink::env::test::set_caller::<ink::env::DefaultEnvironment>(a);
    }
    fn set_value(v: Balance) {
        ink::env::test::set_value_transferred::<ink::env::DefaultEnvironment>(v);
    }
    fn set_block(n: u32) {
        ink::env::test::set_block_number::<ink::env::DefaultEnvironment>(n);
    }

    fn new_contract() -> Sparrowmargin {
        set_caller(alice());
        Sparrowmargin::new(lend_addr(), 1_000_000) // $1.00 seed price
    }

    fn make_position(
        c: &Sparrowmargin,
        dir: Direction,
        collateral: Balance,
        borrowed: Balance,
        entry: u128,
    ) -> Position {
        Position {
            id: 1, owner: alice(), direction: dir,
            collateral, borrowed, leverage: 300,
            entry_price: entry, open_block: 0,
            is_active: true, borrow_rate: 500,
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  1. Deployment
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_initial_state() {
        let c = new_contract();
        assert_eq!(c.get_spot_price(), 1_000_000, "seed price = $1.00");
        assert_eq!(c.get_twap(), 1_000_000,       "twap = seed price initially");
        assert_eq!(c.max_leverage, 500,            "5x max");
        assert_eq!(c.liquidation_hf, 100,          "liquidate at HF < 1.0");
        assert_eq!(c.liquidation_bonus, 5,          "5% bonus");
        assert_eq!(c.next_id, 1,                   "starts at position 1");
        let (long, short, _, _, _) = c.get_market_stats();
        assert_eq!(long, 0);
        assert_eq!(short, 0);
    }

    // ═══════════════════════════════════════════════════════════
    //  2. TWAP Oracle
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_single_observation_returns_that_price() {
        let c = new_contract();
        assert_eq!(c.get_twap(), 1_000_000);
    }

    #[ink::test]
    fn test_push_observation_updates_spot() {
        let mut c = new_contract();
        set_caller(alice());
        set_block(10);
        c.push_price_observation(1_500_000);
        assert_eq!(c.get_spot_price(), 1_500_000);
    }

    #[ink::test]
    fn test_twap_averages_multiple_observations() {
        let mut c = new_contract();
        // obs[0]: block=0, price=1_000_000 (from seed)
        set_block(10);
        c.push_price_observation(1_500_000); // obs[1] at block 10
        set_block(20);
        c.push_price_observation(2_000_000); // obs[2] at block 20

        let twap = c.get_twap();
        // TWAP should be between 1_000_000 and 2_000_000
        assert!(twap >= 1_000_000 && twap <= 2_000_000,
            "TWAP should be between min and max price, got {}", twap);
    }

    #[ink::test]
    fn test_twap_is_lower_than_recent_spike() {
        let mut c = new_contract();
        // Many observations at $1.00
        for i in 1u32..10 {
            set_block(i * 10);
            c.push_price_observation(1_000_000);
        }
        // Sudden spike to $5.00
        set_block(100);
        c.push_price_observation(5_000_000);

        let twap  = c.get_twap();
        let spot  = c.get_spot_price();
        assert_eq!(spot, 5_000_000, "Spot reflects latest price");
        assert!(twap < spot,
            "TWAP should be dampened vs spot spike. twap={}, spot={}", twap, spot);
    }

    #[ink::test]
    fn test_admin_set_price_updates_buffer() {
        let mut c = new_contract();
        set_caller(alice());
        c.admin_set_price(2_000_000);
        assert_eq!(c.get_spot_price(), 2_000_000);
    }

    #[ink::test]
    #[should_panic(expected = "Only admin")]
    fn test_non_admin_cannot_use_admin_set_price() {
        let mut c = new_contract();
        set_caller(bob());
        c.admin_set_price(9_999_999);
    }

    #[ink::test]
    #[should_panic(expected = "Price must be > 0")]
    fn test_push_zero_price_panics() {
        let mut c = new_contract();
        c.push_price_observation(0);
    }

    // ═══════════════════════════════════════════════════════════
    //  3. Collateral Management
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_deposit_collateral_records_amount() {
        let mut c = new_contract();
        set_caller(alice());
        set_value(5000);
        c.deposit_collateral();
        assert_eq!(c.get_free_collateral(alice()), 5000);
    }

    #[ink::test]
    fn test_multiple_deposits_accumulate() {
        let mut c = new_contract();
        set_caller(alice());
        set_value(1000);
        c.deposit_collateral();
        set_value(2000);
        c.deposit_collateral();
        assert_eq!(c.get_free_collateral(alice()), 3000);
    }

    #[ink::test]
    #[should_panic(expected = "Insufficient free collateral")]
    fn test_withdraw_more_than_free_collateral_panics() {
        let mut c = new_contract();
        set_caller(alice());
        set_value(100);
        c.deposit_collateral();
        c.withdraw_collateral(500); // more than deposited
    }

    // ═══════════════════════════════════════════════════════════
    //  4. PnL Calculations
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_long_position_profit_when_price_rises() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Long, 100, 200, 1_000_000);
        // current price (in contract) = 1_000_000, but let's test calc directly
        let (pnl, profit) = c.calc_pnl_at(&pos, 1_500_000); // +50%
        assert!(profit, "Long should profit when price rises");
        assert_eq!(pnl, 150, "PnL = 300 (size) × 0.5 = 150");
    }

    #[ink::test]
    fn test_long_position_loss_when_price_falls() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Long, 100, 200, 1_000_000);
        let (pnl, profit) = c.calc_pnl_at(&pos, 500_000); // -50%
        assert!(!profit, "Long should lose when price falls");
        assert_eq!(pnl, 150, "Loss = 300 × 0.5 = 150");
    }

    #[ink::test]
    fn test_short_position_profit_when_price_falls() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Short, 100, 200, 1_000_000);
        let (pnl, profit) = c.calc_pnl_at(&pos, 500_000); // -50%
        assert!(profit, "Short should profit when price falls");
        assert_eq!(pnl, 150, "PnL = 300 × 0.5 = 150");
    }

    #[ink::test]
    fn test_short_position_loss_when_price_rises() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Short, 100, 200, 1_000_000);
        let (pnl, profit) = c.calc_pnl_at(&pos, 1_500_000); // +50%
        assert!(!profit, "Short should lose when price rises");
        assert_eq!(pnl, 150, "Loss = 300 × 0.5 = 150");
    }

    #[ink::test]
    fn test_pnl_zero_when_price_unchanged() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Long, 100, 200, 1_000_000);
        let (pnl, _) = c.calc_pnl_at(&pos, 1_000_000); // no change
        assert_eq!(pnl, 0, "No PnL when price unchanged");
    }

    #[ink::test]
    fn test_higher_leverage_amplifies_pnl() {
        let c = new_contract();
        // 1x position: size=100, borrowed=0
        let pos_1x = Position {
            id: 1, owner: alice(), direction: Direction::Long,
            collateral: 100, borrowed: 0, leverage: 100,
            entry_price: 1_000_000, open_block: 0, is_active: true, borrow_rate: 500,
        };
        // 3x position: size=300, borrowed=200
        let pos_3x = make_position(&c, Direction::Long, 100, 200, 1_000_000);

        let (pnl_1x, _) = c.calc_pnl_at(&pos_1x, 1_500_000);
        let (pnl_3x, _) = c.calc_pnl_at(&pos_3x, 1_500_000);
        assert!(pnl_3x > pnl_1x,
            "3x should profit more than 1x. 1x={}, 3x={}", pnl_1x, pnl_3x);
        assert_eq!(pnl_3x, 3 * pnl_1x, "3x PnL should be exactly 3× 1x PnL");
    }

    // ═══════════════════════════════════════════════════════════
    //  5. Health Factor
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_health_factor_above_100_when_profitable() {
        let c = new_contract();
        let pos = make_position(&c, Direction::Long, 100, 200, 1_000_000);
        // Price up → positive PnL → higher HF
        let hf = c.calc_health_factor_at(&pos, 1_200_000);
        assert!(hf > 100, "Profitable position should have HF > 1.0 (100)");
    }

    #[ink::test]
    fn test_health_factor_below_100_when_large_loss() {
        let c = new_contract();
        // Highly leveraged: 100 collateral, 400 borrowed (5x)
        let pos = Position {
            id: 1, owner: alice(), direction: Direction::Long,
            collateral: 100, borrowed: 400, leverage: 500,
            entry_price: 1_000_000, open_block: 0, is_active: true, borrow_rate: 500,
        };
        // Price drops 30%: loss = 500 × 0.3 = 150, collateral = 100
        // collateral_val = 100 - 150 = saturates to 0
        // HF = 0 / 400 = 0 → below liquidation threshold
        let hf = c.calc_health_factor_at(&pos, 700_000);
        assert!(hf < 100, "Underwater position should have HF < 1.0 (100), got {}", hf);
    }

    #[ink::test]
    fn test_health_factor_max_when_no_debt() {
        let c = new_contract();
        let pos = Position {
            id: 1, owner: alice(), direction: Direction::Long,
            collateral: 1000, borrowed: 0, leverage: 100,
            entry_price: 1_000_000, open_block: 0, is_active: true, borrow_rate: 0,
        };
        let hf = c.calc_health_factor_at(&pos, 1_000_000);
        assert_eq!(hf, u32::MAX, "No debt = max health factor");
    }

    // ═══════════════════════════════════════════════════════════
    //  6. Leverage Validation
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    #[should_panic(expected = "Exceeds max leverage")]
    fn test_leverage_above_500_rejected() {
        let mut c = new_contract();
        set_caller(alice());
        set_value(1000);
        c.deposit_collateral();
        c.open_position(Direction::Long, 600, 1000); // 6x rejected
    }

    #[ink::test]
    #[should_panic(expected = "Min leverage: 1x (100)")]
    fn test_leverage_below_100_rejected() {
        let mut c = new_contract();
        set_caller(alice());
        set_value(1000);
        c.deposit_collateral();
        c.open_position(Direction::Long, 50, 1000); // below 1x
    }

    #[ink::test]
    #[should_panic(expected = "Large positions: max 3x leverage")]
    fn test_large_position_capped_at_3x() {
        let mut c = new_contract();
        set_caller(alice());
        // Deposit more than LARGE_POSITION_THRESHOLD
        let large = 20_000 * 100_000_000_000_000u128;
        set_value(large);
        c.deposit_collateral();
        c.open_position(Direction::Long, 400, large); // 4x on large → rejected
    }

    // ═══════════════════════════════════════════════════════════
    //  7. Market Stats
    // ═══════════════════════════════════════════════════════════

    #[ink::test]
    fn test_market_stats_initial() {
        let c = new_contract();
        let (long, short, twap, spot, next_id) = c.get_market_stats();
        assert_eq!(long, 0);
        assert_eq!(short, 0);
        assert_eq!(twap, 1_000_000);
        assert_eq!(spot, 1_000_000);
        assert_eq!(next_id, 1);
    }
}