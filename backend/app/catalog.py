"""The shop's products: the seed rows and the search the voice agent uses.

Images live in the frontend's /public/products, so `image` is a path the
site serves itself. `tags` holds the everyday words people say for an item
("wristwatch", "earpiece", "airpod") so a spoken request finds it.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Product

CATEGORIES = {
    "phones": "Phones",
    "audio": "Audio",
    "wearables": "Wearables",
    "bags": "Bags",
    "shoes": "Shoes",
}

# Words a caller might use for a whole category.
CATEGORY_WORDS = {
    "phones": "phone mobile smartphone handset cellphone",
    "audio": "audio earbud earphone headphone headset earpiece sound music",
    "wearables": "watch wristwatch smartwatch timepiece wearable",
    "bags": "bag handbag backpack purse tote",
    "shoes": "shoe sneaker trainer kick footwear",
}

SEED = [
    # id, name, price (NGN), category, image, tags, description
    ("smartphone-pro", "Smartphone Pro", 650000, "phones", "/products/smartphone-pro.jpg",
     "android camera", "A slim flagship phone with a bright display and an all-day battery."),
    ("iphone-13-pro", "iPhone 13 Pro", 1150000, "phones", "/products/iphone-13-pro.jpg",
     "apple iphone ios camera", "Apple's pro iPhone with a triple camera and ProMotion display."),
    ("galaxy-s10", "Samsung Galaxy S10", 420000, "phones", "/products/galaxy-s10.jpg",
     "samsung android galaxy", "A reliable Samsung flagship at a friendly price."),
    ("wireless-earbuds", "Wireless Earbuds", 45000, "audio", "/products/wireless-earbuds.jpg",
     "bluetooth wireless", "Compact true-wireless earbuds with a charging case."),
    ("airpods", "Apple AirPods", 185000, "audio", "/products/airpods.jpg",
     "apple airpod airpods bluetooth wireless", "Apple's wireless earbuds with instant iPhone pairing."),
    ("airpods-max", "AirPods Max", 690000, "audio", "/products/airpods-max.jpg",
     "apple airpod airpods over-ear noise-cancelling", "Over-ear Apple headphones with active noise cancellation."),
    ("beats-flex", "Beats Flex Earphones", 65000, "audio", "/products/beats-flex.jpg",
     "beats wireless neckband bluetooth", "Lightweight wireless neckband earphones from Beats."),
    ("smart-watch", "Smart Watch", 120000, "wearables", "/products/smart-watch.jpg",
     "smartwatch fitness apple", "A fitness-tracking smartwatch with a crisp always-on screen."),
    ("leather-strap-watch", "Leather Strap Watch", 85000, "wearables", "/products/leather-strap-watch.jpg",
     "analog classic leather brown", "A classic analogue watch on a brown leather strap."),
    ("diver-watch", "Steel Diver Watch", 2400000, "wearables", "/products/diver-watch.jpg",
     "luxury steel diver analog", "A luxury stainless-steel dive watch with a rotating bezel."),
    ("everyday-backpack", "Everyday Backpack", 60000, "bags", "/products/everyday-backpack.jpg",
     "backpack school laptop", "A roomy everyday backpack with a padded laptop sleeve."),
    ("black-handbag", "Black Handbag", 140000, "bags", "/products/black-handbag.jpg",
     "handbag purse women black leather", "A structured black handbag for work and evenings."),
    ("blue-handbag", "Blue Handbag", 95000, "bags", "/products/blue-handbag.jpg",
     "handbag purse women blue", "A soft blue handbag with a top handle."),
    ("leather-tote", "Leather Tote Bag", 350000, "bags", "/products/leather-tote.jpg",
     "tote luxury leather women designer", "A premium leather tote with gold hardware."),
    ("court-sneakers", "High-Top Court Sneakers", 210000, "shoes", "/products/court-sneakers.jpg",
     "sneakers jordan nike high-top red black", "Iconic red and black high-top sneakers."),
]


def seed(db: Session) -> None:
    """Insert any missing seed products and refresh the ones already there."""
    existing = {p.id: p for p in db.scalars(select(Product))}
    for i, (pid, name, price, category, image, tags, description) in enumerate(SEED):
        row = existing.get(pid) or Product(id=pid)
        row.name, row.price, row.category, row.image = name, price, category, image
        row.tags, row.description, row.position = tags, description, i
        db.add(row)
    db.commit()


def _stem(word: str) -> str:
    word = word.lower()
    if len(word) > 3 and word.endswith("es") and word[:-2].endswith(("ch", "sh", "x")):
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _words(text: str) -> set[str]:
    return {_stem(w) for w in re.findall(r"[a-z0-9]+", text.lower())}


def _vocabulary(p: Product) -> set[str]:
    return _words(f"{p.name} {p.tags} {p.category} {CATEGORY_WORDS.get(p.category, '')}")


def _matches(term: str, vocab: set[str]) -> bool:
    """Every word of the term must start a word the product is known by:
    "airpod" finds "airpods", "phone" finds phones but not "headphone"."""
    words = _words(term)
    return bool(words) and all(any(v.startswith(w) for v in vocab) for w in words)


def search(
    db: Session,
    items: list[str] | None = None,
    category: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    limit: int = 12,
) -> list[Product]:
    """Products for each thing asked for, in the order asked, cheapest first
    within each. No items means everything (within the other filters)."""
    rows = list(db.scalars(select(Product).order_by(Product.position)))
    if category:
        rows = [p for p in rows if p.category == category]
    if min_price is not None:
        rows = [p for p in rows if p.price >= min_price]
    if max_price is not None:
        rows = [p for p in rows if p.price <= max_price]

    terms = [t.strip() for t in (items or []) if t and t.strip()]
    if not terms:
        return rows[:limit]

    out: list[Product] = []
    seen: set[str] = set()
    for term in terms:
        hits = sorted((p for p in rows if _matches(term, _vocabulary(p))), key=lambda p: p.price)
        for p in hits:
            if p.id not in seen:
                seen.add(p.id)
                out.append(p)
    return out[:limit]
