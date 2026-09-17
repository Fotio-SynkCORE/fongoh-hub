import sys
import os

# Add root project folder to Python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app # type: ignore