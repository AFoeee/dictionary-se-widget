# Dictionary Widget
This StreamElements custom widget displays a dictionary definition for a given command parameter.  

Special thanks to jevvv and c4ldas.  


## Description of operation:  
The widget serves as a front-end to a dictionary API (default is the [Free Dictionary API](https://dictionaryapi.dev/)).  
If you want to use another API, take a look at `queryDictAPI()` in the JavaScript file.  

Responses can either be displayed in the overlay or posted to the twitch chat.  


## Chat command types:  
 - `!dict WORD`  
   
   Queries the API for a definition of the provided `WORD` and publishes the response.  
