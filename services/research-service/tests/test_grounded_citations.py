from __future__ import annotations

from citation_grounding import (
    build_grounded_citations,
    extract_cited_indices,
    remap_citation_markers_in_sections,
)


def test_extract_and_ground_only_cited_docs():
    merged = [
        {"title": "A", "source": "s1", "authors": "", "year": 0},
        {"title": "B", "source": "s2", "authors": "", "year": 0},
        {"title": "C", "source": "s3", "authors": "", "year": 0},
        {"title": "D", "source": "s4", "authors": "", "year": 0},
    ]
    sections = [
        {"id": "x", "title": "T", "content": "See [2] and [4]."},
    ]
    cited = extract_cited_indices(sections)
    assert cited == [2, 4]
    cites, old_to_new = build_grounded_citations(merged, cited, "vancouver", 25)
    assert len(cites) == 2
    assert cites[0]["title"] == "B"
    assert cites[1]["title"] == "D"
    assert cites[0]["id"] == 1
    assert cites[1]["id"] == 2
    assert old_to_new == {2: 1, 4: 2}


def test_out_of_range_index_skipped():
    merged = [{"title": "Only", "source": "s", "authors": "", "year": 0}]
    sections = [{"id": "x", "title": "T", "content": "[99]"}]
    cited = extract_cited_indices(sections)
    cites, old_to_new = build_grounded_citations(merged, cited, "vancouver", 25)
    assert old_to_new is None
    assert len(cites) == 1
    assert cites[0]["title"] == "Only"


def test_no_inline_citations_fallback_ordered():
    merged = [
        {"title": "First", "source": "a", "authors": "", "year": 0},
        {"title": "Second", "source": "b", "authors": "", "year": 0},
    ]
    sections = [{"id": "x", "title": "T", "content": "No brackets here."}]
    cited = extract_cited_indices(sections)
    cites, old_to_new = build_grounded_citations(merged, cited, "vancouver", 2)
    assert old_to_new is None
    assert [c["title"] for c in cites] == ["First", "Second"]


def test_reindexing_remaps_sections():
    merged = [
        {"title": "A", "source": "s", "authors": "", "year": 0},
        {"title": "B", "source": "s", "authors": "", "year": 0},
        {"title": "C", "source": "s", "authors": "", "year": 0},
        {"title": "D", "source": "s", "authors": "", "year": 0},
    ]
    sections = [{"id": "x", "title": "T", "content": "Ref [2] [4]"}]
    cited = extract_cited_indices(sections)
    cites, old_to_new = build_grounded_citations(merged, cited, "vancouver", 25)
    assert old_to_new == {2: 1, 4: 2}
    out = remap_citation_markers_in_sections(sections, old_to_new)
    assert out[0]["content"] == "Ref [1] [2]"
