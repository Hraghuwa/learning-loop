"""
Verify that FLAN-T5 inference params include no_repeat_ngram_size and
consistent max_new_tokens across /generate and /tutor.

These tests patch the model directly so they run with no GPU / no model files.
"""
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# ── stub heavy optional imports so we can import ml_server on any machine ──
for mod in [
    "faiss", "sentence_transformers", "pandas",
    "autogluon", "autogluon.tabular", "autogluon.multimodal",
    "torch", "transformers",
]:
    if mod not in sys.modules:
        sys.modules[mod] = types.ModuleType(mod)

# torch stubs used by the server
torch_stub = sys.modules["torch"]
torch_stub.no_grad = MagicMock(return_value=MagicMock(__enter__=MagicMock(return_value=None), __exit__=MagicMock(return_value=False)))
torch_stub.set_num_threads = MagicMock()

# transformers stubs
tf_stub = sys.modules["transformers"]
tf_stub.AutoModelForSeq2SeqLM = MagicMock()
tf_stub.AutoTokenizer = MagicMock()

import importlib
import ml_server.main as srv

class TestGenerateParams(unittest.TestCase):
    def _make_mocks(self):
        tok = MagicMock()
        model = MagicMock()
        # tokenizer returns a dict-like object
        tok.return_value = {"input_ids": MagicMock()}
        # generate returns token ids; decode returns something
        model.generate.return_value = [[1, 2, 3]]
        tok.decode.return_value = "42"
        return tok, model

    def test_generate_endpoint_uses_no_repeat_ngram_size(self):
        tok, model = self._make_mocks()
        srv._models["flan_t5"] = (tok, model)
        from fastapi.testclient import TestClient
        client = TestClient(srv.app)
        client.post("/generate", json={"problem": "What is 6 * 7?"})
        call_kwargs = model.generate.call_args[1]
        self.assertIn("no_repeat_ngram_size", call_kwargs,
                      "no_repeat_ngram_size must be passed to model.generate()")
        self.assertGreaterEqual(call_kwargs["no_repeat_ngram_size"], 3)

    def test_tutor_endpoint_uses_no_repeat_ngram_size(self):
        tok, model = self._make_mocks()
        srv._models["flan_t5"] = (tok, model)
        # make retriever unavailable so tutor falls through to model-only
        srv._models.pop("retriever", None)
        srv._models.pop("prod_retriever", None)
        from fastapi.testclient import TestClient
        client = TestClient(srv.app)
        with patch.object(srv, "_tutor_retrieve", side_effect=Exception("no retriever")):
            client.post("/tutor", json={"problem": "What is 6 * 7?"})
        call_kwargs = model.generate.call_args[1]
        self.assertIn("no_repeat_ngram_size", call_kwargs)

    def test_generate_max_new_tokens_at_least_64(self):
        tok, model = self._make_mocks()
        srv._models["flan_t5"] = (tok, model)
        from fastapi.testclient import TestClient
        client = TestClient(srv.app)
        client.post("/generate", json={"problem": "A train travels 120 km in 2 hours. Speed?"})
        call_kwargs = model.generate.call_args[1]
        self.assertGreaterEqual(call_kwargs.get("max_new_tokens", 0), 64,
                                "generate endpoint should allow at least 64 tokens for full answers")

if __name__ == "__main__":
    unittest.main()
