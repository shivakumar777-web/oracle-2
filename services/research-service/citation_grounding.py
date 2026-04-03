"""
Grounded citations — align reference list with [n] markers actually used in prose.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("manthana.research.citations")


def extract_cited_indices(sections: List[Dict[str, Any]]) -> List[int]:
    """Collect unique 1-based citation indices from section markdown content."""
    indices: set[int] = set()
    for section in sections:
        content = section.get("content") or ""
        for match in re.findall(r"\[(\d+)\]", content):
            try:
                indices.add(int(match))
            except ValueError:
                pass
    return sorted(indices)


def remap_citation_markers_in_sections(
    sections: List[Dict[str, Any]],
    old_to_new: Dict[int, int],
) -> List[Dict[str, Any]]:
    """Rewrite [n] markers so they match compact citation list ids (1..k)."""

    def _repl(match: re.Match[str]) -> str:
        idx = int(match.group(1))
        if idx in old_to_new:
            return f"[{old_to_new[idx]}]"
        return match.group(0)

    out: List[Dict[str, Any]] = []
    for sec in sections:
        content = sec.get("content") or ""
        new_content = re.sub(r"\[(\d+)\]", _repl, content)
        out.append({**sec, "content": new_content})
    return out


def _one_citation_dict(doc: Dict[str, Any], new_id: int) -> Dict[str, Any]:
    year = doc.get("year")
    try:
        y = int(year) if year else 0
    except (TypeError, ValueError):
        y = 0
    return {
        "id": new_id,
        "authors": doc.get("authors") or "",
        "title": doc.get("title") or "Untitled",
        "journal": doc.get("source") or "",
        "year": y,
        "doi": doc.get("doi"),
        "pmid": doc.get("pmid"),
        "url": doc.get("url"),
    }


def build_grounded_citations(
    merged_docs: List[Dict[str, Any]],
    cited_indices: List[int],
    _citation_style: str,
    max_citations: int,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[int, int]]]:
    """
    Build citations aligned with prose [n] markers.

    - If cited_indices is non-empty and at least one index is in range: return
      citations for those docs only, renumbered 1..k, plus old_to_new for remapping.
    - If cited_indices is empty: fall back to first N merged docs (ordered merge),
      log warning, return (citations, None) — no section remap.
    - If all cited indices are out of range: same fallback as empty markers.
    """
    if not cited_indices:
        logger.warning(
            "LLM produced no inline citations — falling back to ordered merge citations"
        )
        return _ordered_merge_citations(merged_docs, max_citations), None

    valid_ordered: List[int] = []
    for i in sorted(set(cited_indices)):
        if i >= 1 and i <= len(merged_docs):
            valid_ordered.append(i)
        else:
            logger.debug(
                "grounded_citation_skip_out_of_range: index=%s len_merged=%s",
                i,
                len(merged_docs),
            )

    if not valid_ordered:
        logger.warning(
            "LLM produced no inline citations matching merged docs — falling back to ordered merge citations"
        )
        return _ordered_merge_citations(merged_docs, max_citations), None

    old_to_new: Dict[int, int] = {}
    citations: List[Dict[str, Any]] = []
    for new_id, old_idx in enumerate(valid_ordered[:max_citations], start=1):
        old_to_new[old_idx] = new_id
        citations.append(_one_citation_dict(merged_docs[old_idx - 1], new_id))

    return citations, old_to_new


def _ordered_merge_citations(
    merged_docs: List[Dict[str, Any]], max_citations: int
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, doc in enumerate(merged_docs[:max_citations], start=1):
        out.append(_one_citation_dict(doc, i))
    return out


def apply_grounded_citations_to_sections(
    sections: List[Dict[str, Any]],
    old_to_new: Optional[Dict[int, int]],
) -> List[Dict[str, Any]]:
    """Remap [n] in sections when old_to_new is from grounded path; else unchanged."""
    if not old_to_new:
        return sections
    return remap_citation_markers_in_sections(sections, old_to_new)
