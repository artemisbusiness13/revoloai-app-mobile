"""Authentication helpers — email/password + opaque session tokens.

Kept simple by design: no JWT, no refresh tokens. A single random token is
issued on signup/login and stored in the `sessions` Mongo collection.
The frontend sends it via Authorization: Bearer <token>.
"""
from __future__ import annotations
import secrets
from datetime import timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from fastapi import Header, HTTPException

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


# Session lookup is performed against the db handle passed in at request time,
# since we don't want to import the Mongo client here.
async def user_from_token(db, authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    else:
        token = authorization.strip()
    if not token:
        return None
    sess = await db.sessions.find_one({"token": token}, {"_id": 0})
    if not sess:
        return None
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    return user


def require_auth_dep(db):
    async def _dep(authorization: Optional[str] = Header(default=None)):
        u = await user_from_token(db, authorization)
        if not u:
            raise HTTPException(status_code=401, detail="Authentication required")
        return u
    return _dep
