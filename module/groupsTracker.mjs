

export class GroupsTracker extends Application {
  constructor(options = {}) {
      super(options);
      this.groups = this.getValidGroups();
      this._woundSyncTimeout = null;
  }

  static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
          id: "groups-tracker",
          title: "Groups Tracker",
          template: "systems/weave_of_echoes/templates/groups-tracker.hbs",
          width: 400,
          height: "auto",
          resizable: true,
          classes: ["weave-of-echoes", "groups-tracker"]
      });
  }

  getData() {

    const groupsData = this.groups.map(group => {
      group.members = group.members.map(member => {
        const actor = game.actors.get(member.id);
        if (actor) {
          // Calculer le nombre de wounds actives sur l'acteur
          const wounds = actor.system.wounds;
          member.activeWounds = [wounds.wound1, wounds.wound2, wounds.wound3].filter(v => v === true).length;
        } else {
          member.activeWounds = 0;
        }
        return member;
      });
      return group;
    });
    return { groups: groupsData };
  }

  

  activateListeners(html) {
      super.activateListeners(html);


       // Forcer la synchronisation des wounds pour chaque groupe dès l'ouverture
  this.groups.forEach(group => {
    group.members.forEach(member => {
      const actor = game.actors.get(member.id);
      if (actor) {
        this.syncWounds(actor);
      }
    });
  });

  // À l'ouverture du tracker, synchroniser la synergie pour chaque groupe (basée sur le leader)
this.groups.forEach(group => {
  const leader = game.actors.get(group.id);
  if (leader) {
    this.syncSynergy(leader);
  }
});

Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (game.weaveOfEchoes.groupsTracker.disableVisualUpdate) return; // 🔥 Ignore si le flag est actif
  if (actor.ignoreRender) return; // 🚨 Empêche de rerender la fiche de perso pendant le Rest
  
  if (changes.system) {
    const keys = Object.keys(changes.system);
    const focusChanged = keys.some(key => key.includes("focusPoints"));
    const staminaChanged = keys.some(key => key.includes("stamina"));
    const woundsChanged = keys.some(key => key.includes("wounds"));

    if (focusChanged) {
      game.weaveOfEchoes.groupsTracker.syncFocus(actor);
    }
    if (staminaChanged) {
      game.weaveOfEchoes.groupsTracker.syncStamina(actor);
    }
    if (woundsChanged) {
      game.weaveOfEchoes.groupsTracker.syncWounds(actor);
    }
  }
});



  html.find(".rest-member-button").click(async (event) => {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.id;
    if (!actorId) {
      ui.notifications.error("Aucun identifiant trouvé pour le bouton Rest.");
      return;
    }
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error(`Acteur introuvable pour l'id ${actorId}.`);
      return;
    }
    await this.restMember(actor);
    // Rerender du tracker pour prendre en compte les nouvelles valeurs
    if (game.weaveOfEchoes.groupsTracker) {
      game.weaveOfEchoes.groupsTracker.render();
    }
  });

  html.find(".rest-group-button").click(async (event) => {
    event.preventDefault();
  
    const groupId = event.currentTarget.dataset.group;
    const groupLeader = game.actors.get(groupId);
  
    if (!groupLeader) {
      ui.notifications.error("Group leader not found.");
      return;
    }
  
    console.log(`🛏️ Lancement du Rest Group pour ${groupLeader.name}`);
  
    await this.restGroup(groupLeader);
  
    ui.notifications.info(`Le groupe ${groupLeader.name} a été restauré.`);
  });


      // Listener pour les boutons de synergie

      html.find(".synergy-button").click(async (event) => {
        event.preventDefault();
        
        const button = event.currentTarget;
        const groupId = button.dataset.groupId; // on suppose que c'est l'ID du leader ou d'un acteur de référence
        const action = button.dataset.action; // "increase", "decrease", "fill", "empty"
        
        const leader = game.actors.get(groupId);
        if (!leader) {
          console.error(`⛔ Leader introuvable pour le groupe ${groupId}`);
          return;
        }
        
        // Récupérer la valeur actuelle de synergy du leader (on utilise celle du leader comme référence)
        let currentValue = leader.system.relationships.groupSynergy.current || 0;
        // Calculer la nouvelle valeur en fonction de l'action
        switch (action) {
          case "increase":
            currentValue++;
            break;
          case "decrease":
            currentValue = Math.max(0, currentValue - 1);
            break;
          case "fill":
            currentValue = leader.system.relationships.groupSynergy.base;
            break;
          case "empty":
            currentValue = 0;
            break;
          default:
            console.error(`⚠️ Action inconnue : ${action}`);
            return;
        }
        
        // Récupérer tous les membres du groupe (exclure ghost_member si nécessaire)
        const members = leader.system.relationships.characterGroup.members.filter(
          id => id !== "ghost_member"
        );
        
        // Mettre à jour chaque membre avec la nouvelle valeur "current"
        for (const memberId of members) {
          const member = game.actors.get(memberId);
          if (member) {
            await member.update({ "system.relationships.groupSynergy.current": currentValue });
            if (member.sheet) {
              member.sheet.render(false);
            }
          }
        }
        
        // Rerender du tracker de groupe s'il existe
        if (game.weaveOfEchoes.groupsTracker) {
          game.weaveOfEchoes.groupsTracker.render();
        }
      });
      
      html.find(".close-tracker").click(() => this.close());

      // 🔥 Écoute les boutons de Focus
      html.find(".focus-btn").click(async (event) => {
          event.preventDefault();
          await this.updateStat(event, "focusPoints");
      });

      // 🔥 Écoute les boutons de Stamina
      html.find(".stamina-btn").click(async (event) => {
          event.preventDefault();
          await this.updateStat(event, "stamina");
      });

      html.find(".clickable-avatar").click((event) => {
        event.preventDefault();
    
        // Récupérer l'ID du personnage
        const actorId = event.currentTarget.dataset.id;
        if (!actorId) {
            console.error("⚠️ Aucune ID trouvée pour cet avatar !");
            return;
        }
    
        // Trouver l'acteur dans Foundry
        const actor = game.actors.get(actorId);
        if (!actor) {
            console.error(`⚠️ Impossible de trouver l'acteur avec l'ID ${actorId}`);
            return;
        }
    
        // Ouvrir la fiche du personnage
        actor.sheet.render(true);
    });
    
      html.find(".tracker-wound-btn").click(async (event) => {
        event.preventDefault();
        
        const button = event.currentTarget;
        const actorId = button.dataset.id;
        const action = button.dataset.action; // "wound" ou "heal"
      
        // Récupérer l'acteur concerné
        const actor = game.actors.get(actorId);
        if (!actor) {
          console.error(`⛔ Acteur introuvable pour l'ID ${actorId}`);
          return;
        }
      
        // Récupérer l'état des wounds depuis l'acteur
        const wounds = actor.system.wounds;
        const activeWounds = [wounds.wound1, wounds.wound2, wounds.wound3].filter(val => val === true).length;
        
        let newWoundCount;
        if (action === "wound") {
          if (activeWounds >= 3) {
            console.warn(`⚠️ ${actor.name} a déjà 3 wounds.`);
            return;
          }
          newWoundCount = activeWounds + 1;
        } else if (action === "heal") {
          if (activeWounds <= 0) {
            console.warn(`⚠️ ${actor.name} n'a aucun wound à guérir.`);
            return;
          }
          newWoundCount = activeWounds - 1;
        } else {
          console.error(`⚠️ Action inconnue : ${action}`);
          return;
        }
        
        
        // Si la fiche de personnage est ouverte et dispose de _handleWoundClick, on l'utilise ;
        // sinon, on met à jour directement les propriétés via actor.update.
        if (actor.sheet && typeof actor.sheet._handleWoundClick === "function") {
          await actor.sheet._handleWoundClick(newWoundCount);
        } else {
          // Mise à jour directe si la fiche n'est pas ouverte
          const updates = {
            "system.wounds.wound1": newWoundCount >= 1,
            "system.wounds.wound2": newWoundCount >= 2,
            "system.wounds.wound3": newWoundCount >= 3
          };
          await actor.update(updates);
        }
      });
      
      // Forcer la mise à jour dès qu'on rouvre le tracker
      this.groups = this.getValidGroups();
      this.render();
  }

  async updateStat(event, stat) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorId = button.dataset.id;

    if (!actorId) {
        console.error(`⛔ Erreur : Aucun ID d'acteur reçu pour ${stat} !`);
        return;
    }

    const targetActor = game.actors.get(actorId);
    if (!targetActor) {
        console.error(`⛔ Erreur : Acteur introuvable pour l'ID ${actorId} !`);
        return;
    }

    // Pour focusPoints, on peut ne pas avoir de "max" (ou le définir par défaut à Infinity)
    let newValue = targetActor.system[stat].current;
    const maxValue = targetActor.system[stat].max ?? Infinity;

    if (action === "increase") {
        if (newValue < maxValue) {
            newValue += 1;
        } else {
            console.warn(`⚠️ ${targetActor.name} a déjà sa ${stat} au maximum (${maxValue}).`);
            return;
        }
    } else if (action === "decrease") {
        newValue = Math.max(0, newValue - 1);
    }

    await targetActor.update({ [`system.${stat}.current`]: newValue });

    // Détermine la classe CSS à utiliser pour la mise à jour visuelle
    const elementClass = (stat === "focusPoints") ? "focus-value" : `${stat}-value`;
    const statElement = document.querySelector(`.${elementClass}[data-id="${actorId}"]`);
    if (statElement) {
        statElement.textContent = newValue;
    } else {
        console.warn(`⚠️ Élément HTML avec la classe ${elementClass} et data-id="${actorId}" non trouvé.`);
    }

    // Désactiver le bouton "+" si nécessaire
    const plusButton = document.querySelector(`.stat-button[data-stat="${stat}"][data-id="${actorId}"][data-action="increase"]`);
    if (plusButton) {
        plusButton.disabled = (newValue >= maxValue);
    }

      // Forcer la synchronisation des wounds dès l'ouverture
  this.groups.forEach(group => {
    group.members.forEach(member => {
      const actor = game.actors.get(member.id);
      if (actor) {
        this.syncWounds(actor);
      }
    });
  });
  
}



