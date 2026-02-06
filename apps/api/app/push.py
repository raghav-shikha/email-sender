from __future__ import annotations

import base64
import json
from typing import Any

from pywebpush import WebPushException, webpush
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat

from .config import get_settings


def _b64url_to_bytes(s: str) -> bytes:
    # base64url without padding
    padded = s + "=" * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _vapid_private_key_to_pem(vapid_private_key: str) -> str:
    if "BEGIN" in vapid_private_key:
        return vapid_private_key

    # Treat as base64url `d` from a P-256 JWK.
    d_bytes = _b64url_to_bytes(vapid_private_key)
    if len(d_bytes) != 32:
        raise RuntimeError("VAPID_PRIVATE_KEY must be PEM or base64url (32 bytes when decoded)")

    private_value = int.from_bytes(d_bytes, byteorder="big", signed=False)
    key = ec.derive_private_key(private_value, ec.SECP256R1())
    pem = key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    return pem.decode("ascii")


def send_web_push(*, subscription: dict[str, Any], payload: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_public_key or not settings.vapid_subject:
        raise RuntimeError("Missing VAPID keys (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)")

    pem_private = _vapid_private_key_to_pem(settings.vapid_private_key)
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=pem_private,
        vapid_claims={"sub": settings.vapid_subject},
    )
