"""Use browser-harness with this file after selecting the owned authoring tab.
Development server: 127.0.0.1:5178. No additional browser/tab is created.
"""
import base64,json,time
from pathlib import Path
out=Path('artifacts/local/broadleaf-volume');out.mkdir(parents=True,exist_ok=True)
goto_url('http://127.0.0.1:5178/scripts/bake-broadleaf-volume.html')
try:wait_for_load()
except RuntimeError:pass
deadline=time.monotonic()+180
while time.monotonic()<deadline:
 try:
  if js('window.ready===true'):break
  errors=js('window.errors||[]')
  if errors:raise ValueError(errors)
 except RuntimeError:pass
 time.sleep(1)
else:raise RuntimeError('Broadleaf bake did not become ready')
out.joinpath('bounds.json').write_text(json.dumps(js('({height:broadleafBake.height,span:broadleafBake.span,rootOffset:broadleafBake.model.position.y,bounds:broadleafBake.bounds,centre:broadleafBake.centre})'),indent=2))
for axis in ('z','x','y'):
 for index in range(8):
  for kind in ('color','normal'):
   data=js(f"broadleafBake.capture('{axis}',{index},'{kind}')")
   out.joinpath(f'{axis}-{index}-{kind}.png').write_bytes(base64.b64decode(data.split(',',1)[1]))
 print('Captured broadleaf axis '+axis,flush=True)
