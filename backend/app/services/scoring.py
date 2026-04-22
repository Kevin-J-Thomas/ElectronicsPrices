"""5-point scoring — compares a price against peer prices for the same product.

Simple percentile-based approach:
    price ≤ 80% of median → 5 (steal)
    price ≤ 90% of median → 4
    price ≤ 110% of median → 3 (fair)
    price ≤ 125% of median → 2
    price > 125% of median → 1 (overpriced)
"""
from statistics import median


def score_price(price: float, peer_prices: list[float]) -> int | None:
    """Score 1–5 vs peers. Returns None if no peers."""
    peers = [p for p in peer_prices if p and p > 0]
    if not peers:
        return None
    m = median(peers)
    if m <= 0:
        return None
    ratio = price / m
    if ratio <= 0.80:
        return 5
    if ratio <= 0.90:
        return 4
    if ratio <= 1.10:
        return 3
    if ratio <= 1.25:
        return 2
    return 1
