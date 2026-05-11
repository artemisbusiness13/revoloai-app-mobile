"""Job search service. Typed integration layer + scoring.

Live source: Adzuna API (used when ADZUNA_APP_ID + ADZUNA_APP_KEY are set).
Fallback: in-memory curated pool (`search_pool`).
"""
from __future__ import annotations
import os
import logging
from typing import List, Dict, Any, Optional
import uuid

logger = logging.getLogger(__name__)

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "").strip()
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "").strip()
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "gb").strip().lower() or "gb"

# Safe runtime banner so we can verify the BACKEND process actually reads the
# Adzuna env vars (vs them being unset, or set-but-empty, or only present in
# the shell). NEVER prints the secret values — only presence + length.
# We use print() because uvicorn's logger config may not be installed yet at
# import-time; print() bypasses that and lands in supervisor's stdout log.
print(
    f"[jobs] ADZUNA env at runtime → "
    f"APP_ID exists={bool(ADZUNA_APP_ID)} (len={len(ADZUNA_APP_ID)}) | "
    f"APP_KEY exists={bool(ADZUNA_APP_KEY)} (len={len(ADZUNA_APP_KEY)}) | "
    f"COUNTRY={ADZUNA_COUNTRY!r} | "
    f"enabled={bool(ADZUNA_APP_ID and ADZUNA_APP_KEY)}",
    flush=True,
)
logger.info(
    "[jobs] ADZUNA env at runtime → APP_ID exists=%s (len=%d) | APP_KEY exists=%s (len=%d) | COUNTRY=%s | enabled=%s",
    bool(ADZUNA_APP_ID),
    len(ADZUNA_APP_ID),
    bool(ADZUNA_APP_KEY),
    len(ADZUNA_APP_KEY),
    ADZUNA_COUNTRY,
    bool(ADZUNA_APP_ID and ADZUNA_APP_KEY),
)


def adzuna_enabled() -> bool:
    return bool(ADZUNA_APP_ID and ADZUNA_APP_KEY)


# Curated demo pool — labelled to be intentionally diverse so matching is meaningful.
_POOL: List[Dict[str, Any]] = [
    {"id": "j1", "title": "Senior Product Designer", "company": "Lumen Labs", "location": "London, UK", "remote": "hybrid", "seniority": "senior", "salary_min": 70000, "salary_max": 95000, "skills": ["Figma", "design systems", "user research", "prototyping"]},
    {"id": "j2", "title": "Product Manager", "company": "Northwind", "location": "Remote · UK", "remote": "remote", "seniority": "mid", "salary_min": 60000, "salary_max": 85000, "skills": ["roadmapping", "analytics", "B2B SaaS", "stakeholder mgmt"]},
    {"id": "j3", "title": "Frontend Engineer (React)", "company": "Beacon", "location": "Manchester, UK", "remote": "hybrid", "seniority": "mid", "salary_min": 55000, "salary_max": 75000, "skills": ["React", "TypeScript", "Next.js", "testing"]},
    {"id": "j4", "title": "Senior Backend Engineer", "company": "Atlas Data", "location": "London, UK", "remote": "onsite", "seniority": "senior", "salary_min": 85000, "salary_max": 115000, "skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes"]},
    {"id": "j5", "title": "Graduate Data Analyst", "company": "Civic Insights", "location": "Birmingham, UK", "remote": "hybrid", "seniority": "entry", "salary_min": 28000, "salary_max": 34000, "skills": ["SQL", "Excel", "Python", "statistics"]},
    {"id": "j6", "title": "Lead Marketing Strategist", "company": "Bloom & Co", "location": "Remote · EU", "remote": "remote", "seniority": "lead", "salary_min": 95000, "salary_max": 130000, "skills": ["content", "growth", "SEO", "brand"]},
    {"id": "j7", "title": "UX Researcher", "company": "Halcyon", "location": "London, UK", "remote": "hybrid", "seniority": "mid", "salary_min": 55000, "salary_max": 75000, "skills": ["interviews", "synthesis", "discovery", "usability"]},
    {"id": "j8", "title": "Mobile Engineer (React Native)", "company": "Ocra", "location": "Remote · UK", "remote": "remote", "seniority": "mid", "salary_min": 60000, "salary_max": 85000, "skills": ["React Native", "TypeScript", "Expo", "Swift basics"]},
    {"id": "j9", "title": "Sales Development Rep", "company": "Vanta UK", "location": "London, UK", "remote": "onsite", "seniority": "junior", "salary_min": 32000, "salary_max": 45000, "skills": ["outbound", "LinkedIn", "CRM", "B2B"]},
    {"id": "j10", "title": "Principal Engineer", "company": "Forge", "location": "Edinburgh, UK", "remote": "hybrid", "seniority": "principal", "salary_min": 130000, "salary_max": 180000, "skills": ["distributed systems", "architecture", "leadership", "Go"]},
]


