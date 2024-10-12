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
      }

 getData() {
  const data = super.getData();
  data.actors = this.actors.map(actor => {
    return {
      id: actor.id,
      name: actor.name,
      baseFocus: actor.system.focusPoints.base,
      currentFocus: actor.system.focusPoints.current
    };
  });
  data.selectedGroupMembers = this.selectedGroupMembers;
  data.members = this.data.members;  // Ajoutez cette ligne
  return data;
}
  
    activateListeners(html) {
      super.activateListeners(html);
  
      html.find('.focus-add').click(this._onAddFocus.bind(this));
      html.find('.focus-subtract').click(this._onSubtractFocus.bind(this));
      html.find('.focus-generate').click(this._onGenerateFocus.bind(this));
      html.find('.focus-generate-all').click(this._onGenerateAllFocus.bind(this));
      html.find('#manage-members').click(this._onManageMembers.bind(this));
    html.find('.remove-member').click(this._onRemoveMember.bind(this));
      html.find('.group-member-select').change(this._onGroupMemberSelect.bind(this));
    }
    
    _onManageMembers(event) {
        event.preventDefault();
        showMemberManagementModal(this.data.members, (selectedMembers) => {
          this.data.members = [...new Set([...this.data.members, ...selectedMembers])];
          this.render(false);
        });
      }
    
      _onRemoveMember(event) {
        event.preventDefault();
        const memberName = event.currentTarget.dataset.member;
        this.data.members = this.data.members.filter(m => m !== memberName);
        this.render(false);
      }

    async _onAddFocus(event) {
      const actorId = event.currentTarget.dataset.actorId;
      const actor = game.actors.get(actorId);
      actor.modifyCurrentFocusPoints(1);
      this.render();
    }
  
    async _onSubtractFocus(event) {
      const actorId = event.currentTarget.dataset.actorId;
      const actor = game.actors.get(actorId);
      actor.modifyCurrentFocusPoints(-1);
      this.render();
    }
  
    async _onGenerateFocus(event) {
      const actorId = event.currentTarget.dataset.actorId;
      const actor = game.actors.get(actorId);
      actor.calculateBaseFocusPoints(this.selectedGroupMembers);
      this.render();
    }
  
    async _onGenerateAllFocus() {
      for (let actor of this.actors) {
        actor.calculateBaseFocusPoints(this.selectedGroupMembers);
      }
      this.render();
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
  }