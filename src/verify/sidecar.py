import sys, json, io, contextlib, subprocess

def run_arithmetic(code: str):
    buf = io.StringIO()
    safe = {"__builtins__": {"print": print, "range": range, "len": len, "abs": abs,
                              "round": round, "min": min, "max": max, "sum": sum, "pow": pow}}
    try:
        import sympy  # noqa: F401
        safe["sympy"] = sympy
    except Exception:
        pass
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, safe, {})
        return {"ok": True, "value": buf.getvalue().strip()}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}

def _ensure_z3():
    try:
        from z3 import Solver, parse_smt2_string  # noqa: F401
        return True, None
    except Exception:
        pass
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "z3-solver"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        from z3 import Solver, parse_smt2_string  # noqa: F401
        return True, None
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"

def run_logic(smt: str):
    ok, err = _ensure_z3()
    if not ok:
        return {"status": "error", "error": f"z3 unavailable: {err}"}
    try:
        from z3 import Solver, parse_smt2_string, Or
        s = Solver()
        s.add(parse_smt2_string(smt))
        r = s.check()
        if str(r) == "unsat":
            return {"status": "unsat"}
        if str(r) != "sat":
            return {"status": "error", "error": "unknown"}
        m = s.model()
        # Verification requires a UNIQUE model: re-solve while forbidding the
        # model just found. If another model exists the answer is not uniquely
        # determined ("multiple"); only a single model counts as verified.
        block = [d() != m[d] for d in m.decls()]
        if block:
            s.add(Or(block))
            if str(s.check()) == "sat":
                return {"status": "multiple", "solution": str(m)}
        return {"status": "sat", "solution": str(m)}
    except Exception as e:
        return {"status": "error", "error": f"{type(e).__name__}: {e}"}

def main():
    try:
        req = json.loads(sys.stdin.read())
        op = req.get("op")
        if op == "arithmetic":
            out = run_arithmetic(req.get("code", ""))
        elif op == "logic":
            out = run_logic(req.get("smt", ""))
        else:
            out = {"ok": False, "error": "unknown op"}
        sys.stdout.write(json.dumps(out))
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": f"bad request: {type(e).__name__}: {e}"}))

if __name__ == "__main__":
    main()
