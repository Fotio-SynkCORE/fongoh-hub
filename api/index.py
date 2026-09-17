import sys
import os

# Add parent directory (root) to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # type: ignore