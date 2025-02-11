export class GroupsTracker extends Application {
    constructor(options = {}) {
      super(options);
      this.groups = this.getValidGroups();
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
      return { groups: this.groups };
    }
  
    activateListeners(html) {
      super.activateListeners(html);
      html.find(".close-tracker").click(() => this.close());
        // Ajout des événements pour les boutons + et -
  html.find('.stat-button').on('click', async (event) => {
    event.preventDefault();

    // Récupération des données
    const button = $(event.currentTarget);
    const stat = button.data("stat");
    const actorId = button.data("id");
    const action = button.data("action");

    // Récupérer l'acteur concerné
    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Calcul de la nouvelle valeur
    let newValue = actor.system[stat].current || 0;
    if (action === "increase") newValue++;
    if (action === "decrease" && newValue > 0) newValue--;

    // Mise à jour de l'acteur
    await actor.update({ [`system.${stat}.current`]: newValue });

    // Mise à jour immédiate de l'affichage
    html.find(`#${stat}-${actorId}`).text(newValue);
  });
       // Forcer la mise à jour dès qu'on rouvre le tracker
    this.groups = this.getValidGroups();
    this.render();
    }
  
    getValidGroups() {
      if (!game.actors || !game.actors.size) return [];
      
      return game.actors.contents
          .filter(actor => actor.system?.relationships?.characterGroup?.members?.length >= 2)
          .map(actor => {
              return {
                  name: actor.system.relationships.characterGroup.name,
                  members: actor.system.relationships.characterGroup.members
                      .map(id => game.actors.get(id))
                      .filter(member => member) // Ignore les membres inexistants
                      .map(member => ({
                          name: member.name,
                          img: member.img,
                          focus: member.system.focusPoints.current,
                          stamina: member.system.stamina.current,
                          wounds: Object.values(member.system.wounds).filter(Boolean).length,
                          baseSynergy: member.calculateBaseSynergy()
                      }))
              };
          });
  }
  }