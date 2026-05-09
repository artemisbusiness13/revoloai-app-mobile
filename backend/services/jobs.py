"""Job search service. Typed integration layer + scoring.
Currently uses an in-memory curated pool. Swap `search_pool` for an Adzuna/Reed
client without changing call sites.
"""
from __future__ import annotations
from typing import List, Dict, Any
import uuid


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
