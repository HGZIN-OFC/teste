# Shinobi Wilds — inspeção do segundo modelo de Konoha (11/11/2026)

## Fonte recebida
`naruto-hiddenly-village.zip` contém:
- `source/untitled.fbx` — FBX binário 7400, uma única malha combinando toda a vila
- `textures/Picsart_26-05-30_22-38-46-674.png` — atlas PNG 2828×2828

## Decisão do diretor criativo
**CORREÇÃO APROVADA EM 11/11/2026:** Manter a **Konoha original inteira**, incluindo **os rostos do Monumento Hokage do primeiro GLB** (`Mundo_Shinobi.glb`). Do segundo arquivo `naruto-hiddenly-village.zip`, aproveitar **exclusivamente a geometria da montanha/encosta**, SEM reutilizar os cinco rostos esculpidos do segundo FBX e SEM importar a vila, casas, gabinete ou demais elementos desse FBX. A Mansão, gabinete, ruas, personagens e mecânicas do original ficam intactos.

## Resultado da inspeção do segundo FBX (referência técnica anterior; não é o resultado final aprovado)
- Os **cinco rostos do segundo FBX** foram isolados experimentalmente, mas **NÃO serão usados**, conforme correção do usuário. Usar os rostos da primeira versão (`Mundo_Shinobi.glb`).
- Arquivo de trabalho local: `Monumento_Hokage_Rostos_Recortados.glb`, cerca de 8,9 MB (3.370 triângulos de rostos).
- Foi gerada uma prévia estática do monumento.
- O **corpo rochoso da montanha está fundido com geometria de construções**, portanto o primeiro recorte bruto apresentou pedaços de edifícios e faces abertas. É necessário limpar ou reconstruir o recorte da rocha para assegurar uma troca visualmente aceitável.

## Estado e limites
**Esta etapa não é uma integração concluída do jogo.** O GLB recortado, a rocha refinada e os dados de colisão ainda **não foram adicionados ao GitHub**, nem há um link publicado de teste desta mudança.
A extração parcial está disponível em pacote entregue na conversa com o usuário, não no repositório.
Próximo passo: extrair **somente a rocha sem rostos e sem edifícios** do segundo FBX, ajustar escala/rotação para o paredão da Konoha original e manter/reaproveitar **as esculturas de Hokages do primeiro GLB**, sem substituir seu visual. Montar prévia e validar encaixe, colisões, FPS e modo solo/multiplayer antes de integração. Desativar/substituir apenas a rocha antiga quando a nova estiver validada. Adicionar assets só nesta branch e pedir aprovação antes de qualquer merge.

## Spawn aprovado
O personagem deve nascer **no corredor imediatamente em frente à porta do gabinete do Hokage**, voltado para a entrada — **não dentro do gabinete**. Ver `docs/ESPECIFICACAO_SPAWN_KONOHA.md`.

**Branch de trabalho:** `chatgpt/mapa-3d-integracao`. Não tocar em `main` ou `claude/desenvolvimento` antes da aprovação.
