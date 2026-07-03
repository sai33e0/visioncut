"""In-process FAISS index for the clip_analyzer service.

Holds:
- vectors : np.ndarray of shape (N, 512)
- metadata: List[dict] with clip_id, project_id, name, url, duration_sec, metadata

When the host has faiss-gpu available (RTX 3050) we copy vectors onto the
GPU and run searches through IndexFlatIP for big speedups. On faiss-cpu we
fall back to the numpy implementation in `common.embeddings.cosine_search`.
"""
from __future__ import annotations

import os
import threading
from typing import Dict, List, Optional, Tuple
import numpy as np

try:
    import faiss  # type: ignore
    _HAS_FAISS = True
except Exception:  # pragma: no cover
    _HAS_FAISS = False

from common.config import get_settings
from common.embeddings import cosine_search, save_index, load_index
from common.gpu import should_use_gpu, faiss_gpu_available
from common.logging import get_logger

EMBEDDING_DIM = 512
logger = get_logger("clip_analyzer.faiss")


class FAISSIndex:
    """Thread-safe wrapper around a numpy / faiss cosine index.

    GPU path: vectors mirrored to a faiss-gpu IndexFlatIP. The CPU copy stays
    authoritative (for snapshots and consistency); GPU is rebuilt on add.
    """

    def __init__(self, snapshot_path: Optional[str] = None) -> None:
        self._lock = threading.RLock()
        self._vectors = np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        self._meta: List[dict] = []
        self._id_to_pos: Dict[str, int] = {}
        self._snapshot_path = snapshot_path

        # GPU side
        self._gpu_resource = None
        self._gpu_index = None
        self._use_gpu = False
        if _HAS_FAISS and faiss_gpu_available():
            try:
                self._gpu_resource = faiss.StandardGpuResources()
                self._use_gpu = True
                logger.info("faiss_gpu_enabled")
            except Exception as e:
                logger.warning("faiss_gpu_init_failed", error=str(e))
                self._use_gpu = False

        if snapshot_path and os.path.exists(snapshot_path):
            try:
                self._vectors, self._meta = load_index(snapshot_path)
                self._id_to_pos = {m["clip_id"]: i for i, m in enumerate(self._meta)}
                self._rebuild_gpu()
            except Exception:
                self._vectors = np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
                self._meta = []
                self._id_to_pos = {}

    def _rebuild_gpu(self) -> None:
        if not self._use_gpu or self._gpu_resource is None or self._vectors.size == 0:
            return
        try:
            cpu_index = faiss.IndexFlatIP(EMBEDDING_DIM)
            cpu_index.add(self._vectors)
            self._gpu_index = faiss.index_cpu_to_gpu(self._gpu_resource, 0, cpu_index)
        except Exception as e:
            logger.warning("faiss_gpu_rebuild_failed", error=str(e))
            self._gpu_index = None

    # -------- mutation --------

    def add(self, clip_id: str, vector: List[float], metadata: dict) -> None:
        v = np.asarray(vector, dtype=np.float32).reshape(1, -1)
        if v.shape[1] != EMBEDDING_DIM:
            v = v[:, :EMBEDDING_DIM] if v.shape[1] > EMBEDDING_DIM else np.pad(v, ((0, 0), (0, EMBEDDING_DIM - v.shape[1])))
        with self._lock:
            if clip_id in self._id_to_pos:
                pos = self._id_to_pos[clip_id]
                self._vectors[pos] = v[0]
                self._meta[pos] = {"clip_id": clip_id, **metadata}
            else:
                self._vectors = np.vstack([self._vectors, v])
                self._meta.append({"clip_id": clip_id, **metadata})
                self._id_to_pos[clip_id] = len(self._meta) - 1
            self._rebuild_gpu()

    def remove_project(self, project_id: str) -> int:
        with self._lock:
            keep_mask = [m.get("project_id") != project_id for m in self._meta]
            if all(keep_mask):
                return 0
            self._vectors = np.asarray(self._vectors)[keep_mask]
            self._meta = [m for m, k in zip(self._meta, keep_mask) if k]
            self._id_to_pos = {m["clip_id"]: i for i, m in enumerate(self._meta)}
            self._rebuild_gpu()
            return sum(1 for k in keep_mask if not k)

    # -------- query --------

    def search(
        self,
        query: List[float],
        k: int = 5,
        project_id: Optional[str] = None,
    ) -> List[Tuple[dict, float]]:
        with self._lock:
            if self._vectors.size == 0:
                return []

            if project_id is not None:
                mask = np.asarray([m.get("project_id") == project_id for m in self._meta])
                if not mask.any():
                    return []
                if self._use_gpu and self._gpu_index is not None:
                    # Project-scoped search on GPU: build a per-call CPU index
                    # from the mask, copy to GPU. The mask is small enough that
                    # this is still faster than pure CPU when there are many
                    # clips outside the project.
                    vecs = self._vectors[mask]
                    meta = [m for m, m_keep in zip(self._meta, mask) if m_keep]
                    return self._search_subset(vecs, meta, query, k)
                vecs = self._vectors[mask]
                meta = [m for m, m_keep in zip(self._meta, mask) if m_keep]
            else:
                vecs = self._vectors
                meta = self._meta
                if self._use_gpu and self._gpu_index is not None:
                    q = np.asarray(query, dtype=np.float32).reshape(1, -1)
                    sims, idx = self._gpu_index.search(q, min(k, len(meta)))
                    return [(meta[int(i)], float(s)) for s, i in zip(sims[0], idx[0]) if int(i) >= 0]

            return self._search_subset(vecs, meta, query, k)

    def _search_subset(
        self,
        vecs: np.ndarray,
        meta: List[dict],
        query: List[float],
        k: int,
    ) -> List[Tuple[dict, float]]:
        sims, idx = cosine_search(np.asarray(query, dtype=np.float32), vecs, k=k)
        return [(meta[int(i)], float(s)) for s, i in zip(sims, idx)]

    # -------- snapshot --------

    def snapshot(self) -> None:
        if not self._snapshot_path:
            return
        with self._lock:
            save_index(self._snapshot_path, self._vectors, self._meta)

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._meta)


_global_index: Optional[FAISSIndex] = None


def get_index() -> FAISSIndex:
    global _global_index
    if _global_index is None:
        path = os.path.join(get_settings().storage_root, "faiss", "clips.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _global_index = FAISSIndex(snapshot_path=path)
    return _global_index
