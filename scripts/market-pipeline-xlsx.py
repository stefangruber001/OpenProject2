#!/usr/bin/env python3
"""
THE BARCELONA PIPELINE WORKBOOK — target list, contacts and a guided sales
process in one Excel file, generated from the roadmap artefacts.

Generated, not typed: every firm, score, tier, price, stage, objection and
script is parsed from docs/market/barcelona/*.md and *.jsonl, so the workbook
can be rebuilt after a contact-enrichment pass or a re-scoring without anybody
retyping a cell — and so that what the seller reads is what the roadmap said,
not a copy that drifted.

Rules it follows (the xlsx skill's): Arial throughout; formulas, never
hardcoded results; INDEX/MATCH only (no XLOOKUP/FILTER/SORT, which the
verifying LibreOffice cannot evaluate); blue for inputs, black for formulas,
yellow fill for cells the seller fills in; a legend and one example row; zero
formula errors after recalc.

Run:  python3 scripts/market-pipeline-xlsx.py
Out:  docs/market/barcelona/BARCELONA-PIPELINE.xlsx
"""
import json
import re
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/market/barcelona"
OUT = Path(__import__("os").environ.get("MARKET_XLSX_OUT") or (SRC / "BARCELONA-PIPELINE.xlsx"))
TODAY = date(2026, 9, 13)

# ----------------------------------------------------------------- palette
GREEN = "2E4A27"
GREEN_LIGHT = "48733C"
PAPER = "F6F6F4"
LINE = "D8D8D4"
YELLOW = "FFF2CC"  # cells the seller fills in
BLUE = "0000FF"  # hardcoded inputs / levers
TIER_FILL = {"A": "C6E0B4", "B": "E2EFDA", "C": "FFE699", "D": "E7E6E6"}

