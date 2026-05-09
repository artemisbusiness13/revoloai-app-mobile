"""Catalog of pay-per-use items — single source of truth for prices.
Frontend MUST send only `item_id`; price is resolved here for security.
"""
from typing import Dict, Any

GBP_PENCE = 100  # one pound = 100 pence

# Prices in GBP pence (1 pound = 100p). Single source of truth.
CATALOG: Dict[str, Dict[str, Any]] = {
    # Maya / jobs
    "jobs-3":          {"avatar": "maya",  "title": "3 jobs",              "amount": 399,  "currency": "gbp", "kind": "service"},
    "jobs-5":          {"avatar": "maya",  "title": "5 jobs",              "amount": 699,  "currency": "gbp", "kind": "service"},
    "jobs-10":         {"avatar": "maya",  "title": "10 jobs",             "amount": 899,  "currency": "gbp", "kind": "service"},
    # Sofia / interviews
    "itv-basic":       {"avatar": "sofia", "title": "Basic interview",     "amount": 599,  "currency": "gbp", "kind": "service"},
    "itv-standard":    {"avatar": "sofia", "title": "Standard interview",  "amount": 899,  "currency": "gbp", "kind": "service"},
    "itv-advanced":    {"avatar": "sofia", "title": "Advanced interview",  "amount": 1399, "currency": "gbp", "kind": "service"},
    # Aria / coach
    "coach-cv":        {"avatar": "aria",  "title": "CV review",           "amount": 799,  "currency": "gbp", "kind": "service"},
    "coach-answers":   {"avatar": "aria",  "title": "Answer suggestions",  "amount": 799,  "currency": "gbp", "kind": "service"},
    "coach-plan":      {"avatar": "aria",  "title": "Career plan",         "amount": 1199, "currency": "gbp", "kind": "service"},
    # Bundles
    "bundle-starter":  {"avatar": "maya",  "title": "Job Hunt Starter",    "amount": 1199, "currency": "gbp", "kind": "bundle"},
    "bundle-pro":      {"avatar": "sofia", "title": "Career Pro",          "amount": 2299, "currency": "gbp", "kind": "bundle"},
    "bundle-launch":   {"avatar": "aria",  "title": "Career Launch",       "amount": 1999, "currency": "gbp", "kind": "bundle"},
}


def get(item_id: str) -> Dict[str, Any]:
    return CATALOG.get(item_id)
