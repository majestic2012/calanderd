function extractFrequency(textToMatch) {
    var re1 = '.*?'; // Non-greedy match on filler
    var re2 = '([+-]?\\d*\\.\\d+)(?![-+0-9\\.])'; // Float 1

    var floatExp = new RegExp(re1 + re2, ["i"]);
    //console.log(floatExp.toString());
    var floatResult = floatExp.exec(textToMatch);
    if (floatResult != null) {
        var float1 = floatResult[1];
        return float1;
        //console.log("(" + float1.replace(/</, "&lt;") + ")" + "\n");
    }

    var re3 = '.*?'; // Non-greedy match on filler
    var re4 = '\\d+'; // Uninteresting: int
    var re5 = '.*?'; // Non-greedy match on filler
    var re6 = '(\\d+)'; // Integer Number 1

    var integerExp = new RegExp(re3 + re4 + re5 + re6, ["i"]);
    var integerResult = integerExp.exec(textToMatch);
    if (integerResult != null) {
        var int1 = integerResult[1];
        //console.log("(" + int1.replace(/</, "&lt;") + ")" + "\n");
        return int1;
    }
}

function httpGet(theUrl)
{
    var xmlHttp = null;

    xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false );
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

Date.prototype.addDays = function(days)
{
    var dat = new Date(this.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
}

Date.daysBetween = function( date1, date2 ) {
  //Get 1 day in milliseconds
  var one_day=1000*60*60*24;

  // Convert both dates to milliseconds
  var date1_ms = date1.getTime();
  var date2_ms = date2.getTime();

  // Calculate the difference in milliseconds
  var difference_ms = date2_ms - date1_ms;
  //take out milliseconds
  difference_ms = difference_ms/1000;
  var seconds = Math.floor(difference_ms % 60);
  difference_ms = difference_ms/60; 
  var minutes = Math.floor(difference_ms % 60);
  difference_ms = difference_ms/60; 
  var hours = Math.floor(difference_ms % 24);  
  var days = Math.floor(difference_ms/24);
  
  return days + 'd, ' + hours + 'h, ' + minutes + 'm, and ' + seconds + 's';
}

var now = new Date();
var numberOfDaysToFetch = 1;
var endDate = now.addDays(numberOfDaysToFetch);

function getCalendarEvents()
{
  json=httpGet("https://www.googleapis.com/calendar/v3/calendars/us9gvp2nqjuf4nk4df49sfji4o@group.calendar.google.com/events?orderBy=startTime&singleEvents=true&timeMax=" + endDate.toISOString() + "&timeMin=" + now.toISOString() + 
  "&fields=items(start%2Csummary)%2Csummary&key=AIzaSyCobUsCNLg2lIsBlKYtbeHsAaN_X2LjwV0");

  // Parse the data that we got back from the calendar call
  obj = JSON.parse(json);
  return obj;
}

function writeSummaryInformation()
{
  console.log(obj.summary);
  console.log("Grabbing events from " + now.toISOString() + " to " + endDate.toISOString());
  console.log("Number of events found: " + obj.items.length);
  console.log("Time of first event: " + obj.items[0].start.dateTime);
}


function parseEvents()
{
//var slightFuture = new Date();
//slightFuture.setSeconds(now.getSeconds() + 20);
//var json = '{"summary": "TEST SUMMARY", "items": [{"summary": "TEST EVENT", "start": {"dateTime": "' + slightFuture.toISOString() + '"}}, {"summary": "TEST EVENT2", "start": {"dateTime": "2014-01-26T21:00:00Z"}}]}';
//var obj = JSON.parse(json);

  var events = [];
  var obj = getCalendarEvents();
  for (var i = 0; i < obj.items.length; i++)
  {
      var title = obj.items[i].summary;
      var time = obj.items[i].start.dateTime;
      var eventDate = new Date(time);
      //console.log(time + " ** " + title + "- " + Date.daysBetween(now, eventDate));
      var frequency = extractFrequency(title);
      var theEvent = {"eventDate":eventDate, "title":title, "frequency":frequency};
      events.push(theEvent);    
  }
  return events;
}

function getNextEvent(events)
{
  //debugger; 
  var eventToCheck = events[0];
  while(eventToCheck != null && eventToCheck.eventDate < new Date())
  {
    //console.log("Removing event.");
    events.shift();
    eventToCheck = events[0];
  }

  var nextEvents = [];
  var prevEvent;

  for(i = 0; i < events.length; i++)
  {
     var thisEvent = events[i];
     if(prevEvent == null) { prevEvent = thisEvent; nextEvents.push(prevEvent); continue;}
     
     if(prevEvent.eventDate.toISOString() == thisEvent.eventDate.toISOString()) 
	{nextEvents.push(thisEvent);}
     else {break;}
  }

  // TODO: Get the next few events?
  var returnVal = "";
  for(var eventId = 0; eventId < nextEvents.length; eventId++)
  {
    var frequency = nextEvents[eventId].frequency;
    returnVal += nextEvents[eventId].title + " in " + Date.daysBetween(new Date(), nextEvents[eventId].eventDate) + ". <a href=javascript:set_mode(\'USB\');setfreqb(" + frequency + ")>Tune</a>";
  }
  
  return returnVal;

}