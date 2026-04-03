"""
Unit tests for services/shared/plagiarism.py — pure functions.
"""
import pytest
from services.shared.plagiarism import (
    split_into_sentences,
    extract_fingerprint_sentences,
    compute_text_overlap,
    is_likely_citation,
    _deduplicate_matches,
    _compute_originality_score,
)


# Long enough for _MIN_SENTENCE_WORDS (10)
_LONG_SENTENCE = "The patient presented with acute onset of chest pain and shortness of breath."
_ANOTHER_LONG = "Diabetes mellitus type 2 is a chronic metabolic disorder characterized by high blood sugar."
_THIRD_LONG = "Hypertension management requires lifestyle modifications and pharmacological treatment options."


class TestSplitIntoSentences:
    """Tests for split_into_sentences."""

    def test_normal_text(self):
        text = _LONG_SENTENCE + " " + _ANOTHER_LONG
        result = split_into_sentences(text)
        assert len(result) >= 1

    def test_short_fragments_filtered(self):
        text = "Short. Also short. " + _LONG_SENTENCE
        result = split_into_sentences(text)
        assert all(len(s.split()) >= 10 for s in result)

    def test_doi_line_filtered(self):
        text = _LONG_SENTENCE + " DOI: 10.1234/example.2024.001"
        result = split_into_sentences(text)
        assert not any("10.1234" in s for s in result)

    def test_figure_caption_filtered(self):
        text = "Figure 1 shows the radiographic findings of the chest X-ray examination. " + _LONG_SENTENCE
        result = split_into_sentences(text)
        assert not any(s.lower().startswith("figure ") for s in result)

    def test_empty_returns_empty(self):
        assert split_into_sentences("") == []
        assert split_into_sentences("   ") == []


class TestExtractFingerprintSentences:
    """Tests for extract_fingerprint_sentences."""

    def test_empty_returns_empty(self):
        assert extract_fingerprint_sentences("") == []

    def test_few_sentences_returns_all(self):
        text = _LONG_SENTENCE + ". " + _ANOTHER_LONG
        result = extract_fingerprint_sentences(text, top_n=5)
        assert len(result) <= 5
        assert len(result) >= 1

    def test_many_sentences_returns_top_n(self):
        text = ". ".join([_LONG_SENTENCE, _ANOTHER_LONG, _THIRD_LONG] * 2)
        result = extract_fingerprint_sentences(text, top_n=3)
        assert len(result) <= 3


class TestComputeTextOverlap:
    """Tests for compute_text_overlap."""

    def test_identical(self):
        text = "diabetes mellitus type 2 treatment"
        assert compute_text_overlap(text, text) == 1.0

    def test_no_overlap(self):
        assert compute_text_overlap("abc def ghi", "jkl mno pqr") == 0.0

    def test_partial_overlap(self):
        a = "diabetes treatment guidelines"
        b = "diabetes management guidelines"
        result = compute_text_overlap(a, b)
        assert 0 < result < 1

    def test_empty_strings(self):
        assert compute_text_overlap("", "hello") == 0.0
        assert compute_text_overlap("hello", "") == 0.0


class TestIsLikelyCitation:
    """Tests for is_likely_citation."""

    def test_bracket_citation(self):
        assert is_likely_citation("As shown in previous studies [1].", "http://example.com") is True

    def test_author_year(self):
        assert is_likely_citation("Smith et al., 2020 reported.", "http://example.com") is True

    def test_et_al(self):
        assert is_likely_citation("Johnson et al. found that.", "http://example.com") is True

    def test_doi_in_sentence(self):
        assert is_likely_citation("See 10.1234/example.2024", "http://example.com") is True

    def test_scholarly_host(self):
        assert is_likely_citation("Some finding.", "https://pubmed.ncbi.nlm.nih.gov/123") is True
        assert is_likely_citation("Some finding.", "https://doi.org/10.1234/x") is True

    def test_not_citation(self):
        assert is_likely_citation("The patient had chest pain.", "https://blog.com/post") is False


class TestDeduplicateMatches:
    """Tests for _deduplicate_matches."""

    def test_dedup_by_url(self):
        matches = [
            {"url": "http://a.com", "matchPercent": 80},
            {"url": "http://a.com", "matchPercent": 90},
        ]
        result = _deduplicate_matches(matches)
        assert len(result) == 1
        assert result[0]["matchPercent"] == 90

    def test_keeps_higher_score(self):
        matches = [
            {"source": "A", "matchPercent": 70},
            {"source": "A", "matchPercent": 85},
        ]
        result = _deduplicate_matches(matches)
        assert len(result) == 1
        assert result[0]["matchPercent"] == 85

    def test_preserves_unique(self):
        matches = [
            {"url": "http://a.com", "matchPercent": 80},
            {"url": "http://b.com", "matchPercent": 70},
        ]
        result = _deduplicate_matches(matches)
        assert len(result) == 2


class TestComputeOriginalityScore:
    """Tests for _compute_originality_score."""

    def test_no_matches_full_score(self):
        score, matched = _compute_originality_score([], ["s1", "s2"], 0.0)
        assert score == 100
        assert matched == 0.0

    def test_with_matches_reduces_score(self):
        matches = [{"isCitation": False, "matchPercent": 50}]
        sentences = ["s1", "s2", "s3"]
        score, matched = _compute_originality_score(matches, sentences, 0.0)
        assert score < 100
        assert 0 <= score <= 100
        assert 0 <= matched <= 100

    def test_citation_matches_ignored(self):
        matches = [{"isCitation": True, "matchPercent": 80}]
        sentences = ["s1", "s2"]
        score, _ = _compute_originality_score(matches, sentences, 0.0)
        assert score == 100
