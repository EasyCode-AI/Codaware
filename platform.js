const PLATFORMS = {
    CHATGPT: {
      hostnames: ['chat.openai.com', 'chatgpt.com'],
      selectors: {
        inputFieldParent: '#composer-background',
        inputField: '#prompt-textarea',
        sendButton: '[data-testid="send-button"]',
        editor: '.ProseMirror',
        codeBlock: [
          'pre[class*="!overflow-visible"] code', 
          '#codemirror .cm-content' 
        ]
      },
      inputFieldType: 'contenteditable',
      buttonStyle: {
        container: '.sticky',
        style: `
          line-height: initial;
          padding: 4px 8px;
          background: #2A2B32;
          border: 1px solid #565869;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 12px;
          margin-right: 8px;
        `,
        classNames: '',
        icon: '📋 Apply'
      }
    },
    CLAUDE: {
      hostnames: ['claude.ai'],
      selectors: {
        inputFieldParent: '.flex.flex-col.bg-bg-000',
        inputField: '[contenteditable="true"].ProseMirror',
        sendButton: 'button[aria-label="Send Message"]',
        editor: '.ProseMirror',
        codeBlock: 'div.code-block__code code'
      },
      inputFieldType: 'contenteditable',
      buttonStyle: {
        container: '.flex.flex-1.items-center.justify-end',
        style: `pointer-events:auto`,
        classNames: `inline-flex items-center justify-center relative shrink-0 ring-offset-2 
          ring-offset-bg-300 ring-accent-main-100 focus-visible:outline-none 
          focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 
          disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] 
          from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 
          font-medium font-styrene text-text-100/90 transition-colors 
          active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 
          h-8 rounded-md px-3 text-xs min-w-[4rem] active:scale-[0.985] whitespace-nowrap`,
        icon: '📋 Apply'
      }
    }
  };
  
  function getCurrentPlatform() {
    const currentHostname = window.location.hostname;
    return Object.values(PLATFORMS).find(platform => 
      platform.hostnames.some(hostname => 
        currentHostname.includes(hostname)
      )
    );
  }
  
  function getPlatformById(platformId) {
    return PLATFORMS[platformId];
  }
  
  function getSelectors() {
    const platform = getCurrentPlatform();
    return platform ? platform.selectors : null;
  }

  function getInputFieldContainer() {
    const container = document.querySelector(getCurrentPlatform().selectors.inputFieldParent);
    return container;
  }