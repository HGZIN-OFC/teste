# Shinobi Wilds — migração do mapa em blocos para Konoha 3D original

**Decisão aprovada:** criar o mundo novo exclusivamente com o PRIMEIRO GLB do usuário (`Mundo_Shinobi.glb`), sem usar absolutamente nada do segundo ZIP. Não manter o mapa em blocos como fallback.

## O que foi alterado nesta branch
- `public/world.js`: substituiu as malhas voxel por carregamento GLTFLoader do GLB original; usa as malhas de piso para estimar altura no navegador.
- `public/terrain-model.js`: novo adaptador sem dados de terreno em blocos; o servidor ainda não tem colisão física autoritativa baseada no GLB.
- `public/game.js`: passa a construir a cena do GLB; o mapa antigo não é carregado.
- `public/shared.js`: coordenadas provisórias do mundo novo, incluindo nascimento próximo à entrada do gabinete.
- `server.js`: não carrega `public/mundo/*.gz` no runtime.
- `public/mapa.html`: antigo visualizador em blocos redireciona para a entrada do jogo.
- `public/mundo` e `public/mapa.js`: arquivos antigos ainda guardados no repositório para auditoria, mas **não usados** pelo fluxo principal.

## PENDÊNCIA BLOQUEADORA
O arquivo original `Mundo_Shinobi.glb` possui **51.421.648 bytes**, SHA-256:
`cfa6031e1009b5f353d925004550e71302c338d267945e2351bc239752f9ee37`

O arquivo **ainda não está no GitHub**. Precisa ser enviado para `public/assets/Mundo_Shinobi.glb` nesta branch. Como excede o limite usual do upload pelo navegador do GitHub, usar Git CLI. O modelo original está disponível no pacote entregue ao usuário na conversa.

**Até essa pendência ser resolvida, o jogo não poderá carregar o novo mapa e mostrará erro explícito (sem restaurar o cenário voxel).**

## O que ainda precisa ser validado
1. Verificar modelo original e texturas renderizados sem erro no navegador.
2. Definir posição exata **no corredor em frente à porta** do gabinete, olhando para a porta — coordenadas atuais são **provisórias**, não spawn aprovado/testado.
3. Implementar colisões completas de parede, piso e porta do GLB, inclusive sincronizadas com o servidor.
4. Reposicionar elementos interativos e inimigos do protótipo para o novo mapa (os antigos objetos provisórios em blocos foram desativados).
5. Testar FPS, desempenho em desktop/celular, entrada e respawn, modo solo e multiplayer.

**Não mover essas mudanças para a `main` nem para `claude/desenvolvimento` sem aprovação expressa do usuário.**
