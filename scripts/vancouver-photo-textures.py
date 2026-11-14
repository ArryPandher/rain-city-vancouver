"""Rectify licensed Vancouver photographs; preserve attribution for all derivatives.
Requires Pillow and numpy. Originals remain in ignored artifacts/local/reference.
"""
from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
OUT=Path('public/textures/vancouver');OUT.mkdir(parents=True,exist_ok=True)
REF=Path('artifacts/local/reference');REF.mkdir(parents=True,exist_ok=True)
sources=[
 dict(id='northshore',url='https://upload.wikimedia.org/wikipedia/commons/7/71/North_shore_pan.JPG',title='North shore pan.JPG',author='Selmo',license='CC BY-SA 3.0',licenseUrl='https://creativecommons.org/licenses/by-sa/3.0/',derivatives=['north-shore.webp']),
 dict(id='vogue',url='https://upload.wikimedia.org/wikipedia/commons/f/fd/Vancouver_Hotel_Vogue_2010.jpg',title='Vancouver Hotel Vogue 2010.jpg',author='Canadian2006',license='CC BY-SA 3.0',licenseUrl='https://creativecommons.org/licenses/by-sa/3.0/',derivatives=['vogue-heritage.webp','vogue-masonry.webp']),
 dict(id='palms',url='https://upload.wikimedia.org/wikipedia/commons/b/b7/Vancouver_Palms_Hotel_2011.jpg',title='Vancouver Palms Hotel 2011.jpg',author='Canadian2006',license='CC BY-SA 3.0',licenseUrl='https://creativecommons.org/licenses/by-sa/3.0/',derivatives=['palms-arches.webp','palms-sash.webp']),
 dict(id='gastown',url='https://upload.wikimedia.org/wikipedia/commons/a/ac/Gastown-19.JPG',title='Gastown-19.JPG',author='Xicotencatl',license='CC BY-SA 4.0',licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/',derivatives=['gastown-arches.webp','gastown-lofts.webp']),
]
for s in sources:
 p=REF/(s['id']+'.jpg')
 if not p.exists():subprocess.run(['curl','-L','--fail','--silent',s['url'],'-o',str(p)],check=True)
 s['source']='https://commons.wikimedia.org/wiki/File:'+s['title'].replace(' ','_')
 s['changes']='Perspective correction, cropping, colour balancing; horizon also has a feathered alpha mask.'

def rect(id,name,points,reference_width,size):
 im=Image.open(REF/(id+'.jpg')).convert('RGB'); scale=im.width/reference_width
 src=np.array(points,dtype=float)*scale;dst=[(0,0),(size[0],0),(size[0],size[1]),(0,size[1])]
 a=[];b=[]
 for (x,y),(u,v) in zip(dst,src):
  a += [[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]];b += [u,v]
 co=np.linalg.solve(a,b)
 out=im.transform(size,Image.Transform.PERSPECTIVE,co,Image.Resampling.BICUBIC)
 out=ImageEnhance.Color(out).enhance(.76)
 out.save(OUT/(name+'.webp'),quality=92)
 # Material response follows the photographed window regions instead of a separate grid.
 arr=np.array(out).astype(float);lum=arr.mean(axis=2)
 glass=(arr[:,:,2]>arr[:,:,0]*1.04)&(lum<130)
 rough=np.where(glass,65,215).astype('uint8')
 Image.fromarray(rough).filter(ImageFilter.GaussianBlur(1)).save(OUT/(name+'-roughness.webp'),quality=90)
rect('palms','palms-arches',[(144,198),(455,172),(446,388),(120,401)],1067,(1024,640))
rect('palms','palms-sash',[(120,417),(443,403),(439,566),(98,581)],1067,(1024,512))
rect('vogue','vogue-heritage',[(75,326),(293,181),(294,557),(65,607)],966,(1024,1536))
rect('vogue','vogue-masonry',[(320,248),(454,282),(461,402),(321,414)],966,(1024,1024))
rect('gastown','gastown-arches',[(764,158),(1126,5),(1131,184),(757,315)],1200,(1536,1024))
rect('gastown','gastown-lofts',[(478,253),(681,111),(679,375),(468,421)],1200,(1024,1536))
# Hand-traced photographic ridge line in the 1400 px overview. This excludes the photographed sky.
im=Image.open(REF/'northshore.jpg').convert('RGBA');im=im.resize((8192,round(im.height*8192/im.width)),Image.Resampling.LANCZOS)
line=[(0,80),(24,74),(45,62),(67,62),(90,52),(115,49),(145,43),(180,46),(205,48),(243,45),(268,42),(282,45),(300,39),(313,44),(337,47),(357,56),(391,69),(431,74),(454,61),(482,60),(512,82),(539,76),(560,58),(588,48),(614,44),(635,51),(650,43),(672,51),(700,52),(733,45),(753,53),(781,42),(795,54),(821,49),(845,58),(874,65),(915,64),(957,58),(983,64),(1008,63),(1032,56),(1074,59),(1107,62),(1144,60),(1172,67),(1211,67),(1240,74),(1278,76),(1307,89),(1340,84),(1370,89),(1400,90)]
scale=8192/1400;mask=Image.new('L',im.size,0);draw=ImageDraw.Draw(mask)
draw.polygon([(round(x*scale),round(y*scale)) for x,y in line]+[(8192,im.height),(0,im.height)],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(1.6));alpha=np.asarray(mask).astype(float)
y=np.arange(im.height)[:,None];x=np.arange(im.width)[None,:]
alpha*=np.clip((148*scale-y)/(22*scale),0,1)*np.clip(x/160,0,1)*np.clip((8191-x)/160,0,1)
im.putalpha(Image.fromarray(alpha.astype('uint8')));im.save(OUT/'north-shore.webp',quality=92)
(OUT/'SOURCES.json').write_text(json.dumps(sources,indent=2))
print('Wrote Vancouver photographic materials and horizon')
