/// On-chain prediction market (Polymarket-style) per dApp.
///
/// - Funds stored on-chain; resolution by contributed capital (more YES than NO → YES wins).
/// - Polymarket-style: buy YES/NO at current outcome price (e.g. 1 NO + 3 YES → NO costs 0.25 per share).
/// - PM duration from GovernanceConfig (pm_duration_ms).
/// - Ad share to PM is split among participants: flat weight for the first half of the PM (duration/2),
///   then linear decay to 0 over the second half to avoid late griefing.
///
/// Close flow: call close_market_with_final_ad_and_distribute(market, final_ad_payment, dapp_id, clock, ctx).
/// Final ad revenue is deposited, market resolves, gas reimbursement to resolver, dust to creator.
/// Users claim individually via redeem_yes_entry, redeem_no_entry, claim_ad_share_entry (no auto-distribute loop).
module dlux::prediction_market;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::balance::{Self, Balance};
use sui::transfer;
use sui::object::{Self, ID, UID};
use sui::clock::Clock;
use sui::table::{Self, Table};
use dlux::admin;

// ───── Constants ─────

/// Divisor for ad weight: add_weight = (amount * time_weight_ms) / AD_WEIGHT_DIVISOR (u128 used to avoid overflow).
const AD_WEIGHT_DIVISOR: u64 = 1_000_000_000;

/// Gas reimbursement (in MIST) taken from pool and sent to resolver when using resolve_and_distribute.
const GAS_REIMBURSEMENT_MIST: u64 = 10_000_000; // 0.01 SUI

/// Minimum bet amount (0.01 SUI) to prevent Sybil griefing and tiny spammy positions.
const MIN_BET_AMOUNT: u64 = 10_000_000; // 0.01 SUI

const E_NOT_STARTED: u64 = 1;
const E_ALREADY_ENDED: u64 = 2;
const E_NOT_ENDED: u64 = 3;
const E_ALREADY_RESOLVED: u64 = 4;
const E_NOT_RESOLVED: u64 = 5;
const E_NO_POSITION: u64 = 8;
const E_NO_SHARES_TO_REDEEM: u64 = 9;
const E_INVALID_DAPP_ID: u64 = 10;
const E_DAPP_ID_MISMATCH: u64 = 11;
const E_MARKET_EXISTS: u64 = 12;
const E_SHARES_OUTSTANDING: u64 = 13;
const E_NOT_CREATOR: u64 = 14;
const E_BELOW_MIN_BET: u64 = 15;
const MAX_DAPP_ID_LEN: u64 = 64;

// ───── Structs ─────

/// Per-user position: YES/NO shares and weight for ad-revenue distribution.
public struct Position has store, drop, copy {
    yes_shares: u64,
    no_shares: u64,
    /// Weight for ad-share split (scaled). Claimable via claim_ad_share.
    ad_weight: u64,
}

/// Registry: dapp_id -> market ID (so clients can fetch the shared market by dapp_id).
public struct PMRegistry has key {
    id: UID,
    markets: Table<vector<u8>, ID>,
}

/// On-chain prediction market for one dApp.
/// Polymarket-style: price_yes = total_yes_capital / (total_yes + total_no), price_no = total_no / (total_yes + total_no).
/// Resolution: after ends_at_ms, anyone can resolve; outcome = (total_yes_capital >= total_no_capital).
public struct PMMarket has key {
    id: UID,
    dapp_id: vector<u8>,
    creator: address,
    started_at_ms: u64,
    ends_at_ms: u64,
    resolved: bool,
    /// True if YES won (more YES capital than NO at resolution).
    outcome_yes: bool,

    total_yes_capital: Balance<SUI>,
    total_no_capital: Balance<SUI>,
    total_yes_shares: u64,
    total_no_shares: u64,

    /// Sum of all participants' ad_weight (for proportional ad distribution).
    total_ad_weight: u64,
    /// Ad revenue to split among participants (by weight).
    ad_balance: Balance<SUI>,

    positions: Table<address, Position>,
}

// ───── Events ─────

