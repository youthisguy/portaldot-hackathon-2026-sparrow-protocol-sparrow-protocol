#![cfg_attr(not(feature = "std"), no_std, no_main)]
 
/// Isolated Margin Trading Engine
#[ink::contract]
mod sparrowmargin {
    use ink::storage::Mapping;
    use ink::prelude::vec::Vec;
    //   >> ────────────
    //  ---> Types
    //   >> ────────────

    #[derive(scale::Encode, scale::Decode, Debug, PartialEq, Eq, Clone)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub enum Direction {
        Long,
        Short,
    }

    #[derive(scale::Encode, scale::Decode, Debug, PartialEq, Eq, Clone)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Position {
        pub id: u64,
        pub owner: AccountId,
        pub direction: Direction,
        pub collateral: Balance,
        pub borrowed: Balance,
        pub leverage: u32,
        pub entry_price: u128,
        pub open_block: u32,
        pub is_active: bool,
        pub borrow_rate: u32,
    }

    pub type PositionView = (u64, AccountId, u8, Balance, Balance, u32, u128, u32, bool);

    //   >> ────────────
    //  ---> Storage
    //   >> ────────────

    #[ink(storage)]
    pub struct Sparrowmargin {
        positions: Mapping<u64, Position>,
        user_positions: Mapping<AccountId, Vec<u64>>,
        free_collateral: Mapping<AccountId, Balance>,
        next_position_id: u64,

        long_open_interest: Balance,
        short_open_interest: Balance,

        current_price: u128,
        admin: AccountId,
        lend_contract: AccountId,

        max_leverage: u32,
        min_collateral_ratio: u32,
        liquidation_hf: u32,
        liquidation_bonus: u32,
        funding_interval_blocks: u32,
        last_funding_block: u32,
        funding_rate_bps: u32,
        blocks_per_year: u128,
    }

    //   >> ────────────
    //  ---> Events
    //   >> ────────────

    #[ink(event)]
    pub struct CollateralDeposited {
        #[ink(topic)]
        user: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct CollateralWithdrawn {
        #[ink(topic)]
        user: AccountId,
        amount: Balance,
    }

    #[ink(event)]
    pub struct PositionOpened {
        #[ink(topic)]
        position_id: u64,
        #[ink(topic)]
        owner: AccountId,
        direction: u8,
        collateral: Balance,
        borrowed: Balance,
        leverage: u32,
        entry_price: u128,
    }

    #[ink(event)]
    pub struct PositionClosed {
        #[ink(topic)]
        position_id: u64,
        #[ink(topic)]
        owner: AccountId,
        pnl_amount: Balance,
        is_profit: bool,
        payout: Balance,
    }

    #[ink(event)]
    pub struct PositionLiquidated {
        #[ink(topic)]
        position_id: u64,
        liquidator: AccountId,
        collateral_seized: Balance,
        bonus: Balance,
    }

    #[ink(event)]
    pub struct PriceUpdated {
        new_price: u128,
        updated_by: AccountId,
    }

    #[ink(event)]
    pub struct FundingSettled {
        long_oi: Balance,
        short_oi: Balance,
        funding_direction: u8,
    }

    //   >> ────────────
    //  ---> Implementation
    //   >> ────────────

    impl Sparrowmargin {
        #[ink(constructor)]
        pub fn new(lend_contract: AccountId, initial_price: u128) -> Self {
            Self {
                positions: Mapping::default(),
                user_positions: Mapping::default(),
                free_collateral: Mapping::default(),
                next_position_id: 1,
                long_open_interest: 0,
                short_open_interest: 0,
                current_price: initial_price,
                admin: Self::env().caller(),
                lend_contract,
                max_leverage: 500,
                min_collateral_ratio: 110,
                liquidation_hf: 100,
                liquidation_bonus: 5,
                funding_interval_blocks: 100,
                last_funding_block: 0,
                funding_rate_bps: 1,
                blocks_per_year: 2_628_000,
            }
        }

        // >> Admin  >> 
        #[ink(message)]
        pub fn set_mock_price(&mut self, new_price: u128) {
            assert_eq!(self.env().caller(), self.admin, "Only admin");
            assert!(new_price > 0, "Price must be > 0");
            self.current_price = new_price;
            self.env().emit_event(PriceUpdated { new_price, updated_by: self.admin });
        }

        // >> Collateral >>
        #[ink(message, payable)]
        pub fn deposit_collateral(&mut self) {
            let caller = self.env().caller();
            let amount = self.env().transferred_value();
            assert!(amount > 0, "Must deposit > 0");

            let current = self.free_collateral.get(caller).unwrap_or(0);
            // Using checked_add to satisfy clippy::arithmetic_side_effects
            let new_amount = current.checked_add(amount).expect("Collateral overflow");
            self.free_collateral.insert(caller, &new_amount);

            self.env().emit_event(CollateralDeposited { user: caller, amount });
        }

        #[ink(message)]
        pub fn withdraw_collateral(&mut self, amount: Balance) {
            let caller = self.env().caller();
            let free = self.free_collateral.get(caller).unwrap_or(0);
            assert!(free >= amount, "Insufficient free collateral");

            let new_free = free.checked_sub(amount).expect("Underflow");
            self.free_collateral.insert(caller, &new_free);

            self.env().transfer(caller, amount).expect("Transfer failed");
            self.env().emit_event(CollateralWithdrawn { user: caller, amount });
        }

        // >> Position >>
        #[ink(message)]
        pub fn open_position(
            &mut self,
            direction: Direction,
            leverage: u32,
            collateral_amount: Balance,
        ) -> u64 {
            let caller = self.env().caller();

            assert!(leverage >= 100, "Leverage must be >= 1x");
            assert!(leverage <= self.max_leverage, "Exceeds max leverage");
            assert!(collateral_amount > 0, "Collateral must be > 0");

            // Tiered leverage
            let large_threshold = 10_000u128
                .checked_mul(10u128.pow(14))
                .expect("Threshold overflow");

            let effective_max = if collateral_amount > large_threshold { 300 } else { self.max_leverage };
            assert!(leverage <= effective_max, "Large positions capped at 3x");

            let free = self.free_collateral.get(caller).unwrap_or(0);
            assert!(free >= collateral_amount, "Insufficient free collateral");

            let new_free = free
                .checked_sub(collateral_amount)
                .expect("Collateral underflow");
            self.free_collateral.insert(caller, &new_free);

            // Position size
            let position_size = collateral_amount
                .checked_mul(leverage as u128)
                .expect("Size mul overflow")
                .checked_div(100)
                .expect("Size div error");

            let borrowed = position_size
                .checked_sub(collateral_amount)
                .expect("Borrow underflow");

            if borrowed > 0 {
                self.call_borrow_for(borrowed);
            }

            let borrow_rate = self.get_lend_borrow_rate();

            let id = self.next_position_id;
            self.next_position_id = self
                .next_position_id
                .checked_add(1)
                .expect("ID overflow");

            let pos = Position {
                id,
                owner: caller,
                direction: direction.clone(),
                collateral: collateral_amount,
                borrowed,
                leverage,
                entry_price: self.current_price,
                open_block: self.env().block_number(),
                is_active: true,
                borrow_rate,
            };

            self.positions.insert(id, &pos);

            // User positions
            let mut ids = self.user_positions.get(caller).unwrap_or_default();
            ids.push(id);
            self.user_positions.insert(caller, &ids);

            // Open interest
            match direction {
                Direction::Long => {
                    self.long_open_interest = self
                        .long_open_interest
                        .checked_add(position_size)
                        .expect("Long OI overflow");
                }
                Direction::Short => {
                    self.short_open_interest = self
                        .short_open_interest
                        .checked_add(position_size)
                        .expect("Short OI overflow");
                }
            }

            self.env().emit_event(PositionOpened {
                position_id: id,
                owner: caller,
                direction: if matches!(direction, Direction::Long) { 0 } else { 1 },
                collateral: collateral_amount,
                borrowed,
                leverage,
                entry_price: self.current_price,
            });

            self.maybe_settle_funding();
            id
        }

        #[ink(message)]
        pub fn close_position(&mut self, position_id: u64) {
            let caller = self.env().caller();
            let mut pos = self.positions.get(position_id).expect("Position not found");
            assert!(pos.is_active, "Position already closed");
            assert!(pos.owner == caller, "Not your position");
        
            let (pnl_amount, is_profit) = self.calc_pnl(&pos);
            let interest = self.calc_borrow_interest(&pos);
        
            let position_size = pos.collateral
                .checked_add(pos.borrowed)
                .expect("Size overflow");
        
            // Calculate final payout: collateral + pnl - interest
            let payout = if is_profit {
                pos.collateral
                    .saturating_add(pnl_amount)
                    .saturating_sub(interest)
            } else {
                pos.collateral
                    .saturating_sub(pnl_amount)
                    .saturating_sub(interest)
            };
        
            let repay_amount = pos.borrowed
                .checked_add(interest)
                .expect("Repay overflow");
        
            // Repay debt to SparrowLend
            if pos.borrowed > 0 {
                self.call_repay_for(pos.borrowed, repay_amount);
            }
        
            // Update open interest
            match pos.direction {
                Direction::Long => self.long_open_interest = self.long_open_interest.saturating_sub(position_size),
                Direction::Short => self.short_open_interest = self.short_open_interest.saturating_sub(position_size),
            }
        
            pos.is_active = false;
            self.positions.insert(position_id, &pos);
 
            if payout > 0 {
                self.env().transfer(caller, payout).expect("Payout failed");
            }
        
            // Return any leftover collateral to free_collateral
            let collateral_to_return = pos.collateral.saturating_sub(interest);
            if collateral_to_return > 0 {
                let current_free = self.free_collateral.get(caller).unwrap_or(0);
                self.free_collateral.insert(caller, &(current_free + collateral_to_return));
            }
        
            self.env().emit_event(PositionClosed {
                position_id,
                owner: caller,
                pnl_amount,
                is_profit,
                payout,
            });
        }

        #[ink(message)]
        pub fn liquidate(&mut self, position_id: u64) {
            let liquidator = self.env().caller();
            let mut pos = self.positions.get(position_id).expect("Position not found");
            assert!(pos.is_active, "Position already closed");

            let hf = self.calc_health_factor(&pos);
            assert!(hf < self.liquidation_hf, "Position is healthy");

            let interest = self.calc_borrow_interest(&pos);
            let position_size = pos.collateral
                .checked_add(pos.borrowed)
                .expect("Size overflow");

            let bonus = pos.collateral
                .checked_mul(self.liquidation_bonus as u128)
                .expect("Bonus mul overflow")
                .checked_div(100)
                .expect("Bonus div error");

            let liquidator_payout = bonus.min(pos.collateral);
            let pool_recovery = pos.collateral.saturating_sub(liquidator_payout);

            let repayable = pool_recovery.min(pos.borrowed
                .checked_add(interest)
                .expect("Repay overflow"));

            if repayable > 0 {
                self.call_repay_for(pos.borrowed.min(repayable), repayable);
            }

            match pos.direction {
                Direction::Long => self.long_open_interest = self.long_open_interest.saturating_sub(position_size),
                Direction::Short => self.short_open_interest = self.short_open_interest.saturating_sub(position_size),
            }

            pos.is_active = false;
            self.positions.insert(position_id, &pos);

            if liquidator_payout > 0 {
                self.env().transfer(liquidator, liquidator_payout).expect("Liquidator payout failed");
            }

            self.env().emit_event(PositionLiquidated {
                position_id,
                liquidator,
                collateral_seized: pos.collateral,
                bonus: liquidator_payout,
            });
        }

        // >> View functions >> 

        #[ink(message)]
        pub fn get_position_pnl(&self, position_id: u64) -> (Balance, bool) {
            let pos = self.positions.get(position_id).expect("Position not found");
            self.calc_pnl(&pos)
        }

        #[ink(message)]
        pub fn get_health_factor(&self, position_id: u64) -> u32 {
            let pos = self.positions.get(position_id).expect("Position not found");
            self.calc_health_factor(&pos)
        }

        #[ink(message)]
        pub fn get_position(&self, position_id: u64) -> Option<PositionView> {
            self.positions.get(position_id).map(|p| {
                (
                    p.id,
                    p.owner,
                    if matches!(p.direction, Direction::Long) { 0 } else { 1 },
                    p.collateral,
                    p.borrowed,
                    p.leverage,
                    p.entry_price,
                    p.open_block,
                    p.is_active,
                )
            })
        }

        #[ink(message)]
        pub fn get_user_positions(&self, user: AccountId) -> Vec<u64> {
            self.user_positions.get(user).unwrap_or_default()
        }

        #[ink(message)]
        pub fn get_free_collateral(&self, user: AccountId) -> Balance {
            self.free_collateral.get(user).unwrap_or(0)
        }

        #[ink(message)]
        pub fn get_current_price(&self) -> u128 {
            self.current_price
        }

        #[ink(message)]
        pub fn get_market_stats(&self) -> (Balance, Balance, u128, u64) {
            (self.long_open_interest, self.short_open_interest, self.current_price, self.next_position_id)
        }

        // >> Internal calculations >>

        fn calc_pnl(&self, pos: &Position) -> (Balance, bool) {
            let size = pos.collateral
                .checked_add(pos.borrowed)
                .expect("Size overflow");
        
            let entry = pos.entry_price;
            let current = self.current_price;
        
            if entry == 0 || size == 0 {
                return (0, true);
            }
        
            match pos.direction {
                Direction::Long => {
                    if current >= entry {
                        // Long profit
                        let diff = current - entry;
                        let pnl = size * diff / entry;
                        (pnl, true)
                    } else {
                        // Long loss
                        let diff = entry - current;
                        let pnl = size * diff / entry;
                        (pnl, false)
                    }
                }
                Direction::Short => {
                    if current <= entry {
                        // Short profit 
                        let diff = entry - current;
                        let pnl = size * diff / entry;
                        (pnl, true)
                    } else {
                        // Short loss 
                        let diff = current - entry;
                        let pnl = size * diff / entry;
                        (pnl, false)
                    }
                }
            }
        }

        fn calc_health_factor(&self, pos: &Position) -> u32 {
            let interest = self.calc_borrow_interest(pos);
            let debt = pos.borrowed
                .checked_add(interest)
                .expect("Debt overflow");

            if debt == 0 {
                return u32::MAX;
            }

            let (pnl, is_profit) = self.calc_pnl(pos);
            let collateral_value = if is_profit {
                pos.collateral.saturating_add(pnl)
            } else {
                pos.collateral.saturating_sub(pnl)
            };

            let hf = collateral_value
                .checked_mul(100)
                .expect("HF mul overflow")
                .checked_div(debt)
                .unwrap_or(0);

            // Safe conversion
            u32::try_from(hf).unwrap_or(u32::MAX)
        }

        fn calc_borrow_interest(&self, pos: &Position) -> Balance {
            let blocks = (self.env().block_number().saturating_sub(pos.open_block)) as u128;

            pos.borrowed
                .checked_mul(pos.borrow_rate as u128)
                .and_then(|x| x.checked_mul(blocks))
                .and_then(|x| {
                    let denominator = 10_000u128
                        .checked_mul(self.blocks_per_year)
                        .expect("Denominator overflow");
                    x.checked_div(denominator)
                })
                .unwrap_or(0)
        }
 

        fn maybe_settle_funding(&mut self) {
            let current = self.env().block_number();
            let next_funding = self.last_funding_block
                .checked_add(self.funding_interval_blocks)
                .unwrap_or(u32::MAX);

            if current < next_funding {
                return;
            }

            self.last_funding_block = current;

            let long = self.long_open_interest;
            let short = self.short_open_interest;

            if long == 0 || short == 0 {
                return;
            }

            let direction = if long > short { 0 } else { 1 };
            self.env().emit_event(FundingSettled {
                long_oi: long,
                short_oi: short,
                funding_direction: direction,
            });
        }

        // >> Cross-contract calls >>

        fn call_borrow_for(&self, amount: Balance) {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            use ink::env::DefaultEnvironment;   

            let _ = build_call::<DefaultEnvironment>()
                .call(self.lend_contract)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("borrow_for")))
                        .push_arg(amount),
                )
                .returns::<bool>()
                .try_invoke()
                .expect("borrow_for failed");
        }

        fn call_repay_for(&self, principal: Balance, repay_amount: Balance) {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            use ink::env::DefaultEnvironment;   

            let _ = build_call::<DefaultEnvironment>()
                .call(self.lend_contract)
                .transferred_value(repay_amount)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("repay_for")))
                        .push_arg(principal),
                )
                .returns::<bool>()
                .try_invoke()
                .expect("repay_for failed");
        }

        fn get_lend_borrow_rate(&self) -> u32 {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            use ink::env::DefaultEnvironment;  

            let result = build_call::<DefaultEnvironment>()
                .call(self.lend_contract)
                .exec_input(ExecutionInput::new(Selector::new(
                    ink::selector_bytes!("get_current_borrow_rate"),
                )))
                .returns::<u32>()
                .try_invoke();

            match result {
                Ok(Ok(rate)) => rate,
                _ => 500,
            }
        }
    }
}