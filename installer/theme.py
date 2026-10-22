"""Installer identity and fixed window size. Keep layout choices in one place."""
BACKGROUND = "#171922"
SURFACE = "#242733"
TEXT = "#f0f1f8"
MUTED = "#acafc0"
ACCENT = "#b4a5ff"
ACCENT_HOVER = "#c8bdff"
ACCENT_INK = "#1c1638"
WINDOW_SIZE = "580x640"


def layout(tk_scaling: float) -> tuple[str, int]:
    """Keep a fixed window while allowing larger fonts on high-density displays."""
    scale = max(1.0, tk_scaling / (96 / 72))
    width, height = (int(value) for value in WINDOW_SIZE.split("x"))
    return f"{round(width * scale)}x{round(height * scale)}", round(480 * scale)
