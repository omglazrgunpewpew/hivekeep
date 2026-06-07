# Script vidéo — Présentation Hivekeep

**Format** : Screencast + voix off
**Durée cible** : 5-7 minutes
**Public** : Tech-curious, pas forcément développeurs
**Ton** : Naturel, enthousiaste, direct. Pas de jargon inutile.

---

## 1. ACCROCHE (0:00 — 0:25)

**[Écran : on ouvre Hivekeep en thème dark (palette Aurora). Le Hub est sélectionné dans la sidebar, on voit 4-5 Agents listés avec leurs avatars colorés. Un message est envoyé au Hub et la réponse stream en temps réel.]**

> T'as déjà eu l'impression de devoir tout ré-expliquer à chaque fois que tu ouvres une nouvelle conversation avec une IA ? Ton contexte, tes préférences, tes projets en cours… Et si à la place, t'avais une équipe d'assistants IA qui te connaissent vraiment — qui se souviennent de tout, qui bossent ensemble, et qui tournent chez toi ? C'est Hivekeep.

---

## 2. LE PROBLÈME (0:25 — 1:00)

**[Écran : split screen rapide — à gauche, ChatGPT avec le bouton "New chat". À droite, Claude avec "New conversation". Montrer qu'on perd tout le contexte à chaque fois.]**

> Aujourd'hui les chatbots IA ont un gros problème : chaque conversation est une page blanche. Tu dois te répéter. "Je suis développeur, je bosse sur tel projet, j'aime les réponses courtes." À chaque fois.

**[Écran : revenir sur Hivekeep, montrer une conversation longue avec des messages de dates différentes — les séparateurs de date montrent que c'est la même session continue]**

> Et puis il y a la question des données. Tes conversations, tes fichiers, tes secrets — tout passe par des serveurs que tu ne contrôles pas. Hivekeep, c'est l'inverse : une plateforme open-source que tu héberges sur ta propre machine, avec des agents IA qui ont une vraie mémoire à long terme.

---

## 3. C'EST QUOI UN KIN ? (1:00 — 2:00)

**[Écran : cliquer sur "Create new Agent" dans la sidebar. Le formulaire de création s'ouvre avec les champs : nom, rôle, personnalité, expertise, modèle LLM.]**

> Le cœur de Hivekeep, c'est le Agent. Un Agent, c'est un agent IA spécialisé avec sa propre identité. Tu lui donnes un nom, un rôle, une personnalité, un domaine d'expertise. Par exemple : "Atlas, expert en développement web, ton direct et concis."

**[Écran : montrer le sélecteur de modèle LLM — on voit la liste des modèles disponibles (Claude Sonnet, GPT-4o, Gemini, modèles Ollama locaux…)]**

> Tu choisis quel modèle d'IA il utilise — Claude, GPT-4, Gemini, ou même un modèle local avec Ollama. Et chaque Agent peut utiliser un modèle différent.

**[Écran : montrer la génération d'avatar — le Agent génère lui-même son avatar basé sur sa personnalité]**

> Il peut même générer son propre avatar à partir de sa description. Chaque Agent a une identité visuelle unique.

**[Écran : montrer la sidebar avec 5-6 Agents créés — Dev, Analyste, Rédacteur, Nutrition, Finance… Chacun a son avatar distinctif]**

> Tu peux en créer autant que tu veux. Un Agent dev pour coder. Un Agent analyste pour tes recherches. Un Agent nutrition pour tes repas. Chacun est expert dans son domaine, et surtout — chacun a sa propre mémoire.

---

## 4. LE HUB — L'INTELLIGENCE QUI ROUTE (2:00 — 2:30)

**[Écran : sélectionner le Hub dans la sidebar (il a un badge spécial). Envoyer un message générique comme "J'ai besoin d'aide pour mon site web".]**

> Et il y a le Hub. C'est le coordinateur. Tu lui poses une question, il analyse ta demande et la redirige automatiquement vers le Agent le plus qualifié.

**[Écran : le Hub répond en expliquant qu'il transmet la demande au Agent Dev, et on voit le message apparaître dans la conversation du Agent Dev]**

> Tu parles à un seul point d'entrée, et c'est le bon spécialiste qui répond. Pas besoin de savoir quel Agent choisir, le Hub s'en occupe.

---

## 5. LA MÉMOIRE — LA KILLER FEATURE (2:30 — 3:30)

**[Écran : envoyer un message à un Agent du type "Je suis végétarien depuis 2020 et j'ai un budget courses de 150€ par semaine." Le Agent répond en prenant note.]**

> Maintenant la feature qui change tout : la mémoire. Quand tu parles à un Agent, il extrait automatiquement les informations importantes — tes préférences, tes contraintes, tes décisions — et les stocke dans sa mémoire à long terme.

**[Écran : aller dans Settings → Memories. Montrer la liste des mémoires extraites, avec les catégories (fact, preference, decision). On voit des entrées comme "[preference] Nicolas préfère les recettes rapides (<30 min)", "[fact] Budget courses : 150€/semaine".]**

> Et c'est pas juste du texte brut dans un fichier. Chaque souvenir est catégorisé — fait, préférence, décision, connaissance — et indexé avec un système de recherche hybride.

**[Écran : simuler une conversation 3 mois plus tard — demander "Qu'est-ce qu'on mange ce soir ?" et le Agent répond en tenant compte du végétarisme et du budget, sans qu'on lui ait rappelé]**

> Résultat : trois mois plus tard, quand tu demandes des idées de repas, il se souvient que t'es végétarien, qu'il te faut des recettes rapides, et que t'as un budget précis. Sans que tu lui rappelles quoi que ce soit.

**[Écran : montrer le badge "Memories injected" sur un message du Agent — cliquer dessus pour voir quels souvenirs ont été utilisés pour formuler la réponse]**

> Tu peux même voir exactement quels souvenirs le Agent a utilisé pour chaque réponse. Tout est transparent.

---

## 6. LE COMPACTING — COMMENT ÇA TIENT DANS LE CONTEXTE (3:30 — 4:00)

**[Écran : montrer une longue conversation avec beaucoup de messages. Un indicateur "Compacting" apparaît.]**

> Tu te demandes sûrement comment un Agent gère des mois de conversation sans exploser la fenêtre de contexte. C'est le compacting. Quand la conversation dépasse un certain seuil, Hivekeep résume automatiquement les anciens messages en gardant tous les détails importants.

**[Écran : montrer la CompactingCard dans le chat qui indique qu'un résumé a été créé + X mémoires extraites]**

> Les messages originaux ne sont jamais supprimés — tu peux toujours remonter dans l'historique. Mais le Agent travaille avec un résumé intelligent de tout ce qui s'est passé, plus les derniers messages en clair. C'est comme ça qu'il peut avoir une session qui dure des mois.

---

## 7. LES OUTILS — PLUS DE 100 OUTILS NATIFS (4:00 — 4:50)

**[Écran : envoyer un message au Agent comme "Cherche les dernières tendances en design web pour 2025". Le Agent utilise l'outil web_search, les résultats s'affichent dans des cartes de tool call repliables.]**

> Les Agents ne font pas que discuter. Ils ont accès à plus de 100 outils natifs. Recherche web, navigation de pages, lecture et écriture de fichiers, exécution de commandes shell, génération d'images…

**[Écran : montrer un Agent qui génère une image avec generate_image — l'image apparaît inline dans le chat]**

> Ils peuvent générer des images directement dans la conversation.

**[Écran : montrer la section MCP dans les settings — des serveurs MCP connectés (Google Calendar, Home Assistant, etc.)]**

> Et si ça suffit pas, tu connectes des serveurs MCP. C'est le protocole standard qui permet aux Agents d'accéder à n'importe quel service externe — ton calendrier, ta domotique, tes bases de données, tes outils de travail…

**[Écran : montrer un Agent qui crée son propre outil custom via register_tool — le script apparaît dans son workspace]**

> Et le plus dingue : un Agent peut créer ses propres outils. Il écrit un script, l'enregistre, et il peut le réutiliser à chaque conversation. Il s'améliore tout seul.

---

## 8. LES SOUS-TÂCHES — L'IA QUI DÉLÈGUE (4:50 — 5:30)

**[Écran : demander au Agent Dev "Fais-moi un résumé de ces 5 articles" avec des URLs. Le Agent spawn un sub-Agent (on voit la tâche apparaître dans l'onglet Tasks de la sidebar avec le statut "in_progress").]**

> Les Agents peuvent aussi déléguer du travail. Quand une tâche est trop lourde, un Agent crée un "sub-Agent" — un agent temporaire dédié à cette mission. Et il peut même faire appel à un autre Agent spécialisé si c'est plus pertinent.

**[Écran : montrer l'onglet Tasks dans la sidebar — la timeline avec les tâches groupées par jour, les indicateurs de statut (pending, in_progress, completed)]**

> Tu vois toutes les tâches en cours dans la sidebar. Et quand un sub-Agent a besoin d'une décision, il te pose la question directement dans le chat avec un prompt interactif.

**[Écran : montrer un HumanPromptCard — le sub-Agent demande "Quel format tu préfères pour le résumé ?" avec des boutons de choix]**

> C'est de la vraie collaboration humain-IA. Le Agent bosse de son côté, et il te sollicite seulement quand il a besoin de toi.

---

## 9. LES TÂCHES PLANIFIÉES (5:30 — 5:50)

**[Écran : aller dans l'onglet Jobs de la sidebar. Montrer un cron configuré "Veille tech quotidienne" avec l'expression cron "0 8 * * *" (tous les jours à 8h). Montrer le journal d'exécution avec les résultats passés.]**

> Et les Agents peuvent travailler tout seuls, même quand tu n'es pas là. Tu configures des tâches planifiées — un résumé d'actualités chaque matin, une veille technologique hebdo, un rappel récurrent — et ton Agent s'en occupe automatiquement. Les résultats apparaissent dans la conversation, prêts quand tu te connectes.

---

## 10. LES MINI-APPS (5:50 — 6:10)

**[Écran : aller dans l'onglet Apps de la sidebar. Montrer une mini-app créée par un Agent — par exemple un tracker de budget ou un dashboard. Cliquer dessus, l'app s'ouvre dans un panneau latéral.]**

> Et les Agents vont encore plus loin avec les mini-apps. Un Agent peut construire une petite application web interactive — un tracker, un dashboard, un formulaire — qui vit directement dans l'interface de Hivekeep. Tu lui demandes, il le code, et c'est prêt à utiliser.

---

## 11. SELF-HOSTED — VIE PRIVÉE TOTALE (6:10 — 6:40)

**[Écran : montrer la page Providers dans les Settings. On voit Ollama configuré avec des modèles locaux (Llama, Mistral, etc.). Montrer qu'il y a 22+ providers supportés.]**

> Tout ça tourne entièrement sur ta machine. Un seul process, un seul fichier SQLite, zéro infrastructure externe. Tu choisis ton fournisseur d'IA parmi plus de 20 providers — OpenAI, Anthropic, Mistral, Groq… ou des modèles 100% locaux avec Ollama. Tes données ne sortent jamais de ton réseau.

**[Écran : montrer le Vault dans les settings — des secrets masqués (GITHUB_TOKEN, NOTION_API_KEY…). Montrer l'indicateur de chiffrement AES-256.]**

> Les secrets — clés API, tokens, mots de passe — sont chiffrés en AES-256. Et si tu partages un secret par mégarde dans le chat, le Agent peut le stocker dans le coffre-fort et censurer le message automatiquement.

---

## 12. MULTI-UTILISATEUR & MULTI-PLATEFORME (6:40 — 7:00)

**[Écran : montrer Settings → Users avec plusieurs utilisateurs listés (admin + membres). Puis montrer un message dans le chat préfixé par un autre prénom — le Agent s'adresse à la bonne personne.]**

> Hivekeep est multi-utilisateur. Invite ta famille, tes colocs, tes collègues. Tout le monde partage les mêmes Agents, mais chaque personne est identifiée. Le Agent sait à qui il parle et adapte sa réponse.

**[Écran : montrer Settings → Channels avec Telegram, Discord, Slack connectés]**

> Et tu n'es pas limité à l'interface web. Connecte Telegram, Discord, Slack, WhatsApp ou Signal. Parle à tes Agents depuis n'importe où — même contexte, même mémoire, même intelligence.

---

## 13. CONCLUSION + CTA (7:00 — 7:20)

**[Écran : retour sur la vue principale. Interaction fluide avec un Agent — message envoyé, réponse qui stream en temps réel, tool calls qui s'affichent, tout est smooth. Zoom arrière pour montrer l'interface complète avec les palettes de couleurs (basculer entre Aurora, Ocean, Sakura en 2 secondes).]**

> Hivekeep, c'est l'assistant IA que j'ai toujours voulu construire. Open-source, self-hosted, avec de vrais agents qui te connaissent, qui collaborent, et qui s'améliorent avec le temps. Le lien est dans la description. Star le repo, déploie-le en un docker run, et dis-moi ce que t'en penses.

---

## Notes de production

### Préparation avant le tournage
- **Créer 5-6 Agents** à l'avance avec des identités bien définies et des avatars générés
- **Peupler la mémoire** : avoir quelques semaines de conversations simulées pour que les mémoires soient crédibles
- **Préparer les tool calls** : s'assurer que la recherche web et la génération d'images fonctionnent bien
- **Configurer un cron** avec un journal d'exécution existant (quelques jours de résultats)
- **Créer une mini-app** fonctionnelle à montrer
- **Avoir au moins 2 utilisateurs** pour montrer le multi-user
- **Connecter au moins un channel** (Telegram est le plus visuel)

### Technique
- **Résolution** : 1920×1080 minimum, thème dark recommandé (palette Aurora = plus cinématique)
- **Musique** : lo-fi ou électro ambient en fond, volume bas (15-20%)
- **Transitions** : cuts simples entre les sections, pas d'effets tape-à-l'œil
- **Rythme** : ne pas rusher — laisser les démos respirer à l'écran, surtout le streaming des réponses
- **Cursor** : utiliser un curseur agrandi et visible, mouvements fluides
- **Zooms** : zoomer sur les détails importants (mémoires injectées, catégories, tool calls)

### Chapitres YouTube recommandés
- 0:00 — Introduction
- 0:25 — Le problème des chatbots actuels
- 1:00 — C'est quoi un Agent ?
- 2:00 — Le Hub intelligent
- 2:30 — La mémoire à long terme
- 3:30 — Le compacting
- 4:00 — +100 outils natifs & MCP
- 4:50 — Sous-tâches & délégation
- 5:30 — Tâches planifiées (crons)
- 5:50 — Mini-apps
- 6:10 — Self-hosted & vie privée
- 6:40 — Multi-utilisateur & multi-plateforme
- 7:00 — Conclusion

### Thumbnail
- Interface Hivekeep en dark mode avec plusieurs Agents dans la sidebar
- Texte accrocheur : "Vos propres agents IA — Self-hosted"
- Avatar d'un Agent en gros plan à droite
