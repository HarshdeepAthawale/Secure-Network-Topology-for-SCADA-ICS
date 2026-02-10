# Telemetry Freshness and Trust: Techniques Applied

This document describes the techniques we applied to handle **telemetry freshness** and **trust scoring** when multiple sources disagree or update at different rates in the live ICS network.

---

## Problem

Previously:

- The correlator merged device candidates with **first-non-empty wins** and **fixed per-source confidence**.
- **Telemetry age was not used**—stale or conflicting data could win by iteration order.
- There was **no freshness-based trust**: slow or old sources were treated the same as fresh, fast ones.

---

## Techniques Applied

### 1. Carry Telemetry Time into Correlation

**Technique:** Attach the telemetry timestamp to each device candidate so downstream logic can use age.

- **Change:** Added optional `timestamp?: Date` to `DeviceCandidate` in the device correlator.
- **Change:** In the process Lambda, every candidate is created with `timestamp: telemetryTime` (derived from `telemetry.timestamp`).
- **Why:** Enables recency-based ordering and time-based decay; without timestamps, “newer” vs “older” cannot be determined.

**Files:** `src/processors/correlation/device-correlator.ts`, `src/lambda/process/handler.ts`.

---

### 2. Resolve Conflicts by Source Priority and Recency

**Technique:** Sort matched candidates **before** merging so the merge order is deterministic and policy-driven.

- **Source priority:** A fixed order defines which source “wins” when two report different values for the same device. We use: **SNMP > ARP > Syslog > NetFlow** (SNMP highest, as in ICS practice).
- **Recency:** Within the same source, **newest first**. So if the same source reports the same device twice with different values (e.g. hostname change), the latest report wins.
- **Implementation:** `sortCandidatesByPriorityAndRecency()` sorts by priority index, then by `timestamp` descending (missing timestamp treated as oldest). Merge logic is unchanged (“first non-empty wins”); only the input order is changed.

**Result:** When multiple sources disagree (e.g. different IP or vendor for the same MAC), the chosen value comes from the highest-priority source that reported it; when the same source updates at different rates, the newest value wins.

**Files:** `src/processors/correlation/device-correlator.ts` (constants `SOURCE_PRIORITY_ORDER`, and `sortCandidatesByPriorityAndRecency()` used in `mergeAndCorrelate()`).

---

### 3. Freshness-Aware Confidence (Trust Score)

**Technique:** Make the correlation **confidence score** depend on how fresh the contributing telemetry is, not only on how many sources agree.

- **Staleness window:** A configurable window (default 15 minutes, env `TELEMETRY_STALENESS_MINUTES`). Data older than this is considered stale.
- **Freshness factor:** Per candidate, `freshnessFactor = max(0, 1 - ageMinutes / STALENESS_MINUTES)`. Missing timestamp is treated as fully stale (factor 0).
- **Confidence calculation:**
  - **Effective source count:** Instead of raw candidate count, we use the sum of freshness factors, capped (e.g. “more sources” contribution = min(effectiveSourceCount × 15, 45)). Stale candidates contribute little or nothing.
  - **Weighted average candidate confidence:** The average of per-candidate confidence is weighted by freshness factor, so old telemetry does not pull the score up.
- **Result:** Trust score reflects both “how many sources agree” and “how fresh the data is.” Fast-updating sources contribute more; very old data does not drive the score.

**Files:** `src/processors/correlation/device-correlator.ts` (`STALENESS_MINUTES`, `freshnessFactor()`, and updated `calculateConfidence()`).

---

## Configuration

| Item | Default | Override |
|------|--------|----------|
| Source priority for merge | `['snmp', 'arp', 'syslog', 'netflow']` | Constant in code |
| Staleness window | 15 minutes | Env var `TELEMETRY_STALENESS_MINUTES` |

---

## Data Flow (Summary)

1. **Ingest:** Telemetry arrives with a `timestamp`.
2. **Process:** Each candidate is built with `timestamp: telemetry.timestamp` (or equivalent).
3. **Correlate:** For each group of matched candidates:
   - Sort by **source priority**, then **newest first**.
   - Merge with first-non-empty wins (order is now deterministic).
   - Compute confidence using **freshness-weighted** source count and weighted average candidate confidence.

---

## Testing

Unit tests in `tests/unit/processors/device-correlator.test.ts` cover:

- **Source priority:** When SNMP and ARP disagree on vendor for the same MAC, SNMP wins.
- **Recency:** When the same source (e.g. SNMP) reports the same device twice with different hostname, the newer report wins.
- **Staleness:** When candidates are older than the staleness window, the resulting correlation confidence is lower than when the same candidates are fresh.

---

## Summary

We applied three main techniques:

1. **Timestamp propagation** — Carry telemetry time into each candidate so age is available for ordering and scoring.
2. **Priority + recency ordering** — Sort by source priority and then by newest-first so conflicts are resolved deterministically and different update rates are handled by recency.
3. **Freshness-weighted confidence** — Use a staleness window and per-candidate freshness factor so the trust score reflects both multi-source agreement and data freshness, and stale data does not dominate.

Together, these ensure that when multiple sources disagree or update at different rates, the system chooses values in a predictable, ICS-appropriate way and the reported trust score reflects how fresh and consistent the underlying telemetry is.
