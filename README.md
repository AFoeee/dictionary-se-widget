# Dictionary Widget
This StreamElements custom widget displays a dictionary definition for a given command parameter.  

Special thanks to jevvv and c4ldas.  


## Description of operation:  
The widget serves as a front-end to a dictionary API (default is the [Free Dictionary API](https://dictionaryapi.dev/)).  
If you want to use another API, take a look at `queryDictAPI()` in the JavaScript file.  


## Chat command types:  
 - `!dict WORD`  
   
   Queries the API for a definition of the provided `WORD` and publishes the response.  


## Used libraries:  
 - [Reboot0's Widget Tools](https://reboot0-de.github.io/se-tools/index.html)  
 - [animate.css](https://github.com/animate-css/animate.css)
