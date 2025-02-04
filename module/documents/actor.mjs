export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system || {};

    if (systemData._initialized) return;
    systemData._initialized = true;

    systemData.focusPoints ??= { base: 0, current: 0, isVisible: false };
    systemData.stamina ??= { max: 4, current: 4 };

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

  async updateBaseGroupSynergy() {
    const connections = this.system.relationships.connections;
    if (!connections) return;
  
    // Calcul du Discord Level global avec valeurs arrondies
    const totalDiscordLevel = connections.reduce((sum, connection) => {
      const discordValue = Math.round(connection.affinity.value * connection.dynamic.value);
      return sum + discordValue;
    }, 0);
  
    // Calcul du Discord Level du groupe avec valeurs arrondies
    const currentLeader = game.actors.get(this.system.relationships.currentGroupLeader);
    if (!currentLeader) return;
  
    const groupMembers = currentLeader.system.relationships.characterGroup.members;
    const groupDiscordLevel = connections.reduce((sum, connection) => {
      if (groupMembers.includes(connection.characterId)) {
        const discordValue = Math.round(connection.affinity.value * connection.dynamic.value);
        return sum + discordValue;
      }
      return sum;
    }, 0);
  
    await this.update({
      'system.relationships.allConnectionsDiscordValue': totalDiscordLevel,
      'system.relationships.discordValueWithinGroup': groupDiscordLevel
    });
  }

  async updateDiscordValues() {
    const connections = this.system.relationships.connections;
    
    // Mise à jour des valeurs Discord pour chaque connexion
    const updatedConnections = connections.map(conn => ({
      ...conn,
      discordValue: Math.round(conn.affinity.value * conn.dynamic.value)
    }));
  
    await this.update({
      'system.relationships.connections': updatedConnections
    });
  
    // Recalculer les totaux
    await this.updateBaseGroupSynergy();
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

  // 🔥 Modifier la condition : Au lieu de "si < 3 alors 0", on met "si < 2 alors 0"
  if (groupSize < 2) return 0;

  // 🔥 Base synergy dès 2 membres : 10 + (nombre de membres au carré)
  const baseSynergy = 10 + (groupSize * groupSize);

  // 🔥 Récupérer le groupe via le Leader (et non ce personnage)
  const currentLeader = game.actors.get(this.system.relationships.currentGroupLeader);
  if (!currentLeader) {
      console.error(`⛔ Erreur : Impossible de récupérer le leader pour calculer la synergie.`);
      return 0;
  }

  const groupMembers = currentLeader.system.relationships.characterGroup.members;

  // 🔥 Soustraire les discord within group de chaque membre
  const totalGroupDiscord = groupMembers.reduce((sum, memberId) => {
      if (memberId === "ghost_member") return sum;
      const member = game.actors.get(memberId);
      return sum + (member?.system.relationships.discordValueWithinGroup || 0);
  }, 0);

  return baseSynergy - totalGroupDiscord;
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
    const connections = this.system.relationships.connections;
    if (!connections) return;
  
    const totalDiscordLevel = connections.reduce((sum, connection) => {
      const discordValue = Math.round(connection.affinity.value * connection.dynamic.value);
      return sum + discordValue;
    }, 0);
  
    const currentLeader = game.actors.get(this.system.relationships.currentGroupLeader);
    if (!currentLeader) return;
  
    const groupMembers = currentLeader.system.relationships.characterGroup.members;
    const groupDiscordLevel = connections.reduce((sum, connection) => {
      if (groupMembers.includes(connection.characterId)) {
        const discordValue = Math.round(connection.affinity.value * connection.dynamic.value);
        return sum + discordValue;
      }
      return sum;
    }, 0);
  
    await this.update({
      'system.relationships.allConnectionsDiscordValue': totalDiscordLevel,
      'system.relationships.discordValueWithinGroup': groupDiscordLevel
    });
  
    await this.checkAndPropagateGroupTies();
    this.render(false); // <- Forcer un rafraîchissement
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
      case 1: return "Enemy";
      case 2: return "Acquaintance";
      case 3: return "Friend";
      case 4: return "Soulmate";
      default: return "Unknown";
    }
  }

  _getDynamicLabel(value) {
    switch (value) {
      case 1: return "Superior";
      case 2: return "Inferior";
      case 3: return "Equal";
      case 4: return "Rival";
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