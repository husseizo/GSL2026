# C4 Level 3 — Component Diagram: `web-portal`

Zooms into the real, currently-running Vite + React + TypeScript Web Management Portal.

```mermaid
flowchart TB
    Browser["Browser"]

    subgraph WebPortal["web-portal (services/web-portal/)"]
        Router["App.tsx\n(react-router-dom)"]
        Auth["auth/\n(JWT login, incl. MFA)"]
        ApiClient["api/client.ts\n(VITE_API_BASE_URL)"]

        subgraph Pages["src/pages/ (real, running today)"]
            Login["LoginPage"]
            ExecDash["ExecutiveDashboardPage"]
            BranchDash["BranchDashboardPage"]
            UserMgmt["UserManagementPage"]
            SystemHealth["SystemHealthPage"]
            KnowledgePages["knowledge/*\n(12 Knowledge Platform review pages)"]
        end
    end

    Backend["operational-core\n(external container, Level 2)"]

    Browser --> Router
    Router --> Login
    Router --> ExecDash
    Router --> BranchDash
    Router --> UserMgmt
    Router --> SystemHealth
    Router --> KnowledgePages
    Login --> Auth
    Auth --> ApiClient
    ExecDash --> ApiClient
    BranchDash --> ApiClient
    UserMgmt --> ApiClient
    SystemHealth --> ApiClient
    KnowledgePages --> ApiClient
    ApiClient -->|"REST/JSON, Bearer JWT"| Backend
```

## Notes

- **This is the complete, real page inventory as of this writing** — no dedicated page exists yet for DGX 2.0 Forecasting, Purchase Recommendations, Transfer Recommendations, or DGX2 certification/audit evidence; those capabilities are reachable only through their real APIs (Swagger, `/api-docs`) today. Do not add a box to this diagram for a page that does not exist in `src/pages/`.
- `SystemHealthPage` calls the real backend `GET /health` endpoint directly — it is not a static status page.
- All routes except `/login` require an authenticated session (see `App.tsx`'s router structure).
