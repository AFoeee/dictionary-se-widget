/**
 * This widget displays a dictionary definition for a given command parameter.
 */


let triggerPhrase;                  // Command text with appended whitespace.
let isUsableByEveryone;             // If true, everyone can trigger the widget.
let isUsableByMods;
let otherUsers;                     // Those users can trigger the widget, too.
let blockedUsers;                   // Those users are ignored by the widget.
let bannedEntryWords;               // Don't show definitions for those words.
let bannedInMeaningsRegex;          // Ignore meanings that match this regex.
let displayMillis;                  // Hide after this many milliseconds.
let jebaitedToken;                  // jebaited.net token for posting chat messages.

let publishResponse;                // Holds the function for the selected publishing channel.

let timeoutId = null;               // Used to cancel remaining timeout.
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
  // Get rid of any existing timeouts, since the display time gets restarted.
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  
  await dictEntry.change(word, meaning);
  
  // If enabled, hide the overlay after the specified amount of time.
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


// Load google font by name.
function addGoogleFont(fontName) {
  const fontLink = document.createElement('link');
  fontLink.href = 
      `https://fonts.googleapis.com/css2?family=${fontName.replaceAll(" ", "+")}`;
  fontLink.rel = 'stylesheet';
  
  document.head.appendChild(fontLink);
}


function activateTestMode(hasColorizedSegments) {
  // Make it easier to understand behavior by colorizing elements.
  if (hasColorizedSegments) {
    const displayElmnt = document.getElementById("entry-word");
    displayElmnt.style.backgroundColor = "#92DE8B";
    
    const timerElmnt = document.getElementById("meaning");
    timerElmnt.style.backgroundColor = "#FB836F";
  }
  
  // Some mock-up text.
  changeEntry("Lorem Ipsum", "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.");
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
  
  /* A space is appended to ignore invocations without parameters (twitch cuts 
   * off trailing whitespace). */
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
  
  /* Modified splitting procedure to allow spaces in multi-word elements and to 
   * get rid of empty ones. */
  bannedEntryWords = fieldData.bannedEntryWords
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => (s !== ''));
  
  // Basis for regex.
  const bannedWordsInMeanings = fieldData.bannedWordsInMeanings
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => (s !== ''));
  
  if (bannedWordsInMeanings.length) {
    /* Test for word boundaries around the banned words. Matches inside of other 
     * words are ignored that way. */
    const reStr = "\\b(" + bannedWordsInMeanings.join('|') + ")\\b";
    
    /* If any of the banned words is contained in the string to be tested, this 
     * is interpreted as a match later on. */
    bannedInMeaningsRegex = new RegExp(reStr, 'i');
  }
  
  addGoogleFont(fieldData.overlayFontFamily_entryWord);
  addGoogleFont(fieldData.overlayFontFamily_meaning);
  
  cooldown.cooldownMillis = fieldData.cooldown * 1000;
  displayMillis = fieldData.displayDuration * 1000;
  
  if (fieldData.testMode === 'on') {
    activateTestMode(fieldData.hasColorizedSegments);
  }
  
  isBlocked = false;
}


function isEntryWordBanned(str) {
  return bannedEntryWords.includes(str.toLowerCase());
}


function getValidatedMeaning(strArr) {
  let meaning;
  
  // If the list of banned words isn't empty ...
  if (bannedInMeaningsRegex) {
    // ...find first element that doesn't contain banned words ...
    meaning = strArr.find(
        (str) => str && !bannedInMeaningsRegex.test(str));
    
  } else {
    // ... else, find first element that isn't empty.
    meaning = strArr.find((str) => str);
  }
  
  return meaning;
}


/* Encapsulates the querying process. Change this if you want to use another 
 * dictionary API. The implementation depends on used API. */
async function queryDictAPI(str) {
  const url = 
      'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(str);
  
  const init = {
    method: 'GET'
  };
  
  const response = await fetch(url, init);
  const data = await response.json();
  
  if (!data.length) {
    throw new Error("API response data is empty.");
  }
  
  const json = data[0];
  
  if (!json.meanings.length) {
    throw new Error("Response doesn't contain meanings.");
  }
  
  // The filter is applied here, to affect redirections by inflections, too.
  if (isEntryWordBanned(json.word)) {
    throw new Error(`'${json.word}' was banned by user.`);
  }
  
  // Extract all the meanings for filtering.
  const meanings = json.meanings.map(
      (m) => m.definitions[0].definition);
  
  const validatedMeaning = getValidatedMeaning(meanings);
  
  if (!validatedMeaning) {
    throw new Error("All meanings failed validation.");
  }
  
  return {
    entryWord: json.word, 
    meaning: validatedMeaning
  };
}


async function onMessage(msg) {
  if (isBlocked) {
    //console.log("Widget is currently blocked.");
    return;
  }
  
  if (cooldown.isActive()) {
    //console.log("Cooldown is still running.");
    return;
  }
  
  // Blocked users are rejected.
  if (msg.usernameOnList(blockedUsers)) {
    //console.log(`'${msg.username}' is on blocked users list.`);
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
    
    try {
      const response = await queryDictAPI(subStr);
      
      cooldown.activate();
      
      await publishResponse(response.entryWord, response.meaning);
      
    } catch (err) {
      console.log(err.message);
      
    } finally {
      isBlocked = false;
    }
  }
}