public struct PMCreated has copy, drop {
    market_id: ID,
    dapp_id: vector<u8>,
    creator: address,
    creator_yes_amount: u64,
    ends_at_ms: u64,
}

public struct PMBought has copy, drop {
    market_id: ID,
    buyer: address,
    side_yes: bool,
    amount: u64,
    shares: u64,
}

public struct PMResolved has copy, drop {
    market_id: ID,
    outcome_yes: bool,
    total_yes_capital: u64,
    total_no_capital: u64,
}

public struct PMRedeemed has copy, drop {
    market_id: ID,
    user: address,
    amount: u64,
    side_yes: bool,
}

public struct PMAdRevenueReceived has copy, drop {
    market_id: ID,
    amount: u64,
}

public struct PMAdShareClaimed has copy, drop {
    market_id: ID,
    user: address,
    amount: u64,
}

/// Emitted when creator claims redemption dust (remainder after all winning shares redeemed).
public struct PMRedemptionDustClaimed has copy, drop {
    market_id: ID,
    creator: address,
    amount: u64,
}

// ───── Init ─────

fun init(ctx: &mut TxContext) {
    let registry = PMRegistry {
        id: object::new(ctx),
        markets: table::new(ctx),
    };
    transfer::share_object(registry);
}

// ───── Registry ─────

/// Create a new prediction market (called from dapp_posting when a dApp is posted).
/// Creator's YES portion from the posting fee is deposited as the initial YES position.
public fun create_market(
    registry: &mut PMRegistry,
    dapp_id: vector<u8>,
    creator: address,
    creator_yes_coin: Coin<SUI>,
    ends_at_ms: u64,
    ctx: &mut TxContext,
): PMMarket {
    assert!(vector::length(&dapp_id) <= MAX_DAPP_ID_LEN, E_INVALID_DAPP_ID);
    assert!(!table::contains(&registry.markets, dapp_id), E_MARKET_EXISTS);

    let amount = coin::value(&creator_yes_coin);
    assert!(amount >= MIN_BET_AMOUNT, E_BELOW_MIN_BET);
    // Use copy for registry key and event (avoids manual loops)
    let dapp_id_for_registry = copy dapp_id;
    let dapp_id_for_ev = copy dapp_id;

    let mut market = PMMarket {
        id: object::new(ctx),
        dapp_id,
        creator,
        started_at_ms: 0, // set by caller from clock
        ends_at_ms,
        resolved: false,
        outcome_yes: false,
        total_yes_capital: coin::into_balance(creator_yes_coin),
        total_no_capital: balance::zero(),
        total_yes_shares: amount,
        total_no_shares: 0,
        total_ad_weight: 0,
        ad_balance: balance::zero(),
        positions: table::new(ctx),
    };

    let pos = Position {
        yes_shares: amount,
        no_shares: 0,
        ad_weight: 0,
    };
    table::add(&mut market.positions, creator, pos);

    table::add(&mut registry.markets, dapp_id_for_registry, object::id(&market));
    event::emit(PMCreated {
        market_id: object::id(&market),
        dapp_id: dapp_id_for_ev,
        creator,
        creator_yes_amount: amount,
        ends_at_ms,
    });
    market
}

/// Set started_at_ms and credit creator's initial position with ad weight (elapsed = 0).
/// Call immediately after create_market with clock.timestamp_ms().
public fun set_started_at(market: &mut PMMarket, started_at_ms: u64) {
    assert!(market.started_at_ms == 0, E_ALREADY_ENDED);
    market.started_at_ms = started_at_ms;

    let duration_ms = market.ends_at_ms - started_at_ms;
    let w_ms = time_weight_ms(0, duration_ms);
    let amount = market.total_yes_shares;
    let add_weight = ((amount as u128) * (w_ms as u128) / (AD_WEIGHT_DIVISOR as u128)) as u64;
    market.total_ad_weight = market.total_ad_weight + add_weight;
    let pos = table::borrow_mut(&mut market.positions, market.creator);
    pos.ad_weight = pos.ad_weight + add_weight;
}

