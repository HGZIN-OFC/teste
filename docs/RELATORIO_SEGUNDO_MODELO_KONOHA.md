# Shinobi Wilds — inspeção do segundo modelo de Konoha (11/11/2026)

## Fonte recebida
`naruto-hiddenly-village.zip` contém:
- `source/untitled.fbx` — FBX binário 7400, uma única malha combinando toda a vila
- `textures/Picsart_26-05-30_22-38-46-674.png` — atlas PNG 2828×2828

## Decisão do diretor criativo
**Não substituir Konoha inteira.** Usar do segundo modelo somente a **Montanha dos Hokages** e o **Monumento Hokage**. A Konoha principal, a Mansão, a sala do gabinete, as demais ruas, personagens, animações e mecânicas ficam intactos.

## Resultado verificado localmente
- Foram identificados e extraídos os **cinco rostos esculpidos** em um GLB separado, mantendo a textura e ajustando aproximadamente o posicionamento para a encosta de Konoha.
- Arquivo de trabalho local: `Monumento_Hokage_Rostos_Recortados.glb`, cerca de 8,9 MB (3.370 triângulos de rostos).
- Foi gerada uma prévia estática do monumento.
- O **corpo rochoso da montanha está fundido com geometria de construções**, portanto o primeiro recorte bruto apresentou pedaços de edifícios e faces abertas. É necessário limpar ou reconstruir o recorte da rocha para assegurar uma troca visualmente aceitável.

## Estado e limites
**Esta etapa não é uma integração concluída do jogo.** O GLB recortado, a rocha refinada e os dados de colisão ainda **não foram adicionados ao GitHub**, nem há um link publicado de teste desta mudança.
A extração parcial está disponível em pacote entregue na conversa com o usuário, não no repositório.
Quando o arquivo 3D final estiver aprovado, adicionar o GLB a `public/assets` nesta branch e integrar via `GLTFLoader`, desativando apenas as malhas antigas da encosta/monumento, sem tocar no resto de Konoha. Testar visual, colisões, FPS e modo solo/multiplayer antes de propor merge.

## Spawn aprovado
O personagem deve nascer **no corredor imediatamente em frente à porta do gabinete do Hokage**, voltado para a entrada — **não dentro do gabinete**. Ver `docs/ESPECIFICACAO_SPAWN_KONOHA.md`.

**Branch de trabalho:** `chatgpt/mapa-3d-integracao`. Não tocar em `main` ou `claude/desenvolvimento` antes da aprovação.
