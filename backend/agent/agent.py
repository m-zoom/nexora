"""Nexora's shopping agent: the call button on the shop.

The API dispatches this worker into a fresh LiveKit room (by agent name, so
it shares the LiveKit project with Mr Bayo's portfolio worker without either
taking the other's calls) and hands the shopper's browser a join token.

The agent drives the page while it talks. Two RPCs go to the browser:
  show_products  {"title", "products": [...]}  the page shows exactly these
  add_to_cart    {"ids": [...]}                 those cards fly into the cart
It remembers the last list it showed, so "the first and the third" means
positions 1 and 3 on the shopper's screen.

Pipeline (LiveKit Cloud inference unless noted), as on mrbayo.dev:
  STT  Speechmatics enhanced, AssemblyAI fallback
  LLM  openai/gpt-4.1-mini, Gemini Flash fallback
  TTS  Spitch Nigerian-English voice (SPITCH_API_KEY), Cartesia fallback
  VAD  Silero; LiveKit's cloud turn detector on top

Run locally:
  python agent.py download-files   # once
  python agent.py dev
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import time

import aiohttp
from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, RunContext, cli, inference
from livekit.agents import llm as agents_llm
from livekit.agents import stt as agents_stt
from livekit.agents import tts as agents_tts
from livekit.agents.llm import function_tool
from livekit.plugins import silero

try:  # Plugins must register on the main thread, so import at load time.
    from livekit.plugins import spitch
except Exception:  # noqa: BLE001
    spitch = None

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("nexora-voice")

# Must match VOICE_AGENT_NAME on the API.
AGENT_NAME = (os.environ.get("VOICE_AGENT_NAME") or "nexora-voice").strip()
API_URL = (os.environ.get("NEXORA_API_URL") or "http://localhost:8000").rstrip("/")

STT_MODEL = os.environ.get("VOICE_STT", "speechmatics/enhanced")
STT_FALLBACK = os.environ.get("VOICE_FALLBACK_STT", "assemblyai/universal-streaming")
LLM_MODEL = os.environ.get("VOICE_LLM", "openai/gpt-4.1-mini")
LLM_FALLBACK = os.environ.get("VOICE_FALLBACK_LLM", "google/gemini-2.5-flash")
VOICE = (os.environ.get("VOICE_NAME") or "lucy").strip().lower()
TTS_FALLBACK_MODEL = os.environ.get("VOICE_FALLBACK_TTS", "cartesia/sonic-3.5")
CARTESIA_MALE = "a167e0f3-df7e-4d52-a9c3-f949145efdab"
CARTESIA_FEMALE = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
FEMALE_VOICES = {"lina", "lucy", "kani"}
SPITCH_VOICES = {"john", "jude", "henry", "lina", "lucy", "kani"}

DEFAULT_MAX_MINUTES = 10
WIND_DOWN_S = 20
ENDPOINT_MIN_DELAY_S = float(os.environ.get("VOICE_ENDPOINT_MIN_DELAY") or 0.35)
ENDPOINT_MAX_DELAY_S = float(os.environ.get("VOICE_ENDPOINT_MAX_DELAY") or 1.5)
STT_MAX_DELAY_S = float(os.environ.get("VOICE_STT_MAX_DELAY") or 0.7)

GREETING = "Hi, welcome to Nexora! What are you shopping for today?"


# ---------- What the agent is told ----------

def build_instructions(categories: str) -> str:
    return f"""You are the voice shopping assistant for Nexora, an online store in Nigeria. You are speaking out loud on a call while the shopper looks at the store's website, and you control what the website shows them.

HOW YOU TALK: warm, quick, simple English the way people speak it in Nigeria. One or two short sentences per reply, then let the shopper talk. Never read out lists, markdown, symbols or emojis. Say prices in words ("one hundred and twenty thousand naira"). Ask one question at a time.

THE STORE sells these categories: {categories}. Prices are in naira.

FINDING PRODUCTS: when the shopper says what they want, call find_products once, straight away, with everything they asked for in that one call. Put each different thing they asked for as its own entry in items, in the words they used ("wristwatch", "bag", "airpods", "phone"). Turn budgets into numbers: "below two hundred thousand" is max_price 200000, "two hundred k" is 200000, "one point five million" is 1500000. The website then shows exactly those products, numbered in the order the tool returns them. Tell the shopper briefly what is now on their screen: how many, and one or two names with prices. Do not read every item.

POSITIONS: "the first one", "the third one", "the last one", "number two" always refer to the numbered list from your latest find_products call, which is exactly what is on their screen. "The last one" is the highest number. If they name a product instead ("the blue one", "the Samsung"), work out its number from that same list.

ADDING TO CART: when they ask to add something, call add_to_cart with the positions. The products fly into the cart on their screen, so just confirm in a few words ("Done, the watch and the black bag are in your cart"). Only add what they clearly asked for. If it is unclear which ones they mean, ask.

If nothing matches, say so plainly and suggest the closest thing the store has, or offer to show everything with show_all_products. Never invent a product or a price: only talk about what the tools return.