/// Create market, set started_at, and share the market (so it can be used by anyone).
/// Call from dapp_posting when a dApp is posted; started_at_ms = clock.timestamp_ms().
public fun create_and_share_market(
    registry: &mut PMRegistry,
    dapp_id: vector<u8>,
    creator: address,
    creator_yes_coin: Coin<SUI>,
    ends_at_ms: u64,
    started_at_ms: u64,
    ctx: &mut TxContext,
) {
    let mut market = create_market(registry, dapp_id, creator, creator_yes_coin, ends_at_ms, ctx);
    set_started_at(&mut market, started_at_ms);
    transfer::share_object(market);
}

#[test_only]
/// Create and share a PMRegistry for tests (so dapp_posting can call post_dapp with it).
public fun create_and_share_pm_registry_for_testing(ctx: &mut TxContext) {
    let registry = PMRegistry {
        id: object::new(ctx),
        markets: table::new(ctx),
    };
    transfer::share_object(registry);
}

/// Get market ID for a dapp_id (for client lookup).
public fun get_market_id(registry: &PMRegistry, dapp_id: vector<u8>): Option<ID> {
    if (table::contains(&registry.markets, dapp_id)) {
        option::some(*table::borrow(&registry.markets, dapp_id))
    } else {
        option::none()
    }
}

// ───── Time weight for ad share (flat first half of PM, then linear decay to 0) ─────

/// Compute time-weight in ms for a contribution at elapsed_ms into the PM.
/// Exact doubled-integral: flat weight for first half, then linear decay to 0 by end.
/// Fair even for very short markets. Result used as: add_weight = (amount * result) / AD_WEIGHT_DIVISOR.
fun time_weight_ms(elapsed_ms: u64, duration_ms: u64): u64 {
    if (elapsed_ms >= duration_ms || duration_ms == 0) {
        return 0
    };
    let flat_ms = duration_ms / 2;
    let linear_period_ms = duration_ms - flat_ms;
    if (elapsed_ms < flat_ms) {
        // In flat zone: (flat_ms - elapsed_ms) + integral of linear decay over second half
        (flat_ms - elapsed_ms) + (linear_period_ms / 2)
    } else {
        // In linear decay zone: integral from elapsed to end of (T-t)/(T/2) dt = (T - elapsed)^2 / T
        let rem = duration_ms - elapsed_ms;
        ((rem as u128) * (rem as u128) / (duration_ms as u128)) as u64
    }
}

// ───── Polymarket-style buy (size-aware: large orders move the price) ─────

/// Buy YES. Cost per share = outcome price Y/(Y+N); large buys get worse avg price (fewer shares).
/// Uses effective price (midpoint): new_shares = amount * (total + amount/2) / (total_yes + amount/2).
public fun buy_yes(
    market: &mut PMMarket,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(market.started_at_ms > 0, E_NOT_STARTED);
    let now = clock.timestamp_ms();
    assert!(now < market.ends_at_ms, E_ALREADY_ENDED);
    assert!(!market.resolved, E_ALREADY_RESOLVED);

    let amount = coin::value(&payment);
    assert!(amount >= MIN_BET_AMOUNT, E_BELOW_MIN_BET);

    let buyer = ctx.sender();
    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);

    // When no NO: 1:1. When no YES: 1:1. Else: size-aware so large orders get worse avg price.
    let new_yes_shares = if (total_no == 0) {
        amount
    } else if (total_yes == 0) {
        amount
    } else {
        let total = total_yes + total_no;
        let half = amount / 2;
        (amount * (total + half)) / (total_yes + half)
    };

    balance::join(&mut market.total_yes_capital, coin::into_balance(payment));
    market.total_yes_shares = market.total_yes_shares + new_yes_shares;

    let duration_ms = market.ends_at_ms - market.started_at_ms;
    let elapsed = now - market.started_at_ms;
    let w_ms = time_weight_ms(elapsed, duration_ms);
    let add_weight = ((amount as u128) * (w_ms as u128) / (AD_WEIGHT_DIVISOR as u128)) as u64;
    market.total_ad_weight = market.total_ad_weight + add_weight;

    if (table::contains(&market.positions, buyer)) {
        let pos = table::borrow_mut(&mut market.positions, buyer);
        pos.yes_shares = pos.yes_shares + new_yes_shares;
        pos.ad_weight = pos.ad_weight + add_weight;
    } else {
        table::add(&mut market.positions, buyer, Position {
            yes_shares: new_yes_shares,
            no_shares: 0,
            ad_weight: add_weight,
        });
    };

    event::emit(PMBought {
        market_id: object::id(market),
        buyer,
        side_yes: true,
        amount,
        shares: new_yes_shares,
    });
}

