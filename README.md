# Atlas V12

Visualisation interactive d’un moteur V12, en français.

- [Ouvrir le site](https://genjirusuchiwa.github.io/anatomy-v12/)
- [Version claire](https://genjirusuchiwa.github.io/anatomy-v12/v12-light.html)

Les fichiers `v12.html` et `v12-light.html` contiennent leurs styles, scripts et
données. `index.html` ouvre la version principale.

GitHub Pages publie la racine de la branche `main` après chaque push, sans
compilation. Le fichier `.nojekyll` désactive le traitement Jekyll.

Pour modifier le moteur, les sources sont `build.mjs`, `model.mjs`, `atlas.mjs`,
`live.js` et `v12.css`. La régénération des pages nécessite le kit local
`~/.claude/skills/anatomy`, qui n’est pas inclus dans ce dépôt :
`node build.mjs` puis `node build.mjs --light`. Il faut ensuite committer et
pousser les deux fichiers HTML régénérés pour mettre le site à jour.
