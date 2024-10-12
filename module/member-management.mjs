
export function showMemberManagementModal(currentMembers, onMembersSelected) {
    const availableCharacters = game.actors.filter(actor => 
      actor.type === "character" && !currentMembers.includes(actor.name)
    );
  
    const content = `
      <form>
        <div class="form-group">
          <label>Select Members to Add:</label>
          ${availableCharacters.map(character => `
            <div>
              <label>
                <input type="checkbox" name="add-member" value="${character.name}">
                ${character.name}
              </label>
            </div>
          `).join('')}
        </div>
      </form>
    `;
  
    new Dialog({
      title: "Add Members",
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-user-plus"></i>',
          label: "Add Selected",
          callback: (html) => {
            const selectedMembers = Array.from(html.find('input[name="add-member"]:checked')).map(input => input.value);
            onMembersSelected(selectedMembers);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      }
    }).render(true);
  }