/**
 * This widget displays a dictionary definition for a given command parameter.
 * 
 * Special thanks to jevvv and c4ldas.
 */


let triggerPhrases;                 // Commands, each with an appended whitespace.
let maxPhraseLength;                // Length of the longest trigger phrase.
let isUsableByEveryone;             // If true, everyone can trigger the widget.
let isUsableByMods;                 // See above and adapt.
let otherUsers;                     // Those users can trigger the widget, too.
let blockedUsers;                   // Those users are ignored by the widget.
let displayMillis;                  // Time a single meaning is displayed.
let transitionMillis;               // Time it takes for a in between transition.
let bannedEntryWords;               // Don't show definitions for those words.
let validateMeaning;                // Function that searches for bannend words.
let upperBound_partOfSpeech;        // This many categories are displayed.
let upperBound_meaning;             // This many meanings per category are displayed.

let timeoutId_windup = null;        // Used to cancel remaining out animations.
let timeoutId_meaning = null;       // Used to cancel remaining in between transitions.

let isBlocked = true;               // Blocks the widget when busy.


/* Triggers CSS animations by adding animate.css classes. Their effect is 
 * sustained as long as they're attached to the element. Therefore, they are 
 * only removed to immediately replace them with other animate.css classes. */
function animateCss(node, animationName, duration = 1, prefix = 'animate__') {
  // animate.css classes do have a prefix (since version 4.0).
  const envCls = `${prefix}animated`;
  const animationCls = `${prefix}${animationName}`;
  
  // Remove all applied animate.css classes.
  node.className = node.className
      .split(" ")
      .filter((cls) => !cls.startsWith(prefix))
      .join(" ");
  
  // Promise resolves when animation has ended.
  return new Promise((resolve, reject) => {
    node.addEventListener('animationend', (event) => {
      event.stopPropagation();
      resolve('Animation ended');
    }, {once: true});
    
    node.style.setProperty('--animate-duration', `${duration}s`);
    node.classList.add(envCls, animationCls);       // Starts CSS animation.
  });
}


// Promisifies the EventListener for 'transitionend'.
function transformTo(elmnt, transformStr) {
  return new Promise((resolve, reject) => {
    if (elmnt.style.transform != transformStr) {
      elmnt.addEventListener('transitionend', () => {
        resolve(true);
      }, {once: true});
      
      elmnt.style.transform = transformStr;
    } else {
      resolve(false);
    }
  });
}


// Defines behavior for the dictionary-entry HTML element.
const dictEntry = {
  // HTML elements.
  containerElmnt: document.getElementById("dictionary-entry"), 
  upperBlockElmnt: document.getElementById("upper-block"), 
  entryWordElmnt: document.getElementById("entry-word"), 
  pronunciationElmnt: document.getElementById("pronunciation"), 
  lowerBlockElmnt: document.getElementById("lower-block"), 
  partOfSpeechElmnt: document.getElementById("part-of-speech"), 
  meaningElmnt: document.getElementById("meaning"), 
  
  // animate.css stuff
  inAnimation_name: "", 
  inAnimation_secs: 0, 
  outAnimation_name: "", 
  outAnimation_secs: 0, 
  
  isVisible: false, 
  
  async showEntry() {
    if (!this.isVisible) {
      this.isVisible = true;
      
      await animateCss(
          this.containerElmnt, this.inAnimation_name, this.inAnimation_secs);
    }
  }, 
  
  async hideEntry() {
    if (this.isVisible) {
      this.isVisible = false;
      
      await animateCss(
          this.containerElmnt, this.outAnimation_name, this.outAnimation_secs);
    }
  }, 
  
  async expandLowerBlock() {
    await transformTo(this.lowerBlockElmnt, "scaleY(1)");
  }, 
  
  async shrinkLowerBlock() {
    await transformTo(this.lowerBlockElmnt, "scaleY(0)");
  }, 
  
  async change(word, pronunciation, partOfSpeech, meaning) {
    await this.hideEntry();
    
    this.entryWordElmnt.innerHTML = word;
    this.pronunciationElmnt.innerHTML = pronunciation;
    this.partOfSpeechElmnt.innerHTML = partOfSpeech;
    this.meaningElmnt.innerHTML = meaning;
    
    await this.showEntry();
  }, 
  
  async swapMeaning(partOfSpeech, meaning) {
    await this.shrinkLowerBlock();
    
    this.partOfSpeechElmnt.innerHTML = partOfSpeech;
    this.meaningElmnt.innerHTML = meaning;
    
    await this.expandLowerBlock();
  }
};


