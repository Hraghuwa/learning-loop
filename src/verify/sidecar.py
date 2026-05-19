import sys, json, io, contextlib

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

def run_logic(smt: str):
    try:
        from z3 import Solver, parse_smt2_string
        s = Solver()
        s.add(parse_smt2_string(smt))
        r = s.check()
        if str(r) == "sat":
            return {"status": "sat", "solution": str(s.model())}
        if str(r) == "unsat":
            return {"status": "unsat"}
        return {"status": "error", "error": "unknown"}
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
