# Gerador do mapa (Naruto The Shinobi World)

Converte o save do Minecraft 1.12.2 em arquivos para `public/mundo/`:
- `r.X.Z.terr.gz`: altura do terreno (natural) numa grade de 4 m
- `r.X.Z.alt.gz`: altura total por metro (colisão)
- `r.X.Z.quads.gz`: malha das estruturas (casas, muros, troncos, etc.)
- `tex/r.X.Z.jpg`: visão aérea 1 px = 1 m (usada no chão e no minimapa)

Uso: ajuste `paths.py` para apontar para a pasta do mundo extraída (com `region/` e `mapwriter/`), depois rode
`python3 tools/mapa/export2.py` e gzip os `.terr`, `.alt` e `.quads` gerados.
Requer Python 3 com numpy e Pillow.