async function changeEntry(word, pronunciation, contents) {
  // Get rid of any existing timeouts, since the display time gets restarted.
  if (timeoutId_windup) {
    clearTimeout(timeoutId_windup);
    timeoutId_windup = null;
  }
  
  if (timeoutId_meaning) {
    clearTimeout(timeoutId_meaning);
    timeoutId_meaning = null;
  }
  
  // Display first meaning.
  await dictEntry.change(
      word, pronunciation, contents[0].partOfSpeech, contents[0].meaning);
  
  // Get rid of first element (since it is already displayed).
  const otherContents = contents.slice(1);
  
  const overall_millis = 
      (displayMillis * contents.length) + 
      (transitionMillis * otherContents.length);
  
  // The time of hiding is calculated and set in advance.
  timeoutId_windup = setTimeout(async () => {
    await dictEntry.hideEntry();
    timeoutId_windup = null;
  }, overall_millis);
  
  // Show remaining meanings, one after the other.
  if (otherContents.length) {
    const iter = otherContents[Symbol.iterator]();
    
    async function timeoutFunc() {
      const result = iter.next();
      
      timeoutId_meaning = null;
      
      // If there are meanings left, display the next one and spawn a new timeout.
      if (!result.done) {
        const nextElmnt = result.value;
        
        await dictEntry.swapMeaning(
            nextElmnt.partOfSpeech, nextElmnt.meaning);
        
        // Ensures that there wasn't another timeout spawned, while waiting.
        if (!timeoutId_meaning) {
          timeoutId_meaning = setTimeout(timeoutFunc, displayMillis);
        }
      }
    }
    
    timeoutId_meaning = setTimeout(timeoutFunc, displayMillis);
  }
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


function activateTestMode(hasColorizedSegments) {
  // Make it easier to understand behavior by colorizing elements.
  if (hasColorizedSegments) {
    dictEntry.upperBlockElmnt.style.backgroundColor = "#92DE8B";
    dictEntry.pronunciationElmnt.style.backgroundColor = "#F99BE4";
    dictEntry.partOfSpeechElmnt.style.backgroundColor = "#B16FFB";
    dictEntry.meaningElmnt.style.backgroundColor = "#FB836F";
  }
  
  // Content of mock-up entry.
  const mockUpContents = [
    {
      partOfSpeech: "noun", 
      meaning: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    }, {
      partOfSpeech: "noun", 
      meaning: "Odio eu feugiat pretium nibh ipsum consequat nisl. Vel elit scelerisque mauris pellentesque pulvinar pellentesque habitant. Scelerisque in dictum non consectetur a erat. Tempus imperdiet nulla malesuada pellentesque elit. Platea dictumst quisque sagittis purus. Ipsum nunc aliquet bibendum enim facilisis gravida neque convallis a. In hendrerit gravida rutrum quisque non tellus orci ac. Nibh tellus molestie nunc non blandit massa enim nec. Ac tortor vitae purus faucibus ornare suspendisse. Eget sit amet tellus cras adipiscing enim."
    }, {
      partOfSpeech: "noun", 
      meaning: "Dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    }, {
      partOfSpeech: "verb", 
      meaning: "Sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet."
    }, {
      partOfSpeech: "adjective", 
      meaning: "Faucibus a pellentesque sit amet porttitor. Pellentesque habitant morbi tristique senectus. Elit eget gravida cum sociis natoque. Aliquam sem fringilla ut morbi. Dictumst quisque sagittis purus sit. Volutpat odio facilisis mauris sit amet massa vitae. Hac habitasse platea dictumst quisque sagittis. Eget arcu dictum varius duis at. Nisl tincidunt eget nullam non nisi est sit amet. Est ante in nibh mauris cursus mattis molestie a iaculis."
    }
  ];
  
  changeEntry(
      "Lorem Ipsum", "/ˌlɔː.ɹəm ˈɪp.səm/", filterAndLimitContents(mockUpContents));
}


function onWidgetLoad(obj) {
  const fieldData = obj.detail.fieldData;
  
  // Makes it easier for the user to look up the widget version.
  console.log(`Initialize ${fieldData.widgetName} (v${fieldData.widgetVersion}).`);
  
  if (!fieldData.commandText) {
    //console.log("Deactivate widget: no primary command phrase defined.");
    return;
  }
  
  /* A space is appended to ignore invocations without parameters (twitch cuts 
   * off trailing whitespace). */
  triggerPhrases = [
    // Primary trigger phrase.
    fieldData.commandText.toLowerCase() + " ", 
    
    // Other trigger phrases.
    ...fieldData.commandAliases
        .toLowerCase()
        .split(",")
        .map((s) => s.trim())
        .filter((s) => (s !== ''))
        .map((s) => (s + " "))
  ];
  
  /* When a chat msg is posted, only this many chars are initially processed to 
   * check if the widget is triggered. */
  maxPhraseLength = triggerPhrases
      .reduce((a, b) => (a.length > b.length) ? a : b, "")
      .length;
  
  isUsableByEveryone = (fieldData.permissionLvl === 'everyone');
  isUsableByMods = (fieldData.permissionLvl === 'mods');
  
  // Usernames cannot contain spaces, therefore they are not taken into account.
  otherUsers = fieldData.otherUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");
  
  blockedUsers = fieldData.blockedUsers
      .replace(/\s/g, '')
      .toLowerCase()
      .split(",");
  
  cooldown.cooldownMillis = fieldData.cooldown * 1000;
  displayMillis = fieldData.displayDuration_meaning * 1000;
  transitionMillis = fieldData.transitionDuration_meaning * 1000 * 2;
  
  // Sets values, since there is no constructor definition in object literals.
  dictEntry.inAnimation_name = fieldData.animationIn_general;
  dictEntry.inAnimation_secs = fieldData.timeIn_general;
  dictEntry.outAnimation_name = fieldData.animationOut_general;
  dictEntry.outAnimation_secs = fieldData.timeOut_general;
  
  // Modified splitting procedure to allow spaces in multi-word elements.
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
     * words are ignored this way. */
    const reStr = "\\b(" + bannedWordsInMeanings.join('|') + ")\\b";
    
    /* If any of the banned words is contained in the string to be tested, this 
     * is interpreted as a match later on. */
    const bannedInMeaningsRegex = new RegExp(reStr, 'i');
    
    validateMeaning = (s) => s && !bannedInMeaningsRegex.test(s);
    
  } else {
    // Ignores empty meanings.
    validateMeaning = (s) => s;
  }
  
  // Zero will result in the biggest number.
  upperBound_partOfSpeech = fieldData.limitPartOfSpeech || Infinity;
  upperBound_meaning = fieldData.limitMeanings || Infinity;
  
  if (fieldData.testMode === 'on') {
    activateTestMode(fieldData.hasColorizedSegments);
  }
  
  /* This two-step approach was chosen to prevent flickering during initialization.
   * If the animate.css class is already set in the HTML, the corresponding 
   * animation seems to play with its regular duration? (Therefore the 0s duration 
   * here.) */
  animateCss(dictEntry.containerElmnt, fieldData.animationOut_general, 0);
  dictEntry.containerElmnt.classList.remove("invisible");
  
  isBlocked = false;
}


