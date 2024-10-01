export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system;

    // Vérifiez si le nom est défini, sinon attribuez-lui une valeur par défaut
    if (!systemData.name || typeof systemData.name.value === 'undefined') {
      systemData.name = { value: "Unnamed" }; // Valeur par défaut
    }

    // Initialise d'autres champs
    if (!systemData.element) {
      systemData.element = { value: "none" }; // Valeur par défaut pour l'élément
    }

    // Initialise tempers
    if (!systemData.tempers) {
      systemData.tempers = {
        fire: { value: "neutral" },
        water: { value: "neutral" },
        earth: { value: "neutral" },
        air: { value: "neutral" }
      };
    }

    // Initialise attributes
    if (!systemData.attributes) {
      systemData.attributes = {
        corp: { value: "neutral" },
        soul: { value: "neutral" },
        spirit: { value: "neutral" },
        martial: { value: "neutral" },
        elemental: { value: "neutral" },
        rhetoric: { value: "neutral" }
      };
    }
  }

  static async createActor(name, type) {
    if (!name || name.trim() === "") {
      name = "Unnamed"; // Utilise une valeur par défaut si aucun nom n'est fourni
    }

    const actorData = {
      name: name || "Unnamed", // Utilise "Unnamed" par défaut si aucun nom n'est passé
      type: type,
      img: "icons/svg/mystery-man.svg",
      system: {
        name: { value: name }, // Assure-toi que le nom est bien passé ici aussi
        element: { value: "none" }, // Valeur par défaut pour l'élément
        tempers: {
          fire: { value: "neutral" },
          water: { value: "neutral" },
          earth: { value: "neutral" },
          air: { value: "neutral" }
        },
        attributes: {
          corp: { value: "neutral" },
          soul: { value: "neutral" },
          spirit: { value: "neutral" },
          martial: { value: "neutral" },
          elemental: { value: "neutral" },
          rhetoric: { value: "neutral" }
        }
      }
    };

    // Crée l'acteur dans Foundry
    await Actor.create(actorData);
  }

  // Sépare la méthode enableEditing
  enableEditing(html) {
    console.log("Editing mode enabled");

    // Masque le nom actuel et affiche le champ de texte pour l'édition
    html.find('#actor-name').hide();
    html.find('#name-edit').val(this.name).show(); // Utilise `this.name` pour récupérer le nom de l'acteur

    // Active tous les champs qui sont désactivés (ex: select, input)
    html.find('input, select').prop('disabled', false); // Active tous les champs et listes déroulantes

    // Gestion des boutons
    html.find('#edit-button').hide();
    html.find('#save-button').show();
  }
}
