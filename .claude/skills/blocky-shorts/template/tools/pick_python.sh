# Sourced by render.sh and tools/stills.sh. pick_python sets the array PY to a Python 3 that has numpy:
# $PYTHON if set (checked, never replaced), else the first of python3, python, "py -3" on PATH that really runs.
# On Windows `python3` and `python` can be the Microsoft Store alias stub (prints "Python was not found..." and
# exits 9009), so every match on PATH is run once instead of trusting the first one found. Only absolute paths are
# tried, and `py -3` only on Windows.
_py_ok() { "$@" -I -c 'import sys, numpy; sys.exit(sys.version_info[0] != 3)' >/dev/null 2>&1; }
pick_python() {
  if [ -n "${PYTHON:-}" ]; then
    PY=("$PYTHON")
    _py_ok "${PY[@]}" && return 0
    echo "PYTHON=$PYTHON does not run Python 3 with numpy (fix it, or unset PYTHON to search)" >&2; return 2
  fi
  local c p absre='^([A-Za-z]:)?[/\\]'
  local cands=(python3 python)
  case "${OSTYPE:-}" in msys*|cygwin*|win*) cands+=(py) ;; esac
  for c in "${cands[@]}"; do
    while IFS= read -r p; do
      [[ $p =~ $absre ]] || continue   # never a relative path (a ./python3 via PATH=.)
      if [ "$c" = py ]; then PY=("$p" -3); else PY=("$p"); fi
      _py_ok "${PY[@]}" && return 0
    done < <(type -ap "$c")
  done
  echo "No Python 3 with numpy found (tried python3, python, py -3; on Windows python3 may be the Microsoft Store stub)." >&2
  echo "Install Python 3, run 'python -m pip install numpy', or set PYTHON=/path/to/python." >&2
  return 2
}
