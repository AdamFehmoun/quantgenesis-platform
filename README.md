# QuantGenesis Platform

> **White-Box meta-trading infrastructure** — translates natural-language strategy descriptions into auditable, executable Python code via an AI multi-agent pipeline, with hardware-isolated execution for safety.

## Vision

QuantGenesis turns strategic intent expressed in natural language into complex, auditable, exportable Python code. The user describes their strategy; the platform generates, backtests and optimizes the underlying code in a secure environment compliant with the EU AI Act.

```
"Momentum strategy on Bitcoin, max drawdown 10%"
                    ↓
       Multi-agent AI pipeline (5 specialized agents)
                    ↓
       Audited VectorBT code generated
                    ↓
       Vectorized backtest in < 30 seconds
                    ↓
       White-Box export + AI Act compliance log
```

## Why "White-Box"

Most "AI trading bots" on the market are black boxes: users trust the output without visibility into the logic, the data, or the failure modes. QuantGenesis inverts this: every AI decision in the pipeline is logged, scored, and contestable, in alignment with **EU AI Act Article 12** (record-keeping requirements for high-risk AI systems).

## Tech Stack

| Layer | Technology | Role |
|--------|------------|------|
| Backend | FastAPI · Python 3.11 | Transactional API |
| Frontend | Next.js 14 · TypeScript · Tailwind | Supervision dashboard |
| Backtesting | VectorBT | Vectorized quantitative engine |
| Sandbox | E2B (Firecracker MicroVM) | Hardware-isolated code execution |
| Database | PostgreSQL (Supabase) | Persistence + history |
| Cache | Redis (Upstash) | Financial data cache |
| Data | yfinance · Binance API | Historical equities + crypto |
| AI Agents | Claude Opus 4.x (Anthropic) | Multi-agent pipeline |
| Deployment | Docker · Railway · Vercel | CI/CD + production hosting |

## Architecture

```
quantgenesis-platform/
├── backend/
│   └── app/
│       ├── api/          # FastAPI endpoints
│       ├── agents/       # AI pipeline integration (vendored from quantgenesis-agents)
│       ├── models/       # SQLModel persistence layer
│       └── services/     # Business logic (backtest, data, sandbox)
├── frontend/
│   └── src/
│       ├── components/   # Reusable React components
│       ├── pages/        # Next.js pages
│       └── hooks/        # Custom hooks
├── sandbox/              # E2B configuration + custom Dockerfile
├── data/                 # yfinance + Binance data pipelines
├── docs/
│   └── adr/              # Architecture Decision Records
└── .github/
    └── workflows/        # CI/CD GitHub Actions
```

## The Multi-Agent Pipeline

QuantGenesis decomposes strategy generation into five specialized AI agents, each with a single responsibility:

1. **Brainstormer** — explores strategy variants from the user's natural-language intent
2. **Project Lead** — selects the most promising variant and frames the technical brief
3. **Architect** — generates the VectorBT specification (entry/exit rules, assets, sizing)
4. **Critic** — reviews the spec for look-ahead bias, leakage, unrealistic assumptions
5. **Compliance** — produces the EU AI Act Article 12 audit log for the entire pipeline

Each step is versioned, logged, and traceable. Average cost per run: **~0.86€**.

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker + Docker Compose
- `uv` (Python package manager)

### Installation

```bash
# Clone
git clone https://github.com/AdamFehmoun/quantgenesis-platform
cd quantgenesis-platform

# Backend
cd backend
uv venv --python 3.11
source .venv/bin/activate
uv sync

# Frontend
cd ../frontend
npm install

# Environment
cp .env.example .env
# Fill in API keys (Anthropic, E2B, Binance, Supabase)

# Run the full stack
docker compose up
```

## Compliance

QuantGenesis natively integrates EU AI Act requirements (Article 12 — record-keeping) via a dedicated compliance agent that automatically generates traceability logs for each AI decision. This makes the platform deployable in regulated financial environments where AI-generated code must be auditable end-to-end.

## Project Context

Academic project conducted at **ESIEE Paris** (M.Eng program, 2025–2026 cohort) under the supervision of **Lilian Buzer**. Built by a team of 5 engineering students. Production deployment on Railway, frontend on Vercel.

## Roadmap

| Phase | Milestone |
|---------|----------|
| S1 | End-to-end CLI functional ✅ |
| S2 | First live backtested strategy ✅ |
| S3 | Internal alpha — Black-Litterman + HRP |
| S4 | EU AI Act compliance layer + Walk-forward validation |
| S5 | Beta — Paper trading integration |
| S6 | Feature freeze — demo-ready |
| S7 | Public release (June 25, 2026) |

## Contributing

Project currently in pre-release. Contribution guidelines in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

To be determined before public release (target: MIT).

---

*ESIEE Paris · M.Eng Data Science & AI · 2025–2026*
