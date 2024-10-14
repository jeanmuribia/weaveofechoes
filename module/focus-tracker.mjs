// focus-tracker.mjs
import { showMemberManagementModal } from './member-management.mjs';

export class FocusTracker extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "focus-tracker",
            template: "systems/weave_of_echoes/templates/focus-tracker.hbs",
            title: "Focus Point Tracker",
            width: 400,
            height: 'auto',
            resizable: true
        });
    }

    constructor(options = {}) {
        super(options);
        this.data = options.data || {};
        this.data.members = this.data.members || [];
        this.actors = [];
        this.selectedGroupMembers = [];

        Hooks.on('updateActor', (actor, diff, options, userId) => {
            if (this.actors.includes(actor)) {
                // If actor's relationships have changed, recalculate the base focus
                if (diff.system && diff.system.relationships) {
                    this.calculateBaseFocusPoints(this.data.groupMembers);
                }
                this.render(false);  // Re-render if an actor in the tracker is updated
            }
        });
    }

    getData() {
        const data = super.getData();

        // Assurez-vous que groupMembers est un tableau vide s'il n'est pas défini
        if (!this.data.groupMembers) {
            this.data.groupMembers = [];
        }

        // Mapper les données des membres
        data.members = this.data.groupMembers.map(name => {
            const actor = game.actors.getName(name);
            if (actor) {
                return {
                    id: actor.id || 'unknown',
                    name: actor.name || 'unknown',
                    baseFocus: actor.system?.focusPoints?.base || 0,
                    currentFocus: actor.system?.focusPoints?.current || 0,
                };
            } else {
                return {
                    id: 'unknown',
                    name: name || 'unknown',
                    baseFocus: 0,
                    currentFocus: 0,
                };
            }
        });

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.focus-add').click(this._onAddFocus.bind(this));
        html.find('.focus-subtract').click(this._onSubtractFocus.bind(this));
        html.find('.focus-generate').click(this._onGenerateFocus.bind(this));
        html.find('.focus-generate-all').click(this._onGenerateAllFocus.bind(this));
        html.find('.group-member-select').change(this._onGroupMemberSelect.bind(this));
    }

    async _onAddFocus(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        await actor.modifyCurrentFocusPoints(1);
        await this.render(false);  // Forcer un re-rendu après la mise à jour
    }

    async _onSubtractFocus(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        await actor.modifyCurrentFocusPoints(-1);
        await this.render(false);  // Forcer un re-rendu après la mise à jour
    }

    async _onGenerateFocus(event) {
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);

        // Vérifiez que l'acteur existe
        if (actor) {
            // Récupérez la valeur actuelle de baseFocus
            const baseFocus = actor.system.focusPoints.base;
            // Définir currentFocus au niveau de baseFocus
            actor.system.focusPoints.current = baseFocus;

            // Mettre à jour uniquement currentFocus sans toucher à baseFocus
            await actor.update({ 'system.focusPoints.current': baseFocus });
        }

        this.render(); // Rendre à nouveau le tracker après la mise à jour
    }

    async _onGenerateAllFocus() {
        for (let memberName of this.data.groupMembers) {
            const actor = game.actors.getName(memberName);
            if (actor) {
                // Récupérez la valeur actuelle de baseFocus
                const baseFocus = actor.system.focusPoints.base; 
                // Définir currentFocus au niveau de baseFocus
                actor.system.focusPoints.current = baseFocus;

                // Mettre à jour uniquement currentFocus
                await actor.update({ 'system.focusPoints.current': baseFocus });
            }
        }

        this.render(); // Rendre à nouveau le tracker après la mise à jour
    }

    updateGroupFromSynergy(selectedCharacters) {
        // Update group members
        this.data.groupMembers = selectedCharacters;
    
        // Recalculate the base focus points as soon as the group is updated
        this.calculateBaseFocusPoints(selectedCharacters);
    
        // Ensure the tracker is re-rendered with the updated members
        this.render(false);
    }

    _onGroupMemberSelect(event) {
        const memberName = event.currentTarget.value;
        const isSelected = event.currentTarget.checked;

        if (isSelected) {
            this.selectedGroupMembers.push(memberName);
        } else {
            const index = this.selectedGroupMembers.indexOf(memberName);
            if (index > -1) {
                this.selectedGroupMembers.splice(index, 1);
            }
        }

        this._onGenerateAllFocus();
    }

    addActor(actor) {
        if (!this.actors.find(a => a.id === actor.id)) {
            this.actors.push(actor);
            this.render();
        }
    }

    removeActor(actorId) {
        this.actors = this.actors.filter(a => a.id !== actorId);
        this.render();
    }

    calculateBaseFocusPoints(members) {
        const promises = members.map(async memberName => {
            const actor = game.actors.getName(memberName);
            if (!actor) {
                return;
            }

            let baseFocus = 0;

            // Vérifie chaque membre du groupe
            for (const otherMemberName of members) {
                if (otherMemberName === memberName) continue; // Ne pas vérifier soi-même

                // Cherche la relation entre ce personnage et l'autre membre du groupe
                const relation = actor.system.relationships.find(r => r.characterName === otherMemberName);

                if (relation) {
                    switch (relation.relationshipLevel) {
                        case -3: // Haine
                            baseFocus += 3;
                            break;
                        case -2: // Hostilité
                            baseFocus += 2;
                            break;
                        case -1: // Déplaisir
                            baseFocus += 1;
                            break;
                        default:
                            break;
                    }
                }
            }

            // Mise à jour de la base focus du personnage
            await actor.update({ 'system.focusPoints.base': baseFocus });
        });

        // Attend que toutes les mises à jour soient terminées avant de rendre
        Promise.all(promises).then(() => {
            this.render(false); // Mise à jour du tracker
        });
    }
}

// Hook global pour synchroniser le FocusTracker avec le SynergyTracker
Hooks.on('updateSynergyGroup', (synergyTracker) => {
    if (game.weaveOfEchoes.focusTracker) {
        // Pass the updated group members to the focus tracker
        game.weaveOfEchoes.focusTracker.updateGroupFromSynergy(synergyTracker.data.characters);
    }
});

// Hooks.on pour les mises à jour des acteurs
Hooks.on('updateActor', async (actor, updatedData) => {
    if (updatedData.system && updatedData.system.relationships) {
        await actor.update({}); // Assurez-vous que la mise à jour des relations est terminée

        if (game.weaveOfEchoes.focusTracker) {
            await game.weaveOfEchoes.focusTracker.calculateBaseFocusPoints(game.weaveOfEchoes.focusTracker.data.groupMembers);
        }
    }
});
