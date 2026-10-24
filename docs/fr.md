# IMGW-PIB

Amène dans Gladys les **hauteurs d'eau des rivières et lacs de Pologne** (Wisła, Odra, Warta,
Bug, les lacs de Mazurie et de Poméranie, la côte : environ 900 stations), avec leurs **niveaux
de vigilance et d'alarme**, à partir des données publiques de l'**IMGW-PIB**, l'institut
polonais de météorologie et de gestion de l'eau. Sans compte, sans clé.

> **Des valeurs brutes, pas un service d'alerte crues.** Les données peuvent être en retard,
> manquantes ou fausses, et l'intégration dépend de votre Gladys, de votre accès Internet et
> d'un service public. En cas de crue, suivez les alertes officielles (IMGW-PIB, votre
> commune, le 112). Cette intégration n'est pas affiliée à l'IMGW-PIB.

## Ce que vous obtenez

- **Un appareil par station** suivie : la **hauteur d'eau** (en cm, comme sur la carte de
  l'IMGW-PIB), le **débit** en m³/s et la **température de l'eau** quand la station les
  fournit, le **niveau d'alerte** (0 normal, 1 niveau de vigilance atteint, 2 niveau d'alarme
  atteint) quand l'IMGW-PIB donne ses seuils, et la date de la dernière mesure.
- Une station qui n'envoie plus rien est signalée (« Pas de nouvelle mesure depuis… ») : une
  ancienne valeur n'est jamais renvoyée comme si elle était fraîche.
- Trois **déclencheurs de scène** : le niveau de vigilance ou d'alarme est atteint ou quitté,
  une station devient muette, une station muette émet de nouveau.
- Un **widget de tableau de bord** : vos stations, leur hauteur, sa tendance (monte, stable,
  baisse) et leur niveau d'alerte.
- Un bouton **« Chercher des stations »** qui liste les stations autour de votre maison, par
  nom, par cours d'eau, par voïvodie ou par identifiant, avec leur hauteur actuelle.

## Prérequis

