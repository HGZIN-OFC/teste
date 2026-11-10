// Ponto de entrada: fluxo mundo → personagem → jogo.
import { initUI, showWorlds, hideScreens } from './ui.js';
import { startGame } from './game.js';
import { saveChar } from './store.js';

window.__swBoot = true;
let current = null;

initUI({
  enter: async (world, char) => {
    hideScreens();
    current = await startGame({ world, char, onExit: () => { current = null; saveChar(char); showWorlds(); } });
  },
});
showWorlds();
