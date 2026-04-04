"""Billing & subscription service: Stripe integration, quota enforcement, usage tracking."""
from __future__ import annotations

import datetime as dt
import structlog
from typing import Any

import stripe as stripe_lib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Subscription, UsageRecord, User

log = structlog.get_logger(__name__)

TIER_QUOTAS = {
    "free": {"tokens_monthly": 500_000, "requests_monthly": 100},
    "basic": {"tokens_monthly": 2_000_000, "requests_monthly": 500},
    "pro": {"tokens_monthly": 10_000_000, "requests_monthly": 5000},
    "enterprise": {"tokens_monthly": 100_000_000, "requests_monthly": 50000},
}


class BillingService:
    def __init__(self, session: AsyncSession, stripe_key: str = ""):
        self.session = session
        if stripe_key:
            stripe_lib.api_key = stripe_key

    async def get_subscription(self, user_id: str) -> Subscription | None:
        stmt = select(Subscription).where(Subscription.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_subscription(self, user_id: str, tier: str = "free") -> Subscription:
        quotas = TIER_QUOTAS.get(tier, TIER_QUOTAS["free"])
        now = dt.datetime.now(dt.timezone.utc)
        sub = Subscription(
            user_id=user_id,
            tier=tier,
            status="active",
            quota_tokens_monthly=quotas["tokens_monthly"],
            quota_requests_monthly=quotas["requests_monthly"],
            current_period_start=now.replace(day=1),
            current_period_end=(now.replace(day=28) + dt.timedelta(days=4)).replace(day=1),
        )
        self.session.add(sub)
        await self.session.commit()
        await self.session.refresh(sub)
        return sub

    async def check_quota(self, user_id: str) -> tuple[bool, dict[str, Any]]:
        sub = await self.get_subscription(user_id)
        if not sub:
            sub = await self.create_subscription(user_id)

        tokens_remaining = sub.quota_tokens_monthly - sub.current_tokens_used
        requests_remaining = sub.quota_requests_monthly - sub.current_requests_used

        allowed = tokens_remaining > 0 and requests_remaining > 0
        info = {
            "tier": sub.tier,
            "status": sub.status,
            "tokens_used": sub.current_tokens_used,
            "tokens_limit": sub.quota_tokens_monthly,
            "tokens_remaining": max(0, tokens_remaining),
            "requests_used": sub.current_requests_used,
            "requests_limit": sub.quota_requests_monthly,
            "requests_remaining": max(0, requests_remaining),
        }
        return allowed, info

    async def record_usage(self, user_id: str, *, tokens: int, cost_cents: float, model: str = "unknown") -> None:
        today = dt.date.today()
        stmt = select(UsageRecord).where(UsageRecord.user_id == user_id, UsageRecord.usage_date == today, UsageRecord.model == model)
        result = await self.session.execute(stmt)
        record = result.scalar_one_or_none()

        if record:
            record.total_tokens += tokens
            record.cost_cents += cost_cents
            record.request_count += 1
        else:
            record = UsageRecord(
                user_id=user_id,
                usage_date=today,
                model=model,
                total_tokens=tokens,
                cost_cents=cost_cents,
                request_count=1,
            )
            self.session.add(record)

        # Update subscription quota
        sub = await self.get_subscription(user_id)
        if sub:
            sub.current_tokens_used += tokens
            sub.current_requests_used += 1

        await self.session.commit()

    # ── Stripe webhooks ──────────────────────────────────────────────

    def handle_webhook(self, payload: bytes, sig_header: str) -> Any:
        from app.core.config import get_settings

        if not stripe_lib.api_key:
            raise RuntimeError("Stripe not configured")

        secret = get_settings().stripe_webhook_secret
        if not secret:
            raise RuntimeError("STRIPE_WEBHOOK_SECRET is required for webhook verification")

        return stripe_lib.Webhook.construct_event(payload, sig_header, secret)

    async def handle_customer_updated(self, event: dict) -> None:
        customer = event["data"]["object"]
        stripe_id = customer.get("id")
        email = customer.get("email")
        if email:
            result = await self.session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user:
                sub = await self.get_subscription(str(user.id))
                if sub:
                    sub.stripe_customer_id = stripe_id
                    await self.session.commit()
                else:
                    await self.create_subscription(str(user.id))

    async def handle_subscription_updated(self, event: dict) -> None:
        sub_obj = event["data"]["object"]
        stripe_sub_id = sub_obj.get("id")
        customer_id = sub_obj.get("customer")
        status = sub_obj.get("status", "inactive")
        plan = sub_obj.get("items", {}).get("data", [{}])[0].get("plan", {}).get("nickname", "basic")

        result = await self.session.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = status
            sub.tier = plan
            await self.session.commit()
        log.info("stripe_subscription_updated", stripe_sub_id=stripe_sub_id, status=status)

    async def handle_subscription_deleted(self, event: dict) -> None:
        sub_obj = event["data"]["object"]
        stripe_sub_id = sub_obj.get("id")
        result = await self.session.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "canceled"
            sub.cancel_at_period_end = True
            await self.session.commit()
