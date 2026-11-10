import os
BASE='/tmp/claude-0/naruto/Naruto The Shinobi World [Ultimate Naruto Map]'
REG=os.path.join(BASE,'region')
TILES_DIR=os.path.join(BASE,'mapwriter','images','z0')
import re
def tile_list():
    out=[]
    for f in os.listdir(TILES_DIR):
        m=re.match(r'(-?\d+)\.(-?\d+)\.png$',f)
        if m: out.append((int(m.group(1)),int(m.group(2))))
    return sorted(out)
