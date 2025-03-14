let currentMenuIndex = 0; // Track the currently highlighted menu item

function shouldShowContextMenu(text, index) {
    // Extract text before and after the '>' character
    const textBeforeArrow = text.slice(0, index);
    const textAfterArrow = text.slice(index + 1);
  
    // Check if there's no non-whitespace character after '>'
    const noTrailingString = !/\S/.test(textAfterArrow);
  
    // Check if the '>' is at the start or immediately preceded by a whitespace
    const hasWhiteSpaceImmediatelyBefore =
      index === 0 || /\s/.test(text[index - 1]);
  
    // Decide whether to show the context menu
    return noTrailingString && hasWhiteSpaceImmediatelyBefore;
  }
  
// Add this function to handle all menu-related keyboard events
function handleMenuKeyboardEvents(event, inputField) {
  const menu = document.getElementById('mention-context-menu');
  const inputFieldContainer = getInputFieldContainer();
  
  // Handle keydown events when menu is open
  if (event.type === 'keydown' && menu) {
    if (event.key === 'Enter') {
      console.log("captured enter inside mention menu");
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const menuItems = document.querySelectorAll('.mention-menu-item');
      if (menuItems.length > 0 && currentMenuIndex >= 0) {
        const selectedItem = menuItems[currentMenuIndex];
        const suggestionLabel = selectedItem.innerText;
        
        getSuggestions('').then(suggestions => {
          const suggestion = suggestions.find(s => s.label === suggestionLabel);
          if (selectedItem && suggestion) {
            insertMentionContent(inputField, suggestion);
            removeContextMenu();
          }
        });
      }
      return false;
    }
  }

  // Handle keyup events
  if (event.type === 'keyup') {
    // Check if menu is open first for navigation
    if (menu && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      console.log(`Navigating menu with key: ${event.key}`);
      event.preventDefault();
      event.stopPropagation();
      navigateMenu(event.key);
      return;
    }

    if (event.key === ">") {
      // Get the current selection
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const currentNode = range.startContainer;
      
      // Check for context menu trigger
      const textContent = currentNode.textContent;
      const cursorPosition = range.startOffset;
      const textBeforeCursor = textContent.slice(0, cursorPosition);
      
      const lastIndex = textBeforeCursor.lastIndexOf('>');
      const shouldShowFileSuggestions = shouldShowContextMenu(textBeforeCursor, lastIndex);
      
      if (lastIndex !== -1 && shouldShowFileSuggestions) {
        const query = textBeforeCursor.slice(lastIndex + 1);
        showContextMenu(getInputFieldContainer(), range, query.trim());
      } else {
        removeContextMenu();
      }
    }
  }
}
  
  function navigateMenu(direction, menuItems) {
    if (menuItems.length === 0) return;
  
    // Clear previous highlight
    if (currentMenuIndex >= 0 && menuItems[currentMenuIndex]) {
      menuItems[currentMenuIndex].classList.remove('highlighted');
    }
  
    // Update the index based on the direction
    if (direction === 'ArrowDown') {
      currentMenuIndex = (currentMenuIndex + 1) % menuItems.length;
    } else if (direction === 'ArrowUp') {
      currentMenuIndex = (currentMenuIndex - 1 + menuItems.length) % menuItems.length;
    }
  
    // Highlight the current menu item
    const currentItem = menuItems[currentMenuIndex];
    currentItem.classList.add('highlighted');
  
    // Scroll the highlighted item into view
    currentItem.scrollIntoView({ block: 'nearest' });
  }
  
  function handleMenuInputKeyDown(event, menuInput, menu) {
    const menuItems = menu.querySelectorAll('.mention-menu-item');
  
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateMenu('ArrowDown', menuItems);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateMenu('ArrowUp', menuItems);
    } else if (event.key === 'Enter') {
      console.log("Captured Enter inside FileMenu")
      event.preventDefault();
      if (currentMenuIndex >= 0 && menuItems[currentMenuIndex]) {
        const selectedItem = menuItems[currentMenuIndex];
        const suggestionLabel = selectedItem.innerText;
        getSuggestions('').then((suggestions) => {
          const suggestion = suggestions.find(s => s.label === suggestionLabel);
          if (suggestion) {
            insertMentionContent(document.querySelector(getSelectors().inputField), suggestion);
            //removeContextMenu();
          }
        });
      }
    } else if (event.key === 'Escape') {
      console.log("Captured Escape inside FileMenu")
      removeContextMenu();
    }
  }
  
  // Add this helper function to check WebSocket connection
