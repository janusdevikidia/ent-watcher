# ENT Watcher (Éclat/Skolengo)

Extension Chrome qui vérifie automatiquement toutes les 5 minutes si l'espace élève est disponible sur votre ENT, et vous envoie une notification (Chrome + [ntfy](https://ntfy.sh)) dès que c'est le cas.

Contrairement à la version Pronote, cette variante gère tout le parcours de connexion (choix du profil "Élève", validation, etc.) en ouvrant un onglet en arrière-plan, car Skolengo vous déconnecte toute les 15 minutes.
> [!IMPORTANT]
> Cette branche est adaptée aux ENT **Skolengo** (Éclat BFC par exemple)
> Si votre ENT utilise Pronote, merci d'utiliser la branche [`main`](https://github.com/janusdevikidia/ent-watcher/tree/main).

> [!NOTE]
> L'extension n'a pas encore de branche adapté aux ENT École Directe. Vous pouvez essayer avec la branche [`main`](https://github.com/janusdevikidia/ent-watcher/tree/main), mais ce n'est pas sur que cela marche.

## Prérequis

- Avoir ses identifiants de connexion enregistrés dans le navigateur.

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
     - **URL de connexion CAS** : l'URL de login Skolengo de votre établissement (ex. `https://cas.eclat-bfc.fr/login?service=...`)
     - **Mode de détection** : le texte doit disparaître ou apparaître pour signaler la disponibilité
     - **Texte à surveiller** : le texte indiquant que l'espace élève n'est pas encore disponible (par défaut : `Procédure de changement d'année`)
     - **Serveur / topic ntfy** (optionnel) : pour recevoir une notification sur votre téléphone via l'app [ntfy](https://ntfy.sh)
     - **Intervalle** : fréquence de vérification en minutes
   - Cliquez sur **Enregistrer**

C'est tout ! L'extension ouvre périodiquement un onglet en arrière-plan, parcourt automatiquement les écrans de connexion, puis vérifie la page finale de l'ENT.

## Notifications sur mobile (optionnel)

Pour recevoir les alertes sur votre téléphone :
1. Installez l'application [ntfy](https://ntfy.sh) (iOS/Android)
2. Abonnez-vous à un topic (un nom unique de votre choix, ex. `mon-ent-alerte-xyz123`)
3. Renseignez ce même topic dans les réglages de l'extension

## Anomalies

Si l'extension rencontre un écran inattendu pendant le parcours de connexion (session expirée, changement d'interface, etc.), elle vous envoie une notification d'anomalie plutôt que de rester bloquée silencieusement. Le détail (URL et extrait de texte) est inclus dans la notification ntfy si configurée.

## Notes

- Le mode "Arrêter pour aujourd'hui" (dans le popup) suspend temporairement les vérifications jusqu'au lendemain.
- Vos réglages sont stockés localement dans le navigateur (aucune donnée envoyée à un serveur tiers, hormis ntfy si configuré).
- L'extension nécessite les permissions `scripting` et `tabs` pour automatiser la navigation dans l'onglet caché.

> [!WARNING]
> Si vous avez un problème avec l'extension, nous vous invitons à ouvrir une issue pour que nous puissions analyser le bug et le corriger !
