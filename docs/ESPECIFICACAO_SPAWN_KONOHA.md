# Shinobi Wilds — regra de spawn em Konoha

**Status:** especificação aprovada de posicionamento; a implementação no jogo ainda depende da integração do modelo 3D e da validação das colisões.

## Local de nascimento
- O personagem deve nascer **fora da Sala do Hokage**, **no corredor/patamar imediatamente em frente à porta de entrada do gabinete**, no mesmo andar. **Não** no interior do gabinete e **não** na entrada externa da Mansão.
- O personagem deve começar **virado para a porta do gabinete**, com espaço suficiente para virar, andar e entrar pela porta.
- O ponto exato deve ser definido com base na geometria e na orientação real da porta, de modo que a cápsula de colisão do personagem não atravesse a porta, batente ou parede.
- Usar a altura real do piso do corredor e o sistema de colisão do modelo, **sem compensações arbitrárias de altura**.
- O mesmo destino de spawn deve valer no primeiro acesso, reaparecimento/respawn, modo solo e multiplayer.

## Modelo fornecido
- Arquivo: `Mundo_Shinobi_Mansao_Emblema.glb` (fornecido pelo usuário na conversa).
- O modelo tem o nó `Sala do Hokage • interior` e o marcador `Spawn_Sala_do_Hokage`.
- **Não** reutilizar o marcador existente automaticamente como local final: a exigência mais recente é o lado **externo** da porta. Determinar o novo marcador `Spawn_Entrada_Gabinete_Hokage` após localizar a face externa da porta no modelo.

## Validação antes da aprovação
1. O jogador aparece no corredor/patamar na frente do gabinete, sem atravessar chão ou parede.
2. A câmera não atravessa a porta e o jogador consegue entrar e sair normalmente.
3. O spawn e respawn funcionam da mesma maneira em modo solo e multiplayer.
4. O mapa original da `main` e a branch `claude/desenvolvimento` permanecem sem alterações; testes ficam nesta branch até aprovação do usuário.
