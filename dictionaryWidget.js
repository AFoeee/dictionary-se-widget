/**
 * This widget displays a dictionary definition for a given command parameter.
 */


// Credentials for dictionary API.
const baseUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const init = {
  method: 'GET'
};

let triggerPhrase;                  // Command text with appended whitespace.
let isUsableByEveryone;             // If true, everyone can trigger the widget.
let isUsableByMods;
let otherUsers;                     // Those users can trigger the widget, too.
let blockedUsers;                   // Those users are ignored by the widget.
let displayMillis;                  // Hide after this many milliseconds.

let publishResponse;
let jebaitedToken;                  // jebaited.net token for posting chat msgs.

let timeoutId = null;               // Used to cancel timeout.
let isBlocked = true;               // Blocks the widget when busy.


// Promisifies the EventListener for 'transitionend' (opacity transition).
function fadeTo(elmnt, amount) {
  return new Promise((resolve, reject) => {
    if (elmnt.style.opacity != amount) {
      elmnt.addEventListener('transitionend', () => {
        resolve(true);
      }, {once: true});
      
      elmnt.style.opacity = amount;
    } else {
      resolve(false);
    }
  });
}


// Representation of the #dictionary-entry HTML element.
const dictEntry = {
  containerElmnt: document.getElementById("dictionary-entry"), 
  entryWordElmnt: document.getElementById("entry-word"), 
  meaningElmnt: document.getElementById("meaning"), 
  isVisible: false, 
  
  async fadeOut() {
    if (this.isVisible) {
      await fadeTo(this.containerElmnt, 0);
      this.isVisible = false;
    }
  }, 
  
  async fadeIn(amount) {
    if (!this.isVisible && (amount > 0)) {
      await fadeTo(this.containerElmnt, amount);
      this.isVisible = true;
    }
  }, 
  
  async change(word, meaning) {
    await this.fadeOut();
    
    this.entryWordElmnt.innerHTML = word;
    this.meaningElmnt.innerHTML = meaning;
    
    await this.fadeIn(1);
  }
};


// Publishing channel for the 'Overlay' option.
async function changeEntry(word, meaning) {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  
  await dictEntry.change(word, meaning);
  
  if(displayMillis) {
    timeoutId = setTimeout(() => {
      dictEntry.fadeOut();
      timeoutId = null;
    }, displayMillis);
  }
}


// Publishing channel for the 'Chat' option.
async function postToChat(word, meaning) {
  const encodedMsg = encodeURIComponent(`${word}: '${meaning}'`);
  
  fetch(`https://api.jebaited.net/botMsg/${jebaitedToken}/${encodedMsg}`);
}


const cooldown = {
  cooldownMillis: 0, 
  cooldownEndEpoch: 0, 
  
  activate() {
    this.cooldownEndEpoch = Date.now() + this.cooldownMillis;
  }, 
  
  isActive() {
    return (Date.now() < this.cooldownEndEpoch);
  }
}


// Load google font by name and use it for given element.
function addGoogleFont(fontName) {
  const fontLink = document.createElement('link');
  fontLink.href = 
      `https://fonts.googleapis.com/css2?family=${fontName.replaceAll(" ", "+")}`;
  fontLink.rel = 'stylesheet';
  
  document.head.appendChild(fontLink);
}


function onWidgetLoad(obj) {
  const fieldData = obj.detail.fieldData;
  
  // Makes it easier for the user to look up the widget version.
  console.log(`Initialize ${fieldData.widgetName} (v${fieldData.widgetVersion}).`);
  
  switch (fieldData.publishingMode) {
    case 'overlay':
      publishResponse = changeEntry;
      break;
      
    case 'chat':
      jebaitedToken = fieldData.jebaitedNetToken;
      
      if (!jebaitedToken) {
        console.log(
            "Deactivate widget: Publishing mode 'chat' but no jebaited.net token.");
        return;
      }
      
      publishResponse = postToChat;
      break;
      
    default:
      throw new Error(`Encountered unknown switch value: ${fieldData.publishingMode}`);
  }
  
  triggerPhrase = fieldData.commandText.toLowerCase() + " ";
  
  isUsableByEveryone = (fieldData.permissionLvl === 'everyone');
  isUsableByMods = (fieldData.permissionLvl === 'mods');
  
  otherUsers = fieldData.otherUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  
  blockedUsers = fieldData.blockedUsers
      .replace(/\s/g, '')
      .toLowerCase()
      .split(",");
  
  addGoogleFont(fieldData.overlayFontFamily_entryWord);
  addGoogleFont(fieldData.overlayFontFamily_meaning);
  
  displayMillis = fieldData.displayDuration * 1000;
  
  if (fieldData.testMode === 'on') {
    changeEntry("Lorem Ipsum", "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.");
  }
  
  isBlocked = false;
}


async function onMessage(msg) {
  if (isBlocked) {
    //console.log("Widget is currently blocked.");
    return;
  }
  
  // Check if the user has enough permissions for the selected mode.
  if (isUsableByEveryone || 
      (isUsableByMods && msg.isModerator()) || 
      msg.isBroadcaster() || 
      msg.usernameOnList(otherUsers)) {
    
    /* To avoid unnecessary processing, only the beginning of the message is 
     * converted to lower case and gets tested. */
    const msgStart = msg.text
        .substring(0, triggerPhrase.length)
        .toLowerCase();
    
    if (msgStart !== triggerPhrase) return;
    
    isBlocked = true;
    
    /* Now that it's established that the chat message begins with the trigger 
     * phrase and that the user is allowed to use the command, the whole message 
     * can be processed. The trigger phrase is cut off, to allow for white space 
     * in it. */
    const subStr = msg.text
        .substring(triggerPhrase.length)
        .toLowerCase();
    
    const response = await fetch(baseUrl + encodeURIComponent(subStr), init);
    const data = await response.json();
    
    if (data.length) {
      const json = data[0];
      
      if (json.meanings.length) {
        await publishResponse(
            json.word,
            json.meanings[0].definitions[0].definition);
      }
    }
    
    isBlocked = false;
  }
}