function isEntryWordBanned(str) {
  return bannedEntryWords.includes(str.toLowerCase());
}


function filterAndLimitContents(contents) {
  const arr = [];
  
  const counters = {};
  counters._categories = 0;
  counters._sum = 0;
  
  const maxSum = upperBound_partOfSpeech * upperBound_meaning;
  
  for (const c of contents) {
    // Ignore meanings that contain bannend words.
    if (!validateMeaning(c.meaning)) continue;
    
    // Convert the part of speech to an alphanumerical representation.
    const alphanumericalKey = c.partOfSpeech
      .toLowerCase()
      .replace(/\W/g, (s) => s.charCodeAt(0).toString(16));
    
    /* Is placed after the content check to ensure that "empty" categories are 
     * ignored. "Empty" can also mean, that all meanings contain banned words. */
    if (!Object.hasOwn(counters, alphanumericalKey)) {
      if (counters._categories >= upperBound_partOfSpeech) continue;
      
      // Initialize counter variable for new category.
      counters[alphanumericalKey] = 0;
      counters._categories += 1;
    }
    
    if (counters[alphanumericalKey] >= upperBound_meaning) continue;
    
    arr.push(c);
    
    counters[alphanumericalKey] += 1;
    counters._sum += 1;
    
    // If all counters have reached their limit, there is no need to proceed.
    if (counters._sum >= maxSum) break;
  }
  
  return arr;
}


/* Encapsulates the querying process. Change this if you want to use another 
 * dictionary API. The implementation depends on the API used. */
async function queryDictAPI(str) {
  const url = 
      'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(str);
  
  const init = {
    method: 'GET'
  };
  
  const response = await fetch(url, init);
  const data = await response.json();
  
  if (!Array.isArray(data) || !data.length) {
    throw new Error("API response data is empty.");
  }
  
  const contents = [];
  
  for (const obj of data) {
    // The filter is applied here, to affect redirections by inflections, too.
    if (isEntryWordBanned(obj.word)) {
      throw new Error(`'${obj.word}' was banned by user.`);
    }
    
    for (const m of obj.meanings) {
      for (const d of m.definitions) {
        contents.push({
          partOfSpeech: m.partOfSpeech, 
          meaning: d.definition
        });
      }
    }
  }
  
  const filteredAndLimitedContent = filterAndLimitContents(contents);
  
  if (!filteredAndLimitedContent.length) {
    throw new Error("All meanings failed validation.");
  }
  
  return {
    entryWord: data[0].word, 
    pronunciation: data[0].phonetic, 
    contents: filteredAndLimitedContent
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
    const shortenedMsg = msg.text
        .substring(0, maxPhraseLength)
        .toLowerCase();
    
    // Holds the trigger phrase that matched.
    const usedPhrase = triggerPhrases.find((s) => shortenedMsg.startsWith(s));
    
    if (!usedPhrase) return;
    
    isBlocked = true;
    
    /* Now that it's established that the chat message begins with some trigger 
     * phrase and that the user is allowed to use the command, the whole message 
     * can be processed. The trigger phrase is cut off, to allow for white space 
     * in it. */
    const subStr = msg.text
        .substring(usedPhrase.length)
        .toLowerCase();
    
    try {
      const response = await queryDictAPI(subStr);
      
      cooldown.activate();
      
      await changeEntry(
          response.entryWord, response.pronunciation, response.contents);
      
    } catch (err) {
      console.log(err.message);
      
    } finally {
      isBlocked = false;
    }
  }
}