F_BASE = Font(name="Arial", size=10)
F_BOLD = Font(name="Arial", size=10, bold=True)
F_HEAD = Font(name="Arial", size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name="Arial", size=16, bold=True, color=GREEN)
F_SUB = Font(name="Arial", size=11, bold=True, color=GREEN_LIGHT)
F_INPUT = Font(name="Arial", size=10, color=BLUE)
F_NOTE = Font(name="Arial", size=9, italic=True, color="6B6B6B")
FILL_HEAD = PatternFill("solid", fgColor=GREEN)
FILL_SUB = PatternFill("solid", fgColor=GREEN_LIGHT)
FILL_YELLOW = PatternFill("solid", fgColor=YELLOW)
FILL_PAPER = PatternFill("solid", fgColor=PAPER)
THIN = Side(style="thin", color=LINE)
BORDER = Border(bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")


# ----------------------------------------------------------------- parsing
def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def md_tables(text):
    """Every pipe table in `text`, each as a list of dict rows keyed by header."""
    out, lines, i = [], text.split("\n"), 0
    while i < len(lines):
        if lines[i].lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            head = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                cells += [""] * (len(head) - len(cells))
                rows.append(dict(zip(head, cells)))
                i += 1
            out.append((head, rows))
        else:
            i += 1
    return out


def section(text, heading_regex, until_regex=r"^## "):
    """The body of the first heading matching `heading_regex`, up to the next heading matching `until_regex`."""
    lines = text.split("\n")
    start = next((k for k, l in enumerate(lines) if re.match(heading_regex, l)), None)
    if start is None:
        return ""
    end = next((k for k in range(start + 1, len(lines)) if re.match(until_regex, lines[k])), len(lines))
    return "\n".join(lines[start + 1 : end])


def unmd(s):
    """Strip inline markdown for a cell."""
    s = re.sub(r"`([^`]*)`", r"\1", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"(?<!\w)\*([^*]+)\*(?!\w)", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    return s.replace("\\|", "|").strip()


def norm_name(s):
    s = (s or "").lower()
    s = re.sub(r"[àáâä]", "a", s); s = re.sub(r"[èéêë]", "e", s); s = re.sub(r"[ìíîï]", "i", s)
    s = re.sub(r"[òóôö]", "o", s); s = re.sub(r"[ùúûü]", "u", s); s = s.replace("ç", "c").replace("ñ", "n")
    s = re.sub(r"\b(s\.?l\.?u?\.?|s\.?a\.?|s\.?c\.?p\.?|s\.?c\.?c\.?l\.?|sl|slu|sa|scp)\b", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


CNAE_LABEL = {
    "4101": "Construction of buildings (developer-builder)", "4110": "Real-estate development",
    "4121": "Construction of residential buildings", "4122": "Construction of non-residential buildings",
    "4311": "Demolition", "4312": "Site preparation", "4321": "Electrical installation",
    "4322": "Plumbing, heating and air-conditioning", "4329": "Other construction installation",
    "4331": "Plastering", "4332": "Joinery installation", "4333": "Floor and wall covering",
    "4334": "Painting and glazing", "4339": "Other building completion and finishing",
    "4391": "Roofing", "4399": "Other specialised construction activities",
}


def cnae_label(c):
    c = re.sub(r"\D", "", c or "")
    return CNAE_LABEL.get(c[:4], CNAE_LABEL.get(c[:2] + "xx", "Division 43 — specialised construction" if c.startswith("43") else ("Division 41 — building construction" if c.startswith("41") else "")))


# ---- 04 prospects + 04b contacts
prospects = [json.loads(l) for l in read("04-PROSPECTS.jsonl").splitlines() if l.strip()]
contacts = {}
if (SRC / "04b-CONTACTS.jsonl").exists():
    for l in read("04b-CONTACTS.jsonl").splitlines():
        if l.strip():
            c = json.loads(l)
            contacts[c.get("nif") or norm_name(c.get("legal_name"))] = c
            contacts[norm_name(c.get("legal_name"))] = c

# ---- 05 scoring tables (the three "Rows" tables), Tier A/B/C/D detail
t05 = read("05-TARGET-LIST.md")
scored = []
for head, rows in md_tables(section(t05, r"^## Scoring table")):
    if "Legal name" in head and "Tier" in head:
        for r in rows:
            scored.append({k: unmd(v) for k, v in r.items()})
if len(scored) < 100:
    raise SystemExit(f"PARSE GAP: only {len(scored)} scored rows found in 05 (expected 128)")

tierA = {}
for m in re.finditer(r"^### \d+\. (.+?) — row (\d+), (.+?) — NIF (\S+) — CNAE (\S+) — Total ([\d.]+) \((\w+)\)\n(.*?)(?=^### |\Z)", section(t05, r"^## Tier A", r"^## Tier B"), re.S | re.M):
    body = m.group(8)
    pick = lambda label: unmd(re.search(r"\*\*" + label + r"\*\*\s*(.+?)(?=\n\n\*\*|\Z)", body, re.S).group(1).replace("\n", " ")) if re.search(r"\*\*" + label + r"\*\*", body) else ""
    tierA[m.group(4)] = {
        "row": int(m.group(2)), "why": pick(r"Why citable\."),
        "confirm": pick(r"The fact that would confirm or demote\."),
        "lose": pick(r"Single most likely reason we lose them\."),
    }
tierB = {}
for head, rows in md_tables(section(t05, r"^## Tier B", r"^## Tier C")):
    if "Legal name" in head:
        for r in rows:
            key = unmd(r.get("NIF", "")) if unmd(r.get("NIF", "")) not in ("", "—") else norm_name(unmd(r["Legal name"]))
            tierB[key] = unmd(next((v for k, v in r.items() if "lose" in k.lower()), ""))
tierC = {}
for m in re.finditer(r"^### (Pack \d+ — .+?)\n(.*?)(?=^### |\Z)", section(t05, r"^## Tier C", r"^## Tier D"), re.S | re.M):
    for f in re.finditer(r"`([^`]+)` \(row (\d+)", m.group(2)):
        tierC[int(f.group(2))] = unmd(m.group(1))
tierD = {}
for para in section(t05, r"^## Tier D", r"^## CLV").split("\n\n"):
    label = re.match(r"\*\*([^*:]+?)(?: \(\d+[^)]*\))?[:.]", para.strip())
    if label:
        for f in re.finditer(r"`([^`]+)` \(row (\d+)\)|row (\d+)", para):
            rn = f.group(2) or f.group(3)
            if rn:
                tierD.setdefault(int(rn), unmd(label.group(1)))

# ---- 06 pricing, 08 stages/objections/MEDDPICC, 03 triggers, 09 scripts, 10 term sheet, 12 falsification
t06 = read("06-VALUE-CASE.md")
pricing_rows = next((rows for head, rows in md_tables(section(t06, r"^## 5\. PRICING HYPOTHESIS BY SEGMENT")) if "Segment" in head), [])
t08 = read("08-GTM-PLAN.md")
gtm_stages = [(unmd(m.group(1)), unmd(m.group(2).replace("\n", " "))) for m in re.finditer(r"^\d+\. \*\*(.+?)\*\*\s*(.+?)(?=^\d+\. \*\*|\n\n\*\*|\Z)", section(t08, r"^## 4 · Sales cycle"), re.S | re.M)]
objections = next((rows for head, rows in md_tables(section(t08, r"^## 6 · Objection")) if any("bjection" in h for h in head)), [])
meddpicc = [(m.group(1), unmd(m.group(2).replace("\n", " "))) for m in re.finditer(r"^\*\*(Metrics|Economic Buyer|Decision Criteria|Decision Process|Paper Process|Identify Pain|Champion|Competition)\.\*\*\s*(.+?)(?=\n\n|\Z)", section(t08, r"^## 3 · Qualification"), re.S | re.M)]
t03 = read("03-TRIGGER-MAP.md")
urgency = []
for m in re.finditer(r"^\*\*(\d+)\. (.+?)\*\*\s*\n(?:Opener:\s*)?(.+?)(?=\n\n|\Z)", section(t03, r"^## Ranking by urgency", r"^## Non-regulatory"), re.S | re.M):
    urgency.append((int(m.group(1)), unmd(m.group(2)), unmd(m.group(3).replace("\n", " ")).strip("_ ")))
nonreg = next((rows for head, rows in md_tables(section(t03, r"^## Non-regulatory")) if "Trigger" in head), [])
t09 = read("09-OUTREACH-KIT.md")
scripts = []  # (asset, language, text) — one entry per fenced block under a language heading
asset, lang, buf = None, None, None
for line in t09.split("\n"):
    h2 = re.match(r"^## (\d+) · (.+)", line)
    h3 = re.match(r"^#{3,4} (.+)", line)
    if buf is not None:  # inside a fenced block
        if line.startswith("```"):
            scripts.append((asset, lang, buf.strip())); buf = None
        else:
            buf += line + "\n"
    elif h2:
        asset = unmd(h2.group(2)); lang = None
    elif h3:
        t = unmd(h3.group(1))
        if t in ("Castellano", "Català", "English (review)"):
            lang = t
        elif asset and re.match(r"^Follow-up", t):
            asset = "Follow-ups · " + t
    elif line.startswith("```") and asset and lang:
        buf = ""
scripts = [(a, l, t) for a, l, t in scripts if t and l != "English (review)"]
do_not_send = [unmd(m.group(1).replace("\n", " ")) for m in re.finditer(r"^\d+\. (.+?)(?=^\d+\. |\Z)", section(t09, r"^## Do not send until"), re.S | re.M)]
claims = next((rows for head, rows in md_tables(section(t09, r"^## Claims register")) if any("Claim" in h for h in head)), [])
t10 = read("10-PILOT-SPEC.md")
term_sheet = next((rows for head, rows in md_tables(section(t10, r"^## Pilot agreement")) if "Term" in head), [])
t12 = read("12-SYNTHESIS.md")
falsification = [unmd((m.group(1) + " " + m.group(2)).replace("\n", " ")) for m in re.finditer(r"^\*\*\d+\. (.+?)\*\*\s*(.+?)(?=\n\n|\Z)", section(t12, r"^## Falsification"), re.S | re.M)]

# ----------------------------------------------------------------- join firms
by_nif = {p["nif"]: p for p in prospects if p.get("nif")}
by_name = {norm_name(p["legal_name"]): p for p in prospects}
TIER_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3}
firms = []
for s in scored:
    nif = s.get("NIF", "") if s.get("NIF", "") not in ("", "—") else ""
    p = by_nif.get(nif) or by_name.get(norm_name(s["Legal name"])) or {}
    rown = int(re.sub(r"\D", "", s.get("#", "0")) or 0)
    tier = (s.get("Tier") or "D").strip()[:1].upper()
    if tier not in TIER_ORDER:
        tier = "D"
    layer = s.get("Layer estimate (driving requirement)", "")
    lm = re.match(r"(L\d(?:[–-]L\d)?)\s*(?:\((.*)\))?", layer)
    a = tierA.get(nif, {})
    c = contacts.get(nif) or contacts.get(norm_name(s["Legal name"])) or {}
    form = s.get("Legal form", "")
    cn = re.sub(r"\D", "", s.get("CNAE", ""))
    if tier in ("A", "B"):
        seg = "S2" if cn.startswith("41") else ("S3" if not re.search(r"S\.?L", form, re.I) else "S1")
    else:
        seg = ""
    lose = a.get("lose") or tierB.get(nif) or tierB.get(norm_name(s["Legal name"])) or (("Investment case — " + tierC[rown]) if rown in tierC else "") or (("Declined — " + tierD[rown]) if rown in tierD else "")
    try:
        total = float(s.get("Total", "") or 0)
    except ValueError:
        total = 0.0
    firms.append({
        "row": rown, "tier": tier, "seg": seg, "legal": s["Legal name"], "trade": p.get("trade_name") or "",
        "nif": nif, "cnae": cn, "cnae_label": cnae_label(cn), "form": form, "muni": p.get("municipality") or "",
        "prov": p.get("province") or "Barcelona", "total": total, "conf": s.get("Conf.", ""),
        "layer": lm.group(1) if lm else layer, "driver": (lm.group(2) if lm and lm.group(2) else ""),
        "triggers": s.get("Detected triggers", ""), "rationale": s.get("Rationale", ""),
        "why": a.get("why", ""), "confirm": a.get("confirm", ""), "lose": lose,
        "phone": c.get("phone") or p.get("phone") or "", "email": c.get("email") or p.get("email") or "",
        "web": c.get("website") or p.get("website") or "", "form_url": c.get("contact_form_url") or "",
        "linkedin": c.get("linkedin_company_url") or "", "person": c.get("contact_person_published") or "",
        "maps": c.get("maps_rating") if c.get("maps_rating") is not None else "",
        "sources": ", ".join(sorted(set([u for u in (p.get("source_urls") or [])] + [v for k, v in c.items() if k.endswith("_source") and v]))),
    })
firms.sort(key=lambda f: (TIER_ORDER[f["tier"]], -f["total"], f["legal"].lower()))
for i, f in enumerate(firms, 1):
    f["rank"] = i
N = len(firms)
FIRST, LAST = 2, N + 1  # Pipeline data rows

# ----------------------------------------------------------------- workbook
wb = Workbook()
wb.remove(wb.active)


def sheet(name):
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    return ws


def style_range(ws, cell_range, font=F_BASE, fill=None, align=None, border=None):
    for row in ws[cell_range]:
        for c in row:
            c.font = font
            if fill: c.fill = fill
            if align: c.alignment = align
            if border: c.border = border


def header_row(ws, r, headers, widths=None):
    for j, h in enumerate(headers, 1):
        c = ws.cell(row=r, column=j, value=h)
        c.font, c.fill, c.alignment = F_HEAD, FILL_HEAD, Alignment(wrap_text=True, vertical="center")
        if widths: ws.column_dimensions[get_column_letter(j)].width = widths[j - 1]
    ws.row_dimensions[r].height = 30


def title(ws, text, sub=None):
    ws["A1"] = text; ws["A1"].font = F_TITLE
    if sub:
        ws["A2"] = sub; ws["A2"].font = F_NOTE


# ---- Lists (hidden) — dropdown sources
STAGES = [
    # stage, objective, what to do (next action), script/asset, exit criterion, typical duration, probability, next stage, MEDDPICC check
    ("Not started", "Nothing done yet", "Read the row: tier, segment, trigger, reason we lose them. Check contact coverage; if 0, enrich before anything else.", "—", "Row read and a contact channel exists", "—", 0.00, "Research", "—"),
    ("Research", "Know one verifiable thing about their business", "Find a live site or permit, the owner's name if the FIRM publishes it, and which trigger applies. Fill Contact person, Preferred language and Trigger observed.", "Triggers sheet", "One verifiable, specific fact about their current work recorded in Notes", "1 day", 0.02, "Cold call", "Identify Pain — which opener fits"),
    ("Cold call", "Earn 30 minutes on site", "Call the published number. Open with the trigger's one-sentence opener. Ask for the person who prepares the quarterly close. Aim for a site visit, not a demo.", "Scripts · 90-second pitch", "Prospect recognises the named pain as their own, or a visit is booked", "1–3 attempts over 5 days", 0.05, "First-touch email", "Identify Pain · Economic Buyer named"),
    ("First-touch email", "Same ask, in writing, in their language", "Send the first-touch email (ES or CA) with every merge field verified. Log it. Set Next action due = +4 days.", "Scripts · First-touch email", "Sent with no square-bracketed field left, logged", "same day", 0.05, "Follow-up 1", "—"),
    ("Follow-up 1", "Second angle — the 2027 invoicing obligation", "Send Follow-up A. Try one more call at a different hour.", "Scripts · Follow-up A", "Reply, call taken, or 2 touches logged", "+4 days", 0.08, "Follow-up 2", "Identify Pain"),
    ("Follow-up 2", "Third angle — the quarter and the gestoría", "Send Follow-up B. If no reply after this, set Stage to Lost with reason 'no response' and revisit in 90 days.", "Scripts · Follow-up B", "Reply or meeting, else Lost", "+5 days", 0.08, "Meeting booked", "Champion — is there an admin person?"),
    ("Meeting booked", "A date on site with the owner(s)", "Confirm date, place and who attends — both owners if operations and administration are split. Prepare the three qualifying questions.", "Playbook · MEDDPICC checklist", "Date, place and attendees confirmed in writing", "≤ 7 days out", 0.15, "Meeting held", "Economic Buyer (both) · Decision Process"),
    ("Meeting held", "Qualify — hard gates answered", "Run the qualifying questions: revenue mix, incumbent ledger, public-work exposure, bank, legal form, both Economic Buyers. Ask for one closed job's papers for the demo.", "Objections sheet · Leave-behind", "Hard-gate checklist answered; one closed job's documents obtained", "1 meeting", 0.25, "Demo on their data", "Metrics · Decision Criteria · Competition"),
    ("Demo on their data", "Their name on a real document", "Build a quotation, contract and invoice bearing their firm's name, NIF and a sample of their catalogue. Costs 8–16 engineering hours today (07 §4) — book it, do not improvise.", "Pricing & Pilot sheet", "Both Economic Buyers have seen a document with their own name and figures", "1–2 weeks incl. build", 0.40, "Pilot proposed", "Metrics — their numbers, not ours"),
    ("Pilot proposed", "Term sheet on the table", "Present the 90-day pilot: €900, three metrics on their numbers, baseline before install, kill criteria, processor agreement. Leave the term sheet.", "Pricing & Pilot · Term sheet", "Term sheet delivered; processor agreement drafted", "1 week", 0.55, "Pilot running", "Paper Process — art. 28 agreement"),
    ("Pilot running", "Ninety days, measured", "Capture the three baselines BEFORE install. Weekly check-in. Watch the kill criteria. Max two pilots at once, each on its own stack.", "Pricing & Pilot · Term sheet", "Day-24 smoke test passed; metrics moving by day 75", "90 days", 0.75, "Customer", "Champion — the admin person is using it"),
    ("Customer", "Paid, first quarter closed in the product", "Convert to per-segment pricing. Ask for the reference (consent in writing). Log the CLV inputs.", "—", "First quarterly filing assembled from the product", "—", 1.00, "—", "—"),
    ("Lost", "Closed — no", "Record the reason in Notes (no response / price / timing / gestoría alternative). Set a 90-day revisit date in Next action due.", "—", "Reason recorded", "—", 0.00, "—", "—"),
    ("Not a fit", "Declined by us", "Say so plainly and kindly. Record which disqualifier applied (Objections 3, 9 or 11 usually).", "Objections sheet", "Disqualifier recorded", "—", 0.00, "—", "—"),
]
OWNERS = ["Operator", "Sales", "Engineering lead"]
LANGS = ["ES", "CA"]
ACT_TYPES = ["Call", "Email", "LinkedIn", "Meeting", "Demo", "Proposal", "Other"]

# ============================================================ README
ws = sheet("README")
title(ws, "Barcelona pipeline — how to use this workbook", f"Generated {TODAY.isoformat()} from docs/market/barcelona/. Rebuild with: python3 scripts/market-pipeline-xlsx.py")
ws.column_dimensions["A"].width = 26; ws.column_dimensions["B"].width = 110
rows = [
    ("What this is", f"{N} construction and renovation firms in the Barcelona area, scored and tiered by the roadmap (05-TARGET-LIST.md), with their contact channels, ordered by priority, and a guided sales process from first call to customer. Everything a seller needs is in this one file."),
    ("Start here", "1 · Pipeline sheet, filter Focus = Yes (Tier A and B, 37 firms). 2 · Sort by Priority rank. 3 · For each firm read Next action and Script to use — they change with the Stage. 4 · Log every touch in Activity Log. 5 · Move Stage only when the Exit criterion in Playbook is met. 6 · Dashboard shows where the week stands."),
    ("Colour legend", "YELLOW fill = you fill this in (tracking columns). BLUE text = an input or lever you may change (probabilities, prices). BLACK text = a formula — do not overwrite. Tier colours: A green · B light green · C amber (investment case, not to contact now) · D grey (do not contact, reason given)."),
    ("Data caveat 1 — contacts", "Contact channels are only those the firm PUBLISHES (website, Google listing, marketplace profile, registry). Where a cell is blank, nothing was found by search — do not guess; enrich from SABI/eInforma or a call to the switchboard, then fill it in. Contact coverage per row and for Tier A+B is on the Dashboard."),
    ("Data caveat 2 — scores", "Every score is capped at 63.6/100: three of five rubric dimensions could not be observed from public data (04-EXTRACTION-QA.md). Tiering is relative, not absolute. The 'Fact that confirms or demotes' column says what a first call must establish. Municipality was wrong in 30.8% of the audited sample — verify it before you drive there."),
    ("Data protection", "Company-level, published contacts only. Do not add personal mobiles or personal email addresses. Legal basis is legitimate interest for B2B prospecting on published business data (04a-SOURCE-PLAN.md); anyone who objects is marked Lost with reason 'objected' and never contacted again. Before a pilot, the art. 28 processor agreement in Pricing & Pilot must be signed."),
    ("What the product cannot promise yet", "It is NOT fully Verifactu-compliant on day one (Objection 9). Never say it is. The deadline for an S.L. is 1 January 2027 (03-TRIGGER-MAP.md §1) — re-check on the day of sending."),
    ("A demo on their data", "Costs 8–16 engineering hours today (07-TAILORING-ECONOMICS.md §4) and two customers cannot yet share one stack. Book engineering before promising a demo; run at most two pilots at once."),
    ("Sheets", "Dashboard · Pipeline (the list + tracker) · Playbook (stages, what to do, exit criteria, MEDDPICC) · Scripts (ES/CA copy) · Objections · Triggers (openers) · Pricing & Pilot · Activity Log · Lists (hidden dropdowns)."),
    ("Sources", "05-TARGET-LIST.md (tiers, scores, reasons) · 04-PROSPECTS.jsonl + 04b-CONTACTS.jsonl (firms, contacts) · 06-VALUE-CASE.md (pricing) · 08-GTM-PLAN.md (stages, objections, MEDDPICC) · 09-OUTREACH-KIT.md (scripts) · 03-TRIGGER-MAP.md (openers) · 10-PILOT-SPEC.md (term sheet) · 12-SYNTHESIS.md (stop conditions)."),
]
for k, (a, b) in enumerate(rows, 4):
    ws.cell(row=k, column=1, value=a).font = F_BOLD
    ws.cell(row=k, column=1).alignment = TOP
    c = ws.cell(row=k, column=2, value=b); c.font = F_BASE; c.alignment = WRAP
    ws.row_dimensions[k].height = max(30, 15 * (len(b) // 105 + 1))
# Legend swatches
ws.cell(row=15, column=1, value="Swatches").font = F_BOLD
ws.cell(row=15, column=2, value="You fill in").fill = FILL_YELLOW
ws.cell(row=16, column=2, value="Input / lever (blue)").font = F_INPUT
for k, t in enumerate("ABCD"):
    c = ws.cell(row=17 + k, column=2, value=f"Tier {t}"); c.fill = PatternFill("solid", fgColor=TIER_FILL[t]); c.font = F_BASE

# ============================================================ Lists (hidden)
wl = sheet("Lists")
for j, (h, vals) in enumerate([("Stage", [s[0] for s in STAGES]), ("Owner", OWNERS), ("Language", LANGS), ("Activity type", ACT_TYPES), ("Tier", list("ABCD")), ("Segment", ["S1", "S2", "S3"])], 1):
    wl.cell(row=1, column=j, value=h).font = F_BOLD
    for k, v in enumerate(vals, 2):
        wl.cell(row=k, column=j, value=v).font = F_BASE
wl.sheet_state = "hidden"

# ============================================================ Playbook
wp = sheet("Playbook")
title(wp, "Playbook — the selling process, stage by stage", "Pipeline's Next action, Script to use, Exit criterion and Probability are looked up from this table by Stage. Probabilities (blue) are assumptions — change them here, never in Pipeline.")
PB_HEAD = ["Stage", "Objective", "What to do (Next action)", "Script / asset to use", "Exit criterion — move on only when", "Typical duration", "Probability", "Next stage", "MEDDPICC check"]
header_row(wp, 3, PB_HEAD, [18, 26, 60, 26, 44, 16, 11, 18, 30])
for k, s in enumerate(STAGES, 4):
    for j, v in enumerate(s, 1):
        c = wp.cell(row=k, column=j, value=v); c.font = F_INPUT if j == 7 else F_BASE; c.alignment = WRAP; c.border = BORDER
        if j == 7: c.number_format = "0%"
    wp.row_dimensions[k].height = 62
PB_FIRST, PB_LAST = 4, 3 + len(STAGES)
wp.freeze_panes = "B4"
r = PB_LAST + 2
wp.cell(row=r, column=1, value="Exit criteria as written in the go-to-market plan (08-GTM-PLAN.md §4)").font = F_SUB; r += 1
header_row(wp, r, ["#", "Stage in the plan", "Exit criterion and moving artefact"], None); r += 1
for k, (t, body) in enumerate(gtm_stages, 1):
    wp.cell(row=r, column=1, value=k).font = F_BASE
    wp.cell(row=r, column=2, value=t).font = F_BOLD; wp.cell(row=r, column=2).alignment = WRAP
    c = wp.cell(row=r, column=3, value=body); c.font = F_BASE; c.alignment = WRAP
    wp.merge_cells(start_row=r, start_column=3, end_row=r, end_column=9)
    wp.row_dimensions[r].height = min(160, 15 * (len(body) // 150 + 1)); r += 1
r += 1
wp.cell(row=r, column=1, value="Qualification — MEDDPICC adapted to the owner-manager (08-GTM-PLAN.md §3)").font = F_SUB; r += 1
header_row(wp, r, ["Letter", "How it applies to this buyer"], None); r += 1
for letter, body in meddpicc:
    wp.cell(row=r, column=1, value=letter).font = F_BOLD; wp.cell(row=r, column=1).alignment = WRAP
    c = wp.cell(row=r, column=2, value=body); c.font = F_BASE; c.alignment = WRAP
    wp.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
    wp.row_dimensions[r].height = min(170, 15 * (len(body) // 160 + 1)); r += 1

# ============================================================ Pricing & Pilot
wq = sheet("Pricing & Pilot")
title(wq, "Pricing by segment, and the pilot term sheet", "Pipeline's ACV is looked up here by Segment. Figures are the value case's hypotheses (06-VALUE-CASE.md §5) — blue, editable.")
PRICING = [  # code, name, model, annual ACV, monthly, onboarding fee, payback, source
    ("S1", "Finishing and completion trades (CNAE 43.3x/43.9x, S.L.)", "Flat per legal entity, banded by headcount", 3600, 300, 1200, "6 months (central), 10 (slow)", "06-VALUE-CASE.md §1.7, §5"),
    ("S2", "Renovation-led general building contractors (division 41, S.L.)", "Per active site: €60/site/month, floor €400, cap €900", 6480, 540, 1200, "5 months (central), 8 (slow)", "06-VALUE-CASE.md §2.7, §5"),
    ("S3", "Owner-partner micro-contractors (non-S.L. forms)", "Flat per legal entity, 8-hour onboarding cap", 2160, 180, 1200, "8 months (central), 12 (slow) — conceded below 4 simultaneous jobs", "06-VALUE-CASE.md §3.7, §5"),
]
header_row(wq, 3, ["Segment", "Who", "Pricing model", "Annual ACV (€)", "Monthly (€)", "Onboarding fee (€)", "Payback", "Source"], [10, 44, 40, 14, 12, 16, 34, 26])
for k, p in enumerate(PRICING, 4):
    for j, v in enumerate(p, 1):
        c = wq.cell(row=k, column=j, value=v); c.alignment = WRAP; c.border = BORDER
        c.font = F_INPUT if j in (4, 5, 6) else F_BASE
        if j in (4, 5, 6): c.number_format = "€#,##0"
    wq.row_dimensions[k].height = 45
PR_FIRST, PR_LAST = 4, 6
r = 8
wq.cell(row=r, column=1, value="Pricing hypothesis by segment — as written in the value case").font = F_SUB; r += 1
if pricing_rows:
    heads = list(pricing_rows[0].keys())
    header_row(wq, r, heads, None); r += 1
    for row in pricing_rows:
        for j, h in enumerate(heads, 1):
            c = wq.cell(row=r, column=j, value=unmd(row[h])); c.font = F_BASE; c.alignment = WRAP
        wq.row_dimensions[r].height = 75; r += 1
r += 1
wq.cell(row=r, column=1, value="Pilot term sheet (10-PILOT-SPEC.md) — 90 days · €900 · two pilots at once, each on its own stack").font = F_SUB; r += 1
header_row(wq, r, ["Term", "Value"], None); r += 1
for row in term_sheet:
    wq.cell(row=r, column=1, value=unmd(row.get("Term", ""))).font = F_BOLD; wq.cell(row=r, column=1).alignment = WRAP
    c = wq.cell(row=r, column=2, value=unmd(row.get("Value", ""))); c.font = F_BASE; c.alignment = WRAP
    wq.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
    wq.row_dimensions[r].height = min(120, 15 * (len(row.get("Value", "")) // 140 + 1)); r += 1

# ============================================================ Pipeline
wsP = sheet("Pipeline")
COLS = [  # key, header, width, kind ('data'|'fill'|'formula')
    ("rank", "Priority rank", 8, "data"), ("tier", "Tier", 6, "data"), ("focus", "Focus", 7, "formula"), ("seg", "Segment", 9, "data"),
    ("legal", "Legal name", 34, "data"), ("trade", "Trade name", 22, "data"), ("nif", "NIF", 11, "data"), ("cnae", "CNAE", 7, "data"),
    ("cnae_label", "CNAE label", 26, "data"), ("form", "Legal form", 9, "data"), ("muni", "Municipality (verify)", 20, "data"), ("prov", "Province", 10, "data"),
    ("total", "Total score", 8, "data"), ("conf", "Confidence", 10, "data"), ("layer", "Layer", 8, "data"), ("driver", "Driving requirement", 30, "data"),
    ("triggers", "Detected triggers", 30, "data"), ("rationale", "Rationale", 40, "data"), ("why", "Why citable (Tier A)", 40, "data"),
    ("confirm", "Fact that confirms or demotes", 40, "data"), ("lose", "Reason we lose them", 40, "data"),
    ("phone", "Phone", 14, "data"), ("email", "Email", 26, "data"), ("web", "Website", 26, "data"), ("form_url", "Contact form", 26, "data"),
    ("linkedin", "LinkedIn (company)", 26, "data"), ("person", "Contact person (published)", 22, "data"), ("maps", "Maps rating", 8, "data"),
    ("sources", "Source URLs", 40, "data"), ("coverage", "Contact coverage", 9, "formula"),
    ("owner", "Owner", 12, "fill"), ("stage", "Stage", 16, "fill"), ("stage_date", "Stage date", 11, "fill"), ("cperson", "Contact person", 18, "fill"),
    ("role", "Role", 14, "fill"), ("lang", "Preferred language", 9, "fill"), ("trig_obs", "Trigger observed", 22, "fill"), ("last", "Last contact", 11, "fill"),
    ("due", "Next action due", 11, "fill"), ("notes", "Notes", 40, "fill"),
    ("next", "Next action", 44, "formula"), ("script", "Script to use", 22, "formula"), ("exit", "Exit criterion", 36, "formula"),
    ("prob", "Probability", 9, "formula"), ("acv", "ACV (€)", 10, "formula"), ("weighted", "Weighted (€)", 11, "formula"),
    ("days", "Days since last contact", 9, "formula"), ("overdue", "Overdue", 9, "formula"), ("light", "Status", 8, "formula"),
]
L = {key: get_column_letter(j) for j, (key, *_r) in enumerate(COLS, 1)}
header_row(wsP, 1, [h for _, h, *_r in COLS], [w for _, _, w, _ in COLS])
for j, (key, h, w, kind) in enumerate(COLS, 1):
    if kind == "fill":
        wsP.cell(row=1, column=j).fill = PatternFill("solid", fgColor="7F6000")
    elif kind == "formula":
        wsP.cell(row=1, column=j).fill = PatternFill("solid", fgColor="1F3864")
wsP.cell(row=1, column=list(L).index("muni") + 1).comment = Comment("Municipality was wrong in 30.8% of the audited sample (04-EXTRACTION-QA.md). Verify before relying on it.", "roadmap")
wsP.cell(row=1, column=list(L).index("total") + 1).comment = Comment("Capped at 63.6: three rubric dimensions could not be observed from public data. Relative ranking, not absolute.", "roadmap")
wsP.cell(row=1, column=list(L).index("phone") + 1).comment = Comment("Published business contacts only. Blank = not found by search; enrich, do not guess.", "roadmap")

PB = f"Playbook!$A${PB_FIRST}:$A${PB_LAST}"
def pb(col): return f"Playbook!${col}${PB_FIRST}:${col}${PB_LAST}"
for i, f in enumerate(firms):
    r = FIRST + i
    for key, h, w, kind in COLS:
        col = L[key]
        cell = wsP[f"{col}{r}"]
        if kind == "data":
            v = f.get(key, "")
            cell.value = v if v != "" else None
            cell.font = F_BASE
        elif kind == "fill":
            cell.fill = FILL_YELLOW; cell.font = F_BASE
            if key == "stage": cell.value = "Not started"
            if key in ("stage_date", "last", "due"): cell.number_format = "dd/mm/yyyy"
        else:
            cell.font = F_BASE
        cell.alignment = WRAP if key in ("driver", "triggers", "rationale", "why", "confirm", "lose", "sources", "notes", "next", "exit", "cnae_label") else TOP
    S = f"${L['stage']}{r}"
    wsP[f"{L['focus']}{r}"] = f'=IF(OR({L["tier"]}{r}="A",{L["tier"]}{r}="B"),"Yes","No")'
    wsP[f"{L['coverage']}{r}"] = f"=COUNTA({L['phone']}{r}:{L['person']}{r})"
    wsP[f"{L['next']}{r}"] = f'=IFERROR(INDEX({pb("C")},MATCH({S},{PB},0)),"")'
    wsP[f"{L['script']}{r}"] = f'=IFERROR(INDEX({pb("D")},MATCH({S},{PB},0)),"")'
    wsP[f"{L['exit']}{r}"] = f'=IFERROR(INDEX({pb("E")},MATCH({S},{PB},0)),"")'
    wsP[f"{L['prob']}{r}"] = f'=IFERROR(INDEX({pb("G")},MATCH({S},{PB},0)),0)'
    wsP[f"{L['prob']}{r}"].number_format = "0%"
    wsP[f"{L['acv']}{r}"] = f"=IFERROR(INDEX('Pricing & Pilot'!$D${PR_FIRST}:$D${PR_LAST},MATCH(${L['seg']}{r},'Pricing & Pilot'!$A${PR_FIRST}:$A${PR_LAST},0)),0)"
    wsP[f"{L['acv']}{r}"].number_format = "€#,##0"
    wsP[f"{L['weighted']}{r}"] = f"={L['acv']}{r}*{L['prob']}{r}"
    wsP[f"{L['weighted']}{r}"].number_format = "€#,##0"
    wsP[f"{L['days']}{r}"] = f'=IF({L["last"]}{r}="","",TODAY()-{L["last"]}{r})'
    wsP[f"{L['overdue']}{r}"] = f'=IF({L["due"]}{r}="","",IF(AND({L["due"]}{r}<TODAY(),{S}<>"Customer",{S}<>"Lost",{S}<>"Not a fit"),"OVERDUE",""))'
    wsP[f"{L['light']}{r}"] = f'=IF({L["overdue"]}{r}="OVERDUE","RED",IF({S}="Not started","—",IF({S}="Customer","GREEN",IF(OR({S}="Lost",{S}="Not a fit"),"CLOSED","AMBER"))))'
    wsP[f"{L['total']}{r}"].number_format = "0.0"
    wsP[f"{L['tier']}{r}"].fill = PatternFill("solid", fgColor=TIER_FILL[f["tier"]])
    wsP[f"{L['tier']}{r}"].font = F_BOLD
    wsP.row_dimensions[r].height = 48
wsP.freeze_panes = f"{L['trade']}2"
wsP.auto_filter.ref = f"A1:{L['light']}{LAST}"
# data validation
def dv(list_col, n, target_col):
    d = DataValidation(type="list", formula1=f"=Lists!${list_col}$2:${list_col}${n + 1}", allow_blank=True)
    wsP.add_data_validation(d); d.add(f"{L[target_col]}{FIRST}:{L[target_col]}{LAST}")
dv("A", len(STAGES), "stage"); dv("B", len(OWNERS), "owner"); dv("C", len(LANGS), "lang")
for key in ("stage_date", "last", "due"):
    d = DataValidation(type="date", allow_blank=True); wsP.add_data_validation(d); d.add(f"{L[key]}{FIRST}:{L[key]}{LAST}")
# conditional formatting
full = f"A{FIRST}:{L['light']}{LAST}"
wsP.conditional_formatting.add(full, FormulaRule(formula=[f'${L["overdue"]}{FIRST}="OVERDUE"'], fill=PatternFill("solid", fgColor="F8CBAD"), stopIfTrue=False))
wsP.conditional_formatting.add(full, FormulaRule(formula=[f'${L["focus"]}{FIRST}="No"'], font=Font(name="Arial", size=10, color="8C8C8C")))
stage_col = f"{L['stage']}{FIRST}:{L['stage']}{LAST}"
for val, color in [("Customer", "C6E0B4"), ("Pilot running", "A9D08E"), ("Demo on their data", "FFE699"), ("Lost", "D9D9D9"), ("Not a fit", "D9D9D9")]:
    wsP.conditional_formatting.add(stage_col, CellIsRule(operator="equal", formula=[f'"{val}"'], fill=PatternFill("solid", fgColor=color)))
wsP.conditional_formatting.add(f"{L['coverage']}{FIRST}:{L['coverage']}{LAST}", CellIsRule(operator="equal", formula=["0"], fill=PatternFill("solid", fgColor="F8CBAD")))

# ============================================================ Activity Log
wa = sheet("Activity Log")
title(wa, "Activity log — every touch, in one place", "Dashboard counts touches from here. Row 4 is an example: overwrite it.")
header_row(wa, 3, ["Date", "Firm", "Type", "Outcome", "Next step", "Owner"], [12, 40, 12, 50, 40, 14])
AL_LAST = 600
for r in range(4, AL_LAST + 1):
    for j in range(1, 7):
        c = wa.cell(row=r, column=j); c.fill = FILL_YELLOW; c.font = F_BASE; c.alignment = WRAP
    wa.cell(row=r, column=1).number_format = "dd/mm/yyyy"
example = [date(2026, 9, 1), firms[0]["legal"], "Call", "EXAMPLE ROW — switchboard answered, asked for the person who does the quarterly close, call back Tuesday 10:00", "Call back Tuesday; then first-touch email in CA", "Sales"]
for j, v in enumerate(example, 1):
    wa.cell(row=4, column=j, value=v).font = F_NOTE
for col, lst, n in [("B", "Pipeline", N), ("C", "Lists", len(ACT_TYPES)), ("F", "Lists", len(OWNERS))]:
    if lst == "Pipeline":
        d = DataValidation(type="list", formula1=f"=Pipeline!${L['legal']}${FIRST}:${L['legal']}${LAST}", allow_blank=True)
    else:
        lcol = "D" if col == "C" else "B"
        d = DataValidation(type="list", formula1=f"=Lists!${lcol}$2:${lcol}${n + 1}", allow_blank=True)
    wa.add_data_validation(d); d.add(f"{col}4:{col}{AL_LAST}")
wa.freeze_panes = "A4"

# ============================================================ Scripts
wsc = sheet("Scripts")
title(wsc, "Scripts — Castellano and Català, side by side", "From 09-OUTREACH-KIT.md. Merge fields in [BRACKETS] must be resolved and verified before sending. Never invent a figure or a testimonial.")
wsc.column_dimensions["A"].width = 30; wsc.column_dimensions["B"].width = 70; wsc.column_dimensions["C"].width = 70
r = 3
wsc.cell(row=r, column=1, value="Do not send until").font = F_SUB; r += 1
for k, t in enumerate(do_not_send, 1):
    wsc.cell(row=r, column=1, value=f"{k}.").font = F_BOLD
    c = wsc.cell(row=r, column=2, value=t); c.font = F_BASE; c.alignment = WRAP; wsc.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
    wsc.row_dimensions[r].height = min(90, 15 * (len(t) // 140 + 1)); r += 1
r += 1
header_row(wsc, r, ["Asset", "Castellano", "Català"], None); r += 1
assets = []
for a, l, t in scripts:
    if a not in assets: assets.append(a)
for a in assets:
    es = next((t for x, l, t in scripts if x == a and l == "Castellano"), "")
    ca = next((t for x, l, t in scripts if x == a and l == "Català"), "")
    wsc.cell(row=r, column=1, value=a).font = F_BOLD; wsc.cell(row=r, column=1).alignment = WRAP
    for j, t in ((2, es), (3, ca)):
        c = wsc.cell(row=r, column=j, value=t); c.font = F_BASE; c.alignment = WRAP
    wsc.row_dimensions[r].height = min(400, 13 * (max(es.count("\n"), ca.count("\n")) + 3 + max(len(es), len(ca)) // 70)); r += 1
r += 1
wsc.cell(row=r, column=1, value="Claims register — what each figure in the copy rests on").font = F_SUB; r += 1
if claims:
    heads = list(claims[0].keys())
    header_row(wsc, r, heads[:3], None); r += 1
    for row in claims:
        for j, h in enumerate(heads[:3], 1):
            c = wsc.cell(row=r, column=j, value=unmd(row[h])); c.font = F_BASE; c.alignment = WRAP
        wsc.row_dimensions[r].height = 45; r += 1

# ============================================================ Objections
wo = sheet("Objections")
title(wo, "The twelve objections, with the honest answer", "From 08-GTM-PLAN.md §6. Three of them mean we are not the right fit — say so.")
heads = list(objections[0].keys()) if objections else ["#", "Objection", "Honest answer"]
widths = [5, 50, 100] + [30] * (len(heads) - 3)
header_row(wo, 3, heads, widths)
for k, row in enumerate(objections, 4):
    for j, h in enumerate(heads, 1):
        c = wo.cell(row=k, column=j, value=unmd(row[h])); c.font = F_BASE; c.alignment = WRAP; c.border = BORDER
        if j == 3 and "not the right fit" in row[h].lower():
            c.fill = PatternFill("solid", fgColor="FCE4D6")
    wo.row_dimensions[k].height = min(180, 15 * (len(row[heads[2]]) // 110 + 1))
wo.freeze_panes = "A4"

# ============================================================ Triggers
wt = sheet("Triggers")
title(wt, "Triggers — why they buy now, and the sentence to open with", "From 03-TRIGGER-MAP.md. Rank 1 is the Verifactu deadline; the opener is the diagnostic question, not a pitch.")
wt.column_dimensions["A"].width = 6; wt.column_dimensions["B"].width = 50; wt.column_dimensions["C"].width = 110
header_row(wt, 3, ["Rank", "Trigger", "Open with"], None)
r = 4
for rank, name, opener in urgency:
    wt.cell(row=r, column=1, value=rank).font = F_BASE
    wt.cell(row=r, column=2, value=name).font = F_BOLD; wt.cell(row=r, column=2).alignment = WRAP
    c = wt.cell(row=r, column=3, value=opener); c.font = F_BASE; c.alignment = WRAP
    wt.row_dimensions[r].height = min(150, 15 * (len(opener) // 120 + 1)); r += 1
r += 1
wt.cell(row=r, column=1, value="Non-regulatory triggers — detectable from outside").font = F_SUB; r += 1
if nonreg:
    heads = list(nonreg[0].keys())
    header_row(wt, r, heads, None); r += 1
    for row in nonreg:
        for j, h in enumerate(heads, 1):
            c = wt.cell(row=r, column=j, value=unmd(row[h])); c.font = F_BASE; c.alignment = WRAP
        wt.row_dimensions[r].height = 90; r += 1

# ============================================================ Dashboard
wd = sheet("Dashboard")
title(wd, "Dashboard — where the pipeline stands", "All formulas. Nothing to type here.")
for col, w in zip("ABCDEFGH", [30, 14, 4, 30, 14, 4, 34, 14]):
    wd.column_dimensions[col].width = w
P = lambda key: f"Pipeline!${L[key]}${FIRST}:${L[key]}${LAST}"
AL = lambda col: f"'Activity Log'!${col}$4:${col}${AL_LAST}"
def kv(r, c, label, formula, fmt=None):
    wd.cell(row=r, column=c, value=label).font = F_BASE
    x = wd.cell(row=r, column=c + 1, value=formula); x.font = F_BOLD; x.alignment = Alignment(horizontal="right")
    if fmt: x.number_format = fmt
wd.cell(row=4, column=1, value="Firms by tier").font = F_SUB
for k, t in enumerate("ABCD", 5):
    kv(k, 1, f"Tier {t}", f'=COUNTIF({P("tier")},"{t}")')
kv(9, 1, "Focus (A + B)", f'=COUNTIF({P("focus")},"Yes")')
kv(10, 1, "Focus firms with NO contact channel", f'=COUNTIFS({P("focus")},"Yes",{P("coverage")},0)')
kv(11, 1, "Focus firms with a phone", f'=COUNTIFS({P("focus")},"Yes",{P("phone")},"<>")')
kv(12, 1, "Focus firms with an email", f'=COUNTIFS({P("focus")},"Yes",{P("email")},"<>")')
kv(13, 1, "Overdue next actions", f'=COUNTIF({P("overdue")},"OVERDUE")')
wd.cell(row=4, column=4, value="Firms by stage").font = F_SUB
for k, s in enumerate(STAGES, 5):
    kv(k, 4, s[0], f'=COUNTIF({P("stage")},"{s[0]}")')
ST_FIRST, ST_LAST = 5, 4 + len(STAGES)
wd.cell(row=4, column=7, value="Value").font = F_SUB
kv(5, 7, "Pipeline ACV, Focus firms (€)", f'=SUMIFS({P("acv")},{P("focus")},"Yes")', "€#,##0")
kv(6, 7, "Weighted pipeline (€)", f'=SUM({P("weighted")})', "€#,##0")
kv(7, 7, "Customers", f'=COUNTIF({P("stage")},"Customer")')
kv(8, 7, "Customer ACV (€)", f'=SUMIFS({P("acv")},{P("stage")},"Customer")', "€#,##0")
wd.cell(row=10, column=7, value="Activity").font = F_SUB
kv(11, 7, "Touches last 7 days", f'=COUNTIFS({AL("A")},">="&(TODAY()-7),{AL("A")},"<="&TODAY())')
kv(12, 7, "Touches last 30 days", f'=COUNTIFS({AL("A")},">="&(TODAY()-30),{AL("A")},"<="&TODAY())')
for k, t in enumerate(ACT_TYPES, 13):
    kv(k, 7, f"  {t}s, all time", f'=COUNTIF({AL("C")},"{t}")')
r = ST_LAST + 2
wd.cell(row=r, column=1, value="Stop conditions (12-SYNTHESIS.md, Falsification) — decided before starting").font = F_SUB; r += 1
header_row(wd, r, ["Condition", "Live proxy", "", "", ""], None); wd.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5); r += 1
proxies = [
    ("A+B firms engaged (Stage past Cold call, not Lost/Not a fit) — threshold: at least 12 of 37", f'=COUNTIFS({P("focus")},"Yes",{P("stage")},"<>Not started",{P("stage")},"<>Research",{P("stage")},"<>Cold call",{P("stage")},"<>Lost",{P("stage")},"<>Not a fit")'),
    ("Pilots running or converted — value case is measured on their data during the pilot", f'=COUNTIF({P("stage")},"Pilot running")+COUNTIF({P("stage")},"Customer")'),
    ("Firms at Demo or beyond — each one costs 8–16 engineering hours to build", f'=COUNTIF({P("stage")},"Demo on their data")+COUNTIF({P("stage")},"Pilot proposed")+COUNTIF({P("stage")},"Pilot running")+COUNTIF({P("stage")},"Customer")'),
]
for k, cond in enumerate(falsification[:3]):
    c = wd.cell(row=r, column=1, value=cond); c.font = F_BASE; c.alignment = WRAP
    wd.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
    label, formula = proxies[k] if k < len(proxies) else ("", "")
    c2 = wd.cell(row=r, column=4, value=label); c2.font = F_NOTE; c2.alignment = WRAP
    x = wd.cell(row=r, column=5, value=formula); x.font = F_BOLD
    wd.row_dimensions[r].height = 75; r += 1
chart = BarChart(); chart.type = "bar"; chart.style = 10; chart.title = "Firms by stage"; chart.y_axis.title = None; chart.x_axis.title = None
chart.add_data(Reference(wd, min_col=5, min_row=ST_FIRST, max_row=ST_LAST), titles_from_data=False)
chart.set_categories(Reference(wd, min_col=4, min_row=ST_FIRST, max_row=ST_LAST))
chart.legend = None; chart.height = 9; chart.width = 16
wd.add_chart(chart, f"A{r + 1}")

# ----------------------------------------------------------------- order & save
order = ["README", "Dashboard", "Pipeline", "Playbook", "Scripts", "Objections", "Triggers", "Pricing & Pilot", "Activity Log", "Lists"]
wb._sheets = [wb[n] for n in order]
wb.active = 1
for ws_ in wb.worksheets:
    for row in ws_.iter_rows():
        for c in row:
            if c.value is not None and (c.font is None or c.font.name != "Arial"):
                c.font = Font(name="Arial", size=c.font.size or 10, bold=c.font.bold, italic=c.font.italic, color=c.font.color)
wb.save(OUT)
tiers = {t: sum(1 for f in firms if f["tier"] == t) for t in "ABCD"}
cov = sum(1 for f in firms if f["tier"] in "AB" and (f["phone"] or f["email"] or f["web"] or f["form_url"] or f["linkedin"]))
print(f"{OUT}")
print(f"{N} firms · tiers {tiers} · A+B with any contact channel: {cov}/{tiers['A'] + tiers['B']} · contacts file rows: {len({id(v) for v in contacts.values()})}")
print(f"parsed: {len(gtm_stages)} GTM stages · {len(objections)} objections · {len(meddpicc)} MEDDPICC · {len(urgency)} urgency triggers · {len(nonreg)} non-reg triggers · {len(scripts)} script blocks · {len(term_sheet)} term-sheet rows · {len(falsification)} stop conditions · {len(claims)} claims · {len(do_not_send)} send checks")
gaps = [k for k, v in {"stages": gtm_stages, "objections": objections, "meddpicc": meddpicc, "urgency": urgency, "nonreg": nonreg, "scripts": scripts, "term_sheet": term_sheet, "falsification": falsification, "tierA": tierA, "tierB": tierB}.items() if not v]
if gaps:
    print("PARSE GAP:", ", ".join(gaps))
