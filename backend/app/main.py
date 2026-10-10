"""Nexora's API: the product catalogue and the door to the voice agent.

Public:
  GET  /api/products               the catalogue (?ids=a,b  ?category=  ?q=)
  GET  /api/products/search        what the agent calls: ?item=watch&item=bag&max_price=200000
  POST /api/call/session           dispatch the shopping agent into a fresh LiveKit
                                   room and hand the browser a join token
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import catalog
from .db import Product, get_db, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("nexora-api")

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
# Must match AGENT_NAME in agent/agent.py.
AGENT_NAME = os.environ.get("VOICE_AGENT_NAME", "nexora-voice")
CALL_MAX_MINUTES = int(os.environ.get("CALL_MAX_MINUTES", "10"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Nexora API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"status": "ok", "service": "nexora-api"}


@app.get("/api/categories")
def categories():
    return [{"slug": k, "label": v} for k, v in catalog.CATEGORIES.items()]


@app.get("/api/products")
def list_products(
    ids: str | None = None,
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    if ids:
        wanted = [i for i in ids.split(",") if i][:50]
        found = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(wanted)))}
        # Keep the order asked for: the agent's "first" and "third" depend on it.
        return [found[i].to_dict() for i in wanted if i in found]
    rows = catalog.search(db, items=[q] if q else None, category=category, limit=100)
    return [p.to_dict() for p in rows]


@app.get("/api/products/search")
def search_products(
    item: list[str] = Query(default=[]),
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    db: Session = Depends(get_db),
):
    rows = catalog.search(db, items=item, category=category, min_price=min_price, max_price=max_price)
    return [p.to_dict() for p in rows]


@app.get("/api/call/config")
def call_config():
    return {"enabled": bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET), "name": "Nexora Assistant"}


@app.post("/api/call/session")
async def call_session():
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=503, detail="Calls are off right now.")

    from livekit import api

    room = f"nexora-{secrets.token_hex(5)}"
    identity = f"shopper-{secrets.token_hex(4)}"
    metadata = json.dumps({"caller": identity, "max_minutes": CALL_MAX_MINUTES})

    lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    try:
        await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(agent_name=AGENT_NAME, room=room, metadata=metadata)
        )
    except Exception as exc:  # noqa: BLE001
        log.error("LiveKit dispatch failed: %s", exc)
        raise HTTPException(status_code=502, detail="Couldn't reach the agent. Try again in a moment.")
    finally:
        await lk.aclose()

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name("Shopper")
        .with_grants(api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True, can_publish_data=True))
        .with_ttl(timedelta(minutes=CALL_MAX_MINUTES + 5))
        .to_jwt()
    )
    return {"url": LIVEKIT_URL, "token": token, "room": room}