async  restMember(actor) {
  if (!actor) return;

  // 🔥 Désactiver temporairement les mises à jour visuelles
  game.weaveOfEchoes.groupsTracker.disableVisualUpdate = true;
  actor.ignoreRender = true;  // 🚨 On empêche la fiche de se rafraîchir pendant le rest
  
  // 🔄 Mise à jour des stats de base
  await actor.update({
    "system.stamina.current": actor.system.stamina.max,
    "system.focusPoints.current": actor.system.focusPoints.base
  });

  // 🏥 Guérison progressive des wounds
  let wounds = actor.system.wounds;
  let activeWounds = [wounds.wound1, wounds.wound2, wounds.wound3].filter(v => v === true).length;

  while (activeWounds > 0) {
    if (actor.sheet && typeof actor.sheet._handleWoundClick === "function") {
      await actor.sheet._handleWoundClick(activeWounds - 1);
    } else {
      const updates = {
        "system.wounds.wound1": activeWounds - 1 >= 1,
        "system.wounds.wound2": activeWounds - 1 >= 2,
        "system.wounds.wound3": activeWounds - 1 >= 3
      };
      await actor.update(updates);
    }
    await new Promise(resolve => setTimeout(resolve, 50)); // 🕐 Attente pour éviter les updates instantanées

    // 🔄 Recompter les wounds actives après chaque mise à jour
    wounds = actor.system.wounds;
    activeWounds = [wounds.wound1, wounds.wound2, wounds.wound3].filter(v => v === true).length;
  }

  // ✅ Réactivation des mises à jour visuelles (tracker et fiche)
  game.weaveOfEchoes.groupsTracker.disableVisualUpdate = false;
  actor.ignoreRender = false; 

  // 🔥 Rerender final propre, seulement une fois toutes les updates appliquées
  if (actor.sheet) {
    actor.sheet.render(false);
  }
  if (game.weaveOfEchoes.groupsTracker) {
    game.weaveOfEchoes.groupsTracker.render();
  }

  console.log(`Rest terminé pour ${actor.name}`);
}