- Gladys Assistant **5.1.0** ou plus récent.
- Un accès Internet depuis Gladys : l'intégration lit `danepubliczne.imgw.pl`.
- Pour « Autour de ma maison » : la position de votre maison dans Gladys (Paramètres, Maisons).
  L'intégration la demande à l'installation (permission « localisation »). Elle ne sert que
  dans le conteneur, pour trouver les stations les plus proches : jamais envoyée à l'IMGW-PIB
  (l'intégration télécharge la liste entière), jamais stockée ni écrite dans les logs.
- Pologne uniquement.

## Configuration

### Réglages

| Réglage                            | Effet                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stations                           | Identifiants ou noms de station, séparés par des virgules : `152210170, Trestno`. Un nom porté par plusieurs stations prend son cours d'eau : `Krosno Wisłok`.  |
| Autour de ma maison                | Suit aussi les 3 stations les plus proches qui envoient des mesures, à 10, 20 ou 50 km au plus de votre maison.                                                 |
| Fréquence de mise à jour           | 20, 30 (par défaut) ou 60 minutes. Une seule requête couvre toutes les stations.                                                                                |
| Langue des noms de fonctionnalités | Noms des fonctionnalités des nouveaux appareils (Hauteur d'eau, Débit…), et langue du texte « Dernière mesure » et des variables de scène. Français par défaut. |

Enregistrez, puis ouvrez l'onglet **Découverte** de l'intégration et créez les appareils
voulus. Une station reste suivie tant que son appareil existe, même retirée de la
configuration.

### Trouver vos stations

Cliquez sur **« Chercher des stations »** dans la configuration. Laissez le champ vide pour
lister les stations autour de votre maison (20 km, ou la distance choisie), ou tapez :

- un nom de station : `Głogów`, `glogow` ou `GLOGOW` (la casse et les lettres polonaises sont
  ignorées) ;
- un cours d'eau ou un lac : `Wisła`, `Odra`, `Drużno` (les 10 plus proches, ou les 10 premières
  par cours d'eau) ;
- les deux : `Odra Słubice` ;
- une voïvodie : `dolnośląskie` ;
- un identifiant de station : `152210170`.

Chaque ligne donne l'identifiant, le nom, le cours d'eau, la distance à votre maison et la
hauteur actuelle (avec le niveau d'alerte s'il est atteint), ou « pas de mesure récente ».
Copiez les identifiants dans « Stations », puis enregistrez.

## Appareils

| Fonctionnalité          | Type dans Gladys           | Valeur                                                                                                                    |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hauteur d'eau           | Profondeur du liquide (cm) | Hauteur au-dessus du zéro de l'échelle, en cm (stan wody).                                                                |
| Débit (m³/s)            | Débit d'eau                | En m³/s (Gladys n'a pas d'unité m³/s : le nom le dit). Calculé par l'IMGW-PIB, parfois plusieurs heures plus tard.        |
| Température de l'eau    | Température (°C)           | Une centaine de stations, relevée une fois par jour (06:00 UTC).                                                          |
| Niveau d'alerte (0 à 2) | Niveau de risque           | 0 sous le niveau de vigilance (stan ostrzegawczy), 1 à partir de celui-ci, 2 à partir du niveau d'alarme (stan alarmowy). |
| Dernière mesure         | Texte                      | Date de la dernière hauteur, ou « Pas de nouvelle mesure depuis… ».                                                       |

Une fonctionnalité n'existe que si la station la fournit : environ 600 stations ont des
niveaux de vigilance et d'alarme, les stations de lac souvent aucun. La **hauteur d'eau n'est
pas une profondeur** : c'est la lecture de l'échelle, au-dessus de son propre zéro. Comparez-la
aux seuils de la même station (affichés dans le widget), pas à une autre station. Les
paramètres de l'appareil donnent l'identifiant, le nom, le cours d'eau et la voïvodie.

Quand une station devient muette, Gladys garde ses dernières valeurs, niveau d'alerte compris :
la fonctionnalité « Dernière mesure » et le widget disent depuis quand.

La hauteur, le débit et la température sont des fonctionnalités numériques : les scènes de
Gladys savent déjà les comparer à une valeur de votre choix (« Hauteur d'eau au-dessus de
650 cm »).

## Widget de tableau de bord

Ajoutez le widget **IMGW-PIB** à un tableau de bord.

- **Sans réglage** : une ligne par station suivie (10 au plus) avec sa hauteur et sa tendance,
  colorée selon son niveau d'alerte : vert sous le niveau de vigilance, orange au niveau de
  vigilance, rouge au niveau d'alarme, gris sans seuils ou sans mesure récente. Un titre liste
  les stations au niveau de vigilance ou au-dessus.
- **Avec une station choisie** : sa hauteur, son débit et sa température de l'eau en direct,
  puis son état, ses niveaux de vigilance et d'alarme, sa tendance et sa dernière mesure, et un
  lien vers la carte de l'IMGW-PIB.

## Déclencheurs de scène

| Déclencheur                             | Filtres                                                                 | Variables                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Niveau de vigilance ou d'alarme franchi | Station, niveau (vigilance, alarme), sens (atteint, repasse en dessous) | Nom de la station, cours d'eau ou lac, hauteur (cm), code et nom du niveau, sa valeur (cm), sens |
| Station muette                          | Station                                                                 | Nom de la station, cours d'eau ou lac, date de la dernière mesure                                |
| La station émet de nouveau              | Station                                                                 | Nom de la station, cours d'eau ou lac, date de la dernière mesure                                |

Les niveaux sont ceux que l'IMGW-PIB publie pour chaque station. Un niveau compte comme
atteint dès que la hauteur l'égale ; la descente compte une fois la hauteur 2 cm en dessous,
et seulement alors une nouvelle montée peut compter : une hauteur qui oscille autour d'un seuil
ne déclenche qu'une fois. Une station est muette après 6 heures sans nouvelle hauteur (30 heures sans température pour
les quelques stations de lac qui n'envoient qu'elle). Une panne de l'IMGW-PIB ou de votre accès
Internet ne déclenche rien : une station n'est muette que si les autres émettent.

Les déclencheurs ne partent que pour un appareil créé, sur une mesure fraîche, et pas après un
redémarrage de plus d'un jour. Un seuil modifié par l'IMGW-PIB est repris sans déclencher.

## Exemples de scènes

- **La Wisła à Varsovie** : « Niveau de vigilance ou d'alarme franchi », station
  Warszawa-Bulwary, niveau « Niveau de vigilance », atteint → envoyer un message :
  « {{station_name}} : {{height}} cm, niveau de vigilance ({{threshold_value}} cm) atteint ».
- **Surveillance de la cave** : « Niveau de vigilance ou d'alarme franchi », votre station,
  niveau « Niveau d'alarme », atteint → allumer la prise de la pompe et prévenir la famille ; le
  même déclencheur avec « repasse en dessous » → « {{station_name}} : sous le niveau d'alarme ».
- **Surveillance de la station** : « Station muette » → un rappel pour consulter la carte de
  l'IMGW-PIB (« {{station_name}} muette depuis le {{last_reading}} »).

## Sources, licence et quotas

- « Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy
  Instytut Badawczy » (la source des données est l'IMGW-PIB). « Dane Instytutu Meteorologii i
  Gospodarki Wodnej – Państwowego Instytutu Badawczego zostały przetworzone » : l'intégration en
  calcule le niveau d'alerte et la tendance. Conditions d'utilisation :
  [regulamin](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf), gratuites
  pour un usage privé.
- Les valeurs sont des **données opérationnelles**, non vérifiées par l'IMGW-PIB : elles
  peuvent être corrigées ensuite.
- Sans compte, sans clé, sans quota documenté. L'intégration reste légère : **une requête par
  mise à jour** (30 minutes par défaut) pour toutes les stations suivies, environ 550 ko. Les
  stations envoient une hauteur toutes les 10 à 60 minutes ; l'IMGW-PIB les publie environ une
  demi-heure plus tard.

## Dépannage

- **« Station inconnue »** : vérifiez l'orthographe ou utilisez « Chercher des stations », puis
  copiez l'identifiant.
- **« Plusieurs stations s'appellent… »** : ajoutez le cours d'eau (`Krosno Wisłok`) ou
  utilisez l'identifiant.
- **« IMGW-PIB ne répond pas »** : le service ou votre accès Internet est en panne ; les valeurs
  reviennent d'elles-mêmes.
- **« Autour de ma maison » n'ajoute rien** : indiquez la position de votre maison (Paramètres,
  Maisons), ou choisissez une distance plus grande. Une trentaine de stations n'ont pas de
  coordonnées dans les données et ne sont jamais choisies ainsi : ajoutez-les par identifiant.
- **Pas de niveau d'alerte** : l'IMGW-PIB ne donne pas de niveaux de vigilance et d'alarme pour
  cette station (beaucoup de lacs et de retenues).
- **Pas de température de l'eau** : seule une centaine de stations la mesurent, une fois par
  jour.
- **« Pas de nouvelle mesure depuis… »** : la station envoie en retard ou plus du tout (panne,
  maintenance, glace).
- Logs : dans Gladys, les logs de l'intégration ; `LOG_LEVEL=debug` pour voir chaque cycle.

## Limites

- Aucun matériel nécessaire ; testée contre le service réel et des réponses enregistrées, mais
  pas encore dans une vraie installation Gladys : vos retours sont les bienvenus.
- Pas d'avertissements hydrologiques de l'IMGW-PIB (donnés par bassin, pas par station), pas de
  prévisions, pas de phénomènes de glace : mesures et seuils seulement.
- 20 stations au plus depuis la configuration (plus celles dont vous avez créé l'appareil).
- Les noms des fonctionnalités sont figés à la création de l'appareil : changer la langue
  ensuite ne change que les textes envoyés après.
