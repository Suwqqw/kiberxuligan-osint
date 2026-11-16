"""
KIberXuligan Graph
"""

from urllib.parse import urlparse
from typing import Dict, List, Any, Optional

CATEGORIES: Dict[str, Dict[str, Any]] = {
    "runet": {
        "title": "Рунет и СНГ",
        "color": "#00f0b5",          # Cyber Emerald
        "color_alpha": "rgba(0, 240, 181, 0.35)",
        "icon": "🇷🇺",
        "domains": [
            "vk.com", "ok.ru", "habr.com", "pikabu.ru", "dtf.ru", "vc.ru",
            "4pda.to", "rutube.ru", "mail.ru", "dzen.ru", "tenchat.ru",
            "kwork.ru", "fl.ru", "livelib.ru", "otzovik.com", "drive2.ru",
            "babyblog.ru", "yaplakal.com", "stopgame.ru", "sports.ru",
            "proza.ru", "stihi.ru", "irecommend.ru", "avito.ru", "yandex.ru"
        ]
    },
    "messaging": {
        "title": "Мессенджеры",
        "color": "#06b6d4",          # Neon Cyan
        "color_alpha": "rgba(6, 182, 212, 0.35)",
        "icon": "💬",
        "domains": ["t.me", "telegram.me", "discord.com", "viber.com", "skype.com", "whatsapp.com", "signal.org", "slack.com"]
    },
    "tech": {
        "title": "Разработка и IT",
        "color": "#a855f7",          # Electric Violet
        "color_alpha": "rgba(168, 85, 247, 0.35)",
        "icon": "💻",
        "domains": [
            "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
            "kaggle.com", "pypi.org", "npmjs.com", "docker.com", "replit.com",
            "codepen.io", "dev.to", "medium.com", "hackerrank.com", "leetcode.com"
        ]
    },
    "social": {
        "title": "Соцсети",
        "color": "#38bdf8",          # Ice Blue
        "color_alpha": "rgba(56, 189, 248, 0.35)",
        "icon": "🌐",
        "domains": [
            "instagram.com", "facebook.com", "twitter.com", "x.com", "threads.net",
            "mastodon.social", "tiktok.com", "pinterest.com", "reddit.com", "tumblr.com"
        ]
    },
    "gaming": {
        "title": "Гейминг",
        "color": "#f43f5e",          # Neon Crimson
        "color_alpha": "rgba(244, 63, 94, 0.35)",
        "icon": "🎮",
        "domains": [
            "steamcommunity.com", "roblox.com", "twitch.tv", "chess.com",
            "lichess.org", "playstation.com", "xbox.com", "speedrun.com"
        ]
    },
    "media": {
        "title": "Медиа и Творчество",
        "color": "#ec4899",          # Neon Fuchsia
        "color_alpha": "rgba(236, 72, 153, 0.35)",
        "icon": "🎵",
        "domains": [
            "youtube.com", "spotify.com", "soundcloud.com", "vimeo.com",
            "bandcamp.com", "last.fm", "deviantart.com", "artstation.com", "flickr.com"
        ]
    },
    "career": {
        "title": "Карьера и Фриланс",
        "color": "#eab308",          # Warm Amber
        "color_alpha": "rgba(234, 179, 8, 0.35)",
        "icon": "💼",
        "domains": ["linkedin.com", "freelancer.com", "upwork.com", "fiverr.com", "hh.ru", "superjob.ru"]
    }
}

DEFAULT_CATEGORY = {
    "title": "Прочие сервисы",
    "color": "#64748b",              # Cool Slate
    "color_alpha": "rgba(100, 116, 139, 0.35)",
    "icon": "📁"
}

def classify_service(url: str, site_name: str = "") -> str:
    """Classifies URL domain into an intelligence category."""
    try:
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
    except Exception:
        domain = ""

    # Fast RU domain extension check
    if domain.endswith(".ru") or domain.endswith(".рф") or domain.endswith(".su"):
        return "runet"

    site_lower = site_name.lower()
    for cat_id, cat_info in CATEGORIES.items():
        for d in cat_info["domains"]:
            if d in domain or d in url.lower() or d.split('.')[0] in site_lower:
                return cat_id

    return "other"

