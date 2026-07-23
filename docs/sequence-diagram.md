# SZN — Run Flow Sequence Diagram

Canonical UML-style sequence diagram for the full path from filling out the
inputs, clicking **Run**, through the outputs view and everything reachable from
there. GitHub renders the Mermaid block below inline.

> **Maintenance:** keep this in sync with the code. Whenever the run/grounding,
> finance, Fintwit, or output flow changes, update this diagram in the same
> commit.

_Last updated: 2026-07-23_

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as Frontend (React)
    participant API as Backend API (Express)
    participant SEC as SEC EDGAR
    participant FMP as FMP
    participant XA as X / Archive provider
    participant AI as Anthropic (Claude)
    participant DB as MongoDB

    Note over U,DB: 1 — INPUT PHASE
    U->>FE: Build formula, enter median estimates, thesis, scenarios
    FE->>FMP: GET /finance/search (company typeahead)
    FMP-->>FE: matches
    FE->>API: GET /finance/metrics?symbol
    par Hybrid finance (fundamentals + market data)
        API->>SEC: XBRL company facts
        SEC-->>API: revenue, FCF, EPS, debt (TTM)
    and
        API->>FMP: profile + key-metrics-ttm
        FMP-->>API: price, market cap, P/E, EV
    end
    API-->>FE: merged metrics (SEC first, FMP for market data)
    opt Fintwit scenario source (refetches on company change)
        U->>FE: Open Fintwit dropdown
        FE->>API: GET /fintwit?symbol and company
        alt FINTWIT_ARCHIVE_KEY set
            API->>XA: Archive advanced search (~180d, cashtag + name match)
            XA-->>API: tweets
        else X recent search
            API->>XA: X recent search (7-day window)
            XA-->>API: tweets
        end
        API-->>FE: influencers grouped by author
    end
    U->>FE: Click Run

    Note over U,DB: 2 — RUN, grounded scenario reasoning (POST /api/run)
    FE->>API: POST /api/run {company, ticker, thesis, formula, variables, scenarios}
    opt Best-effort grounding
        API->>DB: RAG retrieve (Peter Lynch principles)
        DB-->>API: passages
        API->>AI: web_search tool (credible-domain allowlist)
        AI-->>API: current-facts brief
        API->>SEC: last 2 quarterly earnings press releases (8-K EX-99.1)
        SEC-->>API: release text (read skeptically, discount mgmt optimism)
    end
    API->>AI: messages.create (tool_choice = submit_scenarios)
    AI-->>API: structured value + justification, per variable per scenario
    API->>DB: upsert Run
    API-->>FE: scenarios [{name, values, notes}]

    Note over U,DB: 3 — OUTPUT and POST-OUTPUT
    FE->>FE: set result, view = output, render OutputView (dot plot, grid, notes)
    opt Edit a cell (median base or scenario input)
        U->>FE: change value
        FE->>FE: resolveTyped() recompute locally (no API call)
    end
    opt Autosave (debounced 700ms)
        FE->>API: POST /api/runs
        API->>DB: upsert Run
    end
    opt Feedback (RAG-grounded thesis critique)
        U->>FE: toggle feedback
        FE->>API: POST /api/feedback
        API->>DB: RAG retrieve
        API->>AI: Lynch-lens critique
        AI-->>API: feedback
        API-->>FE: feedback + sources
    end
    opt Add scenario from a source
        FE->>API: POST /fintwit/scenario or POST /ingest/article (PDF)
        API->>AI: summarize into attributed scenario
        AI-->>API: {name, description}
        API-->>FE: append editable scenario row
    end
```

## Notes

- **Grounding is best-effort:** RAG, web search, and the earnings-release fetch
  each fail open — the run continues ungrounded rather than erroring.
- **Hybrid finance:** fundamentals come from SEC EDGAR (primary-source filings);
  FMP supplies company search plus the market data SEC has no access to (price,
  market cap, P/E, enterprise value).
- **Fintwit reach:** X recent search is capped at 7 days on every plan; a
  third-party archive provider (`FINTWIT_ARCHIVE_KEY`) extends it to ~180 days.
- **Recalculation** on cell edits is local (`resolveTyped`) — no API round-trip.
