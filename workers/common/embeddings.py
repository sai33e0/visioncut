"""FAISS helpers and embedding utilities."""
from __future__ import annotations

import os
import pickle
from typing import List, Optional, Tuple

import numpy as np


def l2_normalize(x: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(x, axis=-1, keepdims=True) + 1e-12
    return x / norm


def random_unit_vector(dim: int, seed: Optional[int] = None) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(dim).astype(np.float32)
    return l2_normalize(v)


def random_embedding(seed: int, dim: int = 512) -> List[float]:
    """Deterministic placeholder embedding. Real workers will replace with
    a CLIP/imagebind vector. Same seed → same vector across calls.
    """
    return random_unit_vector(dim, seed=seed).tolist()


def save_index(path: str, vectors: np.ndarray, ids: List[str]) -> None:
    """Pickle a small FAISS-like index for dev. In prod, use faiss.write_index."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump({"vectors": vectors, "ids": ids}, f)


def load_index(path: str) -> Tuple[np.ndarray, List[str]]:
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data["vectors"], data["ids"]


def cosine_search(query: np.ndarray, matrix: np.ndarray, k: int = 5) -> Tuple[np.ndarray, np.ndarray]:
    """Return (similarities, indices) for top-k by cosine similarity."""
    if matrix.size == 0:
        return np.array([]), np.array([])
    q = l2_normalize(query.reshape(1, -1))
    m = l2_normalize(matrix)
    sims = (m @ q.T).flatten()
    idx = np.argsort(-sims)[:k]
    return sims[idx], idx
