"""Run from the repository root: browser-harness < scripts/capture-conifer-volume.py.
Requires the development server on port 5178. Reuses its one owned authoring tab.
The browser-harness command supplies new_tab, goto_url, wait_for_load and js.
"""
import base64
import time
from pathlib import Path

out = Path("artifacts/local/conifer-volume")
out.mkdir(parents=True, exist_ok=True)
for variant in ("c", "b"):
    url = f"http://127.0.0.1:5178/scripts/bake-conifer-volume.html?variant={variant}"
    if variant == "c":
        new_tab(url)
    else:
        goto_url(url)
    wait_for_load()
    deadline = time.monotonic() + 120
    while js("window.ready === true") is not True:
        if time.monotonic() > deadline:
            raise RuntimeError(f"Conifer {variant} did not finish loading")
        time.sleep(1)
    for axis in ("z", "x"):
        for index in range(8):
            for kind in ("color", "normal"):
                data = js(f"coniferVolumeBake.capture('{axis}', {index}, '{kind}')")
                out.joinpath(f"{variant}-{axis}-{index}-{kind}.png").write_bytes(
                    base64.b64decode(data.split(",", 1)[1])
                )
    print(f"Captured {variant}: 16 color and 16 normal slices")
