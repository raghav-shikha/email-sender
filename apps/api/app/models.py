from __future__ import annotations

from pydantic import BaseModel, Field


class ReviseRequest(BaseModel):
    email_item_id: str
    current_draft_text: str = Field(min_length=1)
    instruction: str = Field(min_length=1)


class ReviseResponse(BaseModel):
    revised_draft: str


class SendReplyRequest(BaseModel):
    email_item_id: str
    final_draft_text: str = Field(min_length=1)


class SendReplyResponse(BaseModel):
    ok: bool