SENIORITY_RANK = {"unknown": 0, "entry": 1, "junior": 2, "mid": 3, "senior": 4, "lead": 5, "principal": 6, "exec": 7}


def _heuristic_score(profile: Dict[str, Any], job: Dict[str, Any]) -> int:
    score = 50
    # Title / role keyword overlap
    role = (profile.get("target_role") or "").lower()
    if role and role in job["title"].lower():
        score += 20
    elif role and any(tok in job["title"].lower() for tok in role.split() if len(tok) > 3):
        score += 10
    # Seniority match
    p_sen = SENIORITY_RANK.get((profile.get("seniority") or "unknown").lower(), 0)
    j_sen = SENIORITY_RANK.get(job.get("seniority", "mid"), 3)
    if p_sen and abs(p_sen - j_sen) == 0:
        score += 12
    elif p_sen and abs(p_sen - j_sen) == 1:
        score += 4
    elif p_sen and abs(p_sen - j_sen) >= 3:
        score -= 12
    # Remote preference
    p_remote = (profile.get("remote") or "any").lower()
    j_remote = job.get("remote", "any")
    if p_remote in ("any", "unknown"):
        pass
    elif p_remote == j_remote:
        score += 8
    elif p_remote == "remote" and j_remote != "remote":
        score -= 10
    # Skills overlap
    p_skills = {s.lower() for s in (profile.get("skills") or [])}
    j_skills = {s.lower() for s in job.get("skills", [])}
    overlap = len(p_skills & j_skills)
    score += min(overlap, 5) * 4
    # Salary alignment
    p_min = profile.get("salary_min") or 0
    if p_min and job.get("salary_max") and job["salary_max"] < p_min:
        score -= 10
    return max(0, min(100, score))


async def search_pool(profile: Dict[str, Any], limit: int = 10) -> List[Dict[str, Any]]:
    """Score and return the top jobs from the curated pool."""
    scored = []
    for job in _POOL:
        s = _heuristic_score(profile, job)
        scored.append({**job, "match_score": s})
    scored.sort(key=lambda j: j["match_score"], reverse=True)
    return scored[:limit]


# ---------------- Adzuna (live API) ----------------
def _adzuna_remote_label(loc_text: str) -> str:
    t = (loc_text or "").lower()
    if "remote" in t or "anywhere" in t:
        return "remote"
    if "hybrid" in t:
        return "hybrid"
    return "onsite"


def _adzuna_seniority(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in ["principal", "staff"]):
        return "principal"
    if any(k in t for k in ["lead", "head of"]):
        return "lead"
    if "senior" in t or "sr." in t:
        return "senior"
    if any(k in t for k in ["junior", "jr.", "graduate", "trainee", "intern"]):
        return "junior"
    if any(k in t for k in ["mid", "intermediate"]):
        return "mid"
    return "mid"


def _normalise_adzuna_job(raw: Dict[str, Any]) -> Dict[str, Any]:
    title = raw.get("title") or ""
    company = (raw.get("company") or {}).get("display_name") or ""
    loc = (raw.get("location") or {}).get("display_name") or ""
    contract_time = raw.get("contract_time") or raw.get("contract_type") or ""
    return {
        "id": str(raw.get("id") or uuid.uuid4()),
        "title": title,
        "company": company,
        "location": loc,
        "remote": _adzuna_remote_label(f"{title} {loc}"),
        "seniority": _adzuna_seniority(title),
        "salary_min": int(raw["salary_min"]) if raw.get("salary_min") else None,
        "salary_max": int(raw["salary_max"]) if raw.get("salary_max") else None,
        "skills": [],  # Adzuna doesn't return structured skills
        "url": raw.get("redirect_url") or "",
        "contract_time": contract_time,
        "description": (raw.get("description") or "")[:400],
        "source": "adzuna",
    }


