# PRODUCT_OVERVIEW.md — ShowMePrice.ng

Last updated: 2026-05-11

---

## What ShowMePrice.ng Is

ShowMePrice.ng is a trust-first local marketplace for Nigeria where buyers and
sellers can transact with clarity, accountability, and reduced scam risk.

The name reflects pricing transparency as a trust signal — sellers show their
price honestly, buyers see it clearly. It is not a price comparison engine and
does not aggregate or scrape prices from other sources.

The platform sits closest to trust infrastructure for local commerce. The
mechanisms that make transactions safe — escrow, seller identity verification,
structured communication, contact reveal for vetted users, admin oversight of
disputes — are not features bolted onto a marketplace. They are the reason the
marketplace exists.

---

## What ShowMePrice.ng Is Not

Anti-positioning is as important as positioning. Do not allow these framings
to creep into product decisions, copy, or feature work:

- NOT a price comparison engine or price aggregator
- NOT an Amazon-of-Nigeria or generic ecommerce clone
- NOT a noisy classifieds board (the Jiji model)
- NOT a social commerce platform — engagement features are secondary to trust
- NOT a logistics company — delivery infrastructure is deferred, not a current
  product direction
- NOT a fintech product — payments serve trust, not the reverse

---

## Target Users

### Sellers
Mobile-first small-to-medium independent sellers, roughly 18–45, currently
operating through informal channels: WhatsApp groups, Instagram DMs, Facebook
Marketplace, Jiji listings. They want verifiability, trust signals, and
transaction safety without abandoning the lightweight feel of informal commerce.

### Buyers
Mobile-first buyers in the same demographic who have been burned by scams in
informal channels and want a platform where sellers are identifiable, prices
are honest, and high-value transactions can be protected.

Relevant categories: electronics, gadgets, fashion, appliances, vehicles, and
other higher-trust local commerce categories where the cost of a scam is
materially significant to the buyer.

### Institutional Buyers
A real account type with its own DB table (institutions), procurement log, and
RFQ button in ProductDetail. Lightly implemented. Not a current development
priority, but not abandoned — the account type exists and works at a basic level.

### Admins
Platform operators who approve sellers, manage escrow disputes, control feature
flags, and review violations. Human moderation is the current and intended
operational model. Automation may assist in the future but trust review must
remain human-auditable.

---

## The Trust Loop — This Is the Product

The trust loop is the sequence of systems that together make a transaction
trustworthy. It is not a feature set. It is the product.

```
Seller identity verification
        ↓
Honest product listing with real price
        ↓
Structured buyer-seller communication
        ↓
Optional contact reveal (gated by buyer tier)
        ↓
Escrow-backed payment with buyer protection
        ↓
Order state management + messaging thread
        ↓
Delivery confirmation / dispute path
        ↓
Admin oversight + resolution
        ↓
Fund release to seller
```

Every bug in this sequence is damage to the platform's reason to exist — not
technical debt to address later.

The singular near-term priority is completing this loop as a unified system.
See memory/ROADMAP.md for sequencing.

---

## Market Context

Nigeria-first. Lagos as the likely early density anchor, but not Lagos-exclusive.

The platform is especially relevant in a market where:
- Informal commerce is dominant (WhatsApp, Instagram, Facebook Marketplace)
- Scam risk in peer-to-peer transactions is high and widely experienced
- Trust infrastructure for local commerce is weak or fragmented
- Mobile-first access is the norm, not the exception
- WhatsApp is the primary contact method, not email

ShowMePrice.ng does not try to replace informal commerce. It tries to make it
safer for the transactions where safety matters most.

---

## Current Stage

Late alpha. Core systems exist in working form. The trust loop is architecturally
present but not unified or production-hardened. No real marketplace traction yet.

Launch-quality must be established before first real users, not after.
See memory/CONTEXT.md for current state and active priorities.
