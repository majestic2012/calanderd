// (c) totoCZ 2014, Pierre Ynard 2016
// Original events.js code written by foo.
// GPL 3+

var events = [];

function extractFrequency(textToMatch) {
    var digitsRe = '([0-9]*k|[0-9]* k)';
    var exp = new RegExp(digitsRe);
    var expResult = exp.exec(textToMatch);
  
    if (expResult !== null) {
      expResult = expResult[0].substring(0, expResult[0].length - 1);
      return expResult;
    }
}

function getEvents(refresh) {
  var json = null;
  if ((! refresh) && typeof(Storage) !== 'undefined') {
    json = localStorage.getItem("events");
  }
  if (json === null) {
    var calanderUrl = "https://www.googleapis.com/calendar/v3/calendars/ul6joarfkgroeho84vpieeaakk@group.calendar.google.com/events?orderBy=startTime&singleEvents=true&timeMin=" + (new Date()).toISOString() +
    "&fields=items(start%2Csummary)%2Csummary&key=AIzaSyARkBX_t1JfOEVk0caNk7tf5HpNIEVdcU4&maxResults=150";
  
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", calanderUrl, false);
    xmlHttp.send(null);  
    
    json = xmlHttp.responseText;
    
    if (typeof(Storage) !== 'undefined') {
      localStorage.setItem("events", json);
    }
  }
  
  var obj = JSON.parse(json);
  events = obj.items.map(function(evt) {
    var title = evt.summary;
    var time = evt.start.dateTime;
    var eventDate = new Date(time);
    var frequency = extractFrequency(title);
    return ({
      "eventDate": eventDate,
      "title": title,
      "frequency": frequency
    });
  });
}

function getNextEvent() {

  var eventToCheck = events[0];
  while (eventToCheck != null && eventToCheck.eventDate < new Date()) {
    events.shift();
    eventToCheck = events[0];
  }
  
  var nextEvents = [];
  var prevEvent;

  for (i = 0; i < events.length; i++) {
    var thisEvent = events[i];
    if (prevEvent == null) {
      prevEvent = thisEvent;
      nextEvents.push(prevEvent);
      continue;
    }
    
    if (prevEvent.eventDate.toISOString() == thisEvent.eventDate.toISOString()) {
       nextEvents.push(thisEvent);
    } else {
       break;
    }
  }

  return nextEvents;
}

function printEvents(nextEvents) {
  var next = moment(nextEvents[0].eventDate);
  var header = "<h3>Next station " + next.fromNow() + "</h3>";

  var items = nextEvents.map(function(evt) {
    if (typeof evt.frequency !== 'undefined' && evt.frequency.length > 3) {
      return ("<li><a href='http://websdr.ewi.utwente.nl:8901/?tune=" + evt.frequency + "'>" + evt.title +"</a></li>");
    } else {
      return ("<li>" + evt.title + "</li>");
    }
  });

  return (header + "<ul>" + items.join("") + "</ul>");
}

function cmdNext() {
  var nextEvents = getNextEvent();
  
  if (events.length < 3) {
    getEvents(true);
    nextEvents = getNextEvent();
  }
  
  $("#events").html(nextEvents.length > 0 ? printEvents(nextEvents) : "");
}

$(document).ready(function() {
  getEvents(false);
  cmdNext();
  setInterval(cmdNext, 60 * 1000);
});
