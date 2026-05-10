"""Personalisation helpers — derive package tier from purchases & build the
profile-aware system prompt context that gets injected into every avatar
LLM call.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional


# Package tier mapping based on item_id prefix/suffix conventions in catalog.
# Tiers gate service depth — see tier_limits().
TIER_BY_ITEM_ID = {
    # Maya — Job Finder
    "jobs-3": "basic",
    "jobs-5": "standard",
    "jobs-10": "premium",
    # Sofia — Interview Coach
    "itv-basic": "basic",
    "itv-standard": "standard",
    "itv-premium": "premium",
    # Aria — Career Coach
    "plan-30": "basic",
    "plan-60": "standard",
    "plan-90": "premium",
    "career-basic": "basic",
    "career-standard": "standard",
    "career-premium": "premium",
}


def tier_for_item(item_id: str) -> str:
    if not item_id:
        return "basic"
    iid = item_id.lower().strip()
    if iid in TIER_BY_ITEM_ID:
        return TIER_BY_ITEM_ID[iid]
    # heuristic fallback by suffix
    if "premium" in iid or iid.endswith("-10") or iid.endswith("-90"):
        return "premium"
    if "standard" in iid or iid.endswith("-5") or iid.endswith("-60"):
        return "standard"
    return "basic"


async def active_tier(db, user_id: str, avatar: str) -> str:
    """Return the tier (basic|standard|premium) for the user's most recent
    PAID purchase tied to the given avatar. Defaults to 'basic' if none.
    """
    if not user_id:
        return "basic"
    row = await db.purchases.find_one(
        {"user_id": user_id, "avatar": avatar, "status": "paid"},
        sort=[("paid_at", -1)],
        projection={"_id": 0, "item_id": 1},
    )
    if not row:
        return "basic"
    return tier_for_item(row.get("item_id") or "")


# Service-depth limits per tier
TIER_LIMITS = {
    "basic": {
        "job_matches": 3,
        "interview_questions": 3,
        "feedback_depth": "short",
        "career_plan_horizon_months": 1,
    },
    "standard": {
        "job_matches": 5,
        "interview_questions": 5,
        "feedback_depth": "medium",
        "career_plan_horizon_months": 3,
    },
    "premium": {
        "job_matches": 10,
        "interview_questions": 8,
        "feedback_depth": "deep",
        "career_plan_horizon_months": 12,
    },
}


def tier_limits(tier: str) -> Dict[str, Any]:
    return TIER_LIMITS.get(tier, TIER_LIMITS["basic"])


def _join(label: str, val: Any) -> str:
    if val is None or val == "" or val == [] or val == 0 or val == "unknown" or val == "any":
        return ""
    if isinstance(val, list):
        if not val:
            return ""
        return f"- {label}: {', '.join(str(v) for v in val if v)}\n"
    return f"- {label}: {val}\n"


def profile_block(profile: Optional[Dict[str, Any]]) -> str:
    """Render the user's profile as a compact bullet list to be injected
    into the system prompt. Returns empty string if no profile."""
    if not profile:
        return ""
    p = profile
    lines = [
        _join("Full name", p.get("name")),
        _join("Target role / desired job", p.get("target_role")),
        _join("Experience level", p.get("seniority") if p.get("seniority") not in (None, "unknown") else None),
        _join("Years of experience", p.get("years_experience")),
        _join("Preferred location", p.get("location")),
        _join("Work setup", p.get("remote") if p.get("remote") not in (None, "any") else None),
        _join("Salary expectation (GBP/year, min)", p.get("salary_min")),
        _join("Salary expectation (GBP/year, max)", p.get("salary_max")),
        _join("Skills", p.get("skills")),
        _join("Languages spoken", p.get("languages")),
        _join("Qualifications / certificates", p.get("qualifications")),
        _join("Education", p.get("education")),
        _join("Previous job experience", p.get("experience_summary")),
        _join("Preferred industries", p.get("industries")),
        _join("Industries to avoid", p.get("industries_avoid")),
        _join("Strengths", p.get("strengths")),
        _join("Weaknesses / improvement areas", p.get("weaknesses")),
        _join("Availability / start date", p.get("availability")),
        _join("Additional notes", p.get("notes")),
    ]
    cv = (p.get("cv_text") or "").strip()
    if cv:
        # Cap to 1500 chars so the prompt stays focused
        lines.append(f"- CV (paste, truncated):\n{cv[:1500]}\n")
    body = "".join(l for l in lines if l)
    if not body:
        return ""
    return (
        "\n\nUSER PROFILE (use this to personalise every reply — do NOT ask questions whose answers are already here):\n"
        + body
    )


def tier_block(tier: str, avatar: str) -> str:
    lim = tier_limits(tier)
    tier_label = tier.capitalize()
    avatar_role = {"maya": "Job Finder", "sofia": "Interview Coach", "aria": "Career Coach"}.get(avatar, "Coach")
    return (
        f"\n\nACTIVE PACKAGE: {tier_label} ({avatar_role})."
        f"\nService limits for this tier:"
        f"\n- Max job matches: {lim['job_matches']}"
        f"\n- Interview questions: up to {lim['interview_questions']}"
        f"\n- Feedback depth: {lim['feedback_depth']}"
        f"\n- Career planning horizon: {lim['career_plan_horizon_months']} month(s)"
        f"\nAdapt the depth and length of your answers to this tier — do not over-promise beyond the user's tier."
    )


def personal_directive(avatar: str) -> str:
    """Per-avatar guidance for using the profile."""
    if avatar == "maya":
        return (
            "\n\nBEHAVIOUR: You are looking at the user's full profile above. "
            "When recommending roles or running searches, lean on their target_role, "
            "skills, location, and salary band. Explain the FIT in one short sentence — "
            "skills overlap, level match, location match. "
            "STRICT RULES — these override anything else:"
            "\n• NEVER ask the user to repeat information already in the USER PROFILE above (target role, location, work setup, salary, skills, experience, industries)."
            "\n• NEVER print a long profile dump. NEVER summarise the entire profile back to the user — the frontend already does that."
            "\n• If the user asks you to start searching, run the job search using the saved profile fields."
            "\n• If a SINGLE critical field is missing (e.g. no target_role, no location), ask for ONLY that one missing field in one short sentence — do not list other fields."
            "\n• Do NOT use markdown bold, asterisks, or bullet-point dumps. Reply in plain conversational sentences."
            "\n• Do NOT invent or assume profile values. If a field is blank in the profile, treat it as unknown."
        )
    if avatar == "sofia":
        return (
            "\n\nBEHAVIOUR: Tailor every interview question to the user's target_role and "
            "seniority. Mix behavioural and role-specific questions. Reference the user's "
            "stated experience and skills when probing. "
            "STRICT RULES:"
            "\n• NEVER ask generic openers (e.g. 'What's your dream job?') if target_role is set."
            "\n• NEVER re-collect any profile field already filled. Ask only for ONE missing field if absolutely needed."
            "\n• NEVER print a profile dump or markdown bullets."
            "\n• Do NOT invent profile data; if a field is blank, treat it as unknown."
        )
    if avatar == "aria":
        return (
            "\n\nBEHAVIOUR: Give specific career advice that references the user's actual "
            "strengths, weaknesses, target_role, and skill gaps from the profile. When "
            "suggesting CV improvements, point to specific bullet rewrites. Honour the "
            "user's preferred industries; avoid the ones they listed to avoid. "
            "STRICT RULES:"
            "\n• NEVER ask the user to repeat data already in their profile."
            "\n• NEVER print a long profile dump or markdown bullets."
            "\n• Ask for only ONE missing field at a time if essential to make a recommendation."
            "\n• Do NOT invent profile data."
        )
    return ""


def build_personal_system(persona_system: str, profile: Optional[Dict[str, Any]], avatar: str, tier: str, lang_directive: str) -> str:
    """Compose the final system prompt for a chat turn."""
    return (
        persona_system
        + lang_directive
        + tier_block(tier, avatar)
        + profile_block(profile)
        + personal_directive(avatar)
    )
