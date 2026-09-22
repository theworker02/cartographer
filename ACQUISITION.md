# Acquisition Brief â€” Cartographer

**Date:** 2026-09-22  
**Repository:** https://github.com/theworker02/cartographer  
**Default branch:** `main`  
**Primary language:** TypeScript  
**Status:** Diligence briefing only. **No acquisition has occurred** by virtue of this file.  
**License:** Proprietary â€” sale, written commercial license, or completed asset transfer required (see root `LICENSE`).  
**Valuation:** Not stated.  
**Contact:** GitHub [@theworker02](https://github.com/theworker02) Â· [thanks.dev/u/gh/theworker02](https://thanks.dev/u/gh/theworker02)

> Cloning or forking this repository does **not** grant production, redistribution, SaaS, OEM, or commercial rights.

---

## 1. Executive thesis

This project is **proprietary**. Production use, redistribution, and commercial deployment require a written commercial license or completed acquisition. See [LICENSE](./LICENSE) and [ACQUISITION.md](./ACQUISITION.md). Contact [@theworker02](https://github.com/theworker02). <source media="(prefers-color-scheme: dark)" srcset="assets/banner-light.svg" /> <img src="assets/banner.svg" alt="Cartographer" width="680" height="124" />

**Why a buyer cares:** Cartographer packages transferable product IP â€” source, docs, in-repo brand assets, and a diligence room under `docs/acquisition/` â€” under a clear proprietary posture so diligence can proceed without mistaking the repo for open source.

---

## 2. Product snapshot

| Item | Detail |
|------|--------|
| Product | Cartographer |
| Repo | `theworker02/cartographer` |
| Language | TypeScript |
| Open source? | **No** â€” proprietary |
| Rightsholder | theworker02 |
| Diligence pack | `docs/acquisition/` |

### Capability highlights (from current materials)

- **Orientation before change** Ã¢â‚¬â€ know where you are before you edit.
- **One Atlas facade** Ã¢â‚¬â€ CLI, MCP, and Cursor commands share the same core.
- **Local-first** Ã¢â‚¬â€ no telemetry, no required cloud, no API keys for core navigation.
- **Cartographic language** Ã¢â‚¬â€ territories, corridors, hubs, bridges, landmarks, journeys, fog.
- **`atlas.db`** Ã¢â‚¬â€ SQLite store of files, symbols, relationships, territories, and derived map layers
- **`config.toml`** Ã¢â‚¬â€ optional per-repo configuration (created on demand)
- **Landmarks / journeys / exploration** Ã¢â‚¬â€ JSON alongside the database for annotations and fog-of-war
- **Upstream** Ã¢â‚¬â€ who reaches this symbol?
- **Downstream** Ã¢â‚¬â€ what does this symbol reach?
- **Understood** Ã¢â‚¬â€ territories / areas you have engaged
- **Frontier** Ã¢â‚¬â€ adjacent, high-value next places to chart
- **Beyond** Ã¢â‚¬â€ still unmapped relative to current exploration

---

## 3. Problem / opportunity

Teams evaluating Cartographer typically need either (a) a commercial right to run or embed it, or (b) outright ownership of the Product IP for strategic build-out. Public GitHub visibility without a proprietary license creates false assumptions about free production use. This brief and the linked data room make the commercial path explicit.

---

## 4. What ships today

Honest maturity: treat repository contents, README claims, tests, and release tags as the source of truth. Do not assume production customers, ARR, filed patents, or SLAs unless separately evidenced in diligence.

Typical transferable surfaces:

- Source tree and build/test scripts present in-repo
- Documentation and design notes
- Acquisition / diligence markdown under `docs/acquisition/`
- Branding assets committed to the repository (if any)

---

## 5. Demo / evaluation path (buyer)

Minimal path (no secrets required unless README says otherwise):

```
```text
$ cartographer whereami src/api/handlers.ts 12

Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  CARTOGRAPHER Ã‚Â· LIVING ATLAS BRIEFING                  Ã¢â€â€š
Ã¢â€â€š  checkout-service                                      Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ

Survey  142 files Ã‚Â· 1,840 symbols Ã‚Â· 3,102 edges
Map     8 territories Ã‚Â· 12 entries Ã‚Â· coverage 12%

Ã¢â€“Â¸ YOU ARE HERE
  API Ã¢â‚¬Âº handlers Ã¢â‚¬Âº checkout.ts Ã¢â‚¬Âº function:createOrder
  Territory: API (82% confidence)

Ã¢â€“Â¸ MINI ATLAS
  Ã¢â€Å“Ã¢â€â‚¬ API          Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  420  82%
  Ã¢â€Å“Ã¢â€â‚¬ Domain       Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  310  77%
  Ã¢â€Å“Ã¢â€â‚¬ Data         Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  280  74%
  Ã¢â€â€Ã¢â€â‚¬ Workers      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  120  68%

Ã¢â€“Â¸ TOP CORRIDORS
  Ã¢â€ â€™ API Ã¢â€ â€™ Domain Ã¢â€ â€™ Data  Ãƒâ€”18
    Requests typically flow API Ã¢â€ â€™ Domain Ã¢â€ â€™ Data.

Ã¢â€“Â¸ HUBS & BRIDGES
  [BRIDGE] OrderService
           OrderService is a bridge between API Ã¢â€ â€ Domain Ã¢â€ â€ Data.

Ã¢â€“Â¸ START HERE
  Journey: Start at the edge
  First:   POST /orders
  Why:     Begin at http entry, then walk downstream.
```
```bash
cartographer brief
cartographer brief src/api/handlers.ts 12
cartographer whereami src/api/handlers.ts 12
```
```bash
```

Extended evaluation: `docs/acquisition/BUYER_EVALUATION.md`. Written NDA / evaluation grants may be required for private materials.

---

## 6. What a transaction typically includes

Subject to definitive schedules:

| Included (typical) | Excluded (typical) |
|--------------------|--------------------|
| Repo materials + asserted original IP | Seller personal accounts / unrelated repos |
| Docs + diligence room at closing | Third-party dependency source under separate licenses |
| In-repo brand marks as assigned | Secrets without rotation plan |
| Know-how captured in docs | Fabricated revenue, user, or adoption metrics |

---

## 7. Suggested deal structures

| Structure | When it fits |
|-----------|--------------|
| Non-exclusive commercial license | Deploy/run under seat or environment terms |
| Exclusive field-of-use license | Buyer wants exclusivity; seller may retain entity |
| Asset / IP assignment | Buyer wants ownership of Materials outright |
| OEM / redistribution | Separate agreement â€” not implied here |

Commercial terms (price, earnouts, escrow) are negotiated under NDA with counsel.

---

## 8. Buyer diligence checklist

- [ ] Confirm Rightsholder identity and authority to sell/license
- [ ] Inventory Materials (`docs/acquisition/ASSET_INVENTORY.md`)
- [ ] Review IP posture (`IP_PROVENANCE.md`) and dependencies (`DEPENDENCY_INVENTORY.md`)
- [ ] Run evaluation script (`BUYER_EVALUATION.md`)
- [ ] Review risks (`RISK_REGISTER.md`)
- [ ] Agree transfer scope (`TRANSFER_MANIFEST.md`) and handoff (`HANDOFF_CHECKLIST.md`)
- [ ] Supersede root `LICENSE` at closing via definitive agreement

---

## 9. Related documents

| Document | Purpose |
|----------|---------|
| `LICENSE` | Proprietary â€” no default grant |
| `docs/acquisition/README.md` | Data-room index |
| `docs/acquisition/EXECUTIVE_SUMMARY.md` | One-page thesis |
| `README.md` | Product overview |
| `SECURITY.md` | Vulnerability reporting |
| `COMMERCIAL.md` | Licensing contact path |
| `.github/FUNDING.yml` | Sponsors / thanks.dev |

---

## 10. Disclaimer

This package is informational and **does not** create a binding offer, grant of rights, or investment advice. Engage counsel for any transaction.

---

*Document version: 2.0.0 / 2026-09-22 Â· Classification: acquisition briefing*
