"""Signup, referral attribution, and the downline tree.

The tree is the feature the admin panel and the user dashboard both hang off:
"who sits under whom, and what is each of them worth". It is built with a
single recursive CTE rather than the reference platform's breadth-first
Python loop — one round-trip instead of one per level.
"""
import logging
from collections import defaultdict
from decimal import Decimal

from uuid import UUID

from django.db import connection, transaction
from django.db.models import Count, Sum, UUIDField

from apps.core.services import notify

from .models import KYCDocument, Referral, User

logger = logging.getLogger(__name__)

MAX_TREE_DEPTH = 25


def resolve_sponsor(referral_code):
    """Look up a sponsor by referral code. Returns None for blank/unknown codes
    so signup never hard-fails on a mistyped link."""
    if not referral_code:
        return None
    return User.objects.filter(
        referral_code__iexact=referral_code.strip(), status="active",
    ).first()


@transaction.atomic
def register_user(*, email, password, first_name="", last_name="", phone="",
                  country="", referral_code="", utm=None, ip_address=None):
    """Create a user and wire them into the tree under `referral_code`."""
    sponsor = resolve_sponsor(referral_code)
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        country=country,
        sponsor=sponsor,
        tree_depth=(sponsor.tree_depth + 1) if sponsor else 0,
    )

    utm = utm or {}
    Referral.objects.create(
        referrer=sponsor,
        referred=user,
        referrer_code=sponsor.referral_code if sponsor else "",
        level_at_join=1,
        utm_source=utm.get("utm_source", "")[:100],
        utm_medium=utm.get("utm_medium", "")[:100],
        utm_campaign=utm.get("utm_campaign", "")[:100],
        ip_address=ip_address,
    )

    if sponsor:
        notify(
            sponsor,
            title="New referral joined",
            message=f"{user.full_name} signed up using your referral link.",
            notif_type="referral",
            action_url="/referrals",
        )
    return user


# ─── Downline traversal ───────────────────────────────────────────────────

def _as_uuid(value):
    """Raw-SQL results hand back whatever the backend stores.

    PostgreSQL returns real UUID objects; SQLite stores UUIDs as 32-char hex and
    returns strings. Normalising here keeps every caller able to compare these
    ids against ORM instances.
    """
    if value is None or isinstance(value, UUID):
        return value
    return UUID(str(value))


def downline_rows(root_id, max_depth=MAX_TREE_DEPTH):
    """Every descendant of `root_id` as (id, sponsor_id, depth), depth 1 = direct.

    The CTE is depth-capped, which doubles as the cycle guard: even a corrupt
    sponsor loop terminates at `max_depth`.
    """
    depth = max(1, min(int(max_depth), MAX_TREE_DEPTH))
    # Bind the root through UUIDField so the parameter is adapted the way the
    # backend stores it (native uuid on PostgreSQL, hex string on SQLite).
    # Passing str(uuid) directly silently matches nothing on SQLite.
    root_param = UUIDField().get_db_prep_value(root_id, connection, prepared=False)
    sql = """
        WITH RECURSIVE downline AS (
            SELECT u.id, u.sponsor_id, 1 AS depth
            FROM users u
            WHERE u.sponsor_id = %s
            UNION ALL
            SELECT c.id, c.sponsor_id, d.depth + 1
            FROM users c
            JOIN downline d ON c.sponsor_id = d.id
            WHERE d.depth < %s
        )
        SELECT id, sponsor_id, depth FROM downline
    """
    with connection.cursor() as cur:
        cur.execute(sql, [root_param, depth])
        return [(_as_uuid(r[0]), _as_uuid(r[1]), r[2]) for r in cur.fetchall()]


def _node_payload(user, depth, commission_from, direct_count):
    return {
        "user_id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "country": user.country,
        "referral_code": user.referral_code,
        "level": depth,
        "status": user.status,
        "kyc_status": user.kyc_status,
        "joined_at": user.created_at.isoformat() if user.created_at else None,
        "total_deposited": float(user.total_deposited or 0),
        "invested_balance": float(user.invested_balance or 0),
        "wallet_balance": float(user.wallet_balance or 0),
        "total_roi_earned": float(user.total_roi_earned or 0),
        # What THIS branch has paid the tree root so far.
        "commission_to_root": float(commission_from or 0),
        "direct_referrals": direct_count,
        "children": [],
    }


