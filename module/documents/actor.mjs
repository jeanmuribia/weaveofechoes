export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system || {};
// ✅ Vérifier que `relationships` existe
systemData.relationships ??= {
  connections: [],
  currentGroupLeader: "",
  characterGroup: {
      name: "",
      members: [],
      isInHisOwnGroup: true
  }
};

// ✅ Vérifier que `connections` est bien un tableau
if (!Array.isArray(systemData.relationships.connections)) {
  console.warn("⚠️ [prepareData] - `connections` n'est pas un tableau, initialisation forcée.");
  systemData.relationships.connections = [];
}




    // ✅ Initialisation des attributs
    const attributes = ["body", "martial", "soul", "elementary", "mind", "rhetoric"];
    systemData.attributes ??= {};
    attributes.forEach((attr, index) => {
        systemData.attributes[attr] ??= {};
        systemData.attributes[attr].baseValue ??= "neutral";
        systemData.attributes[attr].currentValue ??= systemData.attributes[attr].baseValue;
        systemData.attributes[attr].injury ??= false;
        systemData.attributes[attr].order = index + 1;
    });

    // ✅ Initialisation des `tempers`
    const tempers = ["passion", "empathy", "rigor", "independence"];
    systemData.tempers ??= {};
    tempers.forEach(temper => {
        systemData.tempers[temper] ??= {};
        systemData.tempers[temper].baseValue ??= "neutral";
        systemData.tempers[temper].currentValue ??= systemData.tempers[temper].baseValue;
        systemData.tempers[temper].injury ??= false;
    });

    // ✅ Initialisation des blessures
    systemData.wounds ??= { wound1: false, wound2: false, wound3: false, knockedOut: false };

    // ✅ Initialisation des points de maîtrise
    systemData.masteryLevel ??= 0;
    systemData.masteryPoints ??= 0;

    // ✅ Vérification et correction des `connections`
    for (let connection of systemData.relationships.connections) {
        connection.affinity ??= { value: 2, label: "Acquaintance" };
        connection.dynamic ??= { value: 0, label: "Equal" };
        connection.discordValue = connection.affinity.value + connection.dynamic.value;
        connection.bio ??= "";
    }

    // 🔄 Suppression des connexions sans `characterId`
    systemData.relationships.connections = systemData.relationships.connections.filter(conn => conn.characterId);

    // ✅ Initialisation du `currentGroupLeader`
    if (!systemData.relationships.currentGroupLeader) {
        systemData.relationships.currentGroupLeader = this.id;
        systemData.relationships.characterGroup.name = `${this.name}'s Group`;
        systemData.relationships.characterGroup.members = [this.id, "ghost_member"];
        systemData.relationships.characterGroup.isInHisOwnGroup = true;
    }

    // ✅ Ajout du `ghost_member` si absent
    if (!systemData.relationships.characterGroup.members.includes("ghost_member")) {
        systemData.relationships.characterGroup.members.push("ghost_member");
    }

    // 🔄 Mise à jour des points de Focus
    let baseFocus = 0;
    for (const relation of systemData.relationships.connections || []) {
        const modifier = Math.ceil(relation.discordValue / 2);
        if (modifier === 3) {
            baseFocus += 2;
        } else if (modifier === 2) {
            baseFocus += 1;
        }
    }
    systemData.focusPoints.base = baseFocus;

    // 🔄 Initialiser `currentSynergy` si inexistant
    if (systemData.relationships.groupSynergy.current === undefined) {
        systemData.relationships.groupSynergy.current = 0;
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
      console.error(`⛔ Leader introuvable pour ${this.name}`);
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
          const actorDiscordModifier = Math.ceil((connection.affinity.value + connection.dynamic.value) / 2);
          const otherMember = game.actors.get(otherId);
          const reverseConnection = otherMember?.system.relationships.connections.find(conn => conn.characterId === memberId);
          const targetDiscordModifier = reverseConnection
              ? Math.ceil((reverseConnection.affinity.value + reverseConnection.dynamic.value) / 2)
              : actorDiscordModifier;
          const synergyValue = Math.ceil((actorDiscordModifier + targetDiscordModifier) / 2);
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
  async recalcAndPropagateGroupSynergy() {
    // 1. Calculer la nouvelle valeur de base
    const newBase = this.calculateBaseSynergy();
    
    // 2. Récupérer la valeur actuelle déjà stockée (si elle existe)
    const existingGroupSynergy = this.system.relationships.groupSynergy || {};
    const currentValue = (typeof existingGroupSynergy.current !== "undefined")
      ? existingGroupSynergy.current
      : newBase; // si aucun current n'existe, on le définit comme newBase
  
    // 3. Préparer l'objet à mettre à jour en ne modifiant que la base
    const newGroupSynergy = {
      base: newBase,
      current: currentValue
    };
  
    // 4. Mettre à jour l'acteur courant
    await this.update({ "system.relationships.groupSynergy": newGroupSynergy });
  
    // 5. Propager uniquement la base aux membres du groupe (si tu souhaites les synchroniser)
    const currentLeaderId = this.system.relationships.currentGroupLeader;
    const groupLeader = game.actors.get(currentLeaderId);
    if (groupLeader) {
      const members = groupLeader.system.relationships.characterGroup.members.filter(
        id => id !== "ghost_member"
      );
      for (const memberId of members) {
        const member = game.actors.get(memberId);
        if (member) {
          // Ici, tu peux choisir de ne mettre à jour que la partie "base" chez les membres,
          // ou alors de ne rien changer si tu souhaites que chacun garde sa propre valeur "current"
          await member.update({
            "system.relationships.groupSynergy.base": newBase
          });
          // Rerender si nécessaire
          if (member.sheet) {
            member.sheet.render(false);
          }
        }
      }
    }
  
    // 6. Rerender la fiche actuelle et le tracker de groupe, le cas échéant
    if (this.sheet) {
      this.sheet.render(false);
    }
    if (game.weaveOfEchoes.groupsTracker) {
      game.weaveOfEchoes.groupsTracker.render();
    }
  }
  
  
  displayMissingTies(missingTies) {
    let warningText = `⚠️ Relations manquantes avec : ${missingTies.join(", ")}`;
    ui.notifications.warn(warningText);
    document.querySelector(".group-synergy-display").textContent = warningText;
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

  async updateFocus(newFocus) {
    await this.update({ "system.focusPoints.current": newFocus });

    // 🔄 Mettre à jour visuellement tous les membres dans le Group Tracker
    const leader = game.actors.get(this.system.relationships.currentGroupLeader);
    if (!leader) return;

    for (const memberId of leader.system.relationships.characterGroup.members) {
        const member = game.actors.get(memberId);
        if (member) {
            await member.update({ "system.focusPoints.current": newFocus });
        }
    }
}

async updateStamina(newStamina) {
  await this.update({ "system.stamina.current": newStamina });

  // 🔄 Mettre à jour visuellement tous les membres dans le Group Tracker
  const leader = game.actors.get(this.system.relationships.currentGroupLeader);
  if (!leader) return;

  for (const memberId of leader.system.relationships.characterGroup.members) {
      const member = game.actors.get(memberId);
      if (member) {
          await member.update({ "system.stamina.current": newStamina });
      }
  }
}



async updateWounds(wounds) {
  await this.update({ "system.wounds": wounds });

  // 🔄 Mettre à jour tous les membres du groupe
  const leader = game.actors.get(this.system.relationships.currentGroupLeader);
  if (!leader) return;

  for (const memberId of leader.system.relationships.characterGroup.members) {
      const member = game.actors.get(memberId);
      if (member) {
          await member.update({ "system.wounds": wounds });
      }
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