/// Buy NO. Size-aware: cost per NO = N/(Y+N); large buys get worse avg price.
/// new_no_shares = amount * (total + amount/2) / (total_no + amount/2).
public fun buy_no(
    market: &mut PMMarket,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(market.started_at_ms > 0, E_NOT_STARTED);
    let now = clock.timestamp_ms();
    assert!(now < market.ends_at_ms, E_ALREADY_ENDED);
    assert!(!market.resolved, E_ALREADY_RESOLVED);

    let amount = coin::value(&payment);
    assert!(amount >= MIN_BET_AMOUNT, E_BELOW_MIN_BET);

    let buyer = ctx.sender();
    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);

    let new_no_shares = if (total_yes == 0) {
        amount
    } else if (total_no == 0) {
        amount
    } else {
        let total = total_yes + total_no;
        let half = amount / 2;
        (amount * (total + half)) / (total_no + half)
    };

    balance::join(&mut market.total_no_capital, coin::into_balance(payment));
    market.total_no_shares = market.total_no_shares + new_no_shares;

    let duration_ms = market.ends_at_ms - market.started_at_ms;
    let elapsed = now - market.started_at_ms;
    let w_ms = time_weight_ms(elapsed, duration_ms);
    let add_weight = ((amount as u128) * (w_ms as u128) / (AD_WEIGHT_DIVISOR as u128)) as u64;
    market.total_ad_weight = market.total_ad_weight + add_weight;

    if (table::contains(&market.positions, buyer)) {
        let pos = table::borrow_mut(&mut market.positions, buyer);
        pos.no_shares = pos.no_shares + new_no_shares;
        pos.ad_weight = pos.ad_weight + add_weight;
    } else {
        table::add(&mut market.positions, buyer, Position {
            yes_shares: 0,
            no_shares: new_no_shares,
            ad_weight: add_weight,
        });
    };

    event::emit(PMBought {
        market_id: object::id(market),
        buyer,
        side_yes: false,
        amount,
        shares: new_no_shares,
    });
}

// ───── Resolution (on-chain by capital) ─────

/// Resolve the market after ends_at_ms. Outcome = (total_yes_capital >= total_no_capital).
/// Callable by anyone once the PM period has ended.
public fun resolve(market: &mut PMMarket, clock: &Clock) {
    assert!(market.started_at_ms > 0, E_NOT_STARTED);
    assert!(clock.timestamp_ms() >= market.ends_at_ms, E_NOT_ENDED);
    assert!(!market.resolved, E_ALREADY_RESOLVED);

    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);
    market.outcome_yes = total_yes >= total_no;
    market.resolved = true;

    event::emit(PMResolved {
        market_id: object::id(market),
        outcome_yes: market.outcome_yes,
        total_yes_capital: total_yes,
        total_no_capital: total_no,
    });
}

/// Canonical close flow: deposit final ad revenue, resolve, gas reimbursement, dust to creator.
/// Users claim individually via redeem_yes_entry, redeem_no_entry, claim_ad_share_entry.
public fun close_market_with_final_ad_and_distribute(
    market: &mut PMMarket,
    final_ad_payment: Coin<SUI>,
    dapp_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    accept_ad_revenue(market, final_ad_payment, dapp_id);
    resolve_and_distribute(market, clock, ctx);
}