def build_downline_tree(root, max_depth=MAX_TREE_DEPTH):
    """Nested tree of everyone under `root`, with per-node user details.

    Each node also reports `commission_to_root` — how much MLM commission this
    particular downline member has generated for the user at the top of the
    tree. That is the number an upline actually cares about.
    """
    from apps.mlm.models import Commission

    rows = downline_rows(root.id, max_depth)
    if not rows:
        return {"tree": [], "total_nodes": 0, "levels": {}}

    ids = [r[0] for r in rows]
    depth_of = {r[0]: r[2] for r in rows}
    users = {u.id: u for u in User.objects.filter(id__in=ids)}

    commission_by_source = defaultdict(Decimal)
    comm_rows = (
        Commission.objects
        .filter(earner=root, source_user_id__in=ids, status="paid")
        .values_list("source_user_id")
        .annotate(total=Sum("amount"))
    )
    for source_id, total in comm_rows:
        commission_by_source[source_id] = total or Decimal("0")

    children_of = defaultdict(list)
    for uid, sponsor_id, _depth in rows:
        children_of[sponsor_id].append(uid)

    # Counted against the database, NOT against `children_of`. The latter only
    # holds the depth-limited slice, so a node sitting on the depth boundary
    # would report zero direct referrals when it actually has several — a wrong
    # number, not merely a truncated one. Callers use this to show "N more
    # below" where the tree stops.
    direct_counts = dict(
        User.objects.filter(sponsor_id__in=ids)
        .values_list("sponsor_id")
        .annotate(total=Count("id"))
    )

    nodes = {}
    for uid in ids:
        user = users.get(uid)
        if user is None:
            continue
        nodes[uid] = _node_payload(
            user, depth_of[uid], commission_by_source.get(uid), direct_counts.get(uid, 0),
        )

    def assemble(parent_id, seen):
        out = []
        for uid in children_of.get(parent_id, []):
            if uid in seen or uid not in nodes:
                continue
            seen.add(uid)
            node = nodes[uid]
            node["children"] = assemble(uid, seen)
            out.append(node)
        out.sort(key=lambda n: n["joined_at"] or "", reverse=True)
        return out

    tree = assemble(root.id, set())

    level_counts = defaultdict(int)
    for depth in depth_of.values():
        level_counts[depth] += 1

    return {
        "tree": tree,
        "total_nodes": len(nodes),
        "levels": {str(k): v for k, v in sorted(level_counts.items())},
    }


def downline_summary(root, max_depth=MAX_TREE_DEPTH):
    """Flat per-level rollup: how many users, and how much business, at each
    level below `root`. Cheap enough for a dashboard header."""
    rows = downline_rows(root.id, max_depth)
    if not rows:
        return {"total_downline": 0, "direct_count": 0, "levels": [],
                "team_business": 0.0}

    depth_of = {r[0]: r[2] for r in rows}
    agg = defaultdict(lambda: {"count": 0, "business": Decimal("0"),
                               "invested": Decimal("0")})

    for user in User.objects.filter(id__in=list(depth_of)).only(
        "id", "total_deposited", "invested_balance"
    ):
        bucket = agg[depth_of[user.id]]
        bucket["count"] += 1
        bucket["business"] += user.total_deposited or Decimal("0")
        bucket["invested"] += user.invested_balance or Decimal("0")

    levels = [
        {
            "level": lvl,
            "count": data["count"],
            "business": float(data["business"]),
            "invested": float(data["invested"]),
        }
        for lvl, data in sorted(agg.items())
    ]
    return {
        "total_downline": len(depth_of),
        "direct_count": agg[1]["count"] if 1 in agg else 0,
        "levels": levels,
        "team_business": float(sum(d["business"] for d in agg.values())),
    }


def submit_kyc(user, doc_type, file_obj):
    doc = KYCDocument.objects.create(user=user, doc_type=doc_type, file=file_obj)
    if user.kyc_status in ("pending", "rejected"):
        user.kyc_status = "submitted"
        user.save(update_fields=["kyc_status", "updated_at"])
    return doc