async  restGroup(groupLeader) {
  if (!groupLeader) return;

  console.log(`Rest Group lancé pour ${groupLeader.name}`);

  // 🔄 Récupérer les membres du groupe (exclut "ghost_member")
  const members = groupLeader.system.relationships.characterGroup.members.filter(id => id !== "ghost_member");

  // 🎯 Récupérer la Base Synergy et l'appliquer à Current Synergy
  const baseSynergy = groupLeader.system.relationships.groupSynergy.base || 0;

  // 🔥 Met à jour la currentSynergy pour tout le groupe
  for (const memberId of members) {
    const member = game.actors.get(memberId);
    if (member) {
      await member.update({ "system.relationships.groupSynergy.current": baseSynergy });
    }
  }

  console.log(`➡️ Current Synergy de ${groupLeader.name} et des membres du groupe réinitialisée à ${baseSynergy}`);

  // ⏳ Attendre un petit instant pour éviter les mises à jour en rafale
  await new Promise(resolve => setTimeout(resolve, 100));

  // 🏥 Appliquer `restMember` à chaque membre
  for (const memberId of members) {
    const member = game.actors.get(memberId);
    if (member) {
      await this.restMember(member);
    }
  }

  console.log(`🎉 Rest Group terminé pour ${groupLeader.name} et ses membres`);

  // 🔄 Forcer un rerender du tracker après toutes les mises à jour
  if (game.weaveOfEchoes.groupsTracker) {
    game.weaveOfEchoes.groupsTracker.render();
  }
}