/// Resolve market, take gas reimbursement (ad_balance first, then capital pool), send dust to creator.
/// Participants claim individually via redeem_yes_entry, redeem_no_entry, claim_ad_share_entry.
public fun resolve_and_distribute(
    market: &mut PMMarket,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(market.started_at_ms > 0, E_NOT_STARTED);
    assert!(clock.timestamp_ms() >= market.ends_at_ms, E_NOT_ENDED);
    assert!(!market.resolved, E_ALREADY_RESOLVED);

    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);
    market.outcome_yes = total_yes >= total_no;
    market.resolved = true;

    event::emit(PMResolved {
        market_id: object::id(market),
        outcome_yes: market.outcome_yes,
        total_yes_capital: total_yes,
        total_no_capital: total_no,
    });

    let resolver = ctx.sender();

    // Gas reimbursement from pool (ad_balance first, then main pool)
    let gas_take = GAS_REIMBURSEMENT_MIST;
    let ad_val = balance::value(&market.ad_balance);
    if (gas_take > 0) {
        let gas_from = if (ad_val >= gas_take) {
            balance::split(&mut market.ad_balance, gas_take)
        } else if (ad_val > 0) {
            balance::split(&mut market.ad_balance, ad_val)
        } else {
            let pool_val = balance::value(&market.total_yes_capital) + balance::value(&market.total_no_capital);
            if (pool_val >= gas_take) {
                let y = balance::value(&market.total_yes_capital);
                if (y >= gas_take) {
                    balance::split(&mut market.total_yes_capital, gas_take)
                } else {
                    let mut b = balance::split(&mut market.total_yes_capital, y);
                    if (gas_take - y > 0) {
                        balance::join(&mut b, balance::split(&mut market.total_no_capital, gas_take - y));
                    };
                    b
                }
            } else {
                balance::zero()
            }
        };
        let gas_val = balance::value(&gas_from);
        if (gas_val > 0) {
            transfer::public_transfer(coin::from_balance(gas_from, ctx), resolver);
        } else {
            balance::destroy_zero(gas_from);
        };
    };

    // Ad remainder to creator — no one can claim_ad_share after resolution; capital pool stays for redemptions
    let ad_left = balance::value(&market.ad_balance);
    if (ad_left > 0) {
        let ad_dust = balance::withdraw_all(&mut market.ad_balance);
        transfer::public_transfer(coin::from_balance(ad_dust, ctx), market.creator);
        event::emit(PMRedemptionDustClaimed {
            market_id: object::id(market),
            creator: market.creator,
            amount: ad_left,
        });
    };
}

// ───── Admin override (veto: force-resolve to NO) ─────

/// Admin can force-resolve market to NO after it has ended (veto power only).
/// Takes fee_pct from ad_balance (then capital pool) and sends to AdminSet.
/// Callable only by addresses in AdminSet with valid AdminOverrideCap.
public fun admin_resolve_override(
    market: &mut PMMarket,
    admin_set: &mut admin::AdminSet,
    _cap: &admin::AdminOverrideCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let admin_addr = ctx.sender();
    assert!(admin::is_admin(admin_set, admin_addr), 1); // E_NOT_ADMIN
    assert!(admin::cap_matches_admin_set(_cap, admin_set), 5); // E_INVALID_ADMIN_SET
    assert!(clock.timestamp_ms() >= market.ends_at_ms, 2); // E_MARKET_NOT_ENDED
    assert!(!market.resolved, 3); // E_ALREADY_RESOLVED

    market.outcome_yes = false;
    market.resolved = true;

    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);
    event::emit(PMResolved {
        market_id: object::id(market),
        outcome_yes: false,
        total_yes_capital: total_yes,
        total_no_capital: total_no,
    });

    let fee_pct = admin::get_fee_pct(admin_set);
    let ad_val = balance::value(&market.ad_balance);
    let pool_val = total_yes + total_no;
    let total_available = ad_val + pool_val;
    let fee_amount = (total_available * fee_pct) / 100;

    let fee_bal = if (fee_amount > 0) {
        if (ad_val >= fee_amount) {
            balance::split(&mut market.ad_balance, fee_amount)
        } else if (ad_val > 0) {
            let mut b = balance::withdraw_all(&mut market.ad_balance);
            let rem = fee_amount - ad_val;
            if (rem > 0 && pool_val >= rem) {
                let y = balance::value(&market.total_yes_capital);
                if (y >= rem) {
                    balance::join(&mut b, balance::split(&mut market.total_yes_capital, rem));
                } else {
                    balance::join(&mut b, balance::split(&mut market.total_yes_capital, y));
                    if (rem - y > 0) {
                        balance::join(&mut b, balance::split(&mut market.total_no_capital, rem - y));
                    };
                };
            };
            b
        } else if (pool_val >= fee_amount) {
            let y = balance::value(&market.total_yes_capital);
            if (y >= fee_amount) {
                balance::split(&mut market.total_yes_capital, fee_amount)
            } else {
                let mut b = balance::split(&mut market.total_yes_capital, y);
                balance::join(&mut b, balance::split(&mut market.total_no_capital, fee_amount - y));
                b
            }
        } else {
            balance::zero()
        }
    } else {
        balance::zero()
    };

    let fee_val = balance::value(&fee_bal);
    if (fee_val > 0) {
        admin::record_override(admin_set, object::id(market), admin_addr, fee_bal);
    } else {
        balance::destroy_zero(fee_bal);
    };
}

