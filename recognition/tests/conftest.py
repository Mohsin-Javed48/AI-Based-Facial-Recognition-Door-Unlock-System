import sys
from pathlib import Path

# Make `import app.xxx` work regardless of where pytest is invoked from,
# the same way the scripts/ entrypoints do.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