def _build_adzuna_what(profile: Dict[str, Any]) -> str:
    """Build the Adzuna `what` keyword string STRICTLY from the saved
    target_role. We do NOT fall back to skills/defaults — if the user's
    target_role is empty we want the caller to surface a clear "no target role"
    state to the UI rather than silently sending unrelated tech keywords.

    Sanitisation rules (Adzuna expects keywords separated by spaces):
        - Lowercase
        - Replace `/`, `,`, `&`, `|`, `-`, `(`, `)`, `+` with a space
        - Collapse multiple spaces
        - Trim
    """
    raw = (profile.get("target_role") or "").strip()
    if not raw:
        return ""
    import re as _re
    cleaned = raw.lower()
    cleaned = _re.sub(r"[\/,&|()+\-]", " ", cleaned)
    cleaned = _re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


async def search_adzuna(profile: Dict[str, Any], limit: int = 10) -> Dict[str, Any]:
    """Live Adzuna search.

    Returns a dict with:
      - matches: list of normalised + scored jobs (empty when error/no results)
      - status: "ok" | "no_results" | "error" | "not_configured" | "no_target_role"
      - query / where: the values actually sent to the API (for logging only — no keys)
      - count: raw number of API hits before slicing/scoring
    """
    if not adzuna_enabled():
        return {"matches": [], "status": "not_configured", "query": "", "where": "", "count": 0}
    import httpx
    # STRICT: use only the saved target_role; no implicit skill/keyword fallback.
    what = _build_adzuna_what(profile)
    where = (profile.get("location") or "").strip()
    if not what:
        logger.warning("Adzuna search skipped: target_role is empty (user_id=%r)", profile.get("user_id"))
        return {"matches": [], "status": "no_target_role", "query": "", "where": where, "count": 0}
    salary_min = profile.get("salary_min") or None
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "results_per_page": max(1, min(int(limit), 50)),
        # `what_or` matches jobs containing ANY of the keywords — much friendlier
        # for multi-word roles like "delivery driver / courier" where AND-
        # matching all of them would return 0 hits.
        "what_or": what,
        "content-type": "application/json",
    }
    if where:
        params["where"] = where
    if salary_min:
        params["salary_min"] = int(salary_min)

    url = f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}/search/1"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        # Safe log — no keys, just what + where + error type.
        logger.warning(
            "Adzuna search FAILED what=%r where=%r country=%s err=%s",
            what, where, ADZUNA_COUNTRY, type(e).__name__,
        )
        return {"matches": [], "status": "error", "query": what, "where": where, "count": 0}

    raw_jobs = data.get("results") or []
    logger.info(
        "Adzuna search OK what=%r where=%r country=%s results=%d (target_role=%r)",
        what, where, ADZUNA_COUNTRY, len(raw_jobs), profile.get("target_role"),
    )
    scored: List[Dict[str, Any]] = []
    for raw in raw_jobs:
        job = _normalise_adzuna_job(raw)
        job["match_score"] = _heuristic_score(profile, job)
        scored.append(job)
    scored.sort(key=lambda j: j["match_score"], reverse=True)
    if not scored:
        return {"matches": [], "status": "no_results", "query": what, "where": where, "count": 0}
    return {"matches": scored[:limit], "status": "ok", "query": what, "where": where, "count": len(raw_jobs)}


async def search(profile: Dict[str, Any], limit: int = 10) -> Dict[str, Any]:
    """Unified entrypoint.

    When Adzuna is configured we ALWAYS use it — we never silently fall back
    to the curated demo pool. The caller (the /jobs/match endpoint) receives
    a structured `status` it can surface to the UI:
        - "ok"            → real matches in `matches`
        - "no_results"    → API returned 0 hits, show "no matches" copy
        - "error"         → network/API error, show retry copy
        - "demo"          → Adzuna is NOT configured (dev only); curated pool returned

    The frontend uses these to render the correct empty / error state without
    ever mixing demo jobs into a "live" response.
    """
    if adzuna_enabled():
        return await search_adzuna(profile, limit=limit)
    # Dev fallback only — never reached in prod where the keys are set.
    pool = await search_pool(profile, limit=limit)
    logger.info("Adzuna NOT configured — returning curated demo pool of %d jobs (dev only)", len(pool))
    return {"matches": pool, "status": "demo", "query": "", "where": "", "count": len(pool)}
