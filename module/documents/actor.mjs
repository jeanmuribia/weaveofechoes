

export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();

    console.log(`🚀 [DEBUG] prepareData() a été appelé pour "${this.name}"`);

    // Accéder aux données du système
    const systemData = this.system || {};

    console.log(`🧐 [CHECK] Avant modification - system:`, structuredClone(systemData));

    // Vérification pour éviter les réinitialisations multiples
    if (systemData._initialized) return;
    systemData._initialized = true;

    // Initialisation des Focus Points
    systemData.focusPoints ??= { base: 0, current: 0, isVisible: false };

    // Initialisation de la Stamina
    systemData.stamina ??= { max: 4, current: 4 };

    // Initialisation des Attributs
    const attributes = ["body", "martial", "soul", "elementary", "mind", "rhetoric"];
    systemData.attributes ??= {};
    attributes.forEach((attr, index) => {
      systemData.attributes[attr] ??= {};
      systemData.attributes[attr].baseValue ??= "neutral";
      systemData.attributes[attr].currentValue ??= systemData.attributes[attr].baseValue;
      systemData.attributes[attr].injury ??= false;
      systemData.attributes[attr].order = index + 1;
    });

    // Initialisation des Tempers
    const tempers = ["passion", "empathy", "rigor", "independence"];
    systemData.tempers ??= {};
    tempers.forEach(temper => {
      systemData.tempers[temper] ??= {};
      systemData.tempers[temper].baseValue ??= "neutral";
      systemData.tempers[temper].currentValue ??= systemData.tempers[temper].baseValue;
      systemData.tempers[temper].injury ??= false;
    });

    // Initialisation des Wounds
    systemData.wounds ??= { wound1: false, wound2: false, wound3: false, knockedOut: false };

    // Initialisation des Mastery Points
    systemData.masteryLevel ??= 0;
    systemData.masteryPoints ??= 0;

    // Initialisation des Relations
    systemData.relationships ??= {
      connections: [],
      currentGroup: "",
      characterGroup: {
        id: "",
        name: "",
        members: [],
        isInHisOwnGroup: true
      }
    };

    console.log(`🔍 [BEFORE FIX] characterGroup:`, systemData.relationships.characterGroup);

  // Vérifier si le groupe du personnage est manquant et le créer avec les valeurs prévues
if (!systemData.relationships.characterGroup.id) {
  console.log(`⚠️ Création d'un nouveau groupe pour "${this.name}"`);

  const groupId = foundry.utils.randomID();
  systemData.relationships.characterGroup.id = groupId;
  systemData.relationships.characterGroup.name = `${this.name}'s Group`;

  // ✅ On ajoute le personnage + le membre fantôme
  systemData.relationships.characterGroup.members = [this.id, "ghost_member"]; 

  systemData.relationships.characterGroup.isInHisOwnGroup = true;

  // Définir le currentGroup par défaut sur le groupe du personnage
  systemData.relationships.currentGroup = groupId;

  console.log(`✅ [FIXED] Nouveau groupe créé avec ghost_member - ID: ${groupId}`);
}

// 📌 Vérifier si le ghost_member a disparu et le remettre si besoin
if (!systemData.relationships.characterGroup.members.includes("ghost_member")) {
  systemData.relationships.characterGroup.members.push("ghost_member");
  console.log(`👻 [GHOST] ghost_member réajouté pour "${this.name}"`);
}

    console.log(`🎯 [AFTER FIX] characterGroup:`, systemData.relationships.characterGroup);

    // Supprimer les connexions vides
    systemData.relationships.connections = systemData.relationships.connections.filter(conn => conn.characterId);

    // FORCER LA SAUVEGARDE AVEC `update()`
    this.update({
      "system.relationships.characterGroup": systemData.relationships.characterGroup,
      "system.relationships.currentGroup": systemData.relationships.currentGroup
    }).then(() => {
      console.log(`💾 [SAVED] Group ID sauvegardé pour "${this.name}"`);
    }).catch(err => {
      console.error(`❌ [ERROR] Impossible de sauvegarder le groupe pour "${this.name}"`, err);
    });

    console.log(`🧐 [CHECK] Après modification - system:`, structuredClone(systemData));
  }



  

  _getAffinityLabel(value) {
    switch (value) {
        case 1:
            return "Enemy";
        case 2:
            return "Acquaintance";
        case 3:
            return "Friend";
        case 4:
            return "Soulmate";
        default:
            return "Unknown";
    }
}

_getDynamicLabel(value) {
  switch (value) {
      case 1:
          return "Superior";
      case 2:
          return "Inferior";
      case 3:
          return "Equal";
      case 4:
          return "Rival";
      default:
          return "Unknown";
  }
}
async changeGroup(newGroupId) {
  try {
    const currentGroupId = this.system.relationships.currentGroup;

    if (currentGroupId === newGroupId) {
      return;
    }

    const newGroupOwner = game.actors.find(actor =>
      actor.system.relationships.characterGroup.id === newGroupId
    );

    if (newGroupOwner) {
      const newMembers = [...newGroupOwner.system.relationships.characterGroup.members];
      if (!newMembers.includes(this.id)) {
        newMembers.push(this.id);
        await newGroupOwner.update({
          'system.relationships.characterGroup.members': newMembers
        });
      }
    }

    await this.update({
      'system.relationships.currentGroup': newGroupId,
      'system.relationships.characterGroup.isInHisOwnGroup': false
    });

    if (currentGroupId) {
      const oldGroupOwner = game.actors.find(actor =>
        actor.system.relationships.characterGroup.id === currentGroupId
      );

      if (oldGroupOwner) {
        let oldMembers = [...oldGroupOwner.system.relationships.characterGroup.members];
        const updatedMembers = oldMembers.filter(memberId => memberId !== this.id);

        // Si le tableau est vide, ajoute une valeur par défaut
        if (updatedMembers.length === 0) {
          updatedMembers.push("No one in this group");
        }

        await oldGroupOwner.update({
          'system.relationships.characterGroup.members': updatedMembers
        });
      }
    }

    this.render(false);

  } catch (error) {
    console.error('Erreur lors du changement de groupe :', error);
    ui.notifications.error('Une erreur est survenue lors du changement de groupe');
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