Checkout happens on the website: they open the cart at the top right. When the shopper is done or says bye, thank them in one sentence and call end_call."""


# ---------- Tools ----------

def _spoken_list(products: list[dict]) -> str:
    return "\n".join(
        f"{i}. {p['name']} ({p['category']}), {p['price']} naira" for i, p in enumerate(products, start=1)
    )


class Shop:
    """The API, the browser and what is on the shopper's screen right now."""

    def __init__(self, ctx: JobContext, caller: str) -> None:
        self.ctx = ctx
        self.caller = caller
        self.shown: list[dict] = []
        self.shown_title = ""
        self.shown_turn: str | None = None
        self._http: aiohttp.ClientSession | None = None

    async def api(self, path: str, params: list[tuple[str, str]]) -> list[dict]:
        if self._http is None or self._http.closed:
            self._http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6))
        async with self._http.get(f"{API_URL}{path}", params=params) as r:
            r.raise_for_status()
            return await r.json()

    async def tell_browser(self, method: str, payload: dict) -> None:
        caller = self.caller or next(iter(self.ctx.room.remote_participants), "")
        if not caller:
            logger.warning("no shopper in the room for %s", method)
            return
        try:
            await self.ctx.room.local_participant.perform_rpc(
                destination_identity=caller, method=method, payload=json.dumps(payload), response_timeout=5.0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("RPC %s failed: %s", method, exc)

    async def close(self) -> None:
        if self._http is not None and not self._http.closed:
            await self._http.close()


def make_tools(shop: Shop, ctx: JobContext):
    @function_tool
    async def find_products(
        context: RunContext,
        items: list[str],
        max_price: int | None = None,
        min_price: int | None = None,
    ) -> str:
        """Search the store and show the results on the shopper's screen, replacing what was there.

        Args:
            items: Each kind of product the shopper wants, in their words, e.g. ["wristwatch", "bag"]. Use [] for anything.
            max_price: Highest price in naira, if they gave a budget.
            min_price: Lowest price in naira, if they asked for something above a price.
        """
        params = [("item", i) for i in items if i.strip()]
        if max_price is not None:
            params.append(("max_price", str(max_price)))
        if min_price is not None:
            params.append(("min_price", str(min_price)))
        try:
            products = await shop.api("/api/products/search", params)
        except Exception:  # noqa: BLE001
            logger.exception("search failed")
            return "The store could not be searched just now. Apologise and ask them to try again in a moment."
        if not products:
            return "Nothing in the store matches. The screen did not change. Say so and suggest something close, or offer to show everything."
        title = " & ".join(i.strip() for i in items if i.strip()).title() or "Products"
        if max_price is not None:
            title += f" under ₦{max_price:,}"
        # Several searches in one turn ("a watch and a bag" split in two) add
        # up to one list on screen instead of each replacing the last.
        turn = getattr(context.speech_handle, "id", None)
        if turn is not None and turn == shop.shown_turn:
            have = {p["id"] for p in shop.shown}
            products = shop.shown + [p for p in products if p["id"] not in have]
            title = f"{shop.shown_title} & {title}"
        shop.shown, shop.shown_title, shop.shown_turn = products, title, turn
        await shop.tell_browser("show_products", {"title": title, "products": products})
        return f"Now on the shopper's screen, in this order:\n{_spoken_list(products)}"

    @function_tool
    async def show_all_products(context: RunContext) -> str:
        """Show the whole catalogue on the shopper's screen."""
        try:
            products = await shop.api("/api/products", [])
        except Exception:  # noqa: BLE001
            return "The store could not be loaded just now."
        shop.shown, shop.shown_title, shop.shown_turn = products, "All products", None
        await shop.tell_browser("show_products", {"title": "All products", "products": products})
        return f"Now on the shopper's screen, in this order:\n{_spoken_list(products)}"

    @function_tool
    async def add_to_cart(context: RunContext, positions: list[int]) -> str:
        """Add products to the shopper's cart by their numbers on screen (1 is the first).

        Args:
            positions: The numbers of the products to add, from the latest list, e.g. [1, 3].
        """
        if not shop.shown:
            return "Nothing has been shown yet. Ask what they are looking for first."
        picked, bad = [], []
        for n in positions:
            (picked if 1 <= n <= len(shop.shown) else bad).append(n)
        if not picked:
            return f"Those numbers are not on screen; there are {len(shop.shown)} products. Ask which ones they mean."
        products = [shop.shown[n - 1] for n in dict.fromkeys(picked)]
        await shop.tell_browser("add_to_cart", {"ids": [p["id"] for p in products]})
        added = ", ".join(p["name"] for p in products)
        note = f" Numbers {bad} do not exist on screen; mention it." if bad else ""
        return f"Added to the cart: {added}.{note}"

    @function_tool
    async def end_call(context: RunContext) -> str:
        """End the call, only when the shopper is finished or has said goodbye."""
        asyncio.create_task(_hang_up_after_goodbye(ctx, context.session))
        return "Say a short, warm goodbye now, one sentence."

    return [find_products, show_all_products, add_to_cart, end_call]


async def _hang_up_after_goodbye(ctx: JobContext, session: AgentSession) -> None:
    started = time.monotonic()
    speech = None
    while time.monotonic() - started < 8.0:
        speech = session.current_speech
        if speech is not None:
            break
        await asyncio.sleep(0.25)
    if speech is not None:
        try:
            await asyncio.wait_for(speech.wait_for_playout(), timeout=20.0)
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(0.6)
    ctx.shutdown(reason="completed")


class ShopAssistant(Agent):
    async def on_enter(self) -> None:
        await self.session.say(GREETING)


# ---------- Pipeline ----------

def _stt():
    try:
        primary = inference.STT(
            STT_MODEL, language="en", extra_kwargs={"max_delay": STT_MAX_DELAY_S, "max_delay_mode": "flexible"}
        ) if STT_MODEL.startswith("speechmatics/") else inference.STT(STT_MODEL, language="en")
    except TypeError:
        primary = inference.STT(STT_MODEL, language="en")
    if not STT_FALLBACK or STT_FALLBACK == STT_MODEL:
        return primary
    try:
        return agents_stt.FallbackAdapter([primary, inference.STT(STT_FALLBACK, language="en")])
    except Exception as exc:  # noqa: BLE001
        logger.warning("STT fallback not wired (%s)", exc)
        return primary


def _llm():
    # One search per request keeps "the first and the third" unambiguous.
    extra = {"parallel_tool_calls": False} if LLM_MODEL.startswith("openai/") else None
    primary = inference.LLM(LLM_MODEL, extra_kwargs=extra)
    if not LLM_FALLBACK or LLM_FALLBACK == LLM_MODEL:
        return primary
    try:
        return agents_llm.FallbackAdapter([primary, inference.LLM(LLM_FALLBACK)])
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM fallback not wired (%s)", exc)
        return primary


def _tts():
    fallback = inference.TTS(TTS_FALLBACK_MODEL, voice=CARTESIA_FEMALE if VOICE in FEMALE_VOICES else CARTESIA_MALE)
    if spitch is not None and VOICE in SPITCH_VOICES and (os.environ.get("SPITCH_API_KEY") or "").strip():
        try:
            return agents_tts.FallbackAdapter([spitch.TTS(language="en", voice=VOICE), fallback])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Spitch voice %s unavailable (%s); using Cartesia", VOICE, exc)
    return fallback


def build_session(ctx: JobContext) -> AgentSession:
    kwargs: dict = dict(stt=_stt(), llm=_llm(), tts=_tts(), vad=ctx.proc.userdata["vad"])
    params = inspect.signature(AgentSession.__init__).parameters
    try:
        td = inference.TurnDetector(version="v1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cloud turn detector unavailable (%s); VAD only", exc)
        td = None
    if "turn_handling" in params:
        handling: dict = {
            "endpointing": {"min_delay": ENDPOINT_MIN_DELAY_S, "max_delay": ENDPOINT_MAX_DELAY_S},
            "interruption": {"min_duration": 0.6, "false_interruption_timeout": 1.0, "resume_false_interruption": True},
            "preemptive_generation": {"enabled": True, "preemptive_tts": True},
        }
        if td is not None:
            handling["turn_detection"] = td
        kwargs["turn_handling"] = handling
    elif td is not None and "turn_detection" in params:
        kwargs["turn_detection"] = td
    return AgentSession(**kwargs)


def _arm_max_duration(ctx: JobContext, session: AgentSession, seconds: int) -> asyncio.Task:
    async def watch():
        start = time.monotonic()
        warned = False
        while True:
            await asyncio.sleep(2.0)
            remaining = start + seconds - time.monotonic()
            if remaining <= 0:
                ctx.shutdown(reason="max_duration")
                return
            if remaining <= WIND_DOWN_S and not warned:
                warned = True
                session.say("I have to end this call in a moment. Anything else quick before I go?")

    return asyncio.create_task(watch())


# ---------- The worker ----------

server = AgentServer(num_idle_processes=int(os.environ.get("WORKER_IDLE_PROCESSES") or 1))


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    try:
        meta = json.loads(ctx.job.metadata or "{}")
    except (TypeError, ValueError):
        meta = {}
    await ctx.connect()
    logger.info("Call %s from %s", ctx.room.name, meta.get("caller"))

    shop = Shop(ctx, str(meta.get("caller") or ""))
    try:
        cats = await shop.api("/api/categories", [])
        categories = ", ".join(c["label"].lower() for c in cats)
    except Exception:  # noqa: BLE001
        categories = "phones, audio, wearables, bags and shoes"

    session = build_session(ctx)
    watchdog = _arm_max_duration(ctx, session, int(meta.get("max_minutes") or DEFAULT_MAX_MINUTES) * 60)

    async def on_shutdown():
        watchdog.cancel()
        await shop.close()

    ctx.add_shutdown_callback(on_shutdown)
    await session.start(
        agent=ShopAssistant(instructions=build_instructions(categories), tools=make_tools(shop, ctx)),
        room=ctx.room,
    )


if __name__ == "__main__":
    cli.run_app(server)
