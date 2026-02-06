from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import get_settings


def _get_aesgcm() -> AESGCM:
    settings = get_settings()
    if not settings.token_encryption_key_b64:
        raise RuntimeError("Missing TOKEN_ENCRYPTION_KEY_B64")
    key = base64.b64decode(settings.token_encryption_key_b64)
    if len(key) != 32:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY_B64 must decode to 32 bytes (AES-256 key)")
    return AESGCM(key)


def encrypt_text(plaintext: str) -> str:
    aesgcm = _get_aesgcm()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    blob = nonce + ciphertext
    return base64.urlsafe_b64encode(blob).decode("ascii")


def decrypt_text(ciphertext_b64: str) -> str:
    aesgcm = _get_aesgcm()
    blob = base64.urlsafe_b64decode(ciphertext_b64.encode("ascii"))
    nonce = blob[:12]
    ciphertext = blob[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")

