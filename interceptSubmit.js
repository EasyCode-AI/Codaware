// interceptSubmit.js

(function () {
  let isCustomEvent = false;

  // Common submission handling logic
  async function handleSubmission(event) {
    event.preventDefault();
    event.stopPropagation();
    //event.stopImmediatePropagation();
    console.log("----- intercepted submission")

    const container = document.getElementById('file-chips-container');
    const fileChips = container ? container.querySelectorAll('.file-chip') : [];

    if (fileChips.length > 0) {
      try {
        const fileContents = await processFileChips(fileChips);
        await appendFileContentsToMessage(fileContents);
        await cleanupAndProceed(event);
      } catch (error) {
        console.error('Error processing file contents:', error);
      }
    } else {
      // If no files to process, proceed with original event
      proceedWithOriginalEvent(event);
    }
  }

  // Helper function to cleanup and proceed with submission
  function cleanupAndProceed(event) {
    const container = document.getElementById('file-chips-container');
    if (container) {
      container.remove();
    }

    proceedWithOriginalEvent(event);
  }

  // Function to proceed with original event
  function proceedWithOriginalEvent(event) {
    isCustomEvent = true;
    
    if (event instanceof KeyboardEvent) {
      // Simulate Enter key press
      const resumedEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        bubbles: true,
        cancelable: true
      });
      event.target.dispatchEvent(resumedEvent);
    } else if (event instanceof MouseEvent) {
      // Simulate button click
      const button = event.target;
      button.removeAttribute('data-mention-intercepted');
      button.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      button.setAttribute('data-mention-intercepted', 'true');
    }
    
    isCustomEvent = false;
    console.log("----- resumed submission")

  }

  // Wrap observer initialization in a function
  function initializeSendButtonObserver() {
    if (!document.body) {
      // If body isn't ready, try again soon
      setTimeout(initializeSendButtonObserver, 100);
      return;
    }

    const sendButtonObserver = new MutationObserver((mutations, observer) => {
      const selectors = getSelectors();
      const sendButton = document.querySelector(selectors.sendButton);
      
      if (sendButton && !sendButton.hasAttribute('data-mention-intercepted')) {
        sendButton.setAttribute('data-mention-intercepted', 'true');
        
        sendButton.addEventListener('click', async (event) => {
          if (event.isTrusted && !isCustomEvent) {
            await handleSubmission(event);
          }
        }, true);
      }
    });

    // Start observing once body is available
    sendButtonObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize the observer with proper timing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSendButtonObserver);
  } else {
    initializeSendButtonObserver();
  }

  // Add helper to check if element matches platform input field
function isInPlatformInputField(element) {
  const selectors = getSelectors(); // Get current platform selectors
  if (!selectors) return false;

  const inputField = document.querySelector(selectors.inputField);
  return inputField === element;
}

// Add helper to check if element is part of mention context menu
function isInMentionContextMenu(element) {
  const menu = document.getElementById('mention-context-menu');
  return menu && (menu === element || menu.contains(element));
}


  // Keep the Enter key interceptor
  window.addEventListener(
    'keydown',
    async function (event) {
      const menu = document.getElementById('mention-context-menu');

      // Only proceed if it's Enter without any modifier keys and not a custom event
      if ((event.key === 'Enter' || event.keyCode === 13) && 
          !event.shiftKey && 
          !event.ctrlKey && 
          !event.altKey && 
          !event.metaKey && 
          !isCustomEvent) {
        if (menu) {
          // If there's an active mention menu, don't intercept
          // Let the mention handler in content.js handle it
          console.log("do not intercept");
          return;
        }
        
        // Otherwise proceed with submission handling
        await handleSubmission(event);
      } else if (event.key === 'Escape') {
        if (menu) {
          console.log("Captured Escape inside FileMenu");
          removeContextMenu();
        }
      }
    },
    { capture: true }
  );

})(); 