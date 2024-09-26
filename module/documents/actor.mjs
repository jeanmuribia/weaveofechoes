export class WoeActor extends Actor {
  prepareData() {
    super.prepareData();
    const systemData = this.system;

    // Vérification pour le nom
    if (!systemData.name) {
      systemData.name = { value: "Unnamed" };
    }

    // Vérification pour l'élément
    if (!systemData.element) {
      systemData.element = { value: "Pas de maîtrise élémentaire" }; // Valeur par défaut
    }

    // Initialiser les tempéraments
    if (!systemData.temperaments) {
      systemData.temperaments = {
        fire: { value: "neutre" },
        water: { value: "neutre" },
        earth: { value: "neutre" },
        air: { value: "neutre" }
      };
    }
  }
}