def build_osint_graph(target_username: str, items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Constructs an interactive Vis.js network graph styled in the ClearVisual aesthetic.
    Features dark obsidian glass nodes, glowing cyber rims, and elegant splines.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # 1. Central Target Node (Obsidian Cyber Core)
    root_id = "target_root"
    nodes.append({
        "id": root_id,
        "label": f"🎯 {target_username}",
        "shape": "circle",
        "size": 36,
        "color": {
            "background": "#070c18",
            "border": "#00f0b5",
            "highlight": {"background": "#0c1a30", "border": "#38bdf8"}
        },
        "borderWidth": 2.5,
        "shadow": {
            "enabled": True,
            "color": "rgba(0, 240, 181, 0.5)",
            "size": 25,
            "x": 0,
            "y": 0
        },
        "font": {
            "color": "#ffffff",
            "size": 16,
            "face": "JetBrains Mono, Plus Jakarta Sans, sans-serif",
            "bold": True
        },
        "title": f"Целевой никнейм: {target_username}",
        "isRoot": True
    })

    # Track discovered categories
    used_categories = {item.get("category", "other") for item in items}

    # 2. Category Hub Nodes (Frosted Capsule Hubs)
    for cat_id in used_categories:
        cat_info = CATEGORIES.get(cat_id, DEFAULT_CATEGORY)
        cat_node_id = f"cat_{cat_id}"
        accent_color = cat_info["color"]

        nodes.append({
            "id": cat_node_id,
            "label": f"{cat_info.get('icon', '•')} {cat_info.get('title', cat_id)}",
            "shape": "box",
            "margin": 10,
            "color": {
                "background": "#080d1a",
                "border": accent_color,
                "highlight": {"background": "#0f172a", "border": "#ffffff"}
            },
            "borderWidth": 1.5,
            "shadow": {
                "enabled": True,
                "color": "rgba(0, 0, 0, 0.7)",
                "size": 12,
                "x": 0,
                "y": 4
            },
            "font": {
                "color": accent_color,
                "size": 12,
                "face": "Plus Jakarta Sans, sans-serif",
                "bold": True
            },
            "isCategory": True
        })

        # Curved connection from Root to Category Hub
        edges.append({
            "from": root_id,
            "to": cat_node_id,
            "color": {
                "color": "rgba(56, 189, 248, 0.4)",
                "highlight": "#38bdf8"
            },
            "width": 2,
            "dashes": [4, 4],
            "smooth": {"type": "continuous", "roundness": 0.35}
        })

    # 3. Discovered Profile Nodes & Extracted Entity Nodes
    for idx, item in enumerate(items):
        site_name = item.get("site", "Unknown")
        url = item.get("url", "")
        tools = item.get("tools", [])
        cat_id = item.get("category", "other")
        cat_info = CATEGORIES.get(cat_id, DEFAULT_CATEGORY)
        color = cat_info["color"]
        meta = item.get("metadata", {})

        node_id = f"profile_{idx}"
        confidence = len(tools)
        node_size = 15 + min(confidence * 3, 10)
        border_width = 1.5 + (confidence * 0.8)

        tools_str = ", ".join(t.capitalize() for t in tools)
        tooltip_html = (
            f"<b>{site_name}</b><br/>"
            f"URL: {url}<br/>"
            f"Подтверждено: {tools_str} ({confidence}x)"
        )

        nodes.append({
            "id": node_id,
            "label": site_name,
            "shape": "dot",
            "size": node_size,
            "color": {
                "background": "#080e1e",
                "border": "#ffffff" if confidence > 1 else color,
                "highlight": {"background": color, "border": "#ffffff"}
            },
            "borderWidth": border_width,
            "shadow": {
                "enabled": True,
                "color": f"rgba(56, 189, 248, {0.35 if confidence > 1 else 0.15})",
                "size": 12,
                "x": 0,
                "y": 0
            },
            "font": {
                "color": "#e2e8f0",
                "size": 11,
                "face": "Plus Jakarta Sans, sans-serif"
            },
            "title": tooltip_html,
            "url": url,
            "tools": tools,
            "site": site_name,
            "category": cat_id,
            "confidence": confidence,
            "metadata": meta,
            "isProfile": True
        })

        # Connect Profile to its Category Hub
        edges.append({
            "from": f"cat_{cat_id}",
            "to": node_id,
            "color": {
                "color": cat_info.get("color_alpha", "rgba(100, 116, 139, 0.35)"),
                "highlight": color
            },
            "width": 1.5 + (confidence * 0.5),
            "smooth": {"type": "continuous", "roundness": 0.25}
        })

        # Extracted secondary links
        extra_links = meta.get("extracted_links", [])
        for l_idx, link in enumerate(extra_links[:2]):
            link_id = f"meta_link_{idx}_{l_idx}"
            clean_link_label = "🔗 " + link.split("://")[-1][:22]
            nodes.append({
                "id": link_id,
                "label": clean_link_label,
                "shape": "box",
                "margin": 6,
                "color": {
                    "background": "#140f06",
                    "border": "#f59e0b",
                    "highlight": {"background": "#b45309", "border": "#ffffff"}
                },
                "borderWidth": 1.2,
                "font": {"color": "#fde68a", "size": 10, "face": "JetBrains Mono, monospace"},
                "title": f"Извлеченная ссылка: {link}",
                "url": link,
                "isPivot": True
            })
            edges.append({
                "from": node_id,
                "to": link_id,
                "color": {"color": "rgba(245, 158, 11, 0.4)", "highlight": "#f59e0b"},
                "width": 1,
                "dashes": [2, 2]
            })

        # Extracted identity / full name
        full_name = meta.get("fullname")
        if full_name and len(full_name.strip()) > 1:
            name_id = f"meta_name_{idx}"
            nodes.append({
                "id": name_id,
                "label": f"👤 {full_name[:20]}",
                "shape": "box",
                "margin": 6,
                "color": {
                    "background": "#06150f",
                    "border": "#10b981",
                    "highlight": {"background": "#059669", "border": "#ffffff"}
                },
                "borderWidth": 1.2,
                "font": {"color": "#a7f3d0", "size": 10, "bold": True, "face": "Plus Jakarta Sans, sans-serif"},
                "title": f"Имя в профиле: {full_name}",
                "isPivot": True
            })
            edges.append({
                "from": node_id,
                "to": name_id,
                "color": {"color": "rgba(16, 185, 129, 0.4)", "highlight": "#10b981"},
                "width": 1,
                "dashes": [2, 2]
            })

    return {"nodes": nodes, "edges": edges}
