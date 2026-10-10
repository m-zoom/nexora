"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { flyToCart, getPicks, setPicks } from "@/lib/agent";
import type { Product } from "@/lib/products";
import { CloseIcon, MicIcon, MicOffIcon, PhoneIcon } from "./icons";

type Status = "idle" | "ringing" | "live" | "ended" | "error";

const AGENT_NAME = "Nexora Assistant";

/** A soft two-tone ringback (like a phone line) while the agent picks up. */
function startRingback() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  for (const f of [440, 480]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
  }
  const ring = () => {
    const t = ctx.currentTime;
    gain.gain.setTargetAtTime(0.035, t, 0.03);
    gain.gain.setTargetAtTime(0, t + 1.6, 0.05);
  };
  ring();
  const timer = window.setInterval(ring, 3600);
  return () => {
    window.clearInterval(timer);
    void ctx.close();
  };
}

function clock(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function CallAgent() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [liveAt, setLiveAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const stopRingRef = useRef<() => void>(() => {});
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Call timer.
  useEffect(() => {
    if (status !== "live") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status]);
  const seconds = Math.max(0, Math.floor((now - liveAt) / 1000));

  // Leaving the page ends the call cleanly.
  useEffect(() => () => void roomRef.current?.disconnect(), []);

  const finish = (next: Status, message = "") => {
    stopRingRef.current();
    stopRingRef.current = () => {};
    const room = roomRef.current;
    roomRef.current = null;
    room?.disconnect();
    document.querySelectorAll("audio[data-agent-audio]").forEach((el) => el.remove());
    setSpeaking(false);
    setMuted(false);
    setError(message);
    setStatus(next);
    if (next === "ended") window.setTimeout(() => setStatus((s) => (s === "ended" ? "idle" : s)), 2200);
  };

  const call = async () => {
    setOpen(true);
    setError("");
    setStatus("ringing");
    stopRingRef.current = startRingback();
    try {
      const res = await fetch("/api/call/session", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "The assistant couldn't be reached.");

      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.registerRpcMethod("show_products", async ({ payload }) => {
        const { title, products } = JSON.parse(payload) as { title: string; products: Product[] };
        setPicks(title, products);
        setOpen(false); // get out of the way of the products

        if (pathRef.current !== "/" && pathRef.current !== "/shop") router.push("/shop");
        return "shown";
      });

      room.registerRpcMethod("add_to_cart", async ({ payload }) => {
        const { ids } = JSON.parse(payload) as { ids: string[] };
        const shown = getPicks()?.products ?? [];
        const products = ids.map((id) => shown.find((p) => p.id === id)).filter((p): p is Product => !!p);
        flyToCart(products);
        return products.length ? "added" : "not on screen";
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        el.dataset.agentAudio = "";
        document.body.appendChild(el);
        stopRingRef.current();
        const t = Date.now();
        setLiveAt(t);
        setNow(t);
        setStatus("live");
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeaking(speakers.some((s) => s.identity !== room.localParticipant.identity));
      });
      room.on(RoomEvent.ParticipantDisconnected, () => finish("ended"));
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) finish("ended");
      });

      await room.connect(data.url, data.token);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        finish("error", "Allow microphone access to talk to the assistant.");
      }
    } catch (e) {
      finish("error", e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const inCall = status === "ringing" || status === "live";
  const showPanel = open && status !== "idle";

  const statusLine =
    status === "ringing"
      ? "Calling…"
      : status === "live"
        ? speaking
          ? "Speaking…"
          : `Connected · ${clock(seconds)}`
        : status === "ended"
          ? "Call ended"
          : error;

  return (
    <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[55] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* Call card */}
      <div
        role="dialog"
        aria-label={`Call with ${AGENT_NAME}`}
        inert={!showPanel}
        className={`pointer-events-auto w-[min(300px,calc(100vw-2rem))] origin-bottom-right rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)] transition duration-300 ease-smooth ${
          showPanel ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Voice shopping</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimise call"
            className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <div className="relative h-20 w-20">
            {status === "ringing" && (
              <>
                <span className="absolute inset-0 animate-call-ripple rounded-full border border-ink/30" />
                <span className="absolute inset-0 animate-call-ripple rounded-full border border-ink/30 [animation-delay:600ms]" />
                <span className="absolute inset-0 animate-call-ripple rounded-full border border-ink/30 [animation-delay:1200ms]" />
              </>
            )}
            <span
              className={`absolute -inset-1 rounded-full border-2 transition-[border-color,transform] duration-300 ${
                status === "live" && speaking ? "scale-105 border-ink" : "scale-100 border-transparent"
              }`}
            />
            <Image
              src="/agent.jpg"
              alt=""
              fill
              sizes="80px"
              className="rounded-full object-cover"
            />
          </div>
          <p className="mt-3.5 text-[15px] font-medium">{AGENT_NAME}</p>
          <p
            role="status"
            className={`mt-0.5 h-5 text-[13px] tabular-nums ${status === "error" ? "text-[#c4352f]" : "text-muted"}`}
          >
            {statusLine}
          </p>

          <div aria-hidden="true" className="mt-3 flex h-6 items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 110}ms` }}
                className={`w-[3px] rounded-full bg-ink transition-[height,opacity] duration-300 ${
                  status === "live" && speaking ? "h-6 animate-voice-bar" : "h-1 opacity-30"
                }`}
              />
            ))}
          </div>

          {status === "live" && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Try “Show me watches and bags under ₦200k”, then “add the first and third to my cart”.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {inCall ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                disabled={status !== "live"}
                aria-pressed={muted}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
                  muted ? "border-ink bg-ink text-white" : "border-line text-ink hover:bg-surface"
                }`}
              >
                {muted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => finish("ended")}
                aria-label="End call"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#e5484d] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <PhoneIcon className="h-4 w-4 rotate-[135deg]" />
                End
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={call}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
            >
              <PhoneIcon className="h-4 w-4" />
              Call again
            </button>
          )}
        </div>
      </div>

      {/* Floating call button */}
      <div className="group pointer-events-auto relative flex items-center">
        <span
          className={`mr-3 hidden rounded-full border border-line bg-white px-3.5 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)] transition duration-300 ease-smooth sm:block ${
            inCall || showPanel ? "pointer-events-none translate-x-2 opacity-0" : "opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
          }`}
        >
          Shop by voice
        </span>
        <button
          type="button"
          onClick={() => (inCall ? setOpen((o) => !o) : call())}
          aria-label={inCall ? (open ? "Hide call" : "Show call") : `Call ${AGENT_NAME}`}
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-smooth hover:scale-105 active:scale-95"
        >
          {/* Rings that ripple out: slow at rest, quick while it rings. */}
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full bg-ink ${status === "ringing" ? "animate-call-ripple-fast" : status === "live" ? (speaking ? "animate-call-ripple" : "") : "animate-call-ripple-idle"}`}
          />
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full bg-ink ${status === "ringing" ? "animate-call-ripple-fast [animation-delay:550ms]" : status === "live" ? (speaking ? "animate-call-ripple [animation-delay:900ms]" : "") : "animate-call-ripple-idle [animation-delay:1600ms]"}`}
          />
          {status === "live" ? (
            <span className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-white">
              <Image src="/agent.jpg" alt="" fill sizes="56px" className="object-cover" />
              <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#30a46c] ring-2 ring-white" />
            </span>
          ) : (
            <PhoneIcon className={`relative h-[22px] w-[22px] ${status === "ringing" ? "animate-phone-ring" : ""}`} />
          )}
        </button>
      </div>
    </div>
  );
}
