export class WoeActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
    const systemData = this.system;

    // Initialize Stamina if not present
    if (!systemData.stamina) {
      systemData.stamina = {
        max: 4,
        current: 4
      };
    }

    // Ensure attributes are initialized for all keys, including "mind" and "elementary"
    const attributes = ["body", "soul", "mind", "martial", "elementary", "rhetoric"];
    attributes.forEach(attr => {
      if (!systemData.attributes[attr]) {
        systemData.attributes[attr] = {}; // Ensure the attribute object exists
      }
      if (!systemData.attributes[attr].baseValue) {
        systemData.attributes[attr].baseValue = "neutral"; // Default base value
      }
      if (!systemData.attributes[attr].currentValue) {
        systemData.attributes[attr].currentValue = systemData.attributes[attr].baseValue;
      }
      if (!systemData.attributes[attr].wounds) {
        systemData.attributes[attr].wounds = {
          wound1: false,
          wound2: false,
          wound3: false
        };
      }
    });

    console.log("Attributes initialized:", systemData.attributes);
  }

  
  /**
   * Crée un nouvel acteur avec des valeurs par défaut pour ses attributs
   * 
   * @param {string} name - Le nom de l'acteur
   * @param {string} type - Le type d'acteur
   */
  static async createActor(name, type) {
    if (!name || name.trim() === "") {
      name = "Unnamed"; // Si aucun nom n'est fourni, utiliser "Unnamed"
    }

    // Définir les valeurs initiales pour le nouvel acteur
    const actorData = {
      name: name || "Unnamed", // Si aucun nom n'est passé, utiliser "Unnamed"
      type: type,
      img: "icons/svg/mystery-man.svg", // Icône par défaut pour l'acteur
      system: {
        name: { value: name }, // Nom de l'acteur
        element: { value: "none" }, // Valeur par défaut pour l'élément (par exemple "none")
        stamina: {
          max: 4, // Valeur par défaut pour la Stamina Max
          current: 4 // Valeur par défaut pour la Stamina Courante
        },
        tempers: {
          fire: { value: "neutral" }, // Tempérament du feu par défaut
          water: { value: "neutral" }, // Tempérament de l'eau par défaut
          earth: { value: "neutral" }, // Tempérament de la terre par défaut
          air: { value: "neutral" } // Tempérament de l'air par défaut
        },
        attributes: {
          // Initialiser tous les attributs avec des valeurs par défaut
          body: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          soul: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          mind: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          martial: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          elementary: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          },
          rhetoric: {
            baseValue: "neutral",
            currentValue: "neutral",
            wounds: { wound1: false, wound2: false, wound3: false }
          }
        }
      }
    };

    // Crée un nouvel acteur dans le système Foundry
    await Actor.create(actorData);
  }
}
