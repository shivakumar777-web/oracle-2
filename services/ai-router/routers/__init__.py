"""
Manthana AI Router — sub-routers for /v1 API.
"""
from .plagiarism import create_plagiarism_router

__all__ = ["create_plagiarism_router"]