syncWounds(actor) {
  setTimeout(() => {
    const trackerElement = document.querySelector(`.group-tracker-wound-container[data-id="${actor.id}"]`);
    if (!trackerElement) {
      console.warn(`⚠️ Impossible de trouver le tracker pour ${actor.name}`);
      return;
    }
    const wounds = actor.system.wounds;
    trackerElement.querySelectorAll(".group-tracker-wound-box").forEach((woundDiv, index) => {
      const woundNumber = index + 1;
      const shouldBeTicked = wounds[`wound${woundNumber}`];
      const currentlyTicked = woundDiv.classList.contains("ticked");
      if (shouldBeTicked !== currentlyTicked) {
        if (shouldBeTicked) {
          woundDiv.classList.add("ticked");
        } else {
          woundDiv.classList.remove("ticked");
        }
      }
    });
  }, 50);
}

refreshTracker() {
 
  this.groups = this.getValidGroups();  // 🔄 Recharge les groupes sans render

  // 🔥 Mise à jour des wounds sans re-render
  document.querySelectorAll(".group-tracker-wound-container").forEach(container => {
      const actorId = container.dataset.id;
      const actor = game.actors.get(actorId);
      if (!actor) return;

      const wounds = actor.system.wounds;

      container.querySelectorAll(".group-tracker-wound-box").forEach((woundDiv, index) => {
          const woundNumber = index + 1;
          if (wounds[`wound${woundNumber}`]) {
              woundDiv.classList.add("ticked");
          } else {
              woundDiv.classList.remove("ticked");
          }
      });
  });
}

syncSynergy(actor) {
  setTimeout(() => {
    // On cible l'élément qui doit afficher la current synergy
    const synergyElement = document.querySelector(`#current-synergy-${actor.id}`);
    if (!synergyElement) {
      console.warn(`⚠️ Élément de synergie pour ${actor.name} non trouvé.`);
      return;
    }
    // Récupérer la donnée depuis le leader
    const groupSynergy = actor.system.relationships.groupSynergy || {};
    const currentSynergy = groupSynergy.current || 0;
    synergyElement.textContent = currentSynergy;
  }, 50);
}

syncFocus(actor) {
  // Cherche l'élément du tracker qui affiche le focus de cet acteur (assure-toi que le data-id est présent)
  const focusElement = document.querySelector(`.focus-value[data-id="${actor.id}"]`);
  if (focusElement) {
    focusElement.textContent = actor.system.focusPoints.current;
  } else {
    console.warn(`Focus element not found for actor ${actor.name}`);
  }
}
syncStamina(actor) {
  // Cherche l'élément du tracker qui affiche la stamina de cet acteur
  const staminaElement = document.querySelector(`.stamina-value[data-id="${actor.id}"]`);
  if (staminaElement) {
    staminaElement.textContent = actor.system.stamina.current;
  } else {
    console.warn(`Stamina element not found for actor ${actor.name}`);
  }
}



getValidGroups() {
  if (!game.actors || !game.actors.size) return [];
  return game.actors.contents
    // Filtrer pour ne garder que les acteurs qui possèdent un groupe avec au moins 2 membres
    .filter(actor => actor.system?.relationships?.characterGroup?.members?.length >= 2)
    .map(actor => {
      const groupData = actor.system.relationships.characterGroup;
      // Utiliser la propriété groupSynergy (attention à la casse)
      const groupSynergy = actor.system.relationships.groupSynergy || {};
      return {
        id: actor.id,
        name: groupData.name,
        currentSynergy: groupSynergy.current || 0,
        baseSynergy: groupSynergy.base || 0,
        members: groupData.members
          .filter(memberId => memberId !== "ghost_member")
          .map(memberId => {
            const member = game.actors.get(memberId);
            if (!member) {
              console.warn(`⚠️ Membre introuvable: ${memberId}`);
              return null;
            }
            const wound1 = member.system.wounds.wound1 || false;
            const wound2 = member.system.wounds.wound2 || false;
            const wound3 = member.system.wounds.wound3 || false;
            const wounds = [wound1, wound2, wound3];
            const activeWounds = wounds.filter(isActive => isActive).length;
            return {
              id: member.id,
              name: member.name,
              img: member.img,
              focus: member.system.focusPoints.current,
              stamina: member.system.stamina.current,
              wounds: wounds,
              activeWounds: activeWounds
            };
          })
          .filter(member => member !== null)
      };
    });
}




}

