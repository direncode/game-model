"""Role-scoped tactical assistant stubs.

This is deliberately LLM-free. It takes a role, a question, and a snapshot
of the current match context, and returns a deterministic templated reply.
The shape of the contract (`generate_reply`) is the exact seam an LLM will
plug into — replacing the body of `generate_reply` is the only change
required to wire Claude or any other model behind the curtain.

Why no LLM in v0:
    1. The brief demanded a full vertical in one session — no time for key
       plumbing, prompt engineering, cost guarding, or retry logic.
    2. The three target scenarios can all be answered from match state +
       recent insights. A small templated responder is actually better for
       demos because it is deterministic, fast, and never hallucinates.
    3. The wiring is clean: swap one function, keep the API, the frontend,
       and everything else untouched.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.dunc.insights import Insight
from app.services.dunc.twins import DigitalTwin

Role = Literal["manager", "technical_staff"]


@dataclass
class AgentReply:
    role: Role
    question: str
    answer: str
    citations: list[str]  # insight ids referenced in the answer
    style: Literal["concise", "detailed"]

    def as_dict(self) -> dict:
        return {
            "role": self.role,
            "question": self.question,
            "answer": self.answer,
            "citations": list(self.citations),
            "style": self.style,
        }


class DuncAgent:
    """Stateless templated agent.

    Manager style:     terse, action-oriented, no jargon
    Tech-staff style:  numeric, detailed, includes evidence
    """

    def generate_reply(
        self,
        role: Role,
        question: str,
        twins: list[DigitalTwin],
        recent_insights: list[Insight],
        ball_xy: tuple[float, float],
    ) -> AgentReply:
        q = (question or "").strip().lower()
        style: Literal["concise", "detailed"] = "concise" if role == "manager" else "detailed"

        # Route on cheap keyword heuristics. Everything after this block
        # is pure string templating.
        if any(k in q for k in ("under", "striker", "front")):
            return self._answer_under_run(role, question, recent_insights, style)
        if any(k in q for k in ("press", "high line", "block")):
            return self._answer_press(role, question, recent_insights, twins, style)
        if any(k in q for k in ("converge", "shape", "triangle", "numbers")):
            return self._answer_convergence(role, question, recent_insights, style)
        if any(k in q for k in ("fatigue", "legs", "tired", "fit")):
            return self._answer_fatigue(role, question, twins, style)
        return self._answer_default(role, question, recent_insights, twins, ball_xy, style)

    # ── themed responses ──────────────────────────────────────────────
    def _answer_under_run(
        self,
        role: Role,
        question: str,
        recent_insights: list[Insight],
        style,
    ) -> AgentReply:
        hit = next((i for i in reversed(recent_insights) if i.kind == "under_run"), None)
        if role == "manager":
            if hit:
                answer = (
                    f"Yes — you're right. The striker is dropping away while the "
                    f"midfield drives forward. That's the under-run you saw. Tell them "
                    f"to stay on the last shoulder until we turn possession."
                )
            else:
                answer = "No under-run signal right now. The front line is in sync with the midfield push."
        else:
            if hit:
                sv = hit.evidence.get("striker_vx")
                mv = hit.evidence.get("midfield_vx_avg")
                answer = (
                    f"Detected at t={hit.t:.1f}s. Striker vx={sv} m/s vs midfield avg "
                    f"vx={mv} m/s — a clear opposing direction. Ball was in the "
                    f"attacking half at the trigger. This matches the 'front line breaks from attack' template."
                )
            else:
                answer = "No under-run firing in the current window. Front line and midfield vx are aligned."
        return AgentReply(
            role=role, question=question, answer=answer,
            citations=[hit.id] if hit else [], style=style,
        )

    def _answer_press(
        self,
        role: Role,
        question: str,
        recent_insights: list[Insight],
        twins: list[DigitalTwin],
        style,
    ) -> AgentReply:
        hit = next((i for i in reversed(recent_insights) if i.kind == "pressing_shift"), None)
        away_mean = (
            sum(tw.x for tw in twins if tw.team == "away" and tw.role != "GK")
            / max(len([1 for tw in twins if tw.team == "away" and tw.role != "GK"]), 1)
        )
        if role == "manager":
            if hit:
                answer = (
                    "They've gone to a high press. Switch to direct balls in behind — "
                    "don't try to play through it. Tell the full-backs to stay narrow until we clear."
                )
            else:
                answer = f"Their block averages x={away_mean:.0f}m. Still a mid-block, no press yet."
        else:
            if hit:
                answer = (
                    f"Pressing shift detected at t={hit.t:.1f}s. "
                    f"{int(float(hit.evidence.get('share_in_home_half', 0)) * 100)}% of the "
                    f"away outfielders are inside our half, mean block x="
                    f"{hit.evidence.get('away_block_x')}m. Recommend vertical outlet "
                    f"and pinning their full-backs high."
                )
            else:
                answer = (
                    f"Away block mean x={away_mean:.1f}m. No pressing shift yet — "
                    f"threshold is 80% in our half."
                )
        return AgentReply(
            role=role, question=question, answer=answer,
            citations=[hit.id] if hit else [], style=style,
        )

    def _answer_convergence(
        self,
        role: Role,
        question: str,
        recent_insights: list[Insight],
        style,
    ) -> AgentReply:
        hit = next((i for i in reversed(recent_insights) if i.kind == "convergence"), None)
        if role == "manager":
            if hit:
                answer = (
                    "The central midfield three are on top of each other — we've got a "
                    "numerical overload in the middle right now. Look for the switch to the weak side."
                )
            else:
                answer = "No central overload this window. Midfield is keeping its shape."
        else:
            if hit:
                if "max_pairwise_m" in hit.evidence:
                    answer = (
                        f"Heuristic convergence at t={hit.t:.1f}s — max pairwise distance "
                        f"between LCM/CM/RCM is {hit.evidence['max_pairwise_m']}m. "
                        f"Worth the manager's attention as the shape of the moment."
                    )
                else:
                    answer = (
                        f"BTUT windowed convergence at t={hit.t:.1f}s, "
                        f"nash_gap={hit.evidence.get('nash_gap')}, "
                        f"energy={hit.evidence.get('energy')}. Tactical lock held across the window."
                    )
            else:
                answer = "No convergence hit this window. Shape is dispersed."
        return AgentReply(
            role=role, question=question, answer=answer,
            citations=[hit.id] if hit else [], style=style,
        )

    def _answer_fatigue(self, role, question, twins, style) -> AgentReply:
        ours = [tw for tw in twins if tw.team == "home" and tw.role != "GK"]
        if not ours:
            return AgentReply(role=role, question=question, answer="No player data yet.", citations=[], style=style)
        tired = sorted(ours, key=lambda tw: -tw.fatigue)[:3]
        if role == "manager":
            names = ", ".join(f"#{tw.number}" for tw in tired)
            answer = f"Watch the legs on {names}. They're the three most loaded right now."
        else:
            lines = [
                f"#{tw.number} {tw.role}: dist={tw.distance_m:.0f}m, HI={tw.high_intensity_m:.0f}m, "
                f"sprints={tw.sprint_count}, fatigue={tw.fatigue:.2f}"
                for tw in tired
            ]
            answer = "Top-3 loaded outfielders: " + " | ".join(lines)
        return AgentReply(role=role, question=question, answer=answer, citations=[], style=style)

    def _answer_default(
        self, role, question, recent_insights, twins, ball_xy, style,
    ) -> AgentReply:
        if role == "manager":
            if recent_insights:
                last = recent_insights[-1]
                answer = f"Most recent thing worth your attention: {last.title}. {last.summary}"
            else:
                answer = "Nothing critical on the board right now. Match is in a stable phase."
        else:
            home_ids = [tw.player_id for tw in twins if tw.team == "home"]
            away_ids = [tw.player_id for tw in twins if tw.team == "away"]
            answer = (
                f"Ball at ({ball_xy[0]:.1f}, {ball_xy[1]:.1f}). "
                f"Home tracked: {len(home_ids)}. Away tracked: {len(away_ids)}. "
                f"Last {min(len(recent_insights), 3)} insight kinds: "
                f"{[i.kind for i in recent_insights[-3:]]}."
            )
        return AgentReply(
            role=role, question=question, answer=answer,
            citations=[i.id for i in recent_insights[-3:]], style=style,
        )
