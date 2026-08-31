# ENT Watcher (Pronote)

Extension Chrome qui vérifie automatiquement toutes les 5 minutes si l'espace élève est disponible sur votre ENT, et vous envoie une notification (Chrome + [ntfy](https://ntfy.sh)) dès que c'est le cas.
> [!IMPORTANT]
> Cette branche est adaptée aux ENT **Pronote**
> Si votre ENT utilise Skolengo (Éclat BFC par exemple), merci d'utiliser la branche [`skolengo`](https://github.com/janusdevikidia/ent-watcher/tree/skolengo).

## Installation

1. **Télécharger le projet**
   - Cliquez sur `Code` > `Download ZIP` sur cette page GitHub, puis décompressez le fichier.

2. **Ouvrir la page des extensions Chrome**
   - Allez sur `chrome://extensions`
   - Activez le **Mode développeur** (interrupteur en haut à droite)

3. **Charger l'extension**
   - Cliquez sur **Charger l'extension non empaquetée**
   - Sélectionnez le dossier `ent-watcher` (celui qui contient `manifest.json`)

4. **Configurer l'extension**
   - Cliquez sur l'icône de l'extension dans la barre d'outils, puis sur **Réglages** (ou clic droit sur l'icône > Options)
   - Renseignez :
     - **URL de l'ENT** : l'URL de la page à surveiller
     - **Mot-clé** : le texte qui indique que l'espace élève n'est pas encore disponible (par défaut : `n'est pas publié par l'établissement`)
     - **Serveur / topic ntfy** (optionnel) : pour recevoir une notification sur votre téléphone via l'app [ntfy](https://ntfy.sh)
     - **Intervalle** : fréquence de vérification en minutes
   - Cliquez sur **Enregistrer**

C'est tout ! L'extension vérifie désormais la page en arrière-plan et vous prévient dès que l'espace élève est disponible.

## Notifications sur mobile (optionnel)

Pour recevoir les alertes sur votre téléphone :
1. Installez l'application [ntfy](https://ntfy.sh) (iOS/Android)
2. Abonnez-vous à un topic (un nom unique de votre choix, ex. `mon-ent-alerte-xyz123`)
3. Renseignez ce même topic dans les réglages de l'extension

## Notes

- Le mode "Arrêter pour aujourd'hui" (dans le popup) suspend temporairement les vérifications jusqu'au lendemain.
- Vos réglages sont stockés localement dans le navigateur (aucune donnée envoyée à un serveur tiers, hormis ntfy si configuré).
