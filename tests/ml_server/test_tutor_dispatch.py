"""
Characterization tests for the /tutor hybrid dispatch:
  exact-match (score >= 0.92 with answer) -> retrieval+model -> model-only.

All heavy deps are stubbed (same technique as test_generate_params.py), so
these run on any machine with fastapi installed.
"""
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

for mod in [
    "faiss", "sentence_transformers", "pandas",
    "autogluon", "autogluon.tabular", "autogluon.multimodal",
    "torch", "transformers",
]:
    if mod not in sys.modules:
        sys.modules[mod] = types.ModuleType(mod)

torch_stub = sys.modules["torch"]
torch_stub.no_grad = MagicMock(return_value=MagicMock(
    __enter__=MagicMock(return_value=None), __exit__=MagicMock(return_value=False)))
torch_stub.set_num_threads = MagicMock()
tf_stub = sys.modules["transformers"]
tf_stub.AutoModelForSeq2SeqLM = MagicMock()
tf_stub.AutoTokenizer = MagicMock()

import ml_server.main as srv
from fastapi.testclient import TestClient


def cite(score: float, answer: str = "60 km/h") -> srv.Citation:
    return srv.Citation(
        text="A train covers 360 km in 4 hours...", answer=answer,
        subDomain="tsd", kind="qa", source="math-corpus.jsonl",
        license="cc-by", url="", score=score,
    )


def flan_stub(answer: str):
    tok = MagicMock()
    model = MagicMock()
    tok.return_value = {"input_ids": MagicMock()}
    model.generate.return_value = [[1, 2, 3]]
    tok.decode.return_value = answer
    return tok, model


class TestTutorDispatch(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(srv.app)
        # classify is best-effort: force it down the error path.
        self.classify_patch = patch.object(
            srv, "_load_tabular", side_effect=Exception("no classifier"))
        self.classify_patch.start()
        srv._models["flan_t5"] = flan_stub("model says 90")

    def tearDown(self):
        self.classify_patch.stop()
        srv._models.pop("flan_t5", None)

    def post(self):
        r = self.client.post("/tutor", json={"problem": "What is the speed?"})
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_exact_match_wins_at_high_similarity(self):
        with patch.object(srv, "_tutor_retrieve",
                          return_value=([cite(0.95)], 0.95, "prod")):
            out = self.post()
        self.assertEqual(out["method"], "exact-match")
        self.assertEqual(out["answer"], "60 km/h")
        self.assertAlmostEqual(out["confidence"], 0.95, places=3)

    def test_exact_match_confidence_is_capped_at_099(self):
        with patch.object(srv, "_tutor_retrieve",
                          return_value=([cite(1.0)], 1.0, "prod")):
            out = self.post()
        self.assertEqual(out["method"], "exact-match")
        self.assertLessEqual(out["confidence"], 0.99)

    def test_below_threshold_uses_model_with_citations(self):
        with patch.object(srv, "_tutor_retrieve",
                          return_value=([cite(0.80)], 0.80, "prod")):
            out = self.post()
        self.assertEqual(out["method"], "retrieval+model")
        self.assertEqual(out["answer"], "model says 90")
        self.assertEqual(len(out["citations"]), 1)
        self.assertAlmostEqual(out["confidence"], 0.4 + 0.5 * 0.80, places=3)

    def test_high_score_but_empty_citation_answer_is_not_exact_match(self):
        with patch.object(srv, "_tutor_retrieve",
                          return_value=([cite(0.95, answer="")], 0.95, "prod")):
            out = self.post()
        self.assertEqual(out["method"], "retrieval+model")

    def test_retrieval_failure_falls_back_to_model_only(self):
        with patch.object(srv, "_tutor_retrieve",
                          side_effect=Exception("no retriever on disk")):
            out = self.post()
        self.assertEqual(out["method"], "model-only")
        self.assertEqual(out["answer"], "model says 90")
        self.assertEqual(out["citations"], [])
        self.assertAlmostEqual(out["confidence"], 0.2, places=3)

    def test_everything_down_still_returns_a_response(self):
        srv._models.pop("flan_t5", None)
        with patch.object(srv, "_tutor_retrieve", side_effect=Exception("down")), \
             patch.object(srv, "_load_flan_t5", side_effect=Exception("no model")):
            out = self.post()
        self.assertEqual(out["method"], "model-only")
        self.assertEqual(out["answer"], "(no answer found)")


if __name__ == "__main__":
    unittest.main()
