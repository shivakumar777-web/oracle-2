from __future__ import annotations

from reflection import filter_low_quality, score_sources


def test_pubmed_scores_higher_than_generic_searxng():
    docs = [
        {"title": "trial x", "content": "diabetes metformin", "source": "pubmed"},
        {"title": "blog", "content": "diabetes metformin", "source": "searxng"},
    ]
    scored = score_sources(docs, "diabetes metformin", ["allopathy"])
    assert scored[0]["source"] == "pubmed"
    assert scored[0].get("_score", 0) >= scored[1].get("_score", 0)


def test_domain_boost():
    docs = [
        {"title": "a", "content": "herb", "source": "searxng:ayush"},
        {"title": "b", "content": "herb", "source": "searxng"},
    ]
    s = score_sources(docs, "herb tonic", ["ayurveda"])
    assert s[0]["source"] == "searxng:ayush"


def test_filter_never_fewer_than_five_when_possible():
    base = [{"title": f"t{i}", "content": "x", "source": "searxng"} for i in range(10)]
    scored = score_sources(base, "query word", ["allopathy"])
    for d in scored:
        d["_score"] = 0.01
    filt = filter_low_quality(scored, min_score=0.99)
    assert len(filt) >= 5


def test_recency_boost_2020():
    docs = [
        {"title": "old", "content": "flu", "source": "pubmed", "year": 2010},
        {"title": "new", "content": "flu", "source": "pubmed", "year": 2022},
    ]
    s = score_sources(docs, "flu vaccine", ["allopathy"])
    by_title = {d["title"]: d.get("_score", 0) for d in s}
    assert by_title["new"] > by_title["old"]