async function isWebSocketConnected() {
  // Send a message to background script to check connection status
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, response => {
      resolve(response?.connected || false);
    });
  });
}

async function showContextMenu(inputField, range, query) {
  removeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'mention-context-menu';
  document.body.appendChild(menu);
  
  // Position the menu
  const inputRect = inputField.getBoundingClientRect();
  const menuTop = inputRect.top;
  const menuLeft = inputRect.left;

  menu.style.setProperty('--menu-top', `${menuTop}px`);
  menu.style.left = `${menuLeft}px`;
  menu.style.width = `${inputRect.width}px`;
  menu.style.maxHeight = '200px';
  menu.style.overflowY = 'auto';
  menu.style.border = '1px solid #ccc';
  menu.style.borderRadius = '15px';
  menu.style.zIndex = '1000';

  const menuInput = document.createElement('input');
    menuInput.type = 'text';
    menuInput.id = 'menu-input';
    menuInput.value = query;
    menuInput.placeholder = 'Search files...';
    menuInput.className = 'menu-input';
  
    // Create a suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'suggestions-container';
    
    // Append both elements to the menu
    menu.appendChild(menuInput);
    menu.appendChild(suggestionsContainer);  
  
    // Initial suggestions
    await updateSuggestions(suggestionsContainer, query);
  
    // Add event listeners
    menuInput.addEventListener('input', async (event) => {
      currentMenuIndex = 0;
      await updateSuggestions(suggestionsContainer, event.target.value);
    });
  
    menuInput.addEventListener('keydown', (event) => {
      handleMenuInputKeyDown(event, menuInput, menu);
    });

    // Focus on the menu input
    menuInput.focus();

  isWebSocketConnected().then(connected => {
    if(!connected) {
      // remove 
      menu.removeChild(menuInput);
      menu.removeChild(suggestionsContainer);

      // Create a message container for the disconnected state
    const disconnectedMessage = document.createElement('div');
    disconnectedMessage.style.cssText = `
      height: 100%;
      padding: 16px;
      background: #f8f9fa;
      color: #333;
      font-size: 13px;
      line-height: 1.5;
    `;

    // Create message text
    const messageText = document.createElement('p');
    messageText.style.margin = '0 0 12px 0';
    messageText.innerHTML = `<b style="color: red">Error: Failed to retrieve files.</b>
    <br><br>
    To add files, please install the 
    <a href="https://marketplace.visualstudio.com/items?itemName=EasyCodeAI.chatgpt-gpt4-gpt3-vscode" target="_blank" style="color: #2563eb; text-decoration: underline; cursor: pointer;">EasyCode</a>
    companion extension in VS Code.
    <br>
    The VS Code extension establishes a local connection to serve file content and apply changes. 
    `;
    // Create settings link
    const settingsLink = document.createElement('a');
    settingsLink.textContent = 'Learn more in settings';
    settingsLink.href = '#';
    settingsLink.style.cssText = `
      color: #2563eb;
      text-decoration: underline;
      cursor: pointer;
    `;
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'openOptions' });
      removeContextMenu();
    });

    // Append elements
    disconnectedMessage.appendChild(messageText);
    disconnectedMessage.appendChild(settingsLink);
    menu.appendChild(disconnectedMessage);
    }
  });
  }
  
  async function updateSuggestions(menu, query) {
    try {
      menu.innerHTML = '';
      const suggestions = await getSuggestions(query);
  
      if (suggestions.length === 0) {
        const item = document.createElement('div');
        item.className = 'mention-menu-item no-results';
        item.innerText = 'No results found';
        menu.appendChild(item);
        return;
      }
  
      suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'mention-menu-item';
        item.innerText = suggestion.label;
  
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
        });
  
        item.addEventListener('click', () => {
          insertMentionContent(document.querySelector(getSelectors().inputField), suggestion);
          //removeContextMenu();
        });
  
        menu.appendChild(item);
  
        if (index === currentMenuIndex) {
          item.classList.add('highlighted');
        }
      });
    } catch (error) {
      console.error('Error getting suggestions:', error);
      const errorItem = document.createElement('div');
      errorItem.className = 'mention-menu-item error';
      errorItem.innerText = 'Error loading suggestions';
      menu.appendChild(errorItem);
    }
  }
  
  function removeContextMenu() {
    const existingMenu = document.getElementById('mention-context-menu');
    if (existingMenu) {
      existingMenu.parentNode.removeChild(existingMenu);
      // Return focus to the original input field
      const inputField = getInputField();
      inputField.focus();
    }
  }