// ───── Redeem winning shares ─────

/// Redeem YES shares after resolution (only pays if outcome was YES). Pool = yes_capital + no_capital.
public fun redeem_yes(
    market: &mut PMMarket,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(market.resolved, E_NOT_RESOLVED);
    assert!(market.outcome_yes, E_NO_SHARES_TO_REDEEM);

    let user = ctx.sender();
    assert!(table::contains(&market.positions, user), E_NO_POSITION);
    let pos = table::borrow_mut(&mut market.positions, user);
    assert!(pos.yes_shares > 0, E_NO_SHARES_TO_REDEEM);

    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);
    let pool = total_yes + total_no;
    let shares = pos.yes_shares;
    let payout = if (market.total_yes_shares == 0) { 0 } else { (pool * shares) / market.total_yes_shares };

    pos.yes_shares = 0;
    market.total_yes_shares = market.total_yes_shares - shares;

    if (payout > 0) {
        let (from_yes, from_no) = if (payout <= total_yes) {
            (payout, 0u64)
        } else {
            (total_yes, payout - total_yes)
        };
        let pay = if (from_no > 0) {
            let mut from_no_bal = balance::split(&mut market.total_no_capital, from_no);
            if (from_yes > 0) {
                balance::join(&mut from_no_bal, balance::split(&mut market.total_yes_capital, from_yes));
                from_no_bal
            } else {
                from_no_bal
            }
        } else {
            balance::split(&mut market.total_yes_capital, from_yes)
        };
        event::emit(PMRedeemed {
            market_id: object::id(market),
            user,
            amount: payout,
            side_yes: true,
        });
        coin::from_balance(pay, ctx)
    } else {
        coin::zero(ctx)
    }
}

/// Redeem NO shares after resolution (only pays if outcome was NO). Pool = yes_capital + no_capital.
public fun redeem_no(
    market: &mut PMMarket,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(market.resolved, E_NOT_RESOLVED);
    assert!(!market.outcome_yes, E_NO_SHARES_TO_REDEEM);

    let user = ctx.sender();
    assert!(table::contains(&market.positions, user), E_NO_POSITION);
    let pos = table::borrow_mut(&mut market.positions, user);
    assert!(pos.no_shares > 0, E_NO_SHARES_TO_REDEEM);

    let total_yes = balance::value(&market.total_yes_capital);
    let total_no = balance::value(&market.total_no_capital);
    let pool = total_yes + total_no;
    let shares = pos.no_shares;
    let payout = if (market.total_no_shares == 0) { 0 } else { (pool * shares) / market.total_no_shares };

    pos.no_shares = 0;
    market.total_no_shares = market.total_no_shares - shares;

    if (payout > 0) {
        let (from_no, from_yes) = if (payout <= total_no) {
            (payout, 0u64)
        } else {
            (total_no, payout - total_no)
        };
        let pay = if (from_yes > 0) {
            let mut from_yes_bal = balance::split(&mut market.total_yes_capital, from_yes);
            if (from_no > 0) {
                balance::join(&mut from_yes_bal, balance::split(&mut market.total_no_capital, from_no));
                from_yes_bal
            } else {
                from_yes_bal
            }
        } else {
            balance::split(&mut market.total_no_capital, from_no)
        };
        event::emit(PMRedeemed {
            market_id: object::id(market),
            user,
            amount: payout,
            side_yes: false,
        });
        coin::from_balance(pay, ctx)
    } else {
        coin::zero(ctx)
    }
}

/// Claim redemption dust (remainder from integer division after all redemptions). Callable only when
/// all winning-side shares have been redeemed (total_yes_shares == 0 and total_no_shares == 0).
/// Sends the remaining pool to the creator (poster / initial purchaser). Only the creator may call.
public fun claim_redemption_dust(
    market: &mut PMMarket,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(market.resolved, E_NOT_RESOLVED);
    assert!(ctx.sender() == market.creator, E_NOT_CREATOR);
    assert!(market.total_yes_shares == 0 && market.total_no_shares == 0, E_SHARES_OUTSTANDING);

    let yes_bal = balance::value(&market.total_yes_capital);
    let no_bal = balance::value(&market.total_no_capital);
    let total = yes_bal + no_bal;
    if (total == 0) {
        return coin::zero(ctx)
    };

    let mut pay = balance::split(&mut market.total_yes_capital, yes_bal);
    if (no_bal > 0) {
        balance::join(&mut pay, balance::split(&mut market.total_no_capital, no_bal));
    };
    event::emit(PMRedemptionDustClaimed {
        market_id: object::id(market),
        creator: market.creator,
        amount: total,
    });
    coin::from_balance(pay, ctx)
}

// ───── Ad revenue (time-weighted split) ─────

/// Accept ad revenue for this PM. Funds are held and split by existing weights; users claim via claim_ad_share.
public fun accept_ad_revenue(
    market: &mut PMMarket,
    payment: Coin<SUI>,
    _dapp_id: vector<u8>,
) {
    assert!(!market.resolved, E_ALREADY_RESOLVED);
    assert!(market.dapp_id == _dapp_id, E_DAPP_ID_MISMATCH);

    let amount = coin::value(&payment);
    balance::join(&mut market.ad_balance, coin::into_balance(payment));
    if (amount > 0) {
        event::emit(PMAdRevenueReceived {
            market_id: object::id(market),
            amount,
        });
    };
}

/// Entry: claim ad share and transfer to sender.
public entry fun claim_ad_share_entry(market: &mut PMMarket, ctx: &mut TxContext) {
    let c = claim_ad_share(market, ctx);
    let amount = coin::value(&c);
    if (amount > 0) {
        transfer::public_transfer(c, ctx.sender());
    } else {
        coin::destroy_zero(c);
    }
}

/// Claim caller's share of ad revenue (proportional to ad_weight / total_ad_weight).
/// Disabled once market is resolved (canonical close already distributed ad share).
public fun claim_ad_share(
    market: &mut PMMarket,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(!market.resolved, E_ALREADY_RESOLVED);
    let user = ctx.sender();
    assert!(table::contains(&market.positions, user), E_NO_POSITION);

    let pos = table::borrow_mut(&mut market.positions, user);
    assert!(pos.ad_weight > 0, E_NO_SHARES_TO_REDEEM);

    let ad_val = balance::value(&market.ad_balance);
    if (ad_val == 0 || market.total_ad_weight == 0) {
        return coin::zero(ctx)
    };

    let share = (ad_val * pos.ad_weight) / market.total_ad_weight;
    if (share == 0) {
        return coin::zero(ctx)
    };

    let pay = balance::split(&mut market.ad_balance, share);
    market.total_ad_weight = market.total_ad_weight - pos.ad_weight;
    pos.ad_weight = 0;

    event::emit(PMAdShareClaimed {
        market_id: object::id(market),
        user,
        amount: share,
    });
    coin::from_balance(pay, ctx)
}

/// Deposit forfeited creator escrow into the PM pool (on PM failure). Becomes part of pool for redemption.
public fun deposit_forfeited_escrow(
    market: &mut PMMarket,
    payment: Coin<SUI>,
    _dapp_id: vector<u8>,
) {
    assert!(!market.resolved, E_ALREADY_RESOLVED);
    assert!(market.dapp_id == _dapp_id, E_DAPP_ID_MISMATCH);

    balance::join(&mut market.total_yes_capital, coin::into_balance(payment));
}

// ───── View / Getters ─────

public fun get_dapp_id(market: &PMMarket): &vector<u8> { &market.dapp_id }
public fun get_creator(market: &PMMarket): address { market.creator }
public fun get_ends_at_ms(market: &PMMarket): u64 { market.ends_at_ms }
public fun get_started_at_ms(market: &PMMarket): u64 { market.started_at_ms }
public fun is_resolved(market: &PMMarket): bool { market.resolved }
public fun outcome_yes(market: &PMMarket): bool { market.outcome_yes }
public fun total_yes_capital(market: &PMMarket): u64 { balance::value(&market.total_yes_capital) }
public fun total_no_capital(market: &PMMarket): u64 { balance::value(&market.total_no_capital) }
public fun total_yes_shares(market: &PMMarket): u64 { market.total_yes_shares }
public fun total_no_shares(market: &PMMarket): u64 { market.total_no_shares }
public fun ad_balance(market: &PMMarket): u64 { balance::value(&market.ad_balance) }
public fun total_ad_weight(market: &PMMarket): u64 { market.total_ad_weight }

/// Entry: redeem YES and transfer to sender.
public entry fun redeem_yes_entry(market: &mut PMMarket, ctx: &mut TxContext) {
    let c = redeem_yes(market, ctx);
    if (coin::value(&c) > 0) {
        transfer::public_transfer(c, ctx.sender());
    } else {
        coin::destroy_zero(c);
    }
}

/// Entry: redeem NO and transfer to sender.
public entry fun redeem_no_entry(market: &mut PMMarket, ctx: &mut TxContext) {
    let c = redeem_no(market, ctx);
    if (coin::value(&c) > 0) {
        transfer::public_transfer(c, ctx.sender());
    } else {
        coin::destroy_zero(c);
    }
}

/// Entry: creator claims redemption dust (remainder after all shares redeemed). Dust goes to creator.
public entry fun claim_redemption_dust_entry(market: &mut PMMarket, ctx: &mut TxContext) {
    assert!(ctx.sender() == market.creator, E_NOT_CREATOR);
    let c = claim_redemption_dust(market, ctx);
    if (coin::value(&c) > 0) {
        transfer::public_transfer(c, market.creator);
    } else {
        coin::destroy_zero(c);
    }
}

/// Entry: resolve and auto-distribute (no final ad deposit). Prefer close_market_with_final_ad_and_distribute_entry when ad pool is used.
public entry fun resolve_and_distribute_entry(
    market: &mut PMMarket,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    resolve_and_distribute(market, clock, ctx);
}

/// Entry: canonical close — deposit final ad revenue, then resolve and distribute. No user initiation; one tx, funds go out.
/// Ad pool (or keeper) passes final_ad_payment (use coin::zero(ctx) if none). Gas from pool to caller.
public entry fun close_market_with_final_ad_and_distribute_entry(
    market: &mut PMMarket,
    final_ad_payment: Coin<SUI>,
    dapp_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    close_market_with_final_ad_and_distribute(market, final_ad_payment, dapp_id, clock, ctx);
}

/// Entry: admin force-resolve market to NO (veto). Takes fee to AdminSet.
public entry fun admin_resolve_override_entry(
    market: &mut PMMarket,
    admin_set: &mut admin::AdminSet,
    cap: &admin::AdminOverrideCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    admin_resolve_override(market, admin_set, cap, clock, ctx);
}

public fun get_position(market: &PMMarket, user: address): Option<Position> {
    if (table::contains(&market.positions, user)) {
        option::some(*table::borrow(&market.positions, user))
    } else {
        option::none()
    }
}
