"""Login: one admin from config; every other username gets a driver account on first login."""
import hashlib
import re
import secrets
import time
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from . import config
from .db import AuthToken, Driver, get_session

USERNAME_RE = re.compile(r"^[^\W_][\w .'\-]{1,31}$")  # letters/digits first; spaces allowed (real names)
_ITER = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITER)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), _ITER)
    return secrets.compare_digest(digest.hex(), digest_hex)


CODE_RE = re.compile(r"^[A-Z]{3}$")


def suggest_code(name: str) -> str:
    """F1 style: first three letters of the last name ("Kimi Antonelli" -> ANT)."""
    letters = re.sub(r"[^A-Za-z]", "", name.split()[-1]) if name.split() else ""
    if len(letters) < 3:
        letters = re.sub(r"[^A-Za-z]", "", name)
    return (letters[:3] or "DRV").upper().ljust(3, "X")


def new_driver(s: Session, username: str, password: str, code: str, team: str) -> Driver:
    used = {d.number for d in s.exec(select(Driver)).all()}
    number = next((i for i in range(2, 100) if i not in used), secrets.randbelow(98) + 2)
    d = Driver(username=username.lower(), password_hash=hash_password(password), name=username,
               code=code, number=number, color=config.TEAMS[team]["color"], team=team, created_at=time.time())
    s.add(d)
    s.commit()
    s.refresh(d)
    return d


def issue_token(s: Session, driver_id: Optional[int], is_admin: bool) -> str:
    token = secrets.token_urlsafe(32)
    s.add(AuthToken(token=token, driver_id=driver_id, is_admin=is_admin, created_at=time.time()))
    s.commit()
    return token


def get_auth(authorization: Optional[str] = Header(default=None), s: Session = Depends(get_session)) -> AuthToken:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in")
    tok = s.get(AuthToken, authorization[7:].strip())
    if not tok:
        raise HTTPException(401, "Your login has expired, please log in again")
    return tok


def current_driver(tok: AuthToken = Depends(get_auth), s: Session = Depends(get_session)) -> Driver:
    if tok.is_admin:
        raise HTTPException(403, "Race Control doesn't drive. Use the admin page.")
    d = s.get(Driver, tok.driver_id)
    if not d:
        raise HTTPException(401, "Driver not found, please log in again")
    return d


def require_admin(tok: AuthToken = Depends(get_auth)) -> AuthToken:
    if not tok.is_admin:
        raise HTTPException(403, "Race Control only")
    return tok
