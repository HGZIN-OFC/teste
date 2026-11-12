# Shinobi Wilds — decisão final sobre os modelos de Konoha (11/11/2026)

## DECISÃO ATUAL — PREVALECE SOBRE TODAS AS PROPOSTAS ANTERIORES

**Usar exclusivamente o PRIMEIRO modelo 3D de Konoha, incluindo a montanha e os rostos dos Hokages que já vieram nele.** Manter a vila, o monumento, o relevo/encosta, a Mansão do Hokage, o gabinete e todas as construções desse primeiro arquivo.

**DESCARTAR INTEGRALMENTE o SEGUNDO modelo** `naruto-hiddenly-village.zip`: não usar a montanha, rostos, textura, edifícios ou quaisquer elementos dele. Não prosseguir com recorte, combinação nem substituição de montanha ou rostos. As prévias experimentais anteriores não representam o visual aprovado e não devem ser implementadas.

## Situação da integração

Esta decisão foi documentada na branch `chatgpt/mapa-3d-integracao`. É somente uma atualização de orientação; **não significa que o primeiro modelo 3D já esteja integrado ou que exista link jogável**. Não foram alterados assets ou códigos do jogo nesta atualização. Não modificar `main` nem `claude/desenvolvimento` sem autorização.

## Spawn aprovado anteriormente

Ao jogar, o personagem deverá nascer no corredor imediatamente **fora da porta do gabinete do Hokage**, olhando para a entrada, sem nascer dentro da sala. Ver `docs/ESPECIFICACAO_SPAWN_KONOHA.md`.

## Próximos passos

Preparar ou testar a integração do primeiro modelo original somente, preservar a geometria original da montanha e dos rostos, conferir colisões, spawn e renderização; mostrar uma prévia fiel do arquivo real antes de pedir aprovação para integrar mudanças.
