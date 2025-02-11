export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system || {};



    // ✅ Vérifier que `connections` est bien un tableau
if (!Array.isArray(systemData.relationships?.connections)) {
  console.warn("⚠️ [prepareData] - `connections` n'est pas un tableau, initialisation forcée.");
  systemData.relationships.connections = [];
}

    const attributes = ["body", "martial", "soul", "elementary", "mind", "rhetoric"];
    systemData.attributes ??= {};
    attributes.forEach((attr, index) => {
      systemData.attributes[attr] ??= {};
      systemData.attributes[attr].baseValue ??= "neutral";
      systemData.attributes[attr].currentValue ??= systemData.attributes[attr].baseValue;
      systemData.attributes[attr].injury ??= false;
      systemData.attributes[attr].order = index + 1;
    });

    const tempers = ["passion", "empathy", "rigor", "independence"];
    systemData.tempers ??= {};
    tempers.forEach(temper => {
      systemData.tempers[temper] ??= {};
      systemData.tempers[temper].baseValue ??= "neutral";
      systemData.tempers[temper].currentValue ??= systemData.tempers[temper].baseValue;
      systemData.tempers[temper].injury ??= false;
    });

    systemData.wounds ??= { wound1: false, wound2: false, wound3: false, knockedOut: false };
    systemData.masteryLevel ??= 0;
    systemData.masteryPoints ??= 0;

    systemData.relationships ??= {
      connections: [],
      currentGroupLeader: "",
      characterGroup: {
        name: "",
        members: [],
        isInHisOwnGroup: true
      }
    };


    for (let connection of systemData.relationships.connections) {
       
        connection.affinity ??= { value: 2, label: "Acquaintance" };
        connection.dynamic ??= { value: 0, label: "Equal" };
        connection.discordValue = connection.affinity.value + connection.dynamic.value;

    }

    systemData.relationships.connections = systemData.relationships.connections.map(connection => {
      connection.bio ??= "";
      return connection;
    });


this.update({
    "system.relationships.connections": systemData.relationships.connections
});

    if (!systemData.relationships.currentGroupLeader) {
      systemData.relationships.currentGroupLeader = this.id;
      systemData.relationships.characterGroup.name = `${this.name}'s Group`;
      systemData.relationships.characterGroup.members = [this.id, "ghost_member"];
      systemData.relationships.characterGroup.isInHisOwnGroup = true;
    }

    if (!systemData.relationships.characterGroup.members.includes("ghost_member")) {
      systemData.relationships.characterGroup.members.push("ghost_member");
    }

    systemData.relationships.connections = systemData.relationships.connections.filter(conn => conn.characterId);

    this.update({
      "system.relationships.characterGroup": systemData.relationships.characterGroup,
      "system.relationships.currentGroupLeader": systemData.relationships.currentGroupLeader
    });

    this.updateBaseGroupSynergy();
    this.synchronizeBaseGroupSynergy();

    this.getGroupSize();


    systemData.relationships.connections = systemData.relationships.connections.map(connection => {
      connection.affinity ??= { value: 2, label: "Acquaintance" };
      connection.dynamic ??= { value: 0, label: "Equal" };
      connection.discordValue = connection.affinity.value + connection.dynamic.value;
      connection.discordModifier = Math.ceil(connection.discordValue / 2); // 🔥 Nouveau calcul ici
  
      return connection;
    
  });
 
   // 2️⃣ Calcul des Focus Points en fonction des relations
   let baseFocus = 0;

   for (const relation of systemData.relationships.connections || []) {
       if (relation.discordModifier === 3) {
           baseFocus += 2;  // +2 points pour une relation avec un modificateur de 3
       } else if (relation.discordModifier === 2) {
           baseFocus += 1;  // +1 point pour une relation avec un modificateur de 1
       }
   }

   systemData.focusPoints.base = baseFocus;

    // Initialiser currentSynergy à 0 si elle n'existe pas encore
    if (systemData.relationships.groupSynergy.current === undefined) {
      systemData.relationships.groupSynergy.current = 0;
      console.log(`🔄 Initialisation de currentSynergy à 0 pour ${this.name}`);
  }


  }

  getGroupLeader() {
    if (!this.system.relationships.currentGroupLeader) {
      console.error(`⛔ Erreur : ${this.name} n'a pas de leader de groupe.`);
      return null;
    }
    return game.actors.get(this.system.relationships.currentGroupLeader);
  }

  async changeGroup(newLeaderId) {
    try {
      const currentLeaderId = this.system.relationships.currentGroupLeader;

      if (currentLeaderId === newLeaderId) {
        return;
      }

      const newLeader = game.actors.get(newLeaderId);

      if (newLeader) {
        const newMembers = [...newLeader.system.relationships.characterGroup.members];
        if (!newMembers.includes(this.id)) {
          newMembers.push(this.id);
          await newLeader.update({
            'system.relationships.characterGroup.members': newMembers
          });
        }
      }

      await this.update({
        'system.relationships.currentGroupLeader': newLeaderId,
        'system.relationships.characterGroup.isInHisOwnGroup': newLeaderId === this.id
      });

   
await this.getGroupSize();  // Ajoute ceci pour forcer le calcul juste après



this.render(false);  // Assure-toi que la fiche est bien mise à jour

      if (currentLeaderId) {
        const oldLeader = game.actors.get(currentLeaderId);
        
        if (oldLeader) {
          let oldMembers = [...oldLeader.system.relationships.characterGroup.members];
          const updatedMembers = oldMembers.filter(memberId => memberId !== this.id);

          if (updatedMembers.length === 0) {
            updatedMembers.push("ghost_member");
          }

          await oldLeader.update({
            'system.relationships.characterGroup.members': updatedMembers
          });
        }
      }
      await this.checkAndPropagateGroupTies();

      this.render(false);

    } catch (error) {
      console.error('Erreur lors du changement de groupe :', error);
      ui.notifications.error('Une erreur est survenue lors du changement de groupe');
    }
  }


  getGroupSize() {
    const currentLeaderId = this.system.relationships.currentGroupLeader;
    if (!currentLeaderId) {
        console.warn(`⚠️ Pas de leader de groupe pour ${this.name}`);
        return 0;
    }

    const currentLeader = game.actors.get(currentLeaderId);
    if (!currentLeader) {
        console.error(`⛔ Leader introuvable pour ${this.name}`);
        return 0;
    }

    const groupMembers = currentLeader.system.relationships.characterGroup.members.filter(m => m !== "ghost_member");


    return groupMembers.length;
}

  
calculateBaseSynergy() {
  const groupSize = this.getGroupSize();

  if (groupSize < 2) return 0;

  let baseSynergy = 4 + (groupSize * 2);


  const currentLeader = game.actors.get(this.system.relationships.currentGroupLeader);
  if (!currentLeader) {
      console.error(`⛔ Erreur : Impossible de récupérer le leader pour calculer la synergie.`);
      return 0;
  }

  const groupMembers = currentLeader.system.relationships.characterGroup.members;
  let countedPairs = new Set();

  for (const memberId of groupMembers) {
    if (memberId === "ghost_member") continue;

    const member = game.actors.get(memberId);
    if (!member) continue;

    for (const connection of member.system.relationships.connections) {
      const otherId = connection.characterId;
      if (!groupMembers.includes(otherId) || countedPairs.has(`${otherId}-${memberId}`)) continue;
      countedPairs.add(`${memberId}-${otherId}`);

      // 🔍 Récupérer le `discordModifier` de l’acteur vers la cible
      const actorDiscordModifier = Math.ceil((connection.affinity.value + connection.dynamic.value) / 2);

      // 🔍 Trouver la connexion dans l’autre sens (cible -> acteur)
      const otherMember = game.actors.get(otherId);
      if (!otherMember) continue;

      const reverseConnection = otherMember.system.relationships.connections.find(conn => conn.characterId === memberId);
      const targetDiscordModifier = reverseConnection
        ? Math.ceil((reverseConnection.affinity.value + reverseConnection.dynamic.value) / 2)
        : actorDiscordModifier; // Si pas de relation inverse, on garde la valeur actuelle

      // 🔥 Calculer la moyenne arrondie au supérieur
      const synergyValue = Math.ceil((actorDiscordModifier + targetDiscordModifier) / 2);
  

      // 🔄 Appliquer la valeur dans le calcul
      switch (synergyValue) {
        case 0: baseSynergy += 2; break;
        case 1: baseSynergy += 1; break;
        case 2: baseSynergy -= 1; break;
        case 3: baseSynergy -= 2; break;
      }
    }
  }


  return baseSynergy;
}


  async checkAndPropagateGroupTies() {
    const currentLeader = game.actors.get(this.system.relationships.currentGroupLeader);
    if (!currentLeader) return;
  
    const members = currentLeader.system.relationships.characterGroup.members
      .filter(id => id !== "ghost_member");
  
    let missingTies = [];
  
    // Vérifier les relations pour chaque membre
    for (const memberId of members) {
      const member = game.actors.get(memberId);
      if (!member) continue;
  
      for (const otherMemberId of members) {
        if (memberId === otherMemberId) continue;
        const otherMember = game.actors.get(otherMemberId);
        if (!otherMember) continue;
  
        // Vérifier si la connexion existe
        const hasConnection = member.system.relationships.connections
          .some(conn => conn.characterId === otherMemberId);
  
        if (!hasConnection) {
          missingTies.push(`${member.name} ➡️ ${otherMember.name}`);
        }
      }
    }
  
    // Mise à jour pour chaque acteur dans le groupe
    for (const memberId of members) {
      const member = game.actors.get(memberId);
      if (member) {
        await member.update({
          'system.relationships.missingGroupTies': missingTies
        });
        member.render(false); // Rafraîchir immédiatement
      }
    }
  }
  
  displayMissingTies(missingTies) {
    let warningText = `⚠️ Relations manquantes avec : ${missingTies.join(", ")}`;
    ui.notifications.warn(warningText);
    document.querySelector(".group-synergy-display").textContent = warningText;
  }

  async updateBaseGroupSynergy() {
    const newSynergy = this.calculateBaseSynergy();
    
    await this.update({
      "system.relationships.groupSynergy.base": newSynergy
    });
  
    this.render(false); // 🔄 Rafraîchir la fiche si elle est ouverte
  }

  synchronizeBaseGroupSynergy() {
    const groupLeader = game.actors.get(this.system.relationships.currentGroupLeader);
  
    if (groupLeader) {
      const baseSynergy = groupLeader.system.relationships.characterGroup.baseGroupSynergy;
      this.update({
        "system.relationships.characterGroup.baseGroupSynergy": baseSynergy
      });
    }
  }

  _getAffinityLabel(value) {
    switch (value) {
      case 0: return "Soulmate";
      case 1: return "Friend";
      case 2: return "Acquaintance";
      case 3: return "Enemy";
      default: return "Unknown";
    }
  }
  
  _getDynamicLabel(value) {
    switch (value) {
      case 0: return "Equal";
      case 1: return "Rival";
      case 2: return "Dependent";
      case 3: return "Dominant";
      default: return "Unknown";
    }
  }
}

// Register Handlebars helpers
Handlebars.registerHelper("capitalize", function(str) {
  if (typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('sort', function(context, field) {
  if (!Array.isArray(context)) return [];
  return context.sort((a, b) => {
    if (a[field] < b[field]) return -1;
    if (a[field] > b[field]) return 1;
    return 0;
  });
});

Handlebars.registerHelper('objectToArray', function(obj) {
  if (typeof obj !== 'object') return [];
  return Object.keys(obj).map(key => {
    return { ...obj[key], key };
  });